import { useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';

import { useWebSearchSettings } from '@/hooks/use-web-search-settings';
import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { useWebSearchSettingsStore } from '@/stores/use-web-search-settings-store';
import {
  DEFAULT_SEARXNG_BASE_URL,
  looksLikeBraveSearchKey,
  maskWebSearchKey,
  type WebSearchProviderChoice,
} from '@/types/web-search-settings';

const BRAVE_SEARCH_KEY_URL = 'https://brave.com/search/api/';
const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

const PROVIDERS: readonly { readonly id: WebSearchProviderChoice; readonly name: string; readonly description: string }[] = [
  { id: 'mock', name: 'Simulado', description: 'Resultados de exemplo — nunca sai nada desta máquina.' },
  { id: 'searxng', name: 'SearXNG', description: 'Uma instância local, sem chave nem conta.' },
  { id: 'brave', name: 'Brave Search', description: 'API da Brave — exige uma chave.' },
];

/**
 * Pesquisa web (Peça 18; provedor SearXNG no item 28, 20/08/2026).
 *
 * Três provedores, escolha explícita. A SearXNG e a Brave têm o mesmo aviso
 * de fundo, por palavras diferentes: pesquisar na internet exige a
 * internet — o termo de cada pesquisa sai desta máquina sempre, para um lado
 * ou para o outro. Dizer "tudo local" seria mentira. O que muda entre elas é
 * quem recebe o termo: a Brave, com chave e conta; ou uma instância de
 * SearXNG (correr localmente, ver `wake-word-service` como precedente de
 * "serviço à parte" — mas o SearXNG não é gerido por esta app, é sempre do
 * utilizador), sem chave, sem conta, sem intermediário comercial.
 */
export function SearchSettings(): React.JSX.Element {
  // Aplica as preferências ao serviço sempre que mudam — redundante com o
  // App.tsx, mas garante a aplicação quando o componente é montado em testes.
  useWebSearchSettings();

  const settings = useWebSearchSettingsStore((state) => state.settings);
  const setProviderChoice = useWebSearchSettingsStore((state) => state.setProvider);
  const setApiKey = useWebSearchSettingsStore((state) => state.setApiKey);
  const forgetKey = useWebSearchSettingsStore((state) => state.forgetKey);
  const setSearxngBaseUrl = useWebSearchSettingsStore((state) => state.setSearxngBaseUrl);

  const [draft, setDraft] = useState('');
  const [isVisible, setVisible] = useState(false);
  const [searxngDraft, setSearxngDraft] = useState(settings.searxngBaseUrl);

  const hasKey = settings.apiKey.length > 0;
  const isMalformed = draft.trim().length > 0 && !looksLikeBraveSearchKey(draft);

  return (
    <div className="flex flex-col gap-s3">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
        role="radiogroup"
        aria-label="Provedor de pesquisa web"
      >
        {PROVIDERS.map((provider) => {
          const isActive = settings.provider === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setProviderChoice(provider.id)}
              className={cn(
                'rounded-input border p-3 text-left transition-all duration-hover ease-out',
                'hover:border-accent/35 hover:bg-accent/[.04]',
                isActive ? 'border-accent bg-accent/[.08]' : 'border-line',
              )}
            >
              <span className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium">
                {provider.name}
                {isActive && <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />}
              </span>
              <span className="block text-[11px] leading-relaxed text-t3">{provider.description}</span>
            </button>
          );
        })}
      </div>

      {settings.provider === 'searxng' && (
        <>
          <p
            className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
            role="note"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
            <span>
              O termo de cada pesquisa sai deste dispositivo na mesma — para a instância de SearXNG
              abaixo, que depois pergunta a vários motores públicos por ti. O que isto tira é a
              chave, a conta e o intermediário comercial, não a ligação à internet.
            </span>
          </p>

          <label className="block">
            <span className="t-label mb-1.5 block">Endereço da instância</span>
            <input
              type="text"
              value={searxngDraft}
              onChange={(event) => setSearxngDraft(event.target.value)}
              onBlur={() => setSearxngBaseUrl(searxngDraft || DEFAULT_SEARXNG_BASE_URL)}
              placeholder={DEFAULT_SEARXNG_BASE_URL}
              aria-label="Endereço do SearXNG"
              className="mono w-full rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
            />
            <span className="mt-1.5 block text-cap text-t3">
              Só {DEFAULT_SEARXNG_BASE_URL} (o endereço de origem) está autorizado a falar com o
              JARVIS. Mudar a porta aqui sem mudar também a política de segurança da app deixa o
              pedido bloqueado. Instalar e correr o SearXNG é à parte (Docker ou Python) —
              <button
                type="button"
                onClick={() => void getPlatformAdapter().openExternal('https://docs.searxng.org/admin/installation-docker.html')}
                className="ml-1 underline transition-colors duration-hover hover:text-accent"
              >
                ver a instalação com Docker
              </button>
              .
            </span>
          </label>
        </>
      )}

      {settings.provider === 'brave' && (
        <>
          <p
            className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
            role="note"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
            <span>
              O termo de cada pesquisa sai deste dispositivo para{' '}
              <b>{BRAVE_SEARCH_ENDPOINT}</b>. A chave fica guardada no cofre do sistema — o Gestor
              de Credenciais do Windows — e não sai nas cópias de segurança.
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
        </>
      )}
    </div>
  );
}
