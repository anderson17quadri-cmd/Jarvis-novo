import { Bell, Menu, MessagesSquare, Mic, Search } from 'lucide-react';

import { useClock } from '@/hooks/use-clock';
import { useIsCompact, useIsTight } from '@/hooks/use-media-query';
import { useSystemMetrics } from '@/hooks/use-system-metrics';
import { cn } from '@/lib/cn';
import { formatPercent, formatShortDate, formatTime } from '@/lib/format';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { selectUnreadCount, useNotificationStore } from '@/stores/use-notification-store';
import { USER_NAME } from '@/constants/user';
import { DesktopSwitcher } from './DesktopSwitcher';

interface HeaderProps {
  /** `true` quando a animação de entrada do desktop já chegou ao header. */
  readonly isVisible: boolean;
  readonly onOpenPalette: () => void;
  readonly onToggleDrawer: () => void;
  readonly onToggleMicrophone: () => void;
  readonly isConversationMode: boolean;
  readonly onToggleConversationMode: () => void;
  readonly onOpenNotifications: () => void;
}

export function Header({
  isVisible,
  onOpenPalette,
  onToggleDrawer,
  onToggleMicrophone,
  isConversationMode,
  onToggleConversationMode,
  onOpenNotifications,
}: HeaderProps): React.JSX.Element {
  const now = useClock();
  const isCompact = useIsCompact();
  const isTight = useIsTight();
  const mode = useAssistantStore((state) => state.mode);
  const { snapshot } = useSystemMetrics();
  const unreadCount = useNotificationStore(selectUnreadCount);

  const isListening = mode === 'listening';

  return (
    <header
      className={cn(
        'glass fixed inset-x-0 top-0 z-header flex h-header items-center gap-s2 px-s3',
        'transition-transform duration-screen ease-out',
        isVisible ? 'translate-y-0' : '-translate-y-full',
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'calc(var(--s3) + env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(var(--s3) + env(safe-area-inset-right, 0px))',
      }}
    >
      {isCompact && (
        <IconButton label="Abrir menu de navegação" onClick={onToggleDrawer}>
          <Menu />
        </IconButton>
      )}

      <div className="flex flex-shrink-0 items-center gap-[11px]">
        <span
          className="h-2 w-2 rounded-full bg-accent shadow-glow motion-safe:animate-breathe"
          aria-hidden="true"
        />
        {/* Abaixo dos 520px a marca sai: o espaço faz falta aos controlos. */}
        {!isTight && (
          <div>
            <div className="pl-[0.26em] text-[15px] font-semibold tracking-[0.26em]">JARVIS</div>
            {!isCompact && (
              <div className="pl-[0.1em] text-[9.5px] tracking-[0.1em] text-t3">AI OS 1.0</div>
            )}
          </div>
        )}
      </div>

      {/*
        No compacto a pesquisa colapsa num botão de ícone. Mantê-la como campo
        largo espremia o texto e empurrava o avatar para fora do ecrã.
      */}
      {isCompact ? (
        <IconButton label="Pesquisa global e comandos" onClick={onOpenPalette}>
          <Search />
        </IconButton>
      ) : (
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Pesquisa global e comandos"
          aria-keyshortcuts="Control+K"
          className={cn(
            'mx-auto flex h-[42px] min-w-0 max-w-[650px] flex-1 items-center gap-[11px] rounded-input px-[15px]',
            'border border-line bg-tint/[.03] transition-colors duration-hover ease-out',
            'hover:border-line-2',
          )}
        >
          <Search className="h-4 w-4 flex-shrink-0 text-t3" aria-hidden="true" />
          <span className="flex-1 truncate text-left text-[13.5px] text-t3">
            O que deseja fazer?
          </span>
          <kbd className="flex-shrink-0 rounded-md border border-line px-[7px] py-[3px] text-[10px] font-medium tracking-[0.04em] text-t3">
            CTRL K
          </kbd>
        </button>
      )}

      <div className="ml-auto flex flex-shrink-0 items-center gap-s2 compact:gap-s1">
        {/* Fora do compacto: quatro marcas de 18px ao lado do relógio ainda
            cabem num telemóvel, mas roubariam o espaço ao microfone e ao
            avatar, que se usam muito mais. */}
        {!isCompact && <DesktopSwitcher />}

        {!isCompact && (
          <>
            <Stat value={formatTime(now)} label={formatShortDate(now)} mono />
            {/* A carga só aparece quando há uma leitura real — nunca um zero inventado. */}
            {snapshot && (
              <Stat value={formatPercent(snapshot.cpu.usagePercent)} label="Carga IA" mono />
            )}
          </>
        )}

        <IconButton
          label={isConversationMode ? 'Desligar modo conversa' : 'Ligar modo conversa'}
          onClick={onToggleConversationMode}
          isActive={isConversationMode}
          activeColor="accent"
        >
          <MessagesSquare />
        </IconButton>

        <IconButton
          label={isListening ? 'Desligar microfone' : 'Ligar microfone'}
          onClick={onToggleMicrophone}
          isActive={isListening}
        >
          <Mic />
        </IconButton>

        <IconButton
          label={
            unreadCount > 0
              ? `Notificações — ${unreadCount} por ler`
              : 'Notificações'
          }
          onClick={onOpenNotifications}
          hasBadge={unreadCount > 0}
        >
          <Bell />
        </IconButton>

        <div
          className={cn(
            'relative flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full',
            'border border-accent/30 bg-gradient-to-br from-[#1d2f42] to-[#0a141d]',
            'text-[12.5px] font-semibold text-accent transition-transform duration-hover ease-out',
            'hover:scale-105',
          )}
          title={USER_NAME}
        >
          AQ
          <span className="absolute bottom-0 right-0 h-[10px] w-[10px] rounded-full border-2 border-bg2 bg-ok" />
        </div>
      </div>
    </header>
  );
}

interface StatProps {
  readonly value: string;
  readonly label: string;
  readonly mono?: boolean;
}

function Stat({ value, label, mono = false }: StatProps): React.JSX.Element {
  return (
    <div className="flex flex-col leading-[1.3]">
      <b className={cn('text-[13.5px] font-semibold', mono && 'mono')}>{value}</b>
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-t3">{label}</span>
    </div>
  );
}

interface IconButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly isActive?: boolean;
  /** Cor do estado ativo: `danger` (microfone) ou `accent` (modo conversa). */
  readonly activeColor?: 'danger' | 'accent';
  readonly hasBadge?: boolean;
}

function IconButton({
  label,
  onClick,
  children,
  isActive = false,
  activeColor = 'danger',
  hasBadge = false,
}: IconButtonProps): React.JSX.Element {
  const activeClass =
    activeColor === 'accent'
      ? 'border-accent/30 bg-accent/10 text-accent hover:text-accent shadow-glow'
      : 'border-danger/30 bg-danger/10 text-danger hover:text-danger';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      className={cn(
        'relative flex h-[38px] w-[38px] items-center justify-center rounded-input',
        'border border-transparent text-t2 transition-all duration-hover ease-out',
        'hover:border-line hover:bg-card-hover hover:text-accent active:scale-95',
        '[&>svg]:h-[18px] [&>svg]:w-[18px]',
        isActive && activeClass,
      )}
    >
      {children}
      {hasBadge && (
        <span className="absolute right-2 top-2 h-[6px] w-[6px] rounded-full border-[1.5px] border-bg2 bg-warn" />
      )}
    </button>
  );
}
