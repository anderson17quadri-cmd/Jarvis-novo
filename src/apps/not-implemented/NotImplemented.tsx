import { Puzzle } from 'lucide-react';

/**
 * Conteúdo das janelas que a Fase 1 ainda não implementa.
 *
 * Diz o que falta em vez de mostrar um ecrã vazio ou um erro: a janela abre,
 * comporta-se como as outras e explica-se.
 */
export default function NotImplemented(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-s2 text-center">
      <Puzzle className="h-8 w-8 text-t3" aria-hidden="true" />
      <p className="text-desc text-t2">Este módulo entra numa fase seguinte.</p>
      <p className="max-w-[36ch] text-cap text-t3">
        A janela, o registo e o ciclo de vida já funcionam — falta o conteúdo, que virá do
        Plugin Manager.
      </p>
    </div>
  );
}
