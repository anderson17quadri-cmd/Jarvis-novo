import { useEffect, useState } from 'react';
import { Check, Mic, Play, Square } from 'lucide-react';

import { cn } from '@/lib/cn';
import { useVoiceSampleRecorder } from '@/hooks/use-voice-sample-recorder';
import { voiceService, type CloneVoiceInfo, type VoiceSelection } from '@/services/voice-service';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

const SAMPLE = 'Boa tarde. Sou o JARVIS.';

function isSameSelection(a: VoiceSelection, b: VoiceSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'sistema' && b.kind === 'sistema') return a.voiceURI === b.voiceURI;
  if (a.kind === 'clonada' && b.kind === 'clonada') return a.nome === b.nome;
  return true;
}

interface VoiceOptionProps {
  readonly label: string;
  readonly isActive: boolean;
  readonly onSelect: () => void;
  readonly onTest: () => void;
  readonly testLabel: string;
}

function VoiceOption({ label, isActive, onSelect, onTest, testLabel }: VoiceOptionProps): React.JSX.Element {
  return (
    <div
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
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left hover:text-accent"
      >
        <span className="min-w-0 truncate">{label}</span>
        {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
      </button>

      <button
        type="button"
        onClick={onTest}
        aria-label={testLabel}
        className="flex-shrink-0 rounded p-1 text-t3 transition-colors duration-hover hover:text-accent"
      >
        <Play className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Voz do assistente (Parte 7.1 §Voz, §Voz clonada local).
 *
 * Duas fontes, no mesmo seletor:
 * - **Vozes do sistema** — o que o Windows (ou o browser) já tem instalado.
 *   Não há aqui nenhuma voz nova a inventar; a voz robótica de sempre costuma
 *   ser a única presente por omissão, e instalar uma voz "Natural" em
 *   português (Definições → Hora e idioma → Voz) é o que muda isto, de
 *   graça, sem API paga.
 * - **Voz clonada local** (`voice-clone-service/`) — só aparece se o serviço
 *   estiver a correr no PC. "A minha voz" é a amostra que a própria pessoa
 *   gravou (nunca a de outra pessoa sem autorização, nem uma personagem);
 *   as restantes são vozes prontas do próprio modelo XTTS-v2, gravadas por
 *   atores que autorizaram o uso — nenhuma delas é clonada por nós.
 */
export function VoiceSettings(): React.JSX.Element | null {
  const selection = useVoiceSettingsStore((state) => state.selection);
  const setSelection = useVoiceSettingsStore((state) => state.setSelection);

  const [systemVoices, setSystemVoices] = useState(() => voiceService.availableVoices);
  const [cloneVoices, setCloneVoices] = useState<readonly CloneVoiceInfo[]>([]);
  const [cloneOwnVoiceAvailable, setCloneOwnVoiceAvailable] = useState(false);
  const [cloneServiceAvailable, setCloneServiceAvailable] = useState(false);
  const sampleRecorder = useVoiceSampleRecorder(() => setCloneOwnVoiceAvailable(true));

  useEffect(() => {
    // As vozes chegam de forma assíncrona nalguns motores — a lista começa
    // vazia e só se enche quando o evento dispara.
    const onVoicesChanged = (): void => setSystemVoices(voiceService.availableVoices);
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      return () => speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    }
    return undefined;
  }, []);

  useEffect(() => {
    let cancelado = false;

    void voiceService.getCloneServiceInfo().then((info) => {
      if (cancelado) return;
      setCloneServiceAvailable(info.disponivel);
      setCloneOwnVoiceAvailable(info.vozPropriaGravada);
      setCloneVoices(info.vozesProntas);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  if (!voiceService.isSynthesisSupported && !cloneServiceAvailable) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Voz do assistente">
        <button
          type="button"
          role="radio"
          aria-checked={selection.kind === 'auto'}
          onClick={() => setSelection({ kind: 'auto' })}
          className={cn(
            'flex items-center justify-between gap-2 rounded-input border px-3 py-2 text-left',
            'text-[12.5px] transition-all duration-hover ease-out',
            selection.kind === 'auto'
              ? 'border-accent bg-accent/[.08] text-accent'
              : 'border-line text-t2 hover:border-accent/35',
          )}
        >
          <span>Escolha automática</span>
          {selection.kind === 'auto' && <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
        </button>

        {systemVoices.length === 0 ? (
          <p className="px-3 py-1 text-cap leading-relaxed text-t3">
            Não encontrei nenhuma voz portuguesa instalada no sistema. No Windows, isto costuma
            resolver-se em Definições → Hora e idioma → Voz.
          </p>
        ) : (
          systemVoices.map((voice) => {
            const optionSelection: VoiceSelection = { kind: 'sistema', voiceURI: voice.voiceURI };
            return (
              <VoiceOption
                key={voice.voiceURI}
                label={voice.name}
                isActive={isSameSelection(selection, optionSelection)}
                onSelect={() => setSelection(optionSelection)}
                onTest={() => voiceService.speak(SAMPLE, undefined, optionSelection)}
                testLabel={`Testar a voz ${voice.name}`}
              />
            );
          })
        )}
      </div>

      {cloneServiceAvailable && (
        <div className="flex flex-col gap-1">
          <p className="px-1 text-cap text-t3">Voz clonada local</p>

          <div className="flex flex-col gap-1.5 rounded-input border border-line px-3 py-2">
            {sampleRecorder.status === 'a gravar' ? (
              <div className="flex items-center justify-between gap-2 text-[12.5px] text-accent">
                <span>A gravar… fala agora ({sampleRecorder.segundosRestantes}s)</span>
                <button
                  type="button"
                  onClick={() => sampleRecorder.stopEarly()}
                  aria-label="Terminar a gravação e enviar"
                  className="flex-shrink-0 rounded p-1 text-t3 transition-colors duration-hover hover:text-accent"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => sampleRecorder.start()}
                disabled={sampleRecorder.status === 'a enviar'}
                className="flex items-center gap-2 text-[12.5px] text-t2 transition-colors duration-hover hover:text-accent disabled:opacity-50"
              >
                <Mic className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  {sampleRecorder.status === 'a enviar'
                    ? 'A enviar…'
                    : cloneOwnVoiceAvailable
                      ? 'Gravar de novo a minha voz'
                      : 'Gravar a minha voz'}
                </span>
              </button>
            )}

            {sampleRecorder.status === 'sucesso' && (
              <p className="text-cap text-accent">Gravado. Já podes escolher &quot;A minha voz&quot; abaixo.</p>
            )}
            {sampleRecorder.status === 'erro' && sampleRecorder.erro && (
              <p className="text-cap text-danger">{sampleRecorder.erro}</p>
            )}
          </div>

          <div role="radiogroup" aria-label="Voz clonada local" className="flex flex-col gap-1">
            {cloneOwnVoiceAvailable && (
              <VoiceOption
                label="A minha voz"
                isActive={isSameSelection(selection, { kind: 'clonada', nome: null })}
                onSelect={() => setSelection({ kind: 'clonada', nome: null })}
                onTest={() => voiceService.speak(SAMPLE, undefined, { kind: 'clonada', nome: null })}
                testLabel="Testar a minha voz clonada"
              />
            )}

            {cloneVoices.map((voz) => {
              const optionSelection: VoiceSelection = { kind: 'clonada', nome: voz.nome };
              return (
                <VoiceOption
                  key={voz.nome}
                  label={`${voz.nome} — ${voz.descricao}`}
                  isActive={isSameSelection(selection, optionSelection)}
                  onSelect={() => setSelection(optionSelection)}
                  onTest={() => voiceService.speak(SAMPLE, undefined, optionSelection)}
                  testLabel={`Testar a voz ${voz.nome}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
