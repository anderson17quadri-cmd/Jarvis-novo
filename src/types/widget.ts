import type { LucideIcon } from 'lucide-react';
import type { ComponentType, LazyExoticComponent } from 'react';

/** Identificador de um widget. */
export type WidgetId =
  | 'clock'
  | 'cpu'
  | 'ram'
  | 'disk'
  | 'network'
  | 'weather'
  | 'news'
  | 'mail'
  | 'music';

/** Categorias da Parte 6.2, para agrupar na paleta e no futuro marketplace. */
export type WidgetCategory = 'sistema' | 'produtividade' | 'informacao' | 'media';

/**
 * O que um widget precisa de aceder.
 *
 * Declaradas na definição e verificadas pelo `WidgetGrid` antes de montar: um
 * widget que peça métricas numa plataforma sem métricas não é montado, e o
 * lugar dele fica com uma mensagem em vez de um componente partido.
 */
export interface WidgetPermissions {
  readonly systemMetrics: boolean;
  readonly network: boolean;
  readonly storage: boolean;
}

/** Ocupação de um widget na grelha, em células. */
export interface WidgetPlacement {
  /** Coluna inicial, base 0. */
  readonly col: number;
  /** Linha inicial, base 0. */
  readonly row: number;
  readonly colSpan: number;
  readonly rowSpan: number;
}

/** Tamanhos predefinidos, para não haver spans arbitrários espalhados. */
export const WIDGET_SIZES = {
  small: { colSpan: 3, rowSpan: 2 },
  medium: { colSpan: 4, rowSpan: 3 },
  wide: { colSpan: 6, rowSpan: 2 },
  large: { colSpan: 6, rowSpan: 4 },
} as const;

export type WidgetSizeName = keyof typeof WIDGET_SIZES;

/**
 * Definição de um widget.
 *
 * Acrescentar um widget é criar um ficheiro e uma entrada em
 * `src/widgets/registry.ts`. A grelha, a paleta e o store leem daqui.
 */
export interface WidgetDefinition {
  readonly id: WidgetId;
  readonly name: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly category: WidgetCategory;
  readonly permissions: WidgetPermissions;
  readonly defaultSize: WidgetSizeName;
  /** Tamanhos que o widget aceita, para o menu de redimensionar. */
  readonly allowedSizes: readonly WidgetSizeName[];
  /**
   * Se entra no arranjo inicial.
   *
   * Todos os widgets registados juntos não cabem na grelha. Em vez de deixar a
   * colocação decidir por ordem de registo — e uns nunca aparecerem sem
   * explicação — a escolha é explícita. Os restantes ligam-se pela paleta.
   */
  readonly showByDefault: boolean;
  /** Carregado sob demanda: nenhum widget pesa no arranque. */
  readonly component: LazyExoticComponent<ComponentType>;
}

/** Um widget colocado no ambiente de trabalho. */
export interface WidgetInstance {
  readonly id: WidgetId;
  readonly placement: WidgetPlacement;
  readonly isVisible: boolean;
}

/** O que é guardado entre sessões. */
export interface PersistedWidgetLayout {
  readonly id: WidgetId;
  readonly placement: WidgetPlacement;
  readonly isVisible: boolean;
}

/** Colunas da grelha (Parte 2 §Grid). */
export const GRID_COLUMNS = 12;
/** Altura de uma linha, em pixels. */
export const GRID_ROW_HEIGHT = 84;
/**
 * Altura de uma linha no compacto.
 *
 * Menor de propósito: no telemóvel os widgets empilham-se, e com a altura do
 * desktop cabiam dois no ecrã inteiro. A largura já é a máxima possível, por
 * isso o conteúdo continua a respirar mesmo com menos altura.
 */
export const COMPACT_ROW_HEIGHT = 60;
/** Espaço entre células — corresponde ao token `--s2`. */
export const GRID_GAP = 16;
/**
 * Linhas da grelha.
 *
 * Doze, não oito: os widgets registados somam mais do que as 96 células que
 * oito linhas dariam. Pior — mesmo com área suficiente, faltava um
 * bloco contíguo para os widgets grandes, e mostrá-los pela paleta falhava sem
 * o utilizador perceber porquê. O palco já faz scroll vertical.
 */
export const GRID_ROWS = 12;
