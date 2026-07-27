import type { LucideIcon } from 'lucide-react';
import type { ComponentType, LazyExoticComponent } from 'react';

/** Identificador de um widget. */
export type WidgetId = 'clock' | 'cpu' | 'ram';

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
/** Espaço entre células — corresponde ao token `--s2`. */
export const GRID_GAP = 16;
/** Quantas linhas a grelha oferece antes de precisar de scroll. */
export const GRID_ROWS = 8;
