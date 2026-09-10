import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Mic, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/cn';
import { runIntent } from '@/services/voice/executor';
import { describeIntent, isCritical, parseSpeech } from '@/services/voice/intents';
import { useVoiceCorrectionStore } from '@/stores/use-voice-correction-store';

/**
 * Corrigir o que a voz ouviu (Parte 10 §Correção de erros).
 *
 * Mostrar a frase reconhecida já existia; faltava poder emendá-la. Sem isto,
 * um "abrir e-mails" ouvido como "abrir imails" obrigava a repetir o comando
 * em voz alta e a esperar que corresse melhor à segunda.
 *
 * O que se entende da frase aparece **enquanto se escreve**, e não depois de
 * executar: é a diferença entre corrigir e adivinhar. O `parseSpeech` é uma
 * função pura, e por isso isto custa uma chamada por tecla e nada mais.
 *
 * Não há segunda confirmação para os comandos que não se desfazem. A
 * confirmação da Parte 10 existe porque a voz falha; aqui a pessoa está a ler
 * "Fechar todas as janelas" escrito no ecrã e a carregar em Executar — pedir
 * outra vez era transformar uma salvaguarda em ruído.
 */
export function VoiceCorrection(): React.JSX.Element | null {
  const phrase = useVoiceCorrectionStore((state) => state.phrase);
  const requestId = useVoiceCorrectionStore((state) => state.requestId);
  const close = useVoiceCorrectionStore((state) => state.close);

  if (phrase === null) return null;

  /*
   * A `key` faz de cada abertura uma caixa nova.
   *
   * A alternativa era um efeito a repor o texto sempre que a frase mudasse, e
   * um `setState` dentro de um efeito é uma renderização em cascata que o
   * React desaconselha — aqui não é preciso nenhum: o estado inicial é a
   * frase, e o React trata do resto.
   */
  return <CorrectionDialog key={requestId} phrase={phrase} onClose={close} />;
}

function CorrectionDialog({
  phrase,
  onClose: close,
}: {
  readonly phrase: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  const [text, setText] = useState(phrase);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selecionada ao abrir: escrever por cima é o caso comum, e emendar uma
  // palavra continua a ser um clique.
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);

    return () => clearTimeout(timer);
  }, []);

  const parsed = useMemo(() => parseSpeech(text), [text]);

  const isEmpty = text.trim().length === 0;
  // Uma frase que não dá comando nenhum vira uma pergunta ao assistente — é o
  // que o `parseSpeech` faz, e a caixa diz isso em vez de fingir um comando.
  const isQuestion = parsed.intents.every((intent) => intent.kind === 'perguntar');

  const execute = (): void => {
    if (isEmpty) return;
    close();
    // Adiado um tick, como na paleta: deixa a caixa fechar antes de o comando
    // abrir uma janela por cima.
    const intents = parsed.intents;
    setTimeout(() => {
      for (const intent of intents) runIntent(intent);
    }, 60);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Corrigir o comando de voz"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className={cn(
        'fixed inset-0 z-palette flex items-start justify-center bg-[rgb(3_6_10_/_0.6)] backdrop-blur-[6px]',
        'px-5 pb-5 pt-[14vh] motion-safe:animate-window-in',
      )}
    >
      <div className="w-[min(560px,100%)] overflow-hidden rounded-modal border border-line-2 bg-glass/[.9] shadow-2 backdrop-blur-glass">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3">
          <Mic className="h-4 w-4 flex-shrink-0 text-t3" aria-hidden="true" />
          <p className="text-[12.5px] font-medium">Corrigir o que ouvi</p>
        </div>

        <div className="px-5 py-4">
          <label className="block">
            <span className="t-label mb-1.5 block">Comando</span>
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  close();
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  execute();
                }
              }}
              className={cn(
                'w-full rounded-input border border-line bg-tint/[.03] px-3 py-2.5',
                'text-[13.5px] outline-none transition-colors duration-hover',
                'placeholder:text-t3 focus:border-accent/45',
              )}
            />
          </label>

          <p className="t-label mb-1.5 mt-3.5">O que vou fazer</p>

          {isEmpty ? (
            <p className="text-[12px] text-t3">Escreva o comando.</p>
          ) : isQuestion ? (
            <p className="text-[12px] text-t3">
              Não é nenhum comando que eu conheça — vai como pergunta para o assistente.
            </p>
          ) : (
            <ul className="space-y-1">
              {parsed.intents.map((intent, index) => (
                <li
                  key={`${intent.kind}-${index}`}
                  className="flex items-center gap-2 text-[12.5px] text-t2"
                >
                  {isCritical(intent) && (
                    <TriangleAlert
                      className="h-3.5 w-3.5 flex-shrink-0 text-warn"
                      aria-hidden="true"
                    />
                  )}
                  {describeIntent(intent)}
                </li>
              ))}
            </ul>
          )}

        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={close}
            className={cn(
              'rounded-btn border border-line px-3.5 py-2 text-[12.5px] text-t2',
              'transition-colors duration-hover hover:text-t1',
            )}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={execute}
            disabled={isEmpty}
            className={cn(
              'flex items-center gap-2 rounded-btn border border-accent/35 bg-accent/[.08] px-3.5 py-2',
              'text-[12.5px] font-medium text-accent transition-all duration-hover ease-out',
              'hover:bg-accent/[.14] active:scale-[.98]',
              'disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-t3',
            )}
          >
            <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Executar
          </button>
        </div>
      </div>
    </div>
  );
}
