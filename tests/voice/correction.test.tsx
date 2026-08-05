import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceCorrection } from '@/components/voice/VoiceCorrection';
import { setVoiceExecutor, type VoiceExecutor } from '@/services/voice/executor';
import { useVoiceCorrectionStore } from '@/stores/use-voice-correction-store';

/**
 * Correção do que a voz ouviu (Parte 10 §Correção de erros).
 *
 * O que interessa provar: que se vê o que vai acontecer **antes** de acontecer,
 * e que executar corre o comando emendado e não o que se tinha ouvido.
 */

function spyExecutor(): { executor: VoiceExecutor; calls: string[] } {
  const calls: string[] = [];

  const executor: VoiceExecutor = {
    openWindow: (appId) => calls.push(`abrir:${appId}`),
    closeAllWindows: () => calls.push('fechar-tudo'),
    setTheme: (theme) => calls.push(`tema:${theme}`),
    setSystemState: (state) => calls.push(`estado:${state}`),
    setWidgetVisible: (widget, show) => calls.push(`widget:${widget}:${show}`),
    hideAllWidgets: () => calls.push('esconder-widgets'),
    createTask: (title) => calls.push(`tarefa:${title}`),
    search: (query) => calls.push(`procurar:${query}`),
    music: (action) => calls.push(`musica:${action}`),
    restartInterface: () => calls.push('reiniciar'),
    ask: (text) => calls.push(`perguntar:${text}`),
  };

  return { executor, calls };
}

beforeEach(() => {
  useVoiceCorrectionStore.setState({ phrase: null, requestId: 0 });
  vi.useRealTimers();
});

describe('a caixa de correção', () => {
  it('não existe até alguém a abrir', () => {
    render(<VoiceCorrection />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre com a frase que se ouviu', async () => {
    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('abrir imails');

    const input = await screen.findByRole('textbox');
    expect(input).toHaveValue('abrir imails');
  });

  it('mostra o que entende enquanto se escreve, antes de executar', async () => {
    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('abrir imails');

    const input = await screen.findByRole('textbox');

    // "imails" não é nada que o interpretador conheça: vira pergunta.
    expect(screen.getByText(/vai como pergunta/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'abrir emails' } });

    expect(await screen.findByText('Abrir Emails')).toBeInTheDocument();
    expect(screen.queryByText(/vai como pergunta/i)).toBeNull();
  });

  it('executa o texto emendado, e não o que se tinha ouvido', async () => {
    const { executor, calls } = spyExecutor();
    const dispose = setVoiceExecutor(executor);

    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('abrir imails');

    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'abrir emails' } });
    fireEvent.click(screen.getByRole('button', { name: 'Executar' }));

    await waitFor(() => expect(calls).toEqual(['abrir:emails']));
    dispose();
  });

  it('a tecla Enter executa', async () => {
    const { executor, calls } = spyExecutor();
    const dispose = setVoiceExecutor(executor);

    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('mudar para o tema oled');

    const input = await screen.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(calls).toEqual(['tema:oled']));
    dispose();
  });

  it('fecha-se ao executar', async () => {
    const { executor, calls } = spyExecutor();
    const dispose = setVoiceExecutor(executor);

    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('abrir emails');

    await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'Executar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Esperar pelo comando antes de largar o executor: o `execute` adia-o 60 ms
    // para a caixa fechar primeiro, e sem esta espera ele caía no executor do
    // teste seguinte.
    await waitFor(() => expect(calls).toEqual(['abrir:emails']));
    dispose();
  });

  it('cancelar fecha sem executar nada', async () => {
    const { executor, calls } = spyExecutor();
    const dispose = setVoiceExecutor(executor);

    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('fechar todas as janelas');

    await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toEqual([]);
    dispose();
  });

  it('a tecla Escape fecha sem executar nada', async () => {
    const { executor, calls } = spyExecutor();
    const dispose = setVoiceExecutor(executor);

    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('fechar todas as janelas');

    const input = await screen.findByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toEqual([]);
    dispose();
  });

  it('um comando vazio não executa', async () => {
    const { executor, calls } = spyExecutor();
    const dispose = setVoiceExecutor(executor);

    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('abrir emails');

    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });

    const executar = screen.getByRole('button', { name: 'Executar' });
    expect(executar).toBeDisabled();

    fireEvent.click(executar);
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('Escreva o comando.')).toBeInTheDocument());
    expect(calls).toEqual([]);
    dispose();
  });

  it('uma frase em que só uma parte é comando trata-se como uma frase só', async () => {
    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('abrir emails e faz o jantar');

    await screen.findByRole('textbox');

    // O `splitCommands` só divide quando todos os pedaços dão comando. Aqui
    // não dão, e a frase inteira vai a um `matchIntent` — que encontra o
    // "abrir emails". É a mesma regra que faz "criar tarefa comprar leite e
    // pão" ser uma tarefa e não duas.
    expect(screen.getByText('Abrir Emails')).toBeInTheDocument();
    expect(screen.queryByText(/Não percebi/)).toBeNull();
  });

  it('executa vários comandos de uma frase, pela ordem em que aparecem', async () => {
    const { executor, calls } = spyExecutor();
    const dispose = setVoiceExecutor(executor);

    render(<VoiceCorrection />);
    useVoiceCorrectionStore.getState().open('abrir emails e mudar para o tema oled');

    await screen.findByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'Executar' }));

    await waitFor(() => expect(calls).toEqual(['abrir:emails', 'tema:oled']));
    dispose();
  });

  it('reabrir com outra frase parte dessa frase, e não da anterior', async () => {
    render(<VoiceCorrection />);

    useVoiceCorrectionStore.getState().open('abrir emails');
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('abrir emails'));

    useVoiceCorrectionStore.getState().close();
    useVoiceCorrectionStore.getState().open('abrir tarefas');

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('abrir tarefas'));
  });

  it('ouvir a mesma frase outra vez não traz a emenda anterior de volta', async () => {
    render(<VoiceCorrection />);

    useVoiceCorrectionStore.getState().open('abrir imails');
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'abrir tarefas' } });
    useVoiceCorrectionStore.getState().close();

    // A mesma frase de antes: sem o `requestId`, a caixa reabria com "abrir
    // tarefas" lá dentro.
    useVoiceCorrectionStore.getState().open('abrir imails');

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('abrir imails'));
  });
});
