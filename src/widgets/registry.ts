import { lazy } from 'react';
import {
  Clock,
  CloudSun,
  Cpu,
  HardDrive,
  Mail,
  MemoryStick,
  Music,
  Newspaper,
  Wifi,
} from 'lucide-react';

import type { WidgetDefinition, WidgetId } from '@/types/widget';

/**
 * Registo de widgets.
 *
 * Fonte única, como `apps/registry.ts` é para as janelas. A grelha, a Command
 * Palette e o store leem daqui e não se conhecem uns aos outros.
 *
 * Acrescentar um widget: criar o componente com exportação `default`, juntar o
 * identificador a `WidgetId` e uma entrada aqui. Mais nada.
 */
export const WIDGET_REGISTRY: Readonly<Record<WidgetId, WidgetDefinition>> = {
  clock: {
    id: 'clock',
    name: 'Relógio',
    description: 'Hora, data completa e fuso horário.',
    icon: Clock,
    category: 'sistema',
    // Só precisa do relógio do browser.
    permissions: { systemMetrics: false, network: false, storage: false },
    defaultSize: 'small',
    allowedSizes: ['small', 'medium', 'wide'],
    showByDefault: true,
    component: lazy(() => import('./clock/ClockWidget')),
  },

  cpu: {
    id: 'cpu',
    name: 'CPU',
    description: 'Utilização em tempo real, por núcleo e global.',
    icon: Cpu,
    category: 'sistema',
    permissions: { systemMetrics: true, network: false, storage: false },
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'wide', 'large'],
    showByDefault: true,
    component: lazy(() => import('./cpu/CpuWidget')),
  },

  ram: {
    id: 'ram',
    name: 'Memória',
    description: 'Uso, disponível e histórico recente.',
    icon: MemoryStick,
    category: 'sistema',
    permissions: { systemMetrics: true, network: false, storage: false },
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'wide'],
    showByDefault: false,
    component: lazy(() => import('./ram/RamWidget')),
  },

  disk: {
    id: 'disk',
    name: 'Disco',
    description: 'Espaço usado e livre, por volume.',
    icon: HardDrive,
    category: 'sistema',
    permissions: { systemMetrics: true, network: false, storage: false },
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'wide', 'large'],
    showByDefault: false,
    component: lazy(() => import('./disk/DiskWidget')),
  },

  network: {
    id: 'network',
    name: 'Rede',
    description: 'Descarga, envio e histórico recente.',
    icon: Wifi,
    category: 'sistema',
    permissions: { systemMetrics: true, network: false, storage: false },
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'wide', 'large'],
    showByDefault: false,
    component: lazy(() => import('./network/NetworkWidget')),
  },

  /*
   * Os quatro seguintes declaram `network: true` porque é disso que vão
   * precisar quando tiverem provedores reais. Hoje os provedores são simulados
   * e não abrem uma única ligação — a permissão é o contrato, não o estado.
   */
  weather: {
    id: 'weather',
    name: 'Clima',
    description: 'Condição atual, sensação, vento e previsão a 7 dias.',
    icon: CloudSun,
    category: 'informacao',
    permissions: { systemMetrics: false, network: true, storage: false },
    defaultSize: 'medium',
    allowedSizes: ['small', 'medium', 'wide', 'large'],
    showByDefault: true,
    component: lazy(() => import('./weather/WeatherWidget')),
  },

  news: {
    id: 'news',
    name: 'Notícias',
    description: 'Manchetes por categoria, com favoritos e leitura rápida.',
    icon: Newspaper,
    category: 'informacao',
    permissions: { systemMetrics: false, network: true, storage: false },
    defaultSize: 'large',
    allowedSizes: ['medium', 'wide', 'large'],
    showByDefault: false,
    component: lazy(() => import('./news/NewsWidget')),
  },

  mail: {
    id: 'mail',
    name: 'Email',
    description: 'Caixa de entrada, por ler e mensagens que pedem ação.',
    icon: Mail,
    category: 'produtividade',
    permissions: { systemMetrics: false, network: true, storage: false },
    defaultSize: 'large',
    allowedSizes: ['medium', 'wide', 'large'],
    showByDefault: true,
    component: lazy(() => import('./mail/MailWidget')),
  },

  music: {
    id: 'music',
    name: 'Música',
    description: 'Faixa atual e controlos de reprodução.',
    icon: Music,
    category: 'media',
    permissions: { systemMetrics: false, network: true, storage: false },
    defaultSize: 'wide',
    allowedSizes: ['wide', 'medium', 'large'],
    showByDefault: true,
    component: lazy(() => import('./music/MusicWidget')),
  },
};

export function getWidgetDefinition(id: WidgetId): WidgetDefinition {
  return WIDGET_REGISTRY[id];
}

export const ALL_WIDGETS: readonly WidgetDefinition[] = Object.values(WIDGET_REGISTRY);
