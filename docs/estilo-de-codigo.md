# Estilo e regras do projeto

Isto é a "inteligência já adquirida" deste projeto — não específica de
nenhum modelo. `CLAUDE.md` aponta para aqui para o Claude Code; o
`ollama/Modelfile` traz uma versão resumida disto como prompt de sistema
para um modelo Ollama local; qualquer outra ferramenta (DeepSeek, outro
editor) pode colar isto como prompt de sistema também. Um só sítio,
todos os modelos a lerem o mesmo.

## Língua

Português de Portugal em tudo: comentários, mensagens de commit, texto da
interface, respostas na conversa. Identificadores de código seguem o que
já estiver no ficheiro — nomes de domínio (`vozes_prontas`, `falar`,
`VoiceSelection`) tendem a português, padrões genéricos da linguagem
(`setSelection`, getters, handlers) tendem a inglês, porque é o que o
resto do ficheiro já faz. Não trocar o que já está escrito só para
uniformizar.

## Comentários

Por omissão, nenhum. Um comentário só se justifica quando explica um
**porquê** que não é óbvio a partir do código — uma restrição escondida,
um invariante subtil, um contorno a um bug específico, um comportamento
que surpreenderia quem lê. Nunca um comentário a dizer o que o código já
diz por ter nomes bem escolhidos. Nunca referências à tarefa atual ("usado
para X", "adicionado para Y") — isso pertence à mensagem do commit, não
ao ficheiro, que ainda vai lá estar quando ninguém se lembrar de X ou Y.

## Design

Não acrescentar funcionalidades, abstrações ou generalizações além do que
foi pedido. Uma correção não precisa de limpeza à volta; uma operação
feita uma vez não precisa de função auxiliar. Três linhas parecidas são
melhores do que uma abstração prematura. Sem implementações a meio —
ou está feito, ou não se começa.

Sem tratamento de erros, validação ou casos de contorno para cenários que
não podem acontecer. Confia-se no código interno e nas garantias da
framework. Só se valida na fronteira (entrada do utilizador, API externa).

## Verificação, antes de dar como feito

- `npx tsc --noEmit` (ou o equivalente do projeto em causa)
- `npx eslint <ficheiros tocados>`
- `npx vitest run` (ou a suite de testes relevante)
- Para mudanças de interface: confirmar num browser real (ou na app a
  sério), não só nos testes automáticos — os testes provam a lógica, não
  que a coisa se vê bem.

Nunca reportar sucesso sem ter corrido isto.

## Decisões éticas já assentes (não voltar a discutir sem pedido explícito)

- **Voz clonada, só com consentimento explícito.** Nunca clonar
  personagens, atores sem autorização, ou reaproveitar áudio sintético de
  outro serviço como se fosse uma gravação real. Só a voz de quem usa o
  sistema, ou de alguém que autorizou. Ver `docs/spec/voz-clonada-local.md`.

## Git

Mensagens de commit em português, focadas no **porquê**, não no que já se
vê no diff. Nunca usar `--no-verify` nem saltar hooks sem pedido explícito.
Nunca commits vazios. Preferir commits novos a `--amend`, exceto quando
pedido.

## Onde procurar mais contexto

- `SPEC.md` — o que está feito, parcial, ou por fazer.
- `docs/spec/jarvis-spec-completo.md` — a especificação original.
- `docs/log/historico-sessoes.md` — o histórico de decisões, sessão a
  sessão. É a memória entre conversas — lê-o antes de assumir que algo
  ainda está por decidir.
