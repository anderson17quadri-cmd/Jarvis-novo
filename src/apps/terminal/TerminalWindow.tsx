import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

import { eventBus } from '@/services/event-bus';
import { useCapabilities } from '@/hooks/use-platform';
import { getPlatformAdapter } from '@/platform';

/**
 * Terminal (Parte 6.2 §Janela: Terminal).
 *
 * Um PTY a sério do lado Rust (`src-tauri/src/terminal/`, via
 * `portable-pty`) — este componente é só o que mostra e envia teclas. Usa o
 * `@xterm/xterm` em vez de uma solução caseira: é o motor por trás do VS
 * Code e do Hyper, entende sequências de escape ANSI (cores, cursor) que um
 * `<div>` com scrollback próprio teria de reimplementar à mão, e só entra no
 * bundle quando esta janela abre (é `lazy()` no registo de apps) — o custo
 * de bundle que a spec pedia para se justificar fica pago por não carregar
 * em quem nunca abre um terminal.
 *
 * Sem confirmação para comandos "destrutivos": ver o comentário em
 * `src-tauri/src/terminal/mod.rs` para a razão — é a pessoa a escrever, à
 * mão, o comando que quer correr, não o assistente a decidir por conta
 * própria.
 */
export default function TerminalWindow(): React.JSX.Element {
  const capabilities = useCapabilities();
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'a-abrir' | 'pronto' | 'erro'>('a-abrir');

  useEffect(() => {
    if (!capabilities.terminal || !containerRef.current) return;

    const adapter = getPlatformAdapter();
    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "Consolas", monospace',
      fontSize: 13,
      theme: readXtermTheme(),
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    let disposed = false;
    const unsubscribers: Array<() => void> = [];

    async function start(): Promise<void> {
      const unlistenOutput = await adapter.onTerminalOutput((event) => {
        if (event.sessionId === sessionIdRef.current) term.write(event.chunk);
      });
      unsubscribers.push(unlistenOutput);

      const unlistenExit = await adapter.onTerminalExit((event) => {
        if (event.sessionId !== sessionIdRef.current) return;
        term.write('\r\n\x1b[2m[sessão terminada]\x1b[0m\r\n');
      });
      unsubscribers.push(unlistenExit);

      const id = await adapter.terminalSpawn(term.cols, term.rows);
      if (disposed) {
        // A janela fechou antes de a sessão abrir — não fica órfã.
        if (id !== null) void adapter.terminalKill(id);
        return;
      }
      if (id === null) {
        setStatus('erro');
        return;
      }
      sessionIdRef.current = id;
      setStatus('pronto');
    }

    void start();

    const onData = term.onData((data) => {
      if (sessionIdRef.current) void adapter.terminalWrite(sessionIdRef.current, data);
    });

    // O tema muda em runtime (Personalização) — as cores do terminal seguem.
    const unsubTheme = eventBus.on('tema:alterado', () => {
      term.options.theme = readXtermTheme();
    });
    unsubscribers.push(unsubTheme);

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (sessionIdRef.current) {
        void adapter.terminalResize(sessionIdRef.current, term.cols, term.rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      onData.dispose();
      resizeObserver.disconnect();
      for (const unsubscribe of unsubscribers) unsubscribe();
      if (sessionIdRef.current) void adapter.terminalKill(sessionIdRef.current);
      term.dispose();
    };
  }, [capabilities.terminal]);

  if (!capabilities.terminal) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-desc text-t3">
        O terminal precisa da versão nativa — esta plataforma não tem um shell de sistema para abrir.
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {status === 'erro' && (
        <p className="flex-shrink-0 border-b border-line bg-[rgb(255_59_92_/_.12)] px-3 py-1.5 text-cap text-t2">
          Não foi possível abrir o shell do sistema.
        </p>
      )}
      <div ref={containerRef} className="min-h-0 flex-1 p-2" />
    </div>
  );
}

/** Lê as cores do tema ativo das variáveis CSS, para o xterm as seguir. */
function readXtermTheme(): {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
} {
  const style = getComputedStyle(document.documentElement);
  const read = (variable: string, fallback: string): string => style.getPropertyValue(variable).trim() || fallback;
  const tintRgb = read('--tint-rgb', '148,163,184');

  return {
    background: read('--card', '#0B0F14'),
    foreground: read('--t1', '#E6EDF3'),
    cursor: read('--accent', '#00CFFF'),
    selectionBackground: `rgba(${tintRgb},0.35)`,
  };
}
