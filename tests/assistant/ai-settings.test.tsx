import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AiSettings } from '@/apps/personalization/AiSettings';
import { aiService } from '@/services/ai-service';
import { logService } from '@/services/log-service';
import { useAiSettingsStore } from '@/stores/use-ai-settings-store';
import { DEFAULT_AI_SETTINGS } from '@/types/ai-provider-settings';

const KEY = 'sk-abcdefgh12345678';

beforeEach(() => {
  localStorage.clear();
  logService.clear();
  useAiSettingsStore.setState({ settings: DEFAULT_AI_SETTINGS });
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

  it('não faz a chave passar por segura', async () => {
    const user = userEvent.setup();
    render(<AiSettings />);
    await user.click(screen.getByRole('radio', { name: /DeepSeek/ }));

    expect(screen.getByRole('note')).toHaveTextContent(/não é um cofre/);
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
    await useAiSettingsStore.getState().persist();

    useAiSettingsStore.setState({ settings: DEFAULT_AI_SETTINGS });
    await useAiSettingsStore.getState().hydrate();

    expect(useAiSettingsStore.getState().settings.apiKey).toBe(KEY);
    expect(aiService.providerName).toBe('DeepSeek');
  });

  it('sem nada gravado, arranca no local', async () => {
    await useAiSettingsStore.getState().hydrate();

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
