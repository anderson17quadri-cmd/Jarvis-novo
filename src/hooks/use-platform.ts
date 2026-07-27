import { useSyncExternalStore } from 'react';

import { getPlatformAdapter } from '@/platform';
import type { PlatformCapabilities, PlatformInfo } from '@/types/platform';

/**
 * Acesso de leitura às capacidades da plataforma.
 *
 * É este o hook que os componentes usam para decidir se mostram algo. Nunca
 * comparar `info.kind` num componente — se for preciso, falta uma capacidade
 * em `PlatformCapabilities`.
 */
export function useCapabilities(): PlatformCapabilities {
  return getPlatformAdapter().capabilities;
}

export function usePlatformInfo(): PlatformInfo {
  return getPlatformAdapter().info;
}

/** Atalho para a capacidade mais consultada. */
export function useIsTouch(): boolean {
  return usePlatformInfo().isTouch;
}

/**
 * Estado de visibilidade da janela.
 *
 * Usado para pausar canvas e sondagens quando a aplicação vai para segundo
 * plano — requisito de performance, e no telemóvel também de bateria.
 */
export function useIsVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, getVisibility, () => true);
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function getVisibility(): boolean {
  return !document.hidden;
}
