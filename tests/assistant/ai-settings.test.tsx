import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiSettings } from '@/apps/personalization/AiSettings';
import { applyAiSettings } from '@/hooks/use-ai-settings';
import { aiService } from '@/services/ai-service';
import { logService } from '@/services/log-service';
import { useAiSettingsStore } from '@/stores/use-ai-settings-store';
import { DEFAULT_AI_SETTINGS } from '@/types/ai-provider-settings';

const KEY = 'sk-abcdefgh12345678';

beforeEach(() => {
  localStorage.clear();
  logService.clear();
  useAiSettingsStore.setState({ settings: DEFAULT_AI_SETTINGS });
  applyAiSettings(DEFAULT_AI_SETTINGS);
});

describe('escolha do provedor', () => {
  it('começa no local — nada sai do dispositivo sem alguém o pedir', () => {
    expect(useAiSettingsStore.getState().settings.provider).toBe('regras');
    expect(aiService.providerName).toBe('Contexto local');
  });

  it('escolher a DeepSeek sem chave não deixa o assistente mudo', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);

    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));

    // A preferência muda, mas quem responde continua a ser o local: um
    // provedor sem chave não responderia nada de útil.
    expect(useAiSettingsStore.getState().settings.provider).toBe('deepseek');
    expect(aiService.providerName).toBe('Contexto local');
  });

  it('com chave, passa a responder a DeepSeek', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);

    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));
    await user.type(screen.getByLabelText('Chave da API'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await waitFor(() => {
      expect(aiService.providerName).toBe('DeepSeek');
    });
  });
});

describe('o que se diz antes de ligar', () => {
  it('avisa o que sai do dispositivo e para onde vai', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/saem deste dispositivo/);
    expect(note).toHaveTextContent('https://api.deepseek.com/chat/completions');
  });

  it('diz que a chave fica no cofre do sistema', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));

    expect(screen.getByRole('note')).toHaveTextContent(/cofre do sistema/);
    expect(screen.getByRole('note')).toHaveTextContent(/não sai nas cópias de segurança/);
  });

  it('no provedor local, diz que nada sai', () => {
    render(<AiSettings />);
    expect(screen.getByText(/Nada sai do dispositivo/)).toBeInTheDocument();
  });
});

describe('a chave', () => {
  it('o botão só liga quando o que está escrito parece uma chave', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));

    const save = screen.getByRole('button', { name: 'Guardar a chave' });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText('Chave da API'), 'a minha password');
    expect(save).toBeDisabled();
    expect(screen.getByText(/começa por/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Chave da API'));
    await user.type(screen.getByLabelText('Chave da API'), KEY);
    expect(save).toBeEnabled();
  });

  it('depois de guardada, mostra-se tapada', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));
    await user.type(screen.getByLabelText('Chave da API'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    expect(await screen.findByText(/sk-abc…/)).toBeInTheDocument();
    expect(screen.queryByText(KEY)).toBeNull();
  });

  it('há sempre forma de a ver e de a apagar', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));
    await user.type(screen.getByLabelText('Chave da API'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await user.click(await screen.findByLabelText('Mostrar a chave'));
    expect(screen.getByText(KEY)).toBeInTheDocument();

    await user.click(screen.getByLabelText('Apagar a chave'));

    expect(useAiSettingsStore.getState().settings.apiKey).toBe('');
    // Apagar volta ao local: continuar em "DeepSeek" sem chave seria mentir
    // sobre quem está a responder.
    expect(useAiSettingsStore.getState().settings.provider).toBe('regras');
  });

  it('nunca entra no registo de auditoria', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));
    await user.type(screen.getByLabelText('Chave da API'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await waitFor(() => {
      expect(logService.list.some((entry) => entry.message.includes('chave'))).toBe(true);
    });

    // O facto fica; o segredo não.
    const everything = logService.list
      .map((entry) => `${entry.message} ${entry.detail ?? ''}`)
      .join(' ');
    expect(everything).not.toContain(KEY);
  });

  it('sobrevive a recarregar, e o provedor volta a ser ligado', async () => {
    useAiSettingsStore.getState().setProvider('deepseek');
    useAiSettingsStore.getState().setApiKey(KEY);
    applyAiSettings(useAiSettingsStore.getState().settings);
    await useAiSettingsStore.getState().persist();

    useAiSettingsStore.setState({ settings: DEFAULT_AI_SETTINGS });
    await useAiSettingsStore.getState().hydrate();
    applyAiSettings(useAiSettingsStore.getState().settings);

    expect(useAiSettingsStore.getState().settings.apiKey).toBe(KEY);
    expect(aiService.providerName).toBe('DeepSeek');
  });

  it('sem nada gravado, arranca no local', async () => {
    await useAiSettingsStore.getState().hydrate();
    applyAiSettings(useAiSettingsStore.getState().settings);

    expect(useAiSettingsStore.getState().settings.provider).toBe('regras');
    expect(aiService.providerName).toBe('Contexto local');
  });
});

