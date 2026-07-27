/**
 * Raiz da aplicação.
 *
 * Bloco 1: só monta o tema e prova que o andaime arranca. O router, a sequência
 * de arranque, o login e o shell entram nos blocos seguintes.
 */
export function App(): React.JSX.Element {
  return (
    <main className="grid h-full place-items-center gap-s2 text-center">
      <div>
        <h1 className="text-h2 tracking-[0.38em] text-t1">JARVIS</h1>
        <p className="mt-s1 text-cap uppercase text-t3">
          Artificial Intelligence Operating System
        </p>
        <p className="mt-s3 text-desc text-t2">Andaime pronto · Project ARC</p>
      </div>
    </main>
  );
}
