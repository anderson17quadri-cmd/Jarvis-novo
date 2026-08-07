import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoginScreen } from '@/components/auth/LoginScreen';
import { soundService } from '@/services/sound-service';

/**
 * Sons do login (Parte 5, Parte 15 §Sons).
 *
 * A metade "leitura biométrica" da categoria "sistema" — a outra é o
 * arranque, coberta em `tests/boot/boot-sound.test.tsx`.
 */

describe('sons do login', () => {
  it('a palavra-passe aceite soa a sucesso', async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(soundService, 'play');

    render(<LoginScreen onAuthenticated={() => undefined} />);
    await user.type(screen.getByLabelText('Palavra-passe'), 'seja-o-que-for');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(play).toHaveBeenCalledWith('success'));
    expect(play).not.toHaveBeenCalledWith('error');
  }, 15_000);

  it('a palavra-passe vazia soa a erro, não a sucesso', async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(soundService, 'play');

    render(<LoginScreen onAuthenticated={() => undefined} />);
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(play).toHaveBeenCalledWith('error'));
    expect(play).not.toHaveBeenCalledWith('success');
  }, 15_000);

  it('o reconhecimento facial soa a "scanner" ao começar, e a sucesso ao acabar', async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(soundService, 'play');

    render(<LoginScreen onAuthenticated={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Autenticar por reconhecimento facial' }));

    // O "scanner" soa ao iniciar a leitura — antes de se saber o resultado.
    expect(play).toHaveBeenCalledWith('scanner');
    expect(play).not.toHaveBeenCalledWith('success');

    await waitFor(() => expect(play).toHaveBeenCalledWith('success'), { timeout: 10_000 });
  }, 20_000);

  it('a impressão digital soa a "scanner" ao começar', async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(soundService, 'play');

    render(<LoginScreen onAuthenticated={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Impressão digital' }));

    expect(play).toHaveBeenCalledWith('scanner');

    await waitFor(() => expect(play).toHaveBeenCalledWith('success'), { timeout: 10_000 });
  }, 20_000);
});
