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
 * "Olhar" não pede confirmação por passo (não mexe em nada), mas continua a
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

  setProvider(provider: VisionProvider | null): void {
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
    if (!this.provider) {
      return 'A visão de ecrã não está configurada — escolhe um modelo de visão em Privacidade → Controlo.';
    }
    if (!this.provider.isConfigured()) {
      return 'O modelo de visão não está configurado — define-o em Privacidade → Controlo.';
    }

    const adapter = getPlatformAdapter();
    const zones: readonly ScreenRect[] = useSensitiveZonesStore
      .getState()
      .zones.map(({ x, y, width, height }) => ({ x, y, width, height }));

    const image = await adapter.captureScreen(zones);
    if (image === null) {
      return 'Não consegui capturar o ecrã — esta plataforma não o permite.';
    }

    try {
      return await this.provider.describe(image);
    } catch (error) {
      const failure = error instanceof AiFailure ? error : new AiFailure('rede');
      const causa = this.provider.isRemote
        ? 'O print foi enviado, mas o modelo remoto falhou.'
        : 'O modelo local falhou — confirma que o Ollama está a correr e que o modelo de visão está instalado (ollama pull).';
      return `Não consegui interpretar o ecrã: ${failure.message}. ${causa}`;
    }
  }
}

export const visionService = new VisionService();
