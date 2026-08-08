import { useEffect, useState } from 'react';
import { Check, Play } from 'lucide-react';

import { cn } from '@/lib/cn';
import { voiceService } from '@/services/voice-service';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

const SAMPLE = 'Boa tarde. Sou o JARVIS.';

/**
 * Voz do assistente (Parte 7.1 §Voz).
 *
 * Não há aqui nenhuma voz nova a inventar, nem clonagem de ninguém — só a
 * lista do que o próprio sistema operativo já tem instalado. A voz robótica
 * de sempre costuma ser a única presente por omissão; no Windows, ir a
 * Definições → Hora e idioma → Voz e instalar uma voz "Natural" em português
 * é o que muda isto, de graça, sem API nenhuma paga — esta lista só mostra o
 * que aparecer depois disso.
 */
export function VoiceSettings(): React.JSX.Element | null {
  const voiceURI = useVoiceSettingsStore((state) => state.voiceURI);
  const setVoiceURI = useVoiceSettingsStore((state) => state.setVoiceURI);

  const [voices, setVoices] = useState(() => voiceService.availableVoices);

  useEffect(() => {
    // As vozes chegam de forma assíncrona nalguns motores — a lista começa
    // vazia e só se enche quando o evento dispara.
    const onVoicesChanged = (): void => setVoices(voiceService.availableVoices);
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      return () => speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    }
    return undefined;
  }, []);

  if (!voiceService.isSynthesisSupported) return null;

  if (voices.length === 0) {
    return (
      <p className="text-cap leading-relaxed text-t3">
        Não encontrei nenhuma voz portuguesa instalada no sistema. No Windows, isto costuma
        resolver-se em Definições → Hora e idioma → Voz.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Voz do assistente">
        <button
          type="button"
          role="radio"
          aria-checked={voiceURI === null}
          onClick={() => setVoiceURI(null)}
          className={cn(
            'flex items-center justify-between gap-2 rounded-input border px-3 py-2 text-left',
            'text-[12.5px] transition-all duration-hover ease-out',
            voiceURI === null
              ? 'border-accent bg-accent/[.08] text-accent'
              : 'border-line text-t2 hover:border-accent/35',
          )}
        >
          <span>Escolha automática</span>
          {voiceURI === null && <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
        </button>

        {voices.map((voice) => {
          const isActive = voiceURI === voice.voiceURI;

          return (
            <div
              key={voice.voiceURI}
              className={cn(
                'flex items-center gap-2 rounded-input border px-3 py-2',
                'text-[12.5px] transition-all duration-hover ease-out',
                isActive ? 'border-accent bg-accent/[.08] text-accent' : 'border-line text-t2',
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setVoiceURI(voice.voiceURI)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left hover:text-accent"
              >
                <span className="min-w-0 truncate">{voice.name}</span>
                {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
              </button>

              <button
                type="button"
                onClick={() => voiceService.speak(SAMPLE, undefined, voice.voiceURI)}
                aria-label={`Testar a voz ${voice.name}`}
                className="flex-shrink-0 rounded p-1 text-t3 transition-colors duration-hover hover:text-accent"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
