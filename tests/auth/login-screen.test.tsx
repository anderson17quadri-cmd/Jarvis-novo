import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoginScreen } from '@/components/auth/LoginScreen';

describe('LoginScreen', () => {
  it('entra com qualquer palavra-passe não vazia', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText('Palavra-passe'), 'seja-o-que-for');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => expect(screen.getByText('Identidade confirmada.')).toBeInTheDocument());
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce(), { timeout: 5_000 });
  }, 15_000);

  // As mensagens da IA entram com efeito de digitação, por isso o texto só está
  // completo passados alguns frames — daí `findByText` em vez de `getByText`.
  it('recusa e avisa quando a palavra-passe está vazia', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(
      await screen.findByText(
        'Não foi possível verificar a identidade. Tente novamente.',
        {},
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
  }, 15_000);

  it('a biometria facial autentica', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);
    await user.click(screen.getByRole('button', { name: 'Autenticar por reconhecimento facial' }));

    expect(await screen.findByText('A analisar biometria…', {}, { timeout: 5_000 })).toBeInTheDocument();
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce(), { timeout: 10_000 });
  }, 20_000);

  it('alterna a visibilidade da palavra-passe', async () => {
    const user = userEvent.setup();
    render(<LoginScreen onAuthenticated={() => undefined} />);

    const input = screen.getByLabelText('Palavra-passe');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Mostrar palavra-passe' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Esconder palavra-passe' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('só autentica uma vez, mesmo com cliques repetidos', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();

    render(<LoginScreen onAuthenticated={onAuthenticated} />);
    await user.type(screen.getByLabelText('Palavra-passe'), 'x');

    const submit = screen.getByRole('button', { name: /entrar/i });
    await user.click(submit);
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce(), { timeout: 5_000 });
  }, 15_000);
});
