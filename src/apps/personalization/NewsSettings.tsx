import { useState } from 'react';
import { AlertTriangle, ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';

import { useNewsSettings } from '@/hooks/use-news-settings';
import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { useNewsSettingsStore } from '@/stores/use-news-settings-store';
import { looksLikeNewsApiKey, maskNewsApiKey } from '@/types/news-settings';

const NEWS_API_KEY_URL = 'https://newsapi.org/register';
const NEWS_API_ENDPOINT = 'https://newsapi.org/v2/top-headlines';

/**
 * Provedor de notícias (Peça 8, lote 2).
 *
 * A NewsAPI precisa de chave — por isso o molde é o da DeepSeek: a chave fica
 * no cofre do sistema, e só se mostra tapada. Sem chave, o widget continua com
 * as notícias simuladas de sempre. Diz-se por escrito o que sai do dispositivo
 * e para onde, antes de qualquer ligação.
 */
export function NewsSettings(): React.JSX.Element {
  // Aplica as preferências ao serviço sempre que mudam — redundante com o
  // App.tsx, mas garante a aplicação quando o componente é montado em testes.
  useNewsSettings();

  const settings = useNewsSettingsStore((state) => state.settings);
  const setApiKey = useNewsSettingsStore((state) => state.setApiKey);
  const setCountry = useNewsSettingsStore((state) => state.setCountry);
  const forgetKey = useNewsSettingsStore((state) => state.forgetKey);

  const [draft, setDraft] = useState('');
  const [isVisible, setVisible] = useState(false);

  const hasKey = settings.apiKey.length > 0;
  const isMalformed = draft.trim().length > 0 && !looksLikeNewsApiKey(draft);

  return (
    <div className="flex flex-col gap-s3">
      <p
        className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
        role="note"
      >
        <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
        <span>
          Os títulos das notícias pedidos saem deste dispositivo para{' '}
          <b>{NEWS_API_ENDPOINT}</b>. A chave fica guardada no cofre do sistema — o Gestor de
          Credenciais do Windows — e não sai nas cópias de segurança.
        </span>
      </p>

      {hasKey ? (
        <div className="flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-t3">Chave guardada no cofre</span>
            <span className="mono block truncate text-[12px]">
              {isVisible ? settings.apiKey : maskNewsApiKey(settings.apiKey)}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={isVisible ? 'Esconder a chave' : 'Mostrar a chave'}
            aria-pressed={isVisible}
            className="flex-shrink-0 rounded p-1.5 text-t3 transition-colors duration-hover hover:text-accent"
          >
            {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              forgetKey();
              setVisible(false);
            }}
            aria-label="Apagar a chave"
            className="flex-shrink-0 rounded p-1.5 text-t3 transition-colors duration-hover hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Chave da NewsAPI</span>
              <input
                type="password"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && looksLikeNewsApiKey(draft)) {
                    setApiKey(draft);
                    setDraft('');
                  }
                }}
                placeholder="Chave da NewsAPI"
                className={cn(
                  'mono w-full rounded-input border bg-tint/[.03] px-3 py-2',
                  'text-[12px] outline-none transition-colors duration-hover',
                  'placeholder:text-t3 focus:border-accent/45',
                  isMalformed ? 'border-warn/50' : 'border-line',
                )}
              />
            </label>

            <button
              type="button"
              disabled={!looksLikeNewsApiKey(draft)}
              onClick={() => {
                setApiKey(draft);
                setDraft('');
              }}
              className={cn(
                'flex-shrink-0 rounded-btn border px-3.5 py-2 text-[12.5px] font-medium',
                'transition-all duration-hover ease-out',
                looksLikeNewsApiKey(draft)
                  ? 'border-accent/50 bg-accent/[.08] text-accent hover:bg-accent/[.14] active:scale-[.98]'
                  : 'cursor-not-allowed border-line text-t3 opacity-60',
              )}
            >
              Guardar a chave
            </button>
          </div>

          {isMalformed && (
            <p className="mt-1.5 text-[11px] text-warn">
              Uma chave da NewsAPI é uma sequência longa de letras e números. Isto não parece uma.
            </p>
          )}

          <button
            type="button"
            onClick={() => void getPlatformAdapter().openExternal(NEWS_API_KEY_URL)}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-t3 underline transition-colors duration-hover hover:text-accent"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Obter uma chave em newsapi.org
          </button>
        </div>
      )}

      <label className="block">
        <span className="t-label mb-1.5 block">País do topo de notícias</span>
        <input
          type="text"
          defaultValue={settings.country}
          onBlur={(event) => setCountry(event.target.value)}
          placeholder="pt"
          aria-label="País das notícias"
          className="mono w-full max-w-[140px] rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
        />
        <span className="mt-1.5 block text-cap text-t3">
          Código ISO de duas letras — <span className="mono">pt</span> para Portugal,{' '}
          <span className="mono">br</span> para o Brasil, <span className="mono">us</span> para os
          Estados Unidos. A categoria de cada notícia é adivinhada pelas palavras, porque o topo
          geral da NewsAPI não a devolve.
        </span>
      </label>
    </div>
  );
}
