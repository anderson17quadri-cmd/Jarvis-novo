import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVoice } from '@/hooks/use-voice';
import type * as UsePlatform from '@/hooks/use-platform';
import { logService } from '@/services/log-service';
import { notificationService } from '@/services/notification-service';
import { voiceService, type VoiceCallbacks } from '@/services/voice-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

/**
 * Modo conversa (revisão a sério, 14/08/2026): o ciclo de re-engate do
 * microfone após cada resposta. Nunca tinha sido revisto por ninguém de
 * fora — o histórico até prometia "retoma-se ao voltar" do segundo plano,
 * sem código nenhum a fazê-lo.
 *
 * O que se prova aqui:
 *
 * 1. Os erros transientes (`no-speech` — silêncio — e `a-falar` — o guarda
 *    de eco a segurar o microfone enquanto a voz ainda soa) **não** põem o
 *    núcleo em "erro" nem sujam o registo. Antes da correção, o `onError`
 *    chamava `setMode('error')` + `log` logo no topo, antes de decidir se o
 *    erro era transiente — um silêncio de rotina piscava "erro" no ecrã.
 * 2. No limiar (3.ª tentativa sem fala), o modo conversa desliga-se e o
 *    núcleo volta a repouso — antes ficava **preso em "erro"**, porque o
 *    `onEnd` só repõe a "idle" se o modo for "listening".
 * 3. Ao voltar do segundo plano, o ciclo retoma — antes, o efeito de
 *    visibilidade só agia quando a janela perdia o foco, e o microfone
 *    nunca mais ligava sozinho apesar de o botão continuar aceso.
 */

// A visibilidade é um `useSyncExternalStore` de verdade (`document.hidden`).
// Para simular ida/volta de segundo plano, substitui-se o hook por um que
// lê este estado controlável — o `vi.hoisted` deixa a fábrica do `vi.mock`
// (que é içada) referenciar as variáveis sem cair na zona morta temporal.
const visibilidade = vi.hoisted(() => ({
  atual: true,
  ouvintes: new Set<() => void>(),
}));

vi.mock('@/hooks/use-platform', async (importOriginal) => {
  const { useSyncExternalStore } = await import('react');
  const real = await importOriginal<typeof UsePlatform>();

  return {
    ...real,
    useIsVisible: () =>
      useSyncExternalStore(
        (aoMudar) => {
          visibilidade.ouvintes.add(aoMudar);
          return () => {
            visibilidade.ouvintes.delete(aoMudar);
          };
        },
        () => visibilidade.atual,
        () => true,
      ),
  };
});

/** A última chamada a `voiceService.toggleListening` fica aqui, para se
 *  invocar os callbacks à mão (como o serviço real faria). */
let escutaAtual: VoiceCallbacks | null = null;

function definirVisibilidade(atual: boolean): void {
  visibilidade.atual = atual;
  visibilidade.ouvintes.forEach((ouvir) => ouvir());
}

/** Liga o modo conversa e dispara o primeiro re-engate, capturando os callbacks. */
function ligarModoConversa(): void {
  const { result } = renderHook(() => useVoice());
  act(() => {
    result.current.toggleConversationMode();
  });
  act(() => {
    vi.advanceTimersByTime(1_100);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  escutaAtual = null;
  visibilidade.atual = true;
  visibilidade.ouvintes.clear();
  voiceService.setConversationMode(false);
  // O `toggleConversationMode` agora grava `micAlwaysOn`; sem repor, a
  // preferência de um teste vazava para o seguinte e o efeito de "sempre
  // ativo" ligava o modo conversa sozinho a meio de outro teste.
  useVoiceSettingsStore.setState({ micAlwaysOn: false });
  useAssistantStore.getState().setMode('idle');
  logService.clear();

  vi.spyOn(voiceService, 'stopListening').mockImplementation(() => undefined);
  vi.spyOn(voiceService, 'toggleListening').mockImplementation((callbacks) => {
    escutaAtual = callbacks;
    return true;
  });
  vi.spyOn(notificationService, 'info').mockImplementation(() => 'id');
  vi.spyOn(notificationService, 'error').mockImplementation(() => 'id');
  vi.spyOn(notificationService, 'warn').mockImplementation(() => 'id');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('erros transientes do modo conversa', () => {
  it('o silêncio (no-speech) não põe o núcleo em erro nem suja o registo', () => {
    ligarModoConversa();
    expect(escutaAtual).not.toBeNull();

    act(() => {
      escutaAtual?.onStart?.();
    });
    expect(useAssistantStore.getState().mode).toBe('listening');

    act(() => {
      escutaAtual?.onError?.('no-speech');
    });

    expect(useAssistantStore.getState().mode).not.toBe('error');
    expect(logService.list.filter((entrada) => entrada.level === 'erro')).toHaveLength(0);
  });

  it('o guarda de eco (a-falar) não põe o núcleo em erro', () => {
    ligarModoConversa();
    expect(escutaAtual).not.toBeNull();

    act(() => {
      escutaAtual?.onStart?.();
    });
    act(() => {
      escutaAtual?.onError?.('a-falar');
    });

    expect(useAssistantStore.getState().mode).not.toBe('error');
    expect(logService.list.filter((entrada) => entrada.level === 'erro')).toHaveLength(0);
  });

  it('um erro persistente continua a pôr o núcleo em erro e a avisar', () => {
    ligarModoConversa();
    expect(escutaAtual).not.toBeNull();

    act(() => {
      escutaAtual?.onError?.('not-allowed');
    });

    expect(useAssistantStore.getState().mode).toBe('error');
    expect(logService.list.some((entrada) => entrada.level === 'erro' && entrada.source === 'voz')).toBe(
      true,
    );
  });

  it('ao fim da 3.ª tentativa sem fala, desliga o modo conversa e volta a repouso — não fica preso em erro', () => {
    ligarModoConversa();
    expect(escutaAtual).not.toBeNull();

    act(() => {
      escutaAtual?.onStart?.();
    });

    act(() => {
      escutaAtual?.onError?.('no-speech');
      escutaAtual?.onError?.('no-speech');
      escutaAtual?.onError?.('no-speech');
    });

    expect(voiceService.isConversationMode).toBe(false);

    // O fim da escuta traz o núcleo a repouso — antes, como o modo já era
    // "error", o `onEnd` não repunha e ficava preso aí.
    act(() => {
      escutaAtual?.onEnd?.();
    });
    expect(useAssistantStore.getState().mode).toBe('idle');
  });
});

describe('retoma ao voltar do segundo plano', () => {
  it('ao voltar, o modo conversa retoma o ciclo de re-engate', () => {
    const toggleSpy = vi.spyOn(voiceService, 'toggleListening');
    const { result } = renderHook(() => useVoice());

    act(() => {
      result.current.toggleConversationMode();
    });
    act(() => {
      vi.advanceTimersByTime(1_100);
    });
    expect(toggleSpy).toHaveBeenCalledTimes(1);

    // Vai para segundo plano: para a fala/escuta e limpa o re-engate.
    act(() => {
      definirVisibilidade(false);
    });

    // Volta: o modo conversa continua ativo — o ciclo deve re-engatar.
    act(() => {
      definirVisibilidade(true);
    });
    act(() => {
      vi.advanceTimersByTime(1_100);
    });

    expect(voiceService.isConversationMode).toBe(true);
    expect(toggleSpy).toHaveBeenCalledTimes(2);
  });
});
