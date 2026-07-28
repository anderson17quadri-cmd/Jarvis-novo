import { create } from 'zustand';

import { eventBus } from '@/services/event-bus';
import { logService } from '@/services/log-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { systemService } from '@/services/system-service';
import { SYSTEM_STATES, type SystemStateDefinition, type SystemStateId } from '@/types/system-state';

/**
 * Estado do sistema (Parte 9).
 *
 * Além de guardar a escolha, aplica-a: escreve `data-system-state` no `<html>`
 * para o CSS baixar o brilho, e diz ao `systemService` a que ritmo há de
 * sondar. O núcleo e o serviço de notificações leem `definition` para se
 * adaptarem — nenhum deles precisa de saber que estados existem.
 */

interface SystemStateStore {
  readonly current: SystemStateId;
  readonly definition: SystemStateDefinition;

  set: (id: SystemStateId) => void;
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

function apply(id: SystemStateId): SystemStateDefinition {
  const definition = SYSTEM_STATES[id];

  if (typeof document !== 'undefined') {
    // O estado normal não escreve nada: um atributo sem regra CSS é ruído,
    // e é a mesma decisão do tema base.
    if (id === 'normal') delete document.documentElement.dataset['systemState'];
    else document.documentElement.dataset['systemState'] = id;
  }

  systemService.setInterval(definition.metricsIntervalMs);

  return definition;
}

export const useSystemStateStore = create<SystemStateStore>((set, get) => ({
  current: 'normal',
  definition: SYSTEM_STATES.normal,

  set: (id) => {
    set({ current: id, definition: apply(id) });
    eventBus.emit('estado:alterado', { state: id });
    logService.audit(`Passar ao modo ${SYSTEM_STATES[id].name}`, 'executado');
  },

  persist: async () => {
    await storageService.set(STORAGE_KEYS.systemState, get().current);
  },

  hydrate: async () => {
    const saved = await storageService.get<SystemStateId>(STORAGE_KEYS.systemState, 'normal');
    // Um estado guardado que já não exista cai no normal, em vez de deixar a
    // aplicação com uma definição indefinida.
    const id = saved in SYSTEM_STATES ? saved : 'normal';

    set({ current: id, definition: apply(id) });
  },
}));
