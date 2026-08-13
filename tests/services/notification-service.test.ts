import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Notificações nativas (Parte 6 §Notificações), isoladas.
 *
 * Até agora só corriam de caminho, a cada arranque — nunca isoladas por
 * testar (SPEC.md). Duas partes: o pedido de permissão e o envio a sério ao
 * plugin nativo (`TauriAdapterBase.sendNativeNotification`, via
 * `DesktopAdapter`), e a decisão de quando o `NotificationService` chega a
 * chamá-lo (estado do sistema, `silent`).
 */

const plugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-notification', () => plugin);

// O resto do que o TauriAdapterBase importa não interessa a estes testes —
// mock mínimo para o módulo carregar em jsdom sem tentar falar com o Tauri.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({}) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-store', () => ({ load: vi.fn() }));
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => 'windows',
  version: () => '11',
  arch: () => 'x64',
}));

import { DesktopAdapter } from '@/platform/desktop-adapter';
import { NotificationService } from '@/services/notification-service';
import { useNotificationStore } from '@/stores/use-notification-store';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { SYSTEM_STATES } from '@/types/system-state';

describe('sendNativeNotification — o pedido a sério ao plugin', () => {
  beforeEach(() => {
    plugin.isPermissionGranted.mockReset();
    plugin.requestPermission.mockReset();
    plugin.sendNotification.mockReset();
  });

  it('com permissão já concedida, manda a notificação e diz que sim', async () => {
    plugin.isPermissionGranted.mockResolvedValue(true);
    const adapter = new DesktopAdapter();

    const ok = await adapter.sendNativeNotification('Título', 'Descrição');

    expect(ok).toBe(true);
    expect(plugin.sendNotification).toHaveBeenCalledWith({ title: 'Título', body: 'Descrição' });
    expect(plugin.requestPermission).not.toHaveBeenCalled();
  });

  it('sem permissão ainda, pede — e manda se for concedida', async () => {
    plugin.isPermissionGranted.mockResolvedValue(false);
    plugin.requestPermission.mockResolvedValue('granted');
    const adapter = new DesktopAdapter();

    const ok = await adapter.sendNativeNotification('Título', 'Descrição');

    expect(ok).toBe(true);
    expect(plugin.requestPermission).toHaveBeenCalledOnce();
    expect(plugin.sendNotification).toHaveBeenCalledWith({ title: 'Título', body: 'Descrição' });
  });

  it('permissão recusada — nunca chega a chamar sendNotification', async () => {
    plugin.isPermissionGranted.mockResolvedValue(false);
    plugin.requestPermission.mockResolvedValue('denied');
    const adapter = new DesktopAdapter();

    const ok = await adapter.sendNativeNotification('Título', 'Descrição');

    expect(ok).toBe(false);
    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it('o plugin a rebentar não crasha — devolve false com elegância', async () => {
    plugin.isPermissionGranted.mockRejectedValue(new Error('sem plugin registado'));
    const adapter = new DesktopAdapter();

    await expect(adapter.sendNativeNotification('Título', 'Descrição')).resolves.toBe(false);
  });
});

describe('NotificationService — quando chega a pedir a nativa', () => {
  let service: NotificationService;

  beforeEach(() => {
    plugin.isPermissionGranted.mockReset().mockResolvedValue(true);
    plugin.requestPermission.mockReset();
    plugin.sendNotification.mockReset();
    useNotificationStore.setState({ notifications: [] });
    useSystemStateStore.setState({ current: 'normal', definition: SYSTEM_STATES.normal });
    service = new NotificationService(new DesktopAdapter());
  });

  it('estado normal (toasts: todos): pede a nativa com o mesmo título e descrição do toast', async () => {
    const id = service.info('Backup feito', 'Guardado em Documentos.');

    await Promise.resolve();
    expect(plugin.sendNotification).toHaveBeenCalledWith({
      title: 'Backup feito',
      body: 'Guardado em Documentos.',
    });

    // O toast interno é o mesmo texto — nenhuma das duas inventa informação
    // que a outra não tem.
    const toast = useNotificationStore.getState().notifications.find((n) => n.id === id);
    expect(toast?.title).toBe('Backup feito');
    expect(toast?.description).toBe('Guardado em Documentos.');
  });

  it('silent: nunca pede a nativa, mesmo em estado normal', async () => {
    service.success('Guardado', 'Sem alarido.', { silent: true });

    await Promise.resolve();
    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it('Apresentação (toasts: nenhum): nem um erro interrompe', async () => {
    useSystemStateStore.setState({ definition: SYSTEM_STATES.apresentacao });

    service.error('Falhou', 'Algo correu mal.');

    await Promise.resolve();
    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it('Foco (toasts: urgentes): info fica em silêncio, erro passa', async () => {
    useSystemStateStore.setState({ definition: SYSTEM_STATES.foco });

    service.info('Chegou notícia', 'Nada de urgente.');
    await Promise.resolve();
    expect(plugin.sendNotification).not.toHaveBeenCalled();

    service.error('Falha grave', 'Isto é urgente.');
    await Promise.resolve();
    expect(plugin.sendNotification).toHaveBeenCalledWith({
      title: 'Falha grave',
      body: 'Isto é urgente.',
    });
  });

  it('uma notificação suprimida (não interrompe) fica dispensada no toast, não desaparecida da história', () => {
    useSystemStateStore.setState({ definition: SYSTEM_STATES.apresentacao });

    const id = service.info('Em segundo plano', 'Não interrompe.');

    const entry = useNotificationStore.getState().notifications.find((n) => n.id === id);
    expect(entry).toBeDefined();
    expect(entry?.isDismissed).toBe(true);
  });

  it('a nativa falhar (sem permissão) não apaga nem altera o toast', async () => {
    plugin.isPermissionGranted.mockResolvedValue(false);
    plugin.requestPermission.mockResolvedValue('denied');

    const id = service.warn('Aviso', 'Só o toast, sem nativa.');

    await Promise.resolve();
    const toast = useNotificationStore.getState().notifications.find((n) => n.id === id);
    expect(toast?.title).toBe('Aviso');
    expect(toast?.isDismissed).toBe(false);
  });
});
