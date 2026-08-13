import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O cofre do desktop (`TauriAdapterBase.secretSet/secretDelete`) e a verdade
 * do que devolve. `secret_set`/`secret_delete` no Rust devolvem `Result<()>`,
 * e o `Ok(())` serializa para `null` na interface — o mesmo valor que
 * `tryInvoke` devolve quando o comando falha. Estes testes prendem que o
 * booleano vem do "não lançou", não do valor devolvido: sem isto, o
 * `secretSet` devolveria `false` sempre, e o registo da chave física
 * (`webauthn-service.ts`) recusaria com "sem cofre" num desktop a sério.
 */

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock, convertFileSrc: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({}) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-store', () => ({ load: vi.fn() }));
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => 'windows',
  version: () => '11',
  arch: () => 'x64',
}));

import { DesktopAdapter } from '@/platform/desktop-adapter';

describe('o cofre do desktop distingue sucesso de falha', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('secretSet devolve true quando o comando Rust devolve Ok(())', async () => {
    invokeMock.mockResolvedValueOnce(null); // Result<()> chega como null
    const adapter = new DesktopAdapter();

    await expect(adapter.secretSet('deepseek-api-key', 'sk-x')).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('secret_set', { key: 'deepseek-api-key', value: 'sk-x' });
  });

  it('secretSet devolve false quando o comando falha', async () => {
    invokeMock.mockRejectedValueOnce(new Error('cofre indisponível'));
    const adapter = new DesktopAdapter();

    await expect(adapter.secretSet('deepseek-api-key', 'sk-x')).resolves.toBe(false);
  });

  it('secretDelete devolve true quando o comando devolve Ok(())', async () => {
    invokeMock.mockResolvedValueOnce(null);
    const adapter = new DesktopAdapter();

    await expect(adapter.secretDelete('deepseek-api-key')).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('secret_delete', { key: 'deepseek-api-key' });
  });

  it('secretDelete devolve false quando o comando falha', async () => {
    invokeMock.mockRejectedValueOnce(new Error('cofre indisponível'));
    const adapter = new DesktopAdapter();

    await expect(adapter.secretDelete('deepseek-api-key')).resolves.toBe(false);
  });

  it('secretGet devolve o segredo quando existe', async () => {
    invokeMock.mockResolvedValueOnce('sk-x');
    const adapter = new DesktopAdapter();

    await expect(adapter.secretGet('deepseek-api-key')).resolves.toBe('sk-x');
  });

  it('secretGet devolve null quando o comando falha (degradação)', async () => {
    invokeMock.mockRejectedValueOnce(new Error('cofre indisponível'));
    const adapter = new DesktopAdapter();

    await expect(adapter.secretGet('deepseek-api-key')).resolves.toBeNull();
  });
});
