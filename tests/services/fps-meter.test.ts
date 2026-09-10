import { describe, expect, it } from 'vitest';

import { fpsMeter } from '@/services/fps-meter';

/**
 * Medidor de FPS (Parte 16 §Desempenho).
 *
 * "FPS fica para depois" — já não fica. `requestAnimationFrame` a sério corre
 * em jsdom, e é isso que se mede: o mecanismo, não um número realista de
 * monitor. O jsdom dispara frames a um ritmo próprio, sem ecrã nenhum a
 * limitar — a única coisa que interessa provar é a transição de "sem amostra"
 * para "com amostra", e de volta a "sem amostra" quando ninguém observa.
 */

describe('fpsMeter', () => {
  it('sem ninguém a observar, não há valor', () => {
    expect(fpsMeter.current).toBeNull();
  });

  it('ao fim de um segundo a observar, aparece um número', async () => {
    const stop = fpsMeter.start();

    await new Promise((resolve) => setTimeout(resolve, 1_100));

    expect(fpsMeter.current).not.toBeNull();
    expect(fpsMeter.current).toBeGreaterThan(0);

    stop();
  }, 5_000);

  it('quando o último observador sai, o valor volta a ausente', async () => {
    const stop = fpsMeter.start();
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect(fpsMeter.current).not.toBeNull();

    stop();

    // Ausente, e não o último número lido — um valor congelado passaria por
    // atual sem o ser.
    expect(fpsMeter.current).toBeNull();
  }, 5_000);

  it('dois observadores partilham a mesma contagem, e só o segundo "stop" a pára', async () => {
    const stopA = fpsMeter.start();
    const stopB = fpsMeter.start();

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect(fpsMeter.current).not.toBeNull();

    stopA();
    // Ainda há um observador: a medição continua.
    expect(fpsMeter.current).not.toBeNull();

    stopB();
    expect(fpsMeter.current).toBeNull();
  }, 5_000);

  it('parar duas vezes com a mesma função não larga um observador a mais', async () => {
    const stopA = fpsMeter.start();
    fpsMeter.start();

    await new Promise((resolve) => setTimeout(resolve, 1_100));

    stopA();
    stopA(); // idempotente — não pode contar como um segundo "stop"
    expect(fpsMeter.current).not.toBeNull();
  }, 5_000);
});
