import { storageService, STORAGE_KEYS } from '../storage-service';
import { MEMORY_PROMPT_LIMIT, type AssistantMemory } from '@/types/assistant';

/**
 * Memória local do assistente (Parte 7.2 §Memória).
 *
 * Guarda duas coisas: o que se lhe pediu para lembrar, e os últimos pedidos.
 * Fica no dispositivo — não há para onde a enviar, e não haveria mesmo que
 * houvesse rede.
 *
 * **Não aprende sozinha.** Só regista o que foi dito por palavras: "trata-me
 * por Anderson", "moro no Porto". Deduzir preferências do que se escreve seria
 * inventar sobre uma pessoa, e depois usá-las como se fossem verdade.
 */

/** Frases que assumem uma preferência. A chave é o que fica guardado. */
const PREFERENCE_PATTERNS: readonly { readonly key: string; readonly pattern: RegExp }[] = [
  { key: 'nome', pattern: /(?:trata-me por|chama-me|o meu nome (?:é|e))\s+(.+)/i },
  { key: 'cidade', pattern: /(?:moro (?:em|no|na)|vivo (?:em|no|na))\s+(.+)/i },
  { key: 'trabalho', pattern: /(?:trabalho (?:em|na|no|como))\s+(.+)/i },
  { key: 'preferência', pattern: /(?:prefiro|gosto de)\s+(.+)/i },
];

/** Etiquetas legíveis para a interface não mostrar chaves cruas. */
export const MEMORY_LABELS: Readonly<Record<string, string>> = {
  nome: 'Trata-te por',
  cidade: 'Vives em',
  trabalho: 'Trabalhas em',
  'preferência': 'Preferes',
};

const EMPTY: AssistantMemory = { preferences: {}, recentPrompts: [] };

export class MemoryService {
  private memory: AssistantMemory = EMPTY;
  private readonly listeners = new Set<() => void>();

  get current(): AssistantMemory {
    return this.memory;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Regista um pedido e, se ele disser uma preferência por palavras, guarda-a.
   * Devolve a chave aprendida, para o assistente poder confirmá-la em voz alta.
   */
  observe(prompt: string): string | null {
    const text = prompt.trim();
    if (text.length === 0) return null;

    // Sem repetições: pedir a mesma coisa duas vezes não enche a lista, mas
    // volta ao topo — é o pedido mais recente na mesma.
    const recentPrompts = [
      text,
      ...this.memory.recentPrompts.filter((entry) => entry.toLowerCase() !== text.toLowerCase()),
    ].slice(0, MEMORY_PROMPT_LIMIT);

    const learned = extractPreference(text);
    const preferences = learned
      ? { ...this.memory.preferences, [learned.key]: learned.value }
      : this.memory.preferences;

    this.memory = { preferences, recentPrompts };
    this.emit();
    void this.persist();

    return learned?.key ?? null;
  }

  /** Esquece uma preferência. O botão que chama isto está na janela. */
  forget(key: string): void {
    const preferences = { ...this.memory.preferences };
    delete preferences[key];

    this.memory = { ...this.memory, preferences };
    this.emit();
    void this.persist();
  }

  clear(): void {
    this.memory = EMPTY;
    this.emit();
    void this.persist();
  }

  async persist(): Promise<void> {
    await storageService.set(STORAGE_KEYS.assistantMemory, this.memory);
  }

  async hydrate(): Promise<void> {
    const saved = await storageService.get<AssistantMemory | null>(
      STORAGE_KEYS.assistantMemory,
      null,
    );

    this.memory = {
      preferences: saved?.preferences ?? {},
      recentPrompts: saved?.recentPrompts ?? [],
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** Lê uma preferência dita por palavras. Pura, para se testar sozinha. */
export function extractPreference(text: string): { key: string; value: string } | null {
  for (const { key, pattern } of PREFERENCE_PATTERNS) {
    const match = pattern.exec(text);
    if (match === null) continue;

    // "Não gosto de café" não é gostar de café — a negação anula a leitura.
    if (isNegated(text, match.index)) continue;

    const captured = cutAtClauseBoundary(match[1] ?? '').trim().replace(/[.!?,;:]+$/, '');

    // Um valor vazio ou absurdamente longo é ruído, não uma preferência.
    if (captured.length > 0 && captured.length <= 60) {
      return { key, value: captured };
    }
  }

  return null;
}

/** Uma negação ("não", "nem"…) imediatamente antes da frase correspondida? */
function isNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(0, matchIndex).trimEnd();
  return /\b(?:nao|não|nem|nunca|jamais)\s*$/.test(before);
}

/**
 * O valor acaba na primeira fronteira de oração — pontuação ou uma
 * conjunção. Sem isto, "moro no Porto desde 2019" guardava "Porto desde
 * 2019", e um segredo dito a seguir era arrastado para a memória.
 */
function cutAtClauseBoundary(value: string): string {
  const boundary = /\s+(?:e|mas|porque|desde|para|que|onde|quando|com|ou)\b|[,.!?;]/;
  const match = boundary.exec(value);
  return match === null ? value : value.slice(0, match.index);
}

export const memoryService = new MemoryService();
