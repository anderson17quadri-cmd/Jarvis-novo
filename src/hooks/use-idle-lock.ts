import { useEffect, useRef } from 'react';

/**
 * Bloqueio por inatividade (Parte 14 §Autenticação).
 *
 * Sem isto, uma sessão aberta ficava aberta para sempre — bastava afastar-se do
 * computador. Ao fim do tempo escolhido, volta ao ecrã de bloqueio.
 *
 * Conta em relógio de parede, não em temporizadores acumulados: um portátil
 * suspenso durante uma hora não continua a contar em segundo plano, e um
 * `setTimeout` de 15 minutos não dispara enquanto a máquina dorme. Uma
 * verificação periódica contra `Date.now()` apanha os dois casos.
 */

/** De quanto em quanto tempo se verifica. Não precisa de ser ao segundo. */
const CHECK_INTERVAL_MS = 15_000;

/** Sinais que contam como estar presente. */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
] as const;

export function useIdleLock({
  timeoutMinutes,
  isActive,
  onLock,
}: {
  /** `0` desliga o bloqueio. */
  readonly timeoutMinutes: number;
  /** `false` fora do desktop — no login não há nada para bloquear. */
  readonly isActive: boolean;
  readonly onLock: () => void;
}): void {
  // Zero, e não `Date.now()`: ler o relógio durante o render é uma chamada
  // impura. O efeito marca a hora real assim que monta, que é o momento em que
  // a contagem começa a valer.
  const lastActivity = useRef(0);
  // Numa ref para o efeito não voltar a montar a cada render de quem chama.
  // A ref é escrita num efeito, não durante o render: escrever numa ref a
  // meio do render é um efeito secundário disfarçado.
  const lock = useRef(onLock);

  useEffect(() => {
    lock.current = onLock;
  }, [onLock]);

  useEffect(() => {
    if (!isActive || timeoutMinutes <= 0) return;

    lastActivity.current = Date.now();

    const markActive = (): void => {
      lastActivity.current = Date.now();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    // Voltar ao separador é atividade: quem regressa está presente, e bloquear
    // no instante em que se olha para o ecrã seria hostil.
    document.addEventListener('visibilitychange', markActive);

    // Uma vez atingido o tempo, bloqueia-se uma só vez — sem isto, a
    // verificação seguinte (15 s depois) tornava a disparar `onLock`, e outra,
    // e outra, enquanto ninguém mexesse no rato: o `logout` corria de novo, e
    // o registo de auditoria enchia-se de "Bloquear a sessão por inatividade".
    let locked = false;

    const timer = setInterval(() => {
      if (locked) return;
      if (Date.now() - lastActivity.current >= timeoutMinutes * 60_000) {
        locked = true;
        lock.current();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive);
      document.removeEventListener('visibilitychange', markActive);
    };
  }, [isActive, timeoutMinutes]);
}