const CLAUDE_KEY = 'sk-ant-abcdefgh12345678';

describe('Claude', () => {
  it('com chave, passa a responder a Claude', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);

    await user.click(screen.getByRole('radio', { name: /^Claude/ }));
    await user.type(screen.getByLabelText('Chave da Claude'), CLAUDE_KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await waitFor(() => {
      expect(aiService.providerName).toBe('Claude');
    });
  });

  it('avisa o que sai do dispositivo e para onde vai', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /^Claude/ }));

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/saem deste dispositivo/);
    expect(note).toHaveTextContent('https://api.anthropic.com/v1/messages');
  });

  it('a chave apaga-se e volta ao local', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /^Claude/ }));
    await user.type(screen.getByLabelText('Chave da Claude'), CLAUDE_KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await user.click(await screen.findByLabelText('Apagar a chave da Claude'));

    expect(useAiSettingsStore.getState().settings.claudeApiKey).toBe('');
    expect(useAiSettingsStore.getState().settings.provider).toBe('regras');
  });

  it('nunca entra no registo de auditoria', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /^Claude/ }));
    await user.type(screen.getByLabelText('Chave da Claude'), CLAUDE_KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await waitFor(() => {
      expect(logService.list.some((entry) => entry.message.includes('Claude'))).toBe(true);
    });

    const everything = logService.list
      .map((entry) => `${entry.message} ${entry.detail ?? ''}`)
      .join(' ');
    expect(everything).not.toContain(CLAUDE_KEY);
  });
});

describe('Ollama', () => {
  it('sem chave nenhuma — só o nome do modelo já chega para responder', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);

    await user.click(screen.getByRole('radio', { name: /^Ollama/ }));
    await user.type(screen.getByLabelText('Modelo do Ollama'), 'llama3.1');
    await user.tab();

    await waitFor(() => {
      expect(aiService.providerName).toBe('Ollama');
    });
  });

  it('diz que nada sai do dispositivo', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /^Ollama/ }));

    expect(screen.getByText(/Nada sai do dispositivo/)).toBeInTheDocument();
  });

  describe('detetar modelos instalados', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('pergunta a GET /api/tags e mostra os modelos como opções', async () => {
      global.fetch = vi.fn((url: string) => {
        expect(url).toBe(`${DEFAULT_AI_SETTINGS.ollamaBaseUrl}/api/tags`);
        return Promise.resolve(
          new Response(JSON.stringify({ models: [{ name: 'qwen3:8b' }, { name: 'llama3.1' }] }), {
            status: 200,
          }),
        );
      }) as unknown as typeof fetch;

      const user = userEvent.setup();
      render(<AiSettings />);
      await user.click(screen.getByRole('radio', { name: /^Ollama/ }));
      await user.click(screen.getByRole('button', { name: 'Detetar modelos instalados no Ollama' }));

      expect(await screen.findByRole('radio', { name: 'qwen3:8b' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'llama3.1' })).toBeInTheDocument();
    });

    it('escolher um modelo detetado guarda-o como preferência', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ models: [{ name: 'qwen3:8b' }] }), { status: 200 })),
      );

      const user = userEvent.setup();
      render(<AiSettings />);
      await user.click(screen.getByRole('radio', { name: /^Ollama/ }));
      await user.click(screen.getByRole('button', { name: 'Detetar modelos instalados no Ollama' }));
      await user.click(await screen.findByRole('radio', { name: 'qwen3:8b' }));

      expect(useAiSettingsStore.getState().settings.ollamaModel).toBe('qwen3:8b');
    });

    it('sem o Ollama a correr, diz isso mesmo em vez de ficar em silêncio', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));

      const user = userEvent.setup();
      render(<AiSettings />);
      await user.click(screen.getByRole('radio', { name: /^Ollama/ }));
      await user.click(screen.getByRole('button', { name: 'Detetar modelos instalados no Ollama' }));

      expect(await screen.findByText(/confirma que está a correr/)).toBeInTheDocument();
    });

    it('respondido mas sem nenhum modelo instalado, diz para instalar um primeiro', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ models: [] }), { status: 200 })),
      );

      const user = userEvent.setup();
      render(<AiSettings />);
      await user.click(screen.getByRole('radio', { name: /^Ollama/ }));
      await user.click(screen.getByRole('button', { name: 'Detetar modelos instalados no Ollama' }));

      expect(await screen.findByText(/não tem nenhum modelo instalado/)).toBeInTheDocument();
    });
  });
});

