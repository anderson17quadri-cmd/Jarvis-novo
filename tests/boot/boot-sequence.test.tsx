import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BootSequence } from '@/components/boot/BootSequence';
import { BOOT_STEPS } from '@/components/boot/boot-steps';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';

describe('BootSequence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('mostra as 10 verificações no arranque completo', async () => {
    render(<BootSequence onComplete={() => undefined} />);

    // A primeira verificação chega depois da faísca e do typewriter.
    await waitFor(
      () => expect(screen.getByText(BOOT_STEPS[0]!.label)).toBeInTheDocument(),
      { timeout: 15_000 },
    );

    for (const step of BOOT_STEPS) {
      await waitFor(() => expect(screen.getByText(step.label)).toBeInTheDocument(), {
        timeout: 15_000,
      });
    }

    expect(BOOT_STEPS).toHaveLength(10);
  }, 30_000);

  it('salta para o arranque rápido quando já houve um arranque antes', async () => {
    await storageService.set(STORAGE_KEYS.booted, true);
    const onComplete = vi.fn();

    render(<BootSequence onComplete={onComplete} />);

    // Vai direto à identidade, sem passar pelas verificações.
    await waitFor(() => expect(screen.getByText('JARVIS AI')).toBeInTheDocument());
    expect(screen.queryByText(BOOT_STEPS[0]!.label)).not.toBeInTheDocument();

    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 10_000 });
  }, 20_000);

  it('o botão de saltar termina a sequência e marca o arranque como visto', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(<BootSequence onComplete={onComplete} />);

    const skip = await screen.findByRole('button', { name: 'Saltar sequência' });
    await user.click(skip);

    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 10_000 });
    await expect(storageService.get(STORAGE_KEYS.booted, false)).resolves.toBe(true);
  }, 20_000);
});
