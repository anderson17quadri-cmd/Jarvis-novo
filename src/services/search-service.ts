import {
  buildCommands,
  filterCommands,
  type Command,
  type SearchableContent,
} from '@/components/command-palette/command-registry';
import type { ThemeId } from '@/design-system/tokens';
import type { SavedLayout } from '@/types/workspace';

/**
 * Tudo o que a pesquisa global precisa de saber, sem conhecer stores.
 *
 * O conteúdo muda a cada sondagem do email e das notícias; os layouts e os
 * temas personalizados mudam quando o utilizador os edita. Quem chama reúne o
 * estado atual e passa-o — o serviço só combina e filtra.
 */
export interface SearchInputs {
  readonly content: SearchableContent;
  readonly layouts: readonly SavedLayout[];
  readonly customThemes: readonly { readonly id: ThemeId; readonly name: string }[];
}

/**
 * Pesquisa global (Parte 8).
 *
 * Combina o catálogo de comandos com o conteúdo pesquisável e filtra pelo
 * texto. Sem React e sem stores — a `useSearchStore` é que reúne os inputs e
 * guarda o resultado.
 */
export class SearchService {
  search(query: string, inputs: SearchInputs): readonly Command[] {
    return filterCommands(
      buildCommands(inputs.content, inputs.layouts, inputs.customThemes),
      query,
    );
  }
}

export const searchService = new SearchService();
