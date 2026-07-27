import { useShallow } from 'zustand/react/shallow';

import { getAppDefinition } from '@/apps/registry';
import { useWindowStore } from '@/stores/use-window-store';
import { Window } from './Window';

/**
 * Desenha as janelas abertas.
 *
 * Não decide nada: lê o `useWindowStore` e desenha. Quem abre e fecha é o
 * `useAppLauncher`. Esta separação é o que permite abrir janelas a partir do
 * dock, do rail, da paleta ou de um comando de voz sem que nenhum deles conheça
 * este componente.
 */
export function WindowManager(): React.JSX.Element {
  const windows = useWindowStore(useShallow((state) => state.windows));

  return (
    <>
      {windows.map((instance) => (
        <Window
          key={instance.id}
          instance={instance}
          definition={getAppDefinition(instance.appId)}
        />
      ))}
    </>
  );
}
