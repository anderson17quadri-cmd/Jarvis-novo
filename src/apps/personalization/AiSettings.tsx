import { useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, Search, Trash2, Wand2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { CLAUDE_MODELS } from '@/services/ai-providers/claude-provider';
import { LONG_PROMPT_CHARS } from '@/services/ai-providers/model-choice';
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
  const setAutoModel = useAiSettingsStore((state) => state.setAutoModel);
  const forgetKey = useAiSettingsStore((state) => state.forgetKey);
  const setClaudeApiKey = useAiSettingsStore((state) => state.setClaudeApiKey);
  const setClaudeModel = useAiSettingsStore((state) => state.setClaudeModel);
  const forgetClaudeKey = useAiSettingsStore((state) => state.forgetClaudeKey);
  const setOllamaModel = useAiSettingsStore((state) => state.setOllamaModel);
  const setOllamaBaseUrl = useAiSettingsStore((state) => state.setOllamaBaseUrl);

  const [draft, setDraft] = useState('');
  const [isVisible, setVisible] = useState(false);
  const [claudeDraft, setClaudeDraft] = useState('');
  const [isClaudeVisible, setClaudeVisible] = useState(false);
  const [ollamaModelDraft, setOllamaModelDraft] = useState(settings.ollamaModel);
  const [isDetectingOllama, setDetectingOllama] = useState(false);
  const [ollamaModelsFound, setOllamaModelsFound] = useState<readonly string[] | null>(null);
  const [ollamaDetectError, setOllamaDetectError] = useState<string | null>(null);

  const hasKey = settings.apiKey.length > 0;
  const isMalformed = draft.trim().length > 0 && !looksLikeApiKey(draft);
  const hasClaudeKey = settings.claudeApiKey.length > 0;
  const isClaudeMalformed = claudeDraft.trim().length > 0 && !looksLikeApiKey(claudeDraft);

  /**
   * Quantos provedores remotos, além do escolhido, têm chave guardada — é o
   * que entra na cadeia automática se o escolhido falhar (Parte 12
   * §Orquestrador multi-provedor).
   */
  const configuredElsewhere = [
    settings.provider !== 'deepseek' && hasKey,
    settings.provider !== 'claude' && hasClaudeKey,
    settings.provider !== 'ollama' && settings.ollamaModel.trim().length > 0,
  ].filter(Boolean).length;

  /**
   * Pergunta ao próprio Ollama que modelos já tens instalados, em vez de
   * teres de escrever o nome à mão e confiar que acertaste. `GET
   * /api/tags` é o próprio endpoint do Ollama para isto — nada de novo do
   * lado do JARVIS, só perguntar antes de assumir.
   */
  const detectOllamaModels = async (): Promise<void> => {
    setDetectingOllama(true);
    setOllamaDetectError(null);
    setOllamaModelsFound(null);

    try {
      const resposta = await fetch(`${settings.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (!resposta.ok) throw new Error(`o Ollama devolveu ${resposta.status}`);

      const corpo = (await resposta.json()) as { models?: readonly { name: string }[] };
      const nomes = (corpo.models ?? []).map((modelo) => modelo.name);

      if (nomes.length === 0) {
        setOllamaDetectError(
          'O Ollama respondeu, mas não tem nenhum modelo instalado. "ollama pull" um primeiro.',
        );
      } else {
        setOllamaModelsFound(nomes);
      }
    } catch {
      setOllamaDetectError(
        `Não consegui perguntar ao Ollama em ${settings.ollamaBaseUrl} — confirma que está a correr.`,
      );
    } finally {
      setDetectingOllama(false);
    }
  };

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

      {configuredElsewhere > 0 && (
        <p className="text-cap leading-relaxed text-t3" role="note">
          Se o <b>{AI_PROVIDERS[settings.provider].name}</b> falhar — sem saldo, sem chave aceite,
          ou de rastos — o assistente tenta sozinho o próximo provedor que tiver chave guardada, e
          avisa sempre antes de continuar.
        </p>
      )}

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

            <button
              type="button"
              role="switch"
              aria-checked={settings.autoModel}
              onClick={() => setAutoModel(!settings.autoModel)}
              className={cn(
                'mb-2 flex w-full items-center gap-2.5 rounded-input border px-3 py-2 text-left',
                'transition-all duration-hover ease-out',
                settings.autoModel
                  ? 'border-accent/40 bg-accent/[.06]'
                  : 'border-line hover:border-accent/25',
              )}
            >
              <Wand2
                className={cn('h-3.5 w-3.5 flex-shrink-0', settings.autoModel ? 'text-accent' : 'text-t3')}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium">Escolher o modelo por pedido</span>
                <span className="block text-cap leading-relaxed text-t3">
                  Perguntas sobre código, pedidos que peçam raciocínio e textos com mais de{' '}
                  {LONG_PROMPT_CHARS} caracteres vão ao Reasoner. O resto vai ao Chat, que é mais
                  rápido e mais barato. Cada resposta diz qual respondeu.
                </span>
              </span>
            </button>

            <div
              className={cn(
                'flex flex-wrap gap-1 transition-opacity duration-hover',
                settings.autoModel && 'opacity-45',
              )}
              role="radiogroup"
              aria-label="Modelo"
            >
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
              {settings.autoModel
                ? 'Com a escolha por pedido ligada, isto passa a ser só o modelo de recurso — o usado quando nada denuncia a tarefa.'
                : DEEPSEEK_MODELS.find((model) => model.id === settings.model)?.description}
            </p>
          </div>
        </>
      )}

      {settings.provider === 'claude' && (
        <>
          <p
            className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
            role="note"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
            <span>
              O que escrever no assistente, o histórico da conversa aberta e um resumo do estado do
              sistema saem deste dispositivo para <b>{AI_PROVIDERS.claude.endpoint}</b>. A chave
              fica guardada aqui, em armazenamento local — <b>não é um cofre</b>. Um cofre a sério
              exige o chaveiro do sistema, que só existe na versão nativa.
            </span>
          </p>

          {hasClaudeKey ? (
            <div className="flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-t3">Chave guardada</span>
                <span className="mono block truncate text-[12px]">
                  {isClaudeVisible ? settings.claudeApiKey : maskApiKey(settings.claudeApiKey)}
                </span>
              </span>

              <button
                type="button"
                onClick={() => setClaudeVisible((value) => !value)}
                aria-label={isClaudeVisible ? 'Esconder a chave da Claude' : 'Mostrar a chave da Claude'}
                aria-pressed={isClaudeVisible}
                className="flex-shrink-0 rounded p-1.5 text-t3 transition-colors duration-hover hover:text-accent"
              >
                {isClaudeVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  forgetClaudeKey();
                  setClaudeVisible(false);
                }}
                aria-label="Apagar a chave da Claude"
                className="flex-shrink-0 rounded p-1.5 text-t3 transition-colors duration-hover hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Chave da Claude</span>
                  <input
                    type="password"
                    value={claudeDraft}
                    onChange={(event) => setClaudeDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && looksLikeApiKey(claudeDraft)) {
                        setClaudeApiKey(claudeDraft);
                        setClaudeDraft('');
                      }
                    }}
                    placeholder="sk-ant-…"
                    className={cn(
                      'mono w-full rounded-input border bg-tint/[.03] px-3 py-2',
                      'text-[12px] outline-none transition-colors duration-hover',
                      'placeholder:text-t3 focus:border-accent/45',
                      isClaudeMalformed ? 'border-warn/50' : 'border-line',
                    )}
                  />
                </label>

                <button
                  type="button"
                  disabled={!looksLikeApiKey(claudeDraft)}
                  onClick={() => {
                    setClaudeApiKey(claudeDraft);
                    setClaudeDraft('');
                  }}
                  className={cn(
                    'flex-shrink-0 rounded-btn border px-3.5 py-2 text-[12.5px] font-medium',
                    'transition-all duration-hover ease-out',
                    looksLikeApiKey(claudeDraft)
                      ? 'border-accent/50 bg-accent/[.08] text-accent hover:bg-accent/[.14] active:scale-[.98]'
                      : 'cursor-not-allowed border-line text-t3 opacity-60',
                  )}
                >
                  Guardar a chave
                </button>
              </div>

              {isClaudeMalformed && (
                <p className="mt-1.5 text-[11px] text-warn">
                  Uma chave da Anthropic começa por <span className="mono">sk-</span>. Isto não
                  parece uma.
                </p>
              )}

              <button
                type="button"
                onClick={() => void getPlatformAdapter().openExternal(AI_PROVIDERS.claude.keyUrl)}
                className="mt-2 flex items-center gap-1.5 text-[11px] text-t3 underline transition-colors duration-hover hover:text-accent"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Obter uma chave em console.anthropic.com
              </button>
            </div>
          )}

          <div>
            <p className="t-label mb-1.5">Modelo</p>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Modelo da Claude">
              {CLAUDE_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.claudeModel === model.id}
                  onClick={() => setClaudeModel(model.id)}
                  title={model.description}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10.5px] transition-all duration-hover ease-out',
                    settings.claudeModel === model.id
                      ? 'border-accent bg-accent/[.1] text-accent'
                      : 'border-line text-t3 hover:border-accent/35 hover:text-t2',
                  )}
                >
                  {model.name}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-cap text-t3">
              {CLAUDE_MODELS.find((model) => model.id === settings.claudeModel)?.description}
            </p>
          </div>

          <p className="text-cap leading-relaxed text-t3">
            Ainda não pede ferramentas — abre janelas, cria tarefas ou muda de tema só a DeepSeek,
            por agora. A Claude responde em conversa.
          </p>
        </>
      )}

      {settings.provider === 'ollama' && (
        <>
          <p className="text-cap leading-relaxed text-t3">
            Nada sai do dispositivo — é um modelo a correr no próprio PC. Sem chave: não há
            ninguém do outro lado a cobrar.
          </p>

          <label className="block">
            <span className="t-label mb-1.5 block">Modelo instalado</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={ollamaModelDraft}
                onChange={(event) => setOllamaModelDraft(event.target.value)}
                onBlur={() => setOllamaModel(ollamaModelDraft)}
                placeholder="llama3.1"
                aria-label="Modelo do Ollama"
                className="mono w-full min-w-0 flex-1 rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
              />
              <button
                type="button"
                onClick={() => void detectOllamaModels()}
                disabled={isDetectingOllama}
                aria-label="Detetar modelos instalados no Ollama"
                className={cn(
                  'flex flex-shrink-0 items-center gap-1.5 rounded-btn border px-3 py-2 text-[12px] font-medium',
                  'border-line text-t2 transition-all duration-hover ease-out hover:border-accent/35 hover:text-accent',
                  isDetectingOllama && 'cursor-not-allowed opacity-60',
                )}
              >
                <Search className={cn('h-3.5 w-3.5', isDetectingOllama && 'animate-pulse')} aria-hidden="true" />
                {isDetectingOllama ? 'A perguntar…' : 'Detetar'}
              </button>
            </div>
            <span className="mt-1.5 block text-cap text-t3">
              O nome tal como aparece em <span className="mono">ollama list</span> no teu
              terminal, ou "Detetar" para perguntar ao próprio Ollama — o sistema não adivinha
              que modelos tens instalados.
            </span>

            {ollamaDetectError && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-warn">
                <AlertTriangle className="mt-px h-3 w-3 flex-shrink-0" aria-hidden="true" />
                {ollamaDetectError}
              </p>
            )}

            {ollamaModelsFound && (
              <div
                className="mt-2 flex flex-wrap gap-1.5"
                role="radiogroup"
                aria-label="Modelos detetados no Ollama"
              >
                {ollamaModelsFound.map((nome) => (
                  <button
                    key={nome}
                    type="button"
                    role="radio"
                    aria-checked={settings.ollamaModel === nome}
                    onClick={() => {
                      setOllamaModelDraft(nome);
                      setOllamaModel(nome);
                    }}
                    className={cn(
                      'mono rounded-full border px-2.5 py-1 text-[10.5px] transition-all duration-hover ease-out',
                      settings.ollamaModel === nome
                        ? 'border-accent bg-accent/[.1] text-accent'
                        : 'border-line text-t3 hover:border-accent/35 hover:text-t2',
                    )}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="block">
            <span className="t-label mb-1.5 block">Endereço</span>
            <input
              type="text"
              defaultValue={settings.ollamaBaseUrl}
              onBlur={(event) => setOllamaBaseUrl(event.target.value)}
              aria-label="Endereço do Ollama"
              className="mono w-full rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
            />
            <span className="mt-1.5 block text-cap text-t3">
              Só a porta 11434 (a de origem) está autorizada a falar com o JARVIS. Mudar a porta
              aqui sem mudar também a política de segurança da app deixa o pedido bloqueado.
            </span>
          </label>

          <p className="text-cap leading-relaxed text-t3">
            Ainda não pede ferramentas — abre janelas, cria tarefas ou muda de tema só a DeepSeek,
            por agora. O Ollama responde em conversa.
          </p>
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
