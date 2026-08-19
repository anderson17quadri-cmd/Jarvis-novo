# JARVIS AI OS — Project ARC

Tauri v2 + React 19 + TypeScript strict.

## A regra que está acima de todas as outras

**O que o utilizador pedir, faz-se — até ao fim, não metade.** Se o pedido
é "verifica tudo", é tudo; não se devolve trabalho por acabar disfarçado
de "queres que continue?". E nunca se diz que se verificou o que não se
leu: o portão a passar prova que compila, não que está certo. Detalhe e
razão em `docs/estilo-de-codigo.md` §"Fazer o que foi pedido, até ao fim".

## Antes de começar

Lê **`docs/estilo-de-codigo.md`** primeiro — é a "inteligência já
adquirida" deste projeto (língua, estilo, regras, ética), escrita para
qualquer modelo, não só para ti. Depois:

1. **`docs/log/historico-sessoes.md`** — o que já se decidiu e porquê,
   sessão a sessão. É a memória entre conversas: uma sessão nova (local
   ou não) não tem acesso à conversa anterior, só a isto e ao que está
   commitado.
2. **`SPEC.md`** — o que está feito, parcial, ou por fazer.
3. **`docs/spec/jarvis-spec-completo.md`** — a especificação original.

## Ao acabar um bocado de trabalho com significado

Acrescenta uma entrada no fim do `docs/log/historico-sessoes.md`, no mesmo
formato das que já lá estão — data, título curto, duas ou três frases sobre
o que se pediu e o que ficou feito. "Com significado" quer dizer uma
funcionalidade, uma correção, uma decisão — não cada ficheiro isolado, nem
cada commit a seu tempo (os commits já são a fonte exata do "o quê"; isto é
só o "porquê", em prosa).

Se o trabalho mudar uma regra ou convenção (não só o histórico dela),
atualiza também o `docs/estilo-de-codigo.md` — e, se for algo que valha a
pena um modelo local saber de fábrica, o `ollama/Modelfile`.
