import { useCallback, useState } from 'react';

import type { RailItem } from '@/config/navigation';
import { cn } from '@/lib/cn';
import { useEntranceCascade } from '@/hooks/use-entrance-cascade';
import { useIsCompact } from '@/hooks/use-media-query';
import { useShallow } from 'zustand/react/shallow';

import { selectOpenAppIds, useWindowStore } from '@/stores/use-window-store';
import type { AppId } from '@/types/app';
import { Dock } from './Dock';
import { Header } from './Header';
import { Rail } from './Rail';
import { Stage } from './Stage';

interface AppShellProps {
  /** `true` depois do login, quando o desktop entra em cascata. */
  readonly isActive: boolean;
  readonly children: React.ReactNode;
  readonly onLaunchApp: (appId: AppId) => void;
  readonly onOpenPalette: () => void;
  readonly onToggleMicrophone: () => void;
  readonly isConversationMode: boolean;
  readonly onToggleConversationMode: () => void;
  readonly onOpenNotifications: () => void;
  readonly onLogout: () => void;
}

/**
 * Estrutura do ambiente de trabalho: header, rail, palco e dock.
 *
 * Guarda apenas o estado que é do shell — a gaveta e o item ativo do rail. As
 * janelas vivem no `useWindowStore`, e o que abre cada uma é decidido por quem
 * usa o shell, através de `onLaunchApp`.
 */
export function AppShell({
  isActive,
  children,
  onLaunchApp,
  onOpenPalette,
  onToggleMicrophone,
  isConversationMode,
  onToggleConversationMode,
  onOpenNotifications,
  onLogout,
}: AppShellProps): React.JSX.Element {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [activeRailId, setActiveRailId] = useState('dashboard');

  const isCompact = useIsCompact();
  const cascade = useEntranceCascade(isActive);
  // `useShallow` é obrigatório: o seletor deriva um array novo a cada chamada, e
  // sem comparação superficial o Zustand entraria em ciclo de renderização.
  const openAppIds = useWindowStore(useShallow(selectOpenAppIds));

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleRailSelect = useCallback(
    (item: RailItem): void => {
      setActiveRailId(item.id);

      if (item.action === 'search') {
        onOpenPalette();
      } else if (item.action === 'logout') {
        onLogout();
      } else if (item.appId) {
        onLaunchApp(item.appId);
      }

      // Na gaveta, escolher um item fecha-a — como em qualquer aplicação móvel.
      if (isCompact) closeDrawer();
    },
    [closeDrawer, isCompact, onLaunchApp, onLogout, onOpenPalette],
  );

  return (
    <div
      className={cn(
        'fixed inset-0 z-desktop transition-opacity duration-[500ms] ease-out',
        isActive ? 'visible opacity-100' : 'invisible opacity-0',
      )}
    >
      <Header
        isVisible={cascade.header}
        onOpenPalette={onOpenPalette}
        onToggleDrawer={() => setDrawerOpen((open) => !open)}
        onToggleMicrophone={onToggleMicrophone}
        isConversationMode={isConversationMode}
        onToggleConversationMode={onToggleConversationMode}
        onOpenNotifications={onOpenNotifications}
      />

      <Rail
        isVisible={cascade.rail}
        isDrawerOpen={isDrawerOpen}
        activeId={activeRailId}
        onSelect={handleRailSelect}
        onCloseDrawer={closeDrawer}
      />

      <Stage>{children}</Stage>

      <Dock isVisible={cascade.dock} openAppIds={openAppIds} onLaunch={onLaunchApp} />
    </div>
  );
}
