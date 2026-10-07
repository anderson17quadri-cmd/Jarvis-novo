import { getPlatformAdapter } from '@/platform';
import { directControlService } from '@/services/direct-control-service';
import { useSensitiveZonesStore } from '@/stores/use-sensitive-zones-store';
import type { ScreenRect } from '@/types/screen-zone';
import { AiFailure } from '@/types/ai-failure';
import type { VisionProvider } from './vision-provider';

/**
 * Visão de ecrã (Fase 3.5).
 *
 * Junta as três peças que não deviam saber umas das outras: captura o print
 * pelo adapter (já tapado das zonas sensíveis), manda-o ao provedor de visão, e
 * devolve a descrição a quem pediu — a ferramenta `ver_ecra`, hoje.
 *
 * O print **nunca** passa por aqui por descoberto: o tapar acontece no Rust
 * (`capture_screen` recebe as zonas e devolve o PNG já tapado), e as zonas vêm
 * da store. A interface e este serviço só alguma vez veem a versão tapada.
 *
 * **A porta de presença (`docs/spec/fase-3-controlo-direto.md` §1, §2) vive
 * aqui, não só nas ações.** As zonas sensíveis tapam só o que a pessoa marcou
 * — o resto do ecrã continua a sair da máquina se o provedor for remoto.
 * A primeira captura pede autorização para este provedor e sessão, e continua a
 * exigir o mesmo que abrir o Controlo Direto exige para tudo o resto: o
 * interruptor ligado e uma sessão de presença ativa. Sem isto, um print do
 * ecrã — senhas, conversas, saldos — podia viajar para a nuvem mesmo com o
 * Controlo Direto desligado por omissão.
 *
 * Nunca lança: uma falha do provedor vira uma frase que o modelo pode dizer à
 * pessoa, não uma exceção a rebentar o pedido do assistente.
 */

class VisionService {
  private provider: VisionProvider | null = null;
  private authorized: { token: number; provider: VisionProvider } | null = null;
  private consent: { token: number; provider: VisionProvider; resolve: (allowed: boolean) => void;
    promise: Promise<boolean>; timer: ReturnType<typeof setTimeout> } | null = null;
  private readonly listeners = new Set<() => void>();

  constructor() {
    directControlService.subscribe(() => {
      if (directControlService.sessionToken !== this.authorized?.token || directControlService.isSimulated) {
        this.authorized = null;
      }
      if (this.consent && (directControlService.sessionToken !== this.consent.token || directControlService.isSimulated)) {
        this.answerConsent(false);
      }
    });
  }

  get pendingConsent(): { readonly provider: VisionProvider } | null { return this.consent; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  answerConsent(allowed: boolean): void {
    const consent = this.consent;
    if (!consent) return;
    this.consent = null;
    clearTimeout(consent.timer);
    const valid = allowed && directControlService.sessionToken === consent.token &&
      !directControlService.isSimulated && this.provider === consent.provider;
    if (valid) this.authorized = { token: consent.token, provider: consent.provider };
    consent.resolve(valid);
    for (const listener of this.listeners) listener();
  }

  private requestConsent(token: number, provider: VisionProvider): Promise<boolean> {
    if (this.authorized?.token === token && this.authorized.provider === provider) return Promise.resolve(true);
    if (this.consent?.token === token && this.consent.provider === provider) return this.consent.promise;
    this.answerConsent(false);
    let resolve!: (allowed: boolean) => void;
    const promise = new Promise<boolean>(done => { resolve = done; });
    const timer = setTimeout(() => this.answerConsent(false), Math.min(60_000, directControlService.sessionRemainingSeconds * 1000));
    this.consent = { token, provider, resolve, promise, timer };
    for (const listener of this.listeners) listener();
    return promise;
  }

  setProvider(provider: VisionProvider | null): void {
    this.answerConsent(false);
    this.authorized = null;
    this.provider = provider;
  }

  get isConfigured(): boolean {
    return this.provider?.isConfigured() ?? false;
  }

  async describeScreen(): Promise<string> {
    if (!directControlService.isEnabled) {
      return 'O controlo direto está desligado — liga-o em Privacidade antes de eu poder ver o ecrã.';
    }
    if (!directControlService.sessionActive) {
      return 'Não há uma sessão de controlo direto ativa — abre uma em Privacidade ou diz a palavra-passe.';
    }
    // O modo simulado promete, por palavras na Privacidade, que as ações
    // "nunca executam a sério — é para testar o fluxo sem risco". Olhar para o
    // ecrã não passa pelo `executeStep`, por isso escapava a essa promessa: em
    // modo simulado, um print real do ecrã seguia à mesma para o modelo (e,
    // com o provedor Claude, para fora da máquina). Testar o fluxo não pode
    // ser a coisa que expõe o ecrã.
    if (directControlService.isSimulated) {
      return 'O controlo direto está em modo simulado — não tiro prints do ecrã a sério. Desliga o modo simulado em Privacidade para eu poder olhar.';
    }
    if (!this.provider) {
      return 'A visão de ecrã não está configurada — escolhe um modelo de visão em Privacidade → Controlo.';
    }
    if (!this.provider.isConfigured()) {
      return 'O modelo de visão não está configurado — define-o em Privacidade → Controlo.';
    }

    const provider = this.provider;
    const token = directControlService.sessionToken;
    if (token === null || !(await this.requestConsent(token, provider))) {
      return 'A captura do ecrã não foi autorizada nesta sessão.';
    }
    if (directControlService.sessionToken !== token || directControlService.isSimulated || this.provider !== provider) {
      return 'A sessão mudou antes da captura — o pedido foi cancelado.';
    }
    const adapter = getPlatformAdapter();
    const zones: readonly ScreenRect[] = useSensitiveZonesStore
      .getState()
      .zones.map(({ x, y, width, height }) => ({ x, y, width, height }));

    const image = await adapter.captureScreen(zones);
    if (directControlService.sessionToken !== token || directControlService.isSimulated || this.provider !== provider) {
      return 'A sessão mudou antes do envio — o print foi descartado.';
    }
    if (image === null) {
      return 'Não consegui capturar o ecrã — esta plataforma não o permite.';
    }

    try {
      return await provider.describe(image);
    } catch (error) {
      const failure = error instanceof AiFailure ? error : new AiFailure('rede');
      const causa = provider.isRemote
        ? 'O print foi enviado, mas o modelo remoto falhou.'
        : 'O modelo local falhou — confirma que o Ollama está a correr e que o modelo de visão está instalado (ollama pull).';
      return `Não consegui interpretar o ecrã: ${failure.message}. ${causa}`;
    }
  }
}

export const visionService = new VisionService();
