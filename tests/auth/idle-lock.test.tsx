import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIdleLock } from '@/hooks/use-idle-lock';
import { IDLE_LOCK_OPTIONS, idleLockLabel } from '@/types/appearance';

/** Monta o hook num componente vazio, para o poder conduzir. */
function Harness({
  timeoutMinutes,
  isActive = true,
  onLock,
}: {
  readonly timeoutMinutes: number;
  readonly isActive?: boolean;
  readonly onLock: () => void;
}): React.JSX.Element {
  useIdleLock({ timeoutMinutes, isActive, onLock });
  return <div />;
}

/** Deixa passar tempo de relógio e de temporizadores ao mesmo tempo. */
function advance(minutes: number): void {
  act(() => {
    vi.advanceTimersByTime(minutes * 60_000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('opções', () => {
  it('a primeira é "nunca"', () => {
    expect(IDLE_LOCK_OPTIONS[0]).toBe(0);
    expect(idleLockLabel(0)).toBe('Nunca');
  });

  it('as etiquetas concordam em número', () => {
    expect(idleLockLabel(1)).toBe('1 minuto');
    expect(idleLockLabel(5)).toBe('5 minutos');
    expect(idleLockLabel(60)).toBe('1 hora');
  });

  it('estão por ordem crescente', () => {
    expect([...IDLE_LOCK_OPTIONS].sort((a, b) => a - b)).toEqual([...IDLE_LOCK_OPTIONS]);
  });
});

describe('bloqueio', () => {
  it('bloqueia ao fim do tempo sem atividade', () => {
    const onLock = vi.fn();
    render(<Harness timeoutMinutes={5} onLock={onLock} />);

    advance(4);
    expect(onLock).not.toHaveBeenCalled();

    advance(2);
    expect(onLock).toHaveBeenCalled();
  });

  it('mexer no rato adia a contagem', () => {
    const onLock = vi.fn();
    render(<Harness timeoutMinutes={5} onLock={onLock} />);

    advance(4);
    act(() => {
      window.dispatchEvent(new Event('pointermove'));
    });

    advance(4);
    expect(onLock).not.toHaveBeenCalled();

    advance(2);
    expect(onLock).toHaveBeenCalled();
  });

  it('escrever também conta como estar presente', () => {
    const onLock = vi.fn();
    render(<Harness timeoutMinutes={5} onLock={onLock} />);

    advance(4);
    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });
    advance(4);

    expect(onLock).not.toHaveBeenCalled();
  });

  it('voltar ao separador conta — bloquear ao olhar para o ecrã seria hostil', () => {
    const onLock = vi.fn();
    render(<Harness timeoutMinutes={5} onLock={onLock} />);

    advance(4);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    advance(4);

    expect(onLock).not.toHaveBeenCalled();
  });

  it('zero minutos desliga o bloqueio', () => {
    const onLock = vi.fn();
    render(<Harness timeoutMinutes={0} onLock={onLock} />);

    advance(600);
    expect(onLock).not.toHaveBeenCalled();
  });

  it('fora do desktop não bloqueia — no login não há nada a bloquear', () => {
    const onLock = vi.fn();
    render(<Harness timeoutMinutes={1} isActive={false} onLock={onLock} />);

    advance(30);
    expect(onLock).not.toHaveBeenCalled();
  });

  it('desmontar pára a contagem', () => {
    const onLock = vi.fn();
    const { unmount } = render(<Harness timeoutMinutes={1} onLock={onLock} />);

    unmount();
    advance(30);

    expect(onLock).not.toHaveBeenCalled();
  });
});
