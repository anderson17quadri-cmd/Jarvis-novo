import { describe, expect, it } from 'vitest';

import { readDiagnostics } from '@/services/diagnostics';
import { fpsMeter } from '@/services/fps-meter';

/**
 * O FPS dentro do diagnóstico (Parte 16 §Desempenho).
 *
 * O medidor já se testa sozinho; isto só prova que `readDiagnostics` lê o
 * mesmo sítio, e não uma cópia que possa divergir.
 */
describe('readDiagnostics inclui o fps', () => {
  it('sem ninguém a observar o medidor, o diagnóstico diz null e não zero', () => {
    expect(readDiagnostics().fps).toBeNull();
  });

  it('com o medidor a correr, o diagnóstico acaba por refletir o valor', async () => {
    const stop = fpsMeter.start();

    await new Promise((resolve) => setTimeout(resolve, 1_100));

    expect(readDiagnostics().fps).toBe(fpsMeter.current);
    expect(readDiagnostics().fps).toBeGreaterThan(0);

    stop();
  }, 5_000);
});
