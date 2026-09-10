/** Um bocado de saída de uma sessão de terminal. */
export interface TerminalOutputEvent {
  readonly sessionId: string;
  readonly chunk: string;
}

/** O processo da sessão terminou — o shell fechou, ou foi morto. */
export interface TerminalExitEvent {
  readonly sessionId: string;
  readonly exitCode: number | null;
}
