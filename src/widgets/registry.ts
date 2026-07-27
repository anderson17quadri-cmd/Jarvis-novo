import { lazy } from 'react';
import { Clock, Cpu, MemoryStick } from 'lucide-react';

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
    component: lazy(() => import('./ram/RamWidget')),
  },
};

export function getWidgetDefinition(id: WidgetId): WidgetDefinition {
  return WIDGET_REGISTRY[id];
}

export const ALL_WIDGETS: readonly WidgetDefinition[] = Object.values(WIDGET_REGISTRY);
