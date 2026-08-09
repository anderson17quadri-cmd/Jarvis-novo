import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceSettings } from '@/apps/personalization/VoiceSettings';
import { voiceService } from '@/services/voice-service';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

/**
 * Escolha de voz (Parte 7.1 §Voz).
 *
 * O pedido era simples: uma voz mais humana sem pagar por uma API. A
 * resposta não é clonar ninguém — é deixar escolher, de entre as vozes que o
 * próprio sistema já tem instaladas (as "Natural" do Windows, por exemplo),
 * em vez de ficar preso à primeira que calhar.
 */

const VOICES = [
  { name: 'Microsoft Helena - Portuguese (Portugal)', lang: 'pt-PT', voiceURI: 'helena' },
  { name: 'Microsoft Duarte Online (Natural) - Portuguese (Portugal)', lang: 'pt-PT', voiceURI: 'duarte-natural' },
] as unknown as SpeechSynthesisVoice[];

const speak = vi.fn();

function fakeSynthesis(): void {
  const listeners: Record<string, (() => void)[]> = {};
  speak.mockClear();

  (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    getVoices: () => VOICES,
    speak,
    cancel: vi.fn(),
    addEventListener: (event: string, fn: () => void) => {
      listeners[event] = [...(listeners[event] ?? []), fn];
    },
    removeEventListener: () => undefined,
  };

  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    function (this: Record<string, unknown>, text: string) {
      this.text = text;
    };
}

beforeEach(() => {
  fakeSynthesis();
  useVoiceSettingsStore.setState({ selection: { kind: 'auto' } });
  voiceService.setSelection({ kind: 'auto' });
  // O serviço local de voz clonada não está a correr nos testes — sem isto,
  // cada teste dispararia um `fetch` a sério contra o localhost.
  vi.spyOn(voiceService, 'getCloneServiceInfo').mockResolvedValue({
    disponivel: false,
    vozPropriaGravada: false,
    vozesProntas: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VoiceSettings', () => {
  it('lista as vozes portuguesas que o sistema já tem instaladas', () => {
    render(<VoiceSettings />);

    expect(screen.getByText(/Helena/)).toBeInTheDocument();
    expect(screen.getByText(/Duarte Online \(Natural\)/)).toBeInTheDocument();
  });

  it('escolher uma voz guarda-a como preferida', async () => {
    const user = userEvent.setup();
    render(<VoiceSettings />);

    await user.click(screen.getByRole('radio', { name: /Duarte Online \(Natural\)/ }));

    expect(useVoiceSettingsStore.getState().selection).toEqual({
      kind: 'sistema',
      voiceURI: 'duarte-natural',
    });
  });

  it('"Escolha automática" volta ao estado automático', async () => {
    const user = userEvent.setup();
    useVoiceSettingsStore.setState({ selection: { kind: 'sistema', voiceURI: 'helena' } });
    render(<VoiceSettings />);

    await user.click(screen.getByRole('radio', { name: 'Escolha automática' }));

    expect(useVoiceSettingsStore.getState().selection).toEqual({ kind: 'auto' });
  });

  it('testar uma voz não muda a preferência guardada', async () => {
    const user = userEvent.setup();
    useVoiceSettingsStore.setState({ selection: { kind: 'sistema', voiceURI: 'helena' } });
    render(<VoiceSettings />);

    await user.click(screen.getByRole('button', { name: /Testar a voz.*Duarte Online/ }));

    // O teste falou com a voz do Duarte, mas a preferência continua a ser a Helena.
    expect(useVoiceSettingsStore.getState().selection).toEqual({ kind: 'sistema', voiceURI: 'helena' });
    expect(speak).toHaveBeenCalled();
  });

  it('mostra as vozes clonadas locais quando o serviço está disponível', async () => {
    vi.spyOn(voiceService, 'getCloneServiceInfo').mockResolvedValue({
      disponivel: true,
      vozPropriaGravada: true,
      vozesProntas: [{ nome: 'Ana Florence', descricao: 'Feminina, tom claro e neutro' }],
    });

    render(<VoiceSettings />);

    expect(await screen.findByText('A minha voz')).toBeInTheDocument();
    expect(await screen.findByText(/Ana Florence/)).toBeInTheDocument();
  });

  it('escolher uma voz clonada pronta guarda-a como preferida', async () => {
    vi.spyOn(voiceService, 'getCloneServiceInfo').mockResolvedValue({
      disponivel: true,
      vozPropriaGravada: false,
      vozesProntas: [{ nome: 'Ana Florence', descricao: 'Feminina, tom claro e neutro' }],
    });
    const user = userEvent.setup();
    render(<VoiceSettings />);

    await user.click(await screen.findByRole('radio', { name: /Ana Florence/ }));

    expect(useVoiceSettingsStore.getState().selection).toEqual({ kind: 'clonada', nome: 'Ana Florence' });
  });
});
