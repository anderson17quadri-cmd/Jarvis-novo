import { useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { useAiSettingsStore } from '@/stores/use-ai-settings-store';
import {
  AI_PROVIDERS,
  DEEPSEEK_MODELS,
  looksLikeApiKey,
  maskApiKey,
  type AiProviderId,
} from '@/types/ai-provider-settings';

/**
 * Provedor de IA (Partes 7.1 e 12).
 *
 * O ecrã onde se escolhe quem responde, e onde se cola a chave.
 *
 * Diz três coisas por escrito, antes de qualquer ligação: **o que sai do
 * dispositivo**, **para onde vai**, e **onde a chave fica guardada**. Um
 * sistema que começa a enviar o que se escreve para servidores de terceiros
 * sem o dizer trai quem o usa, por muito bem que responda depois.
 */
export function AiSettings(): React.JSX.Element {
  const settings = useAiSettingsStore((state) => state.settings);
  const setProvider = useAiSettingsStore((state) => state.setProvider);
  const setApiKey = useAiSettingsStore((state) => state.setApiKey);
  const setModel = useAiSettingsStore((state) => state.setModel);
  const forgetKey = useAiSettingsStore((state) => state.forgetKey);

  const [draft, setDraft] = useState('');
  const [isVisible, setVisible] = useState(false);

  const hasKey = settings.apiKey.length > 0;
  const isMalformed = draft.trim().length > 0 && !looksLikeApiKey(draft);

  return (
    <div className="flex flex-col gap-s3">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        role="radiogroup"
        aria-label="Provedor de IA"
      >
        {(Object.keys(AI_PROVIDERS) as AiProviderId[]).map((id) => {
          const provider = AI_PROVIDERS[id];
          const isActive = settings.provider === id;

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setProvider(id)}
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
              <span className="block text-[11px] leading-relaxed text-t3">
                {provider.description}
              </span>
            </button>
          );
        })}
      </div>

      {settings.provider === 'deepseek' && (
        <>
          <p
            className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
            role="note"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
            <span>
              O que escrever no assistente, o histórico da conversa aberta e um resumo do estado do
              sistema saem deste dispositivo para <b>{AI_PROVIDERS.deepseek.endpoint}</b>. A chave
              fica guardada aqui, em armazenamento local — <b>não é um cofre</b>. Um cofre a sério
              exige o chaveiro do sistema, que só existe na versão nativa.
            </span>
          </p>

          {hasKey ? (
            <div className="flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-t3">Chave guardada</span>
                <span className="mono block truncate text-[12px]">
                  {isVisible ? settings.apiKey : maskApiKey(settings.apiKey)}
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
                  <span className="sr-only">Chave da API</span>
                  <input
                    type="password"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && looksLikeApiKey(draft)) {
                        setApiKey(draft);
                        setDraft('');
                      }
                    }}
                    placeholder="sk-…"
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
                  disabled={!looksLikeApiKey(draft)}
                  onClick={() => {
                    setApiKey(draft);
                    setDraft('');
                  }}
                  className={cn(
                    'flex-shrink-0 rounded-btn border px-3.5 py-2 text-[12.5px] font-medium',
                    'transition-all duration-hover ease-out',
                    looksLikeApiKey(draft)
                      ? 'border-accent/50 bg-accent/[.08] text-accent hover:bg-accent/[.14] active:scale-[.98]'
                      : 'cursor-not-allowed border-line text-t3 opacity-60',
                  )}
                >
                  Guardar a chave
                </button>
              </div>

              {isMalformed && (
                <p className="mt-1.5 text-[11px] text-warn">
                  Uma chave da DeepSeek começa por <span className="mono">sk-</span>. Isto não
                  parece uma.
                </p>
              )}

              <button
                type="button"
                onClick={() => void getPlatformAdapter().openExternal(AI_PROVIDERS.deepseek.keyUrl)}
                className="mt-2 flex items-center gap-1.5 text-[11px] text-t3 underline transition-colors duration-hover hover:text-accent"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Obter uma chave em platform.deepseek.com
              </button>
            </div>
          )}

          <div>
            <p className="t-label mb-1.5">Modelo</p>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Modelo">
              {DEEPSEEK_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.model === model.id}
                  onClick={() => setModel(model.id)}
                  title={model.description}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10.5px] transition-all duration-hover ease-out',
                    settings.model === model.id
                      ? 'border-accent bg-accent/[.1] text-accent'
                      : 'border-line text-t3 hover:border-accent/35 hover:text-t2',
                  )}
                >
                  {model.name}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-cap text-t3">
              {DEEPSEEK_MODELS.find((model) => model.id === settings.model)?.description}
            </p>
          </div>
        </>
      )}

      {settings.provider === 'regras' && (
        <p className="text-cap leading-relaxed text-t3">
          Nada sai do dispositivo. O assistente responde ao que o sistema sabe — hora,
          meteorologia, janelas abertas, notificações e memória — e diz que não sabe ao resto, em
          vez de improvisar.
        </p>
      )}
    </div>
  );
}
