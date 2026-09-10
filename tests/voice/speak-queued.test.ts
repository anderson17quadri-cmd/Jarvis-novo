import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVoice } from '@/hooks/use-voice';
import { voiceService } from '@/services/voice-service';

/**
 * `speakQueued` (item 16, reportado ao vivo): falar por frase à medida que
 * o texto chega, sem cortar a frase anterior a meio. `voiceService.speak()`
 * cancela qualquer fala em curso antes de começar — por isso o que prova
 * que a fila funciona é confirmar que a próxima frase só é passada ao
 * `voiceService.speak()` depois do `onEnd` da anterior, nunca antes.
 */

beforeEach(() => {
  vi.spyOn(voiceService, 'stopListening').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('speakQueued', () => {
  it('fala a primeira frase logo, e só passa a segunda ao voiceService depois do onEnd da primeira', () => {
    const speakSpy = vi.spyOn(voiceService, 'speak').mockReturnValue(true);
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.speakQueued('Primeira frase.');
      result.current.speakQueued('Segunda frase.');
    });

    // Só uma chamada a voiceService.speak — a segunda frase está à espera.
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(speakSpy).toHaveBeenNthCalledWith(1, 'Primeira frase.', expect.anything());

    // Termina a primeira fala — só aí a segunda entra.
    act(() => {
      speakSpy.mock.calls[0]?.[1]?.onEnd?.();
    });

    expect(speakSpy).toHaveBeenCalledTimes(2);
    expect(speakSpy).toHaveBeenNthCalledWith(2, 'Segunda frase.', expect.anything());
  });

  it('uma frase vazia ou só espaço não chega a chamar o voiceService', () => {
    const speakSpy = vi.spyOn(voiceService, 'speak').mockReturnValue(true);
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.speakQueued('   ');
    });

    expect(speakSpy).not.toHaveBeenCalled();
  });

  it('depois da fila esvaziar, uma frase nova volta a falar logo', () => {
    const speakSpy = vi.spyOn(voiceService, 'speak').mockReturnValue(true);
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.speakQueued('Primeira frase.');
    });
    act(() => {
      speakSpy.mock.calls[0]?.[1]?.onEnd?.();
    });

    expect(speakSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.speakQueued('Frase de uma resposta seguinte.');
    });

    expect(speakSpy).toHaveBeenCalledTimes(2);
  });

  it('limparFilaDeFala esvazia a fila — o onEnd da frase cortada não avança para a seguinte', () => {
    const speakSpy = vi.spyOn(voiceService, 'speak').mockReturnValue(true);
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.speakQueued('Primeira frase.');
      result.current.speakQueued('Segunda frase.');
    });
    expect(speakSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.limparFilaDeFala();
      speakSpy.mock.calls[0]?.[1]?.onEnd?.();
    });

    // A segunda frase ficou de fora — não se fala uma resposta que já não
    // pertence a lado nenhum.
    expect(speakSpy).toHaveBeenCalledTimes(1);
  });

  it('depois de limpar a fila, uma frase nova volta a falar logo', () => {
    const speakSpy = vi.spyOn(voiceService, 'speak').mockReturnValue(true);
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.speakQueued('Primeira frase.');
    });
    act(() => {
      result.current.limparFilaDeFala();
    });
    act(() => {
      result.current.speakQueued('Frase nova.');
    });

    expect(speakSpy).toHaveBeenCalledTimes(2);
    expect(speakSpy).toHaveBeenNthCalledWith(2, 'Frase nova.', expect.anything());
  });
});
