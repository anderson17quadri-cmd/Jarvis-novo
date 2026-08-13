import { useState } from 'react';
import { AlertTriangle, ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';

import { useWebSearchSettings } from '@/hooks/use-web-search-settings';
import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { useWebSearchSettingsStore } from '@/stores/use-web-search-settings-store';
import { looksLikeBraveSearchKey, maskWebSearchKey } from '@/types/web-search-settings';

const BRAVE_SEARCH_KEY_URL = 'https://brave.com/search/api/';
const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Pesquisa web (Peça 18).
 *
 * A Brave Search precisa de chave — por isso o molde é o das notícias: a chave
 * fica no cofre do sistema, e só se mostra tapada. Sem chave, a ferramenta
 * `pesquisar_na_web` responde com resultados simulados, e diz que o são. Diz-se
 * por escrito o que sai do dispositivo e para onde, antes de qualquer ligação.
 */
export function SearchSettings(): React.JSX.Element {
  // Aplica as preferências ao serviço sempre que mudam — redundante com o
  // App.tsx, mas garante a aplicação quando o componente é montado em testes.
  useWebSearchSettings();

  const settings = useWebSearchSettingsStore((state) => state.settings);
  const setApiKey = useWebSearchSettingsStore((state) => state.setApiKey);
  const forgetKey = useWebSearchSettingsStore((state) => state.forgetKey);

  const [draft, setDraft] = useState('');
  const [isVisible, setVisible] = useState(false);

  const hasKey = settings.apiKey.length > 0;
  const isMalformed = draft.trim().length > 0 && !looksLikeBraveSearchKey(draft);

  return (
    <div className="flex flex-col gap-s3">
      <p
        className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
        role="note"
      >
        <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
        <span>
          O termo de cada pesquisa sai deste dispositivo para{' '}
          <b>{BRAVE_SEARCH_ENDPOINT}</b>. A chave fica guardada no cofre do sistema — o Gestor de
          Credenciais do Windows — e não sai nas cópias de segurança.
        </span>
      </p>

      {hasKey ? (
        <div className="flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-t3">Chave guardada no cofre</span>
            <span className="mono block truncate text-[12px]">
              {isVisible ? settings.apiKey : maskWebSearchKey(settings.apiKey)}
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
              <span className="sr-only">Chave da Brave Search</span>
              <input
                type="password"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && looksLikeBraveSearchKey(draft)) {
                    setApiKey(draft);
                    setDraft('');
                  }
                }}
                placeholder="Chave da Brave Search"
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
              disabled={!looksLikeBraveSearchKey(draft)}
              onClick={() => {
                setApiKey(draft);
                setDraft('');
              }}
              className={cn(
                'flex-shrink-0 rounded-btn border px-3.5 py-2 text-[12.5px] font-medium',
                'transition-all duration-hover ease-out',
                looksLikeBraveSearchKey(draft)
                  ? 'border-accent/50 bg-accent/[.08] text-accent hover:bg-accent/[.14] active:scale-[.98]'
                  : 'cursor-not-allowed border-line text-t3 opacity-60',
              )}
            >
              Guardar a chave
            </button>
          </div>

          {isMalformed && (
            <p className="mt-1.5 text-[11px] text-warn">
              Uma chave da Brave Search é uma sequência longa de letras e números. Isto não parece
              uma.
            </p>
          )}

          <button
            type="button"
            onClick={() => void getPlatformAdapter().openExternal(BRAVE_SEARCH_KEY_URL)}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-t3 underline transition-colors duration-hover hover:text-accent"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Obter uma chave em brave.com/search/api
          </button>
        </div>
      )}
    </div>
  );
}
