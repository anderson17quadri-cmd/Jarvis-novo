import { afterEach, describe, expect, it, vi } from 'vitest';
import { readDiagnostics, refreshVoiceDiagnostics } from '@/services/diagnostics';
import { voiceService } from '@/services/voice-service';

afterEach(() => { vi.unstubAllGlobals(); voiceService.configureOpenAi(''); });
describe('diagnóstico independente da voz', () => {
  it('uma chave configurada não é apresentada como áudio verificado', () => {
    voiceService.configureOpenAi('chave-teste');
    const status = readDiagnostics().services.find(service => service.name === 'Voz OpenAI');
    expect(status?.state).toBe('por-verificar');
    expect(status?.detail).toContain('não testado');
  });
  it('a transcrição disponível não esconde uma falha no detetor local', async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith(':8091/health')) throw new Error('serviço desligado');
      return new Response(JSON.stringify({ ok: true, reconhecimento_disponivel: true, reconhecimento_carregado: false }));
    });
    vi.stubGlobal('fetch', fetch);
    await refreshVoiceDiagnostics();
    const statuses = readDiagnostics().services;
    expect(statuses.find(service => service.name === 'Transcrição local')?.state).toBe('configurado');
    expect(statuses.find(service => service.name === 'Detetor local')?.state).toBe('indisponível');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.every(([url]) => url.startsWith('http://127.0.0.1:'))).toBe(true);
  });
});
