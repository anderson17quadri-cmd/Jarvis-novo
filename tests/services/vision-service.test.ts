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

  it('captura o ecrã com o controlo direto ligado e sessão ativa', async () => {
    const { visionService } = await import('@/services/vision/vision-service');
    const { directControlService } = await import('@/services/direct-control-service');

    directControlService.setEnabled(true);
    directControlService.startSession();
    visionService.setProvider({
      id: 'claude',
      name: 'Claude',
      isConfigured: () => true,
      isRemote: true,
      describe: async () => 'Uma janela do Bloco de Notas.',
    });

    const result = await visionService.describeScreen();

    expect(captureScreen).toHaveBeenCalledTimes(1);
    expect(result).toBe('Uma janela do Bloco de Notas.');
  });
});
