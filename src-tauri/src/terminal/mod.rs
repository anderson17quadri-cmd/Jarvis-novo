//! Terminal real (Parte 6.2 §Janela: Terminal).
//!
//! Um PTY a sério por sessão, via `portable-pty` (o mesmo motor do WezTerm —
//! dá cores, redimensionamento e um shell que se comporta como um shell). A
//! interface nunca escolhe o que corre: o programa é sempre [`SHELL_PROGRAM`],
//! fixo neste ficheiro. O único IPC que a interface tem é "escreve este texto
//! no stdin da sessão X" — exatamente o que um humano a escrever num terminal
//! a sério faria. Isto é a fronteira de segurança: não há caminho nenhum,
//! vindo do lado de fora, para escolher um binário diferente para correr.
//!
//! Confirmação para comandos destrutivos (`rm`, `del`, `Remove-Item`, etc.):
//! decidiu-se **não pedir**. O critério do projeto para pedir confirmação
//! ("dá para desfazer?") aplica-se a ações que o *assistente* decide tomar
//! por conta própria, a partir de uma frase interpretada por um modelo que
//! pode alucinar — daí "apagar_tarefas_concluidas" pedir confirmação. Um
//! terminal é o oposto: é a pessoa a escrever, à mão, exatamente o comando
//! que quer correr, com controlo total e deliberado — o mesmo que qualquer
//! terminal a sério (PowerShell, Windows Terminal, cmd) já assume. Filtrar
//! por padrões de texto (`del`, `rm -rf`, …) seria ao mesmo tempo frágil
//! (contornável com um alias, uma variável, `iex`, um caminho diferente) e
//! surpreendente (um terminal que pergunta "tens a certeza?" antes de um
//! comando comum deixa de se comportar como um terminal).

mod registry;
mod session;

pub use registry::TerminalRegistry;
