import { WIDGET_SIZES, type PersistedWidgetLayout, type WidgetId } from '@/types/widget';
import type { PersistedWindowLayout } from '@/types/window';
import type { SavedLayout, WorkspaceSnapshot } from '@/types/workspace';
import type { AppId } from '@/types/app';

/**
 * Layouts que vêm com o sistema (Parte 6.2 §Layouts salvos).
 *
 * Os seis nomes são os da especificação. Cada um abre janelas a sério, mostra
 * widgets a sério e muda tema e papel de parede — não são etiquetas com uma
 * descrição bonita.
 *
 * A geometria das janelas fica a zero: quem aplica um layout calcula a posição
 * pelo ecrã que tem. Guardar coordenadas de um monitor que não é o nosso seria
 * repor janelas fora do sítio.
 */

const ORIGIN = { x: 0, y: 0, width: 0, height: 0 };

function windows(...appIds: readonly AppId[]): readonly PersistedWindowLayout[] {
  return appIds.map((appId) => ({ appId, rect: ORIGIN, isMaximized: false }));
}

/**
 * Coloca os widgets pedidos em linha, da esquerda para a direita, descendo
 * quando a linha enche. É o mesmo critério do arranjo predefinido.
 */
function widgets(...ids: readonly WidgetId[]): readonly PersistedWidgetLayout[] {
  const placed: PersistedWidgetLayout[] = [];
  let col = 0;
  let row = 0;
  let tallest = 0;

  for (const id of ids) {
    const size = WIDGET_SIZES[defaultSizeOf(id)];

    if (col + size.colSpan > 12) {
      col = 0;
      row += tallest;
      tallest = 0;
    }

    placed.push({ id, placement: { col, row, ...size }, isVisible: true });
    col += size.colSpan;
    tallest = Math.max(tallest, size.rowSpan);
  }

  return placed;
}

/** O tamanho com que cada widget entra num layout. */
function defaultSizeOf(id: WidgetId): keyof typeof WIDGET_SIZES {
  switch (id) {
    case 'clock':
    case 'cpu':
    case 'ram':
    case 'disk':
    case 'network':
      return 'small';
    case 'weather':
    case 'music':
      return 'medium';
    case 'news':
    case 'mail':
      return 'wide';
  }
}

function layout(
  id: string,
  name: string,
  description: string,
  snapshot: WorkspaceSnapshot,
): SavedLayout {
  return {
    id,
    name,
    description,
    createdAt: 0,
    isBuiltIn: true,
    snapshot,
  };
}

export function builtInLayouts(): readonly SavedLayout[] {
  return [
    layout('produtividade', 'Produtividade', 'Tarefas, emails e calendário, com o relógio à vista.', {
      windows: windows('tasks', 'emails', 'calendar'),
      widgets: widgets('clock', 'mail', 'cpu'),
      theme: 'classic',
      wallpaper: 'grelha',
    }),
    layout('programacao', 'Programação', 'Projetos e ficheiros, com as métricas da máquina.', {
      windows: windows('projects', 'files'),
      widgets: widgets('cpu', 'ram', 'disk', 'network'),
      theme: 'graphite',
      wallpaper: 'grelha',
    }),
    layout('design', 'Design', 'Ecrã limpo, sem métricas a competir pela atenção.', {
      windows: windows('projects'),
      widgets: widgets('clock', 'music'),
      theme: 'aurora',
      wallpaper: 'nebulosa',
    }),
    layout('estudos', 'Estudos', 'Uma janela de cada vez, e nada a piscar ao lado.', {
      windows: windows('tasks'),
      widgets: widgets('clock', 'weather'),
      theme: 'midnight',
      wallpaper: 'liso',
    }),
    layout('streaming', 'Streaming', 'Fundo escuro ao máximo e música à mão.', {
      windows: windows('music'),
      widgets: widgets('music', 'clock'),
      theme: 'oled',
      wallpaper: 'particulas',
    }),
    layout('jogos', 'Jogos', 'Só o que mede a máquina, no tema mais agressivo.', {
      windows: windows(),
      widgets: widgets('cpu', 'ram', 'disk', 'network'),
      theme: 'cyber-red',
      wallpaper: 'particulas',
    }),
  ];
}
