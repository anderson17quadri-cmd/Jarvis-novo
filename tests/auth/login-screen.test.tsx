import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as WebAuthnServiceModule from '@/services/webauthn-service';

vi.mock('@/services/webauthn-service', async (importOriginal) => {
  const actual = await importOriginal<typeof WebAuthnServiceModule>();
  return {
    ...actual,
    hasRegisteredSecurityKey: vi.fn(),
    verifySecurityKey: vi.fn(),
  };
});

import { hasRegisteredSecurityKey, verifySecurityKey } from '@/services/webauthn-service';
import { useAppearanceStore } from '@/stores/use-appearance-store';
import { DEFAULT_APPEARANCE } from '@/types/appearance';
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

  describe('chave física', () => {
    it('sem chave registada, diz isso sem tentar cerimónia nenhuma', async () => {
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(false);
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.click(screen.getByRole('button', { name: 'Chave física' }));

      expect(
        await screen.findByText(
          /Nenhuma chave física registada — regista uma em Privacidade/,
          {},
          { timeout: 5_000 },
        ),
      ).toBeInTheDocument();
      expect(verifySecurityKey).not.toHaveBeenCalled();
      expect(onAuthenticated).not.toHaveBeenCalled();
    });

    it('com chave registada e verificação válida, entra', async () => {
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(true);
      vi.mocked(verifySecurityKey).mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.click(screen.getByRole('button', { name: 'Chave física' }));

      expect(
        await screen.findByText('Identidade confirmada pela chave física.', {}, { timeout: 5_000 }),
      ).toBeInTheDocument();
      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce(), { timeout: 5_000 });
    }, 15_000);

    it('com chave registada mas verificação recusada (assinatura errada, cancelada, etc.), não entra', async () => {
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(true);
      vi.mocked(verifySecurityKey).mockResolvedValue({
        ok: false,
        reason: 'Assinatura inválida — não corresponde à chave registada.',
      });
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.click(screen.getByRole('button', { name: 'Chave física' }));

      expect(
        await screen.findByText(
          'Assinatura inválida — não corresponde à chave registada.',
          {},
          { timeout: 5_000 },
        ),
      ).toBeInTheDocument();
      expect(onAuthenticated).not.toHaveBeenCalled();
    }, 15_000);
  });

  describe('2FA (segundo fator)', () => {
    beforeEach(() => {
      // `restoreMocks` global não limpa o histórico de chamadas destes
      // `vi.fn()` entre as suites de "chave física" e esta — limpar aqui
      // evita falsos positivos de "não devia ter sido chamado" a arrastar
      // chamadas de testes anteriores no mesmo ficheiro.
      vi.mocked(hasRegisteredSecurityKey).mockReset();
      vi.mocked(verifySecurityKey).mockReset();
    });

    afterEach(() => {
      useAppearanceStore.setState({ appearance: DEFAULT_APPEARANCE });
    });

    it('desligado (omissão), a palavra-passe entra sozinha mesmo com chave registada', async () => {
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(true);
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.type(screen.getByLabelText('Palavra-passe'), 'qualquer-uma');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce(), { timeout: 5_000 });
      expect(verifySecurityKey).not.toHaveBeenCalled();
    }, 15_000);

    it('ligado com chave registada, a palavra-passe sozinha não basta — pede o segundo fator', async () => {
      useAppearanceStore.getState().set('twoFactorEnabled', true);
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(true);
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.type(screen.getByLabelText('Palavra-passe'), 'qualquer-uma');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      expect(
        await screen.findByRole('button', { name: 'Usar chave física' }, { timeout: 5_000 }),
      ).toBeInTheDocument();
      expect(onAuthenticated).not.toHaveBeenCalled();

      // A fila de atalhos (biometria, PIN, chave física direta) some — nenhum
      // deles pode contornar o segundo fator que se acabou de exigir.
      expect(screen.queryByRole('button', { name: 'Chave física' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reconhecimento facial' })).toBeNull();
    }, 15_000);

    it('confirmar o segundo fator com sucesso entra', async () => {
      useAppearanceStore.getState().set('twoFactorEnabled', true);
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(true);
      vi.mocked(verifySecurityKey).mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.type(screen.getByLabelText('Palavra-passe'), 'qualquer-uma');
      await user.click(screen.getByRole('button', { name: /entrar/i }));
      await user.click(await screen.findByRole('button', { name: 'Usar chave física' }));

      expect(
        await screen.findByText('Identidade confirmada — dois fatores verificados.', {}, { timeout: 5_000 }),
      ).toBeInTheDocument();
      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce(), { timeout: 5_000 });
    }, 15_000);

    it('segundo fator recusado não entra, e volta à palavra-passe', async () => {
      useAppearanceStore.getState().set('twoFactorEnabled', true);
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(true);
      vi.mocked(verifySecurityKey).mockResolvedValue({ ok: false, reason: 'Verificação cancelada.' });
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.type(screen.getByLabelText('Palavra-passe'), 'qualquer-uma');
      await user.click(screen.getByRole('button', { name: /entrar/i }));
      await user.click(await screen.findByRole('button', { name: 'Usar chave física' }));

      expect(await screen.findByText('Verificação cancelada.', {}, { timeout: 5_000 })).toBeInTheDocument();
      expect(onAuthenticated).not.toHaveBeenCalled();
      // Volta ao formulário — não fica preso no painel do segundo fator.
      expect(screen.getByLabelText('Palavra-passe')).toBeInTheDocument();
    }, 15_000);

    it('cancelar o segundo fator volta à palavra-passe sem autenticar', async () => {
      useAppearanceStore.getState().set('twoFactorEnabled', true);
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(true);
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.type(screen.getByLabelText('Palavra-passe'), 'qualquer-uma');
      await user.click(screen.getByRole('button', { name: /entrar/i }));
      await screen.findByRole('button', { name: 'Usar chave física' });

      await user.click(screen.getByRole('button', { name: 'Cancelar e voltar' }));

      expect(screen.getByLabelText('Palavra-passe')).toHaveValue('');
      expect(verifySecurityKey).not.toHaveBeenCalled();
      expect(onAuthenticated).not.toHaveBeenCalled();
    });

    it('ligado mas sem chave registada (estado inconsistente), nega em vez de entrar só com o primeiro fator', async () => {
      useAppearanceStore.getState().set('twoFactorEnabled', true);
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(false);
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.type(screen.getByLabelText('Palavra-passe'), 'qualquer-uma');
      await user.click(screen.getByRole('button', { name: /entrar/i }));

      expect(
        await screen.findByText(
          /O segundo fator está ligado, mas não há chave física registada/,
          {},
          { timeout: 5_000 },
        ),
      ).toBeInTheDocument();
      expect(onAuthenticated).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Usar chave física' })).toBeNull();
    }, 15_000);

    it('o PIN também exige o segundo fator quando ligado', async () => {
      useAppearanceStore.getState().set('twoFactorEnabled', true);
      vi.mocked(hasRegisteredSecurityKey).mockResolvedValue(true);
      vi.mocked(verifySecurityKey).mockResolvedValue({ ok: true });
      const user = userEvent.setup();
      const onAuthenticated = vi.fn();

      render(<LoginScreen onAuthenticated={onAuthenticated} />);
      await user.click(screen.getByRole('button', { name: 'PIN' }));
      for (const digit of ['1', '2', '3', '4']) {
        await user.click(screen.getByRole('button', { name: `Dígito ${digit}` }));
      }

      await user.click(await screen.findByRole('button', { name: 'Usar chave física' }));
      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce(), { timeout: 5_000 });
    }, 15_000);
  });
});
