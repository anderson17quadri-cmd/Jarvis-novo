import { useCallback, useState } from 'react';
import { Delete } from 'lucide-react';

import { cn } from '@/lib/cn';

/** Quantos dígitos o PIN tem. */
const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'apagar'] as const;

interface PinKeypadProps {
  readonly onComplete: () => void;
  readonly onCancel: () => void;
}

/**
 * Teclado numérico do PIN (Parte 5 §PIN).
 *
 * Botões circulares com ripple e feedback visual. Qualquer PIN de quatro
 * dígitos entra — é uma demonstração, e o ecrã diz isso.
 */
export function PinKeypad({ onComplete, onCancel }: PinKeypadProps): React.JSX.Element {
  const [digits, setDigits] = useState('');

  const press = useCallback(
    (key: string): void => {
      if (key === 'apagar') {
        setDigits((current) => current.slice(0, -1));
        return;
      }

      setDigits((current) => {
        const next = (current + key).slice(0, PIN_LENGTH);
        if (next.length === PIN_LENGTH) {
          // Deixa o último ponto acender antes de sair.
          setTimeout(onComplete, 260);
        }
        return next;
      });
    },
    [onComplete],
  );

  return (
    <div className="mt-s3">
      <div className="mb-s3 flex justify-center gap-3" aria-label={`PIN de ${PIN_LENGTH} dígitos`}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-3 w-3 rounded-full border transition-all duration-hover ease-out',
              index < digits.length
                ? 'border-accent bg-accent shadow-glow'
                : 'border-line-2 bg-transparent',
            )}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="mx-auto grid w-[min(260px,80%)] grid-cols-3 gap-2.5">
        {KEYS.map((key, index) =>
          key === '' ? (
            <span key={`empty-${index}`} />
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              aria-label={key === 'apagar' ? 'Apagar último dígito' : `Dígito ${key}`}
              className={cn(
                'mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full',
                'border border-line text-[17px] font-medium text-t2',
                'transition-all duration-hover ease-out active:scale-95',
                'hover:border-accent/35 hover:bg-accent/5 hover:text-accent hover:shadow-glow',
              )}
            >
              {key === 'apagar' ? <Delete className="h-[18px] w-[18px]" /> : key}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="mt-s3 w-full text-center text-[11.5px] text-t3 transition-colors hover:text-accent"
      >
        Voltar à palavra-passe
      </button>
    </div>
  );
}
