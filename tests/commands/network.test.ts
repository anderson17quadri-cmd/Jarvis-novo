/** Testes do adaptador de rede para automações. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesktopAdapter } from '../../src/platform/desktop-adapter';

describe('networkMonitor', () => {
  let adapter: DesktopAdapter;

  beforeEach(() => {
    adapter = new DesktopAdapter();
  });

  it('capability está ligada no desktop', () => {
    expect(adapter.capabilities.networkMonitor).toBe(true);
  });

  it('getNetworkState devolve null quando o invoke falha (sem Rust)', async () => {
    // Em teste, o invoke não está disponível — deve devolver null graciosamente
    const result = await adapter.getNetworkState();
    expect(result).toBeNull();
  });

  it('watchNetwork devolve null quando o invoke falha (sem Rust)', async () => {
    const result = await adapter.watchNetwork();
    expect(result).toBeNull();
  });

  it('unwatchNetwork não rebenta quando o invoke falha', async () => {
    await expect(adapter.unwatchNetwork()).resolves.toBeUndefined();
  });

  it('onNetworkChanged devolve noop quando não há capacidade', async () => {
    const handler = vi.fn();
    const unlisten = await adapter.onNetworkChanged(handler);
    
    // Deve devolver uma função noop que não faz nada
    expect(typeof unlisten).toBe('function');
    
    // Chamar unlisten não deve rebentar
    await expect(unlisten()).resolves.toBeUndefined();
    
    // Handler nunca foi chamado
    expect(handler).not.toHaveBeenCalled();
  });
});
