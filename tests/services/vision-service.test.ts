import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Visão de ecrã (Fase 3.5) — a porta de presença.
 *
 * `capture_screen` tapa as zonas sensíveis, mas isso protege só o que a
 * pessoa marcou — o resto do ecrã (senhas não marcadas, conversas, saldos)
 * sai da máquina na mesma se a visão estiver ligada a um provedor remoto. A
 * spec (`docs/spec/fase-3-controlo-direto.md` §1, §2, §3) é categórica: a
 * camada de perceção vive **depois** da camada de presença — "sem isto, nada
 * corre" — e o Controlo Direto começa sempre desligado. `ver_ecra` não devia
 * conseguir tirar um print sem o interruptor de Privacidade ligado e sem uma
 * sessão de presença ativa, tal como `mover_rato`/`clicar_em`/`escrever_texto`
 * já exigem.
 */

const captureScreen = vi.fn(async () => 'base64png');

vi.mock('@/platform', () => ({
  getPlatformAdapter: () => ({ captureScreen }),
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('visionService.describeScreen — a porta de presença', () => {
  async function ready() {
    const { visionService } = await import('@/services/vision/vision-service');
    const { directControlService } = await import('@/services/direct-control-service');
    directControlService.setEnabled(true);
    directControlService.startSession();
    directControlService.setSimulated(false);
    const describe = vi.fn(async () => 'descrição');
    visionService.setProvider({ id: 'claude', name: 'Teste', isConfigured: () => true, isRemote: true, describe });
    return { visionService, directControlService, describe };
  }

  it('recusar a primeira captura não lê nem envia o ecrã', async () => {
    const { visionService, describe } = await ready();
    const pending = visionService.describeScreen();
    visionService.answerConsent(false);
    expect(await pending).toMatch(/não.*autorizada/i);
    expect(captureScreen).not.toHaveBeenCalled();
    expect(describe).not.toHaveBeenCalled();
  });

  it('autoriza só a sessão atual e volta a perguntar na sessão seguinte', async () => {
    const { visionService, directControlService } = await ready();
    const first = visionService.describeScreen();
    visionService.answerConsent(true);
    await first;
    await visionService.describeScreen();
    expect(captureScreen).toHaveBeenCalledTimes(2);
    directControlService.endSession();
    directControlService.startSession();
    const second = visionService.describeScreen();
    expect(visionService.pendingConsent).not.toBeNull();
    expect(captureScreen).toHaveBeenCalledTimes(2);
    directControlService.emergencyStop();
    await second;
    expect(visionService.pendingConsent).toBeNull();
  });

  it('descarta uma captura se a sessão terminar durante a leitura', async () => {
    const { visionService, directControlService, describe } = await ready();
    let resolve!: (image: string) => void;
    captureScreen.mockImplementationOnce(() => new Promise<string>(done => { resolve = done; }));
    const pending = visionService.describeScreen();
    visionService.answerConsent(true);
    await vi.waitFor(() => expect(captureScreen).toHaveBeenCalledTimes(1));
    directControlService.endSession();
    resolve('base64png');
    expect(await pending).toMatch(/descartad[oa]/i);
    expect(describe).not.toHaveBeenCalled();
  });
  it('recusa capturar o ecrã com o controlo direto desligado', async () => {
    const { visionService } = await import('@/services/vision/vision-service');
    const { directControlService } = await import('@/services/direct-control-service');

    directControlService.setEnabled(false);
    visionService.setProvider({
      id: 'claude',
      name: 'Claude',
      isConfigured: () => true,
      isRemote: true,
      describe: async () => 'descrição',
    });

    const result = await visionService.describeScreen();

    expect(captureScreen).not.toHaveBeenCalled();
    expect(result).toMatch(/desligado/);
  });

  it('recusa capturar o ecrã sem sessão de presença ativa', async () => {
    const { visionService } = await import('@/services/vision/vision-service');
    const { directControlService } = await import('@/services/direct-control-service');

    directControlService.setEnabled(true);
    visionService.setProvider({
      id: 'claude',
      name: 'Claude',
      isConfigured: () => true,
      isRemote: true,
      describe: async () => 'descrição',
    });

    const result = await visionService.describeScreen();

    expect(captureScreen).not.toHaveBeenCalled();
    expect(result).toMatch(/sessão/);
  });

  it('com o modo simulado ligado, não tira print nenhum', async () => {
    // A Privacidade promete, por palavras: "com o modo simulado ligado, as
    // ações de controlo direto aparecem no overlay de confirmação mas **nunca
    // executam a sério** — é para testar o fluxo sem risco". O `ver_ecra` não
    // passa pelo `executeStep`, por isso escapava a essa promessa: uma pessoa
    // a testar o fluxo "sem risco" mandava um print real do ecrã para a nuvem.
    const { visionService } = await import('@/services/vision/vision-service');
    const { directControlService } = await import('@/services/direct-control-service');

    directControlService.setEnabled(true);
    directControlService.startSession();
    directControlService.setSimulated(true);
    visionService.setProvider({
      id: 'claude',
      name: 'Claude',
      isConfigured: () => true,
      isRemote: true,
      describe: async () => 'descrição',
    });

    const result = await visionService.describeScreen();

    expect(captureScreen).not.toHaveBeenCalled();
    expect(result).toMatch(/simulado/i);
  });

  it('captura o ecrã com o controlo direto ligado e sessão ativa', async () => {
    const { visionService } = await import('@/services/vision/vision-service');
    const { directControlService } = await import('@/services/direct-control-service');

    directControlService.setEnabled(true);
    directControlService.startSession();
    directControlService.setSimulated(false);
    visionService.setProvider({
      id: 'claude',
      name: 'Claude',
      isConfigured: () => true,
      isRemote: true,
      describe: async () => 'Uma janela do Bloco de Notas.',
    });

    const pending = visionService.describeScreen();
    expect(captureScreen).not.toHaveBeenCalled();
    visionService.answerConsent(true);
    const result = await pending;

    expect(captureScreen).toHaveBeenCalledTimes(1);
    expect(result).toBe('Uma janela do Bloco de Notas.');
  });
});
