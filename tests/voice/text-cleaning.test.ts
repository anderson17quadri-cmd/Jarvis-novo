import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceService } from '@/services/voice-service';

/**
 * Limpeza do texto antes de sintetizar (Parte 7.1/7.2 §Voz).
 *
 * Confirmado a sério com áudio real, não só por ler o código: um texto
 * curto isolado como "Bom dia." sai do XTTS-v2 como "Bom dia. Ponto." em
 * cerca de 1 em cada 4 gerações — testado com `voice-clone-service/server.py`
 * a correr, `/falar` seguido de `/ouvir` (Whisper) a confirmar o que
 * realmente foi dito. Este ficheiro testa só a limpeza em si, pela via mais
 * fácil de observar sem rede — a voz do sistema, que recebe o mesmo texto
 * já limpo que a voz clonada.
 */

function withFakeSynthesis(): { utterances: string[]; restore: () => void } {
  const utterances: string[] = [];
  const originalSynthesis = (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  const originalUtterance = (globalThis as unknown as { SpeechSynthesisUtterance?: unknown })
    .SpeechSynthesisUtterance;

  (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    getVoices: () => [],
    speak: vi.fn(),
    cancel: vi.fn(),
  };

  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = function (
    this: Record<string, unknown>,
    text: string,
  ) {
    utterances.push(text);
    this.text = text;
  };

  return {
    utterances,
    restore: () => {
      (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis = originalSynthesis;
      (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
        originalUtterance;
    },
  };
}

describe('limpeza do texto antes de sintetizar', () => {
  let restore: () => void;

  afterEach(() => restore?.());

  it('tira o ponto final — o que, às vezes, o XTTS-v2 lê à letra', () => {
    const env = withFakeSynthesis();
    restore = env.restore;

    new VoiceService().speak('Bom dia.', undefined, { kind: 'sistema', voiceURI: 'qualquer' });

    expect(env.utterances).toEqual(['Bom dia']);
  });

  it('não mexe em pontos a meio da frase, que servem de pausa real entre orações', () => {
    const env = withFakeSynthesis();
    restore = env.restore;

    new VoiceService().speak(
      'Bom dia. Todos os sistemas foram inicializados com sucesso.',
      undefined,
      { kind: 'sistema', voiceURI: 'qualquer' },
    );

    expect(env.utterances).toEqual(['Bom dia. Todos os sistemas foram inicializados com sucesso']);
  });

  it('reticências (três pontos ou "…") viram vírgula — pausa, não a palavra "ponto"', () => {
    const env = withFakeSynthesis();
    restore = env.restore;

    new VoiceService().speak('Espera... um momento.', undefined, { kind: 'sistema', voiceURI: 'x' });
    new VoiceService().speak('Espera… um instante.', undefined, { kind: 'sistema', voiceURI: 'x' });

    expect(env.utterances).toEqual(['Espera, um momento', 'Espera, um instante']);
  });

  it('texto sem pontuação nenhuma não muda', () => {
    const env = withFakeSynthesis();
    restore = env.restore;

    new VoiceService().speak('Ligar o microfone', undefined, { kind: 'sistema', voiceURI: 'x' });

    expect(env.utterances).toEqual(['Ligar o microfone']);
  });

  it('pergunta e exclamação não se tocam — só o ponto final é que é lido à letra', () => {
    const env = withFakeSynthesis();
    restore = env.restore;

    new VoiceService().speak('Confirma?', undefined, { kind: 'sistema', voiceURI: 'x' });
    new VoiceService().speak('Feito!', undefined, { kind: 'sistema', voiceURI: 'x' });

    expect(env.utterances).toEqual(['Confirma?', 'Feito!']);
  });
});
