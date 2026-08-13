import { getPlatformAdapter } from '@/platform';
import { normalizeSearch } from '@/utils/text';
import type { ObsidianNote } from '@/types/obsidian';

/**
 * Vault Obsidian real (Peça 17) — memória persistente a sério, ao lado da
 * memória de preferências (`memory-service.ts`, só o que é dito por
 * palavras). Aqui é a pessoa quem escreve, no seu próprio vault; o
 * assistente só procura, lê e escreve quando lhe pedem.
 *
 * A lista de notas (título + caminho, nunca o conteúdo) fica em cache na
 * memória, atualizada sempre que o vault é escolhido, uma nota é escrita, ou
 * `refreshNotes` é chamada explicitamente — nunca lida do disco outra vez a
 * cada procura, o que tornaria uma pesquisa lenta num vault grande. O
 * conteúdo de cada nota nunca é pré-carregado: só se lê quando pedido,
 * porque um vault pode ter centenas de notas e ingeri-las todas de
 * antemão seria caro e, em grande parte, desperdiçado.
 */
class ObsidianService {
  private notes: readonly ObsidianNote[] = [];

  /** As notas já conhecidas — só título e caminho, para listas e menus. */
  get cachedNotes(): readonly ObsidianNote[] {
    return this.notes;
  }

  /** Relê a lista de notas do disco. Chamar depois de escolher/trocar de vault. */
  async refreshNotes(): Promise<void> {
    this.notes = await getPlatformAdapter().obsidianListNotes();
  }

  /** Notas cujo título contém `query` (sem acentos, parcial). Vazio se `query` for vazio. */
  searchByTitle(query: string): readonly ObsidianNote[] {
    const normalized = normalizeSearch(query);
    if (normalized.length === 0) return [];
    return this.notes.filter((note) => normalizeSearch(note.title).includes(normalized));
  }

  /** Conteúdo da primeira nota cujo título contém `query`. `null` se não houver nenhuma. */
  async readByTitle(query: string): Promise<string | null> {
    const [first] = this.searchByTitle(query);
    if (!first) return null;
    return getPlatformAdapter().obsidianReadNote(first.path);
  }

  /**
   * Cria ou substitui uma nota no topo do vault — o título vira o nome do
   * ficheiro, sanitizado (só o essencial: os carateres que o sistema de
   * ficheiros não aceita num nome). Notas em subpastas continuam a listar-se
   * e a ler-se normalmente (`obsidianListNotes` desce o vault inteiro); só a
   * criação pelo assistente fica no topo — dar-lhe controlo sobre pastas
   * exigiria interpretar a organização do vault a partir da conversa, o que
   * fica de fora por agora.
   */
  async write(title: string, content: string): Promise<boolean> {
    const filename = sanitizeFilename(title);
    if (filename.length === 0) return false;

    const ok = await getPlatformAdapter().obsidianWriteNote(`${filename}.md`, content);
    if (ok) await this.refreshNotes();
    return ok;
  }
}

/** Troca carateres inválidos em nomes de ficheiro do Windows por `-`; corta espaço nas pontas. */
function sanitizeFilename(title: string): string {
  return title.trim().replace(/[\\/:*?"<>|]/g, '-');
}

export const obsidianService = new ObsidianService();
