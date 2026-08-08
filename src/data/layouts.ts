import { DEFAULT_AMBIENCE, type Ambience } from '@/types/appearance';
import { DEFAULT_CATEGORY_VOLUMES, type SoundSnapshot } from '@/services/sound-service';
import { getWidgetDefinition } from '@/widgets/registry';
import { WIDGET_SIZES, type PersistedWidgetLayout, type WidgetId } from '@/types/widget';
import type { PersistedWindowLayout } from '@/types/window';
import type { SavedLayout, WorkspaceSnapshot } from '@/types/workspace';
import type { AppId } from '@/types/app';

/**
 * Layouts que vêm com o sistema (Parte 6.2 §Layouts salvos e Parte 15 §Perfis).
 *
 * Os seis nomes são os da especificação. Cada um abre janelas a sério, mostra
 * widgets a sério, muda tema e ambiente e mexe no som — não são etiquetas com
 * uma descrição bonita.
 *
 * A geometria das janelas fica a zero: quem aplica um layout calcula a posição
 * pelo ecrã que tem. Guardar coordenadas de um monitor que não é o nosso seria
 * repor janelas fora do sítio.
 *
 * Nenhum toca em plugins: um perfil que vem do código não sabe o que a pessoa
 * instalou, e desligar-lhe um plugin por omissão era decidir por ela.
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
    const size = WIDGET_SIZES[getWidgetDefinition(id).defaultSize];

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

/** O ambiente base com as diferenças deste perfil por cima. */
function ambience(changes: Partial<Ambience>): Ambience {
  return { ...DEFAULT_AMBIENCE, ...changes };
}

/**
 * Som ligado, com o volume geral e as diferenças por categoria.
 *
 * As categorias que não se nomeiam ficam no máximo — o que as baixa é o volume
 * geral, e é isso que faz do cursor geral um cursor a sério.
 */
function sound(volume: number, changes: Partial<SoundSnapshot['categoryVolumes']> = {}): SoundSnapshot {
  return {
    isEnabled: true,
    volume,
    categoryVolumes: { ...DEFAULT_CATEGORY_VOLUMES, ...changes },
  };
}

/** Silêncio completo, e não o volume a zero: sem contexto de áudio nenhum. */
const SILENCE: SoundSnapshot = {
  isEnabled: false,
  volume: 0.5,
  categoryVolumes: DEFAULT_CATEGORY_VOLUMES,
};

function layout(
  id: string,
  name: string,
  description: string,
  snapshot: Omit<WorkspaceSnapshot, 'plugins'>,
): SavedLayout {
  return {
    id,
    name,
    description,
    createdAt: 0,
    isBuiltIn: true,
    snapshot: { ...snapshot, plugins: [] },
  };
}

export function builtInLayouts(): readonly SavedLayout[] {
  return [
    layout(
      'produtividade',
      'Produtividade',
      'Tarefas, emails e calendário. Avisos audíveis, interface discreta.',
      {
        windows: windows('tasks', 'emails', 'calendar'),
        widgets: widgets('clock', 'mail', 'cpu'),
        theme: 'classic',
        ambience: ambience({ wallpaper: 'grelha', wallpaperIntensity: 0.7, coreParticles: 0.75 }),
        // Os avisos ao máximo, os cliques a menos de metade: quem está a
        // trabalhar quer ouvir o que chega, não o que carrega.
        sound: sound(0.45, { interface: 0.4 }),
      },
    ),
    layout(
      'programacao',
      'Programação',
      'Projetos e ficheiros, métricas à vista e a interface calada.',
      {
        windows: windows('projects', 'files'),
        widgets: widgets('cpu', 'ram', 'disk', 'network'),
        theme: 'graphite',
        ambience: ambience({
          wallpaper: 'grelha',
          wallpaperIntensity: 0.45,
          coreParticles: 0.5,
          cursor: 'minimal',
          radius: 'reto',
          // Desenhada para ecrãs de engenharia — é literalmente o que este
          // perfil é.
          fontFamily: 'plex-sans',
        }),
        sound: sound(0.4, { interface: 0 }),
      },
    ),
    layout('design', 'Design', 'Ecrã limpo, cores por inteiro, sem métricas a competir.', {
      windows: windows('projects'),
      widgets: widgets('clock', 'music'),
      theme: 'aurora',
      ambience: ambience({ wallpaper: 'nebulosa', coreParticles: 1.2 }),
      sound: sound(0.5),
    }),
    layout('estudos', 'Estudos', 'Uma janela de cada vez, nada a piscar e nada a apitar.', {
      windows: windows('tasks'),
      widgets: widgets('clock', 'weather'),
      theme: 'midnight',
      ambience: ambience({
        wallpaper: 'liso',
        wallpaperIntensity: 0.3,
        coreParticles: 0.4,
        cursor: 'sistema',
      }),
      sound: SILENCE,
    }),
    layout('streaming', 'Streaming', 'Fundo escuro ao máximo, música à mão e som que não entra na gravação.', {
      windows: windows('music'),
      widgets: widgets('music', 'clock'),
      theme: 'oled',
      ambience: ambience({ wallpaper: 'particulas', wallpaperIntensity: 0.8, cursor: 'minimal' }),
      sound: sound(0.25, { interface: 0, sistema: 0 }),
    }),
    layout('jogos', 'Jogos', 'Só o que mede a máquina, no tema mais agressivo.', {
      windows: windows(),
      widgets: widgets('cpu', 'ram', 'disk', 'network'),
      theme: 'cyber-red',
      ambience: ambience({
        wallpaper: 'particulas',
        wallpaperIntensity: 0.6,
        coreParticles: 1.5,
        cursor: 'minimal',
        radius: 'reto',
      }),
      sound: sound(0.5, { interface: 0, sistema: 0 }),
    }),
  ];
}
