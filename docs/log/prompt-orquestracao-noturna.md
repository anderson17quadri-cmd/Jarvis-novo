# Prompt — orquestração noturna multi-modelo (13/08/2026)

> Um só prompt, para o **Claude Code local**. Ele é que lê a fila, decide
> o que manda a cada IA, abre os terminais sozinho e acompanha — a pessoa
> não escreve nada mais esta noite. Ver `docs/estilo-de-codigo.md`
> §"Orquestração multi-modelo".

Cola isto à sessão do Claude Code local, na raiz do repositório:

---

Vais orquestrar sozinho o trabalho desta noite, sem mais nada da minha
parte. Faz isto:

1. `npm run tauri dev` num terminal à parte, que fica aberto a noite
   toda — é para eu poder testar ao vivo a qualquer momento.

2. `git pull origin claude/jarvis-ai-os-tauri-mvp-xa5km0`, depois lê
   `docs/estilo-de-codigo.md` e `docs/log/fila-de-trabalho.md` — a fila
   tem 15 itens, cada um já com contexto suficiente para uma IA começar
   sozinha (o que rever, que ficheiros, que perguntas responder).

3. Confirma nesta máquina como se invoca o Qwen, o Kimi e o DeepSeek em
   modo não-interativo (o equivalente ao `claude -p`). Se não souberes o
   comando de algum, não adivinhes — avisa-me em vez de inventar uma
   flag.

4. Abre um terminal por IA (Qwen, Kimi, DeepSeek, e um para ti). Para
   cada uma, escolhe o próximo item sem dono da fila, escreve o nome
   dela e a hora a seguir ao título do item em
   `docs/log/fila-de-trabalho.md` (`git pull` → editar → `commit` →
   `push`, sempre antes de a pôr a trabalhar — é a reserva), e manda-lhe
   o texto desse item como tarefa, com saída para `logs/<nome>.log`.
   Nunca atribuas os itens da secção "Precisa de decisão da pessoa".

5. Quando alguma terminar (o item dela passou para "Feito" com um
   commit), dá-lhe o próximo item sem dono da fila, da mesma forma. Isto
   repete a noite toda — a fila é para durar, não para uma tarefa cada.

6. A cada 15-20 minutos: `git log --oneline -10`, os ficheiros de log
   (alguma presa a meio, ou a pedir uma confirmação que não devia
   precisar?), `git status` (conflito à espera?).

Regra para todas, sempre: gates completos antes de qualquer `push`
(`tsc --noEmit` limpo, `eslint .` 0 erros, `npx vitest run` e
`cargo test` se mexeu em Rust, tudo a passar), `git pull` antes de cada
`push`, nunca `--force`, nunca um segredo commitado, tudo em português —
código, commits, e a entrada correspondente em
`docs/log/historico-sessoes.md`/`SPEC.md` ao fechar cada item. E nunca
confiar só no relatório de outra sessão — confirma tu próprio antes de
construir por cima do que ela disser que fez.

No fim, ou de manhã, resume-me o que cada IA fechou e qualquer bug real
encontrado.

---

Isto fica registado em `docs/log/prompt-orquestracao-noturna.md` e a
fila em `docs/log/fila-de-trabalho.md`, os dois já commitados.