describe('cadeia automática', () => {
  it('com mais do que um provedor configurado, avisa que há troca automática', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);

    await user.click(screen.getByRole('radio', { name: /^Ollama/ }));
    await user.type(screen.getByLabelText('Modelo do Ollama'), 'llama3.1');
    await user.tab();

    await user.click(screen.getByRole('radio', { name: /^DeepSeek/ }));
    await user.type(screen.getByLabelText('Chave da API'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    expect(await screen.findByText(/tenta sozinho o próximo provedor/)).toBeInTheDocument();
  });

  it('com um só provedor configurado, não há nota de cadeia', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);

    await user.click(screen.getByRole('radio', { name: /^DeepSeek/ }));
    await user.type(screen.getByLabelText('Chave da API'), KEY);
    await user.click(screen.getByRole('button', { name: 'Guardar a chave' }));

    await waitFor(() => expect(aiService.providerName).toBe('DeepSeek'));
    expect(screen.queryByText(/tenta sozinho o próximo provedor/)).toBeNull();
  });
});

describe('ordem da cadeia', () => {
  it('reordenar pela interface troca os degraus e guarda', async () => {
    const user = userEvent.setup();
    // A cadeia por omissão só tem o DeepSeek; para reordenar é preciso pôr
    // os outros degraus lá primeiro (acrescentados à mão, como na interface).
    useAiSettingsStore.getState().setProviderOrder(['deepseek', 'claude', 'ollama']);
    render(<AiSettings />);

    await user.click(screen.getByRole('button', { name: 'Descer DeepSeek' }));

    expect(useAiSettingsStore.getState().settings.providerOrder).toEqual([
      'claude',
      'deepseek',
      'ollama',
    ]);
  });

  it('a ordem guardada sobrevive a recarregar', async () => {
    useAiSettingsStore.getState().setProviderOrder(['ollama', 'deepseek', 'claude']);
    await useAiSettingsStore.getState().persist();

    useAiSettingsStore.setState({ settings: DEFAULT_AI_SETTINGS });
    await useAiSettingsStore.getState().hydrate();

    expect(useAiSettingsStore.getState().settings.providerOrder).toEqual([
      'ollama',
      'deepseek',
      'claude',
    ]);
  });

  it('a cadeia respeita a ordem guardada, não a fixa', () => {
    const setChain = vi.spyOn(aiService, 'setChain');

    applyAiSettings({
      ...DEFAULT_AI_SETTINGS,
      provider: 'deepseek',
      apiKey: KEY,
      claudeApiKey: CLAUDE_KEY,
      ollamaModel: 'llama3.1',
      providerOrder: ['ollama', 'deepseek', 'claude'],
    });

    const nomes = setChain.mock.calls[0]![0].map((membro) => membro.name);
    expect(nomes).toEqual(['DeepSeek', 'Ollama', 'Claude']);
  });

  it('sem preferência guardada, cai na ordem por omissão', async () => {
    localStorage.setItem('jarvis.ai-settings', JSON.stringify({ provider: 'deepseek' }));

    await useAiSettingsStore.getState().hydrate();

    expect(useAiSettingsStore.getState().settings.providerOrder).toEqual(['deepseek']);
  });
});
