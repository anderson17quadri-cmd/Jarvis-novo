import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BootSequence } from '@/components/boot/BootSequence';
import { BOOT_STEPS } from '@/components/boot/boot-steps';
import { soundService } from '@/services/sound-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';

/**
 * Sons do arranque (Parte 4 §Efeitos sonoros, Parte 15 §Sons).
 *
 * A categoria "sistema" já se descrevia como "arranque e leitura biométrica"
 * sem que nenhum código lhe tocasse — nem aqui, nem no login. Estes testes
 * cobram essa descrição: o que soa, quando, e quantas vezes.
 *
 * `soundService.play` nunca lança nem depende de áudio a sério (o
 * `AudioContext` fica ausente em jsdom, e o método sai cedo) — o que se prova
 * é que é **chamado** com o som certo, no momento certo.
 */

function setReducedMotion(matches: boolean): void {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  localStorage.clear();
  setReducedMotion(false);
});

describe('sons do arranque completo', () => {
  it('a formação dos anéis soa a "scanner"', async () => {
    const play = vi.spyOn(soundService, 'play');

    render(<BootSequence onComplete={() => undefined} />);

    await waitFor(() => expect(play).toHaveBeenCalledWith('scanner'), { timeout: 5_000 });
  }, 10_000);

  it('cada verificação soa a "click", uma vez por verificação', async () => {
    const play = vi.spyOn(soundService, 'play');

    render(<BootSequence onComplete={() => undefined} />);

    await waitFor(() => expect(screen.getByText(BOOT_STEPS[0]!.label)).toBeInTheDocument(), {
      timeout: 15_000,
    });

    for (const step of BOOT_STEPS) {
      await waitFor(() => expect(screen.getByText(step.label)).toBeInTheDocument(), {
        timeout: 15_000,
      });
    }

    // As dez verificações têm de ter tocado exatamente dez cliques — nem um a
    // mais (repetido por engano em cada render) nem um a menos (perdido).
    await waitFor(
      () => expect(play.mock.calls.filter(([sound]) => sound === 'click')).toHaveLength(10),
      { timeout: 5_000 },
    );
  }, 30_000);

  it('a identidade final soa a sucesso, e não ao "open" do arranque rápido', async () => {
    const play = vi.spyOn(soundService, 'play');

    render(<BootSequence onComplete={() => undefined} />);

    await waitFor(() => expect(screen.getByText('JARVIS AI')).toBeInTheDocument(), {
      timeout: 15_000,
    });
    await waitFor(() => expect(play).toHaveBeenCalledWith('success'), { timeout: 3_000 });

    expect(play).not.toHaveBeenCalledWith('open');
  }, 30_000);
});

describe('sons do arranque rápido', () => {
  it('quem já arrancou antes ouve "open"', async () => {
    await storageService.set(STORAGE_KEYS.booted, true);
    const play = vi.spyOn(soundService, 'play');

    render(<BootSequence onComplete={() => undefined} />);

    await waitFor(() => expect(play).toHaveBeenCalledWith('open'), { timeout: 3_000 });
    // Não verificou nada — não merece o som de sucesso, que é do arranque a sério.
    expect(play).not.toHaveBeenCalledWith('success');
  });

  it('com redução de movimento, não soa nada — a saída é instantânea', async () => {
    setReducedMotion(true);
    const play = vi.spyOn(soundService, 'play');

    render(<BootSequence onComplete={() => undefined} />);

    await waitFor(() => expect(screen.queryByText('JARVIS AI')).toBeInTheDocument());

    expect(play).not.toHaveBeenCalled();
  });
});
