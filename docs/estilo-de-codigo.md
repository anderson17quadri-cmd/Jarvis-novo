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

**"Respostas na conversa" inclui relatórios de progresso e resumos
técnicos, mesmo quando parecem dirigidos a outra IA em vez de à pessoa.**
Uma sessão lançada sem interface (`claude -p "..."`) ou a escrever um
resumo do que fez tende a cair para inglês por hábito — não é exceção à
regra. Se o texto vai aparecer num terminal ou numa conversa, é em
português, sem exceção nenhuma de contexto ou de audiência.

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

## Fazer o que foi pedido, até ao fim (regra do utilizador, 19/08/2026)

Quando o utilizador pede uma coisa, **faz-se essa coisa toda** — não uma
parte, com o resto oferecido como "queres que continue?". Se o pedido é
"verifica tudo", é tudo; se é grande, leva o tempo que levar, mas não se
devolve o trabalho por acabar disfarçado de pergunta.

Duas regras que saem daqui, e que já foram quebradas antes:

1. **Não dizer que se verificou o que não se leu.** Correr o portão
   (`tsc`/`eslint`/`vitest`/`cargo`) prova que compila e que os testes
   passam — um teste só prova aquilo que testa. Ler o `SPEC.md` e o
   histórico é ler o que *outro* disse; não conta como verificação. Se
   se leram 15 ficheiros de 295, diz-se "li 15 de 295", não "verifiquei".
2. **Uma dívida anunciada é uma dívida a pagar.** Dizer "a seguir vou
   verificar X" e não o fazer é pior do que não ter dito nada — foi
   assim que os itens 21 e 22 ficaram por rever durante uma sessão
   inteira, e o 22 tinha mesmo um buraco (o `id` do plugin como
   namespace, 19/08/2026).

O utilizador já teve de pedir isto mais do que uma vez. Não é preferência
de estilo: é a condição para os relatórios deste projeto valerem alguma
coisa.

## Decisões éticas já assentes (não voltar a discutir sem pedido explícito)

- **Voz clonada, só com consentimento explícito.** Nunca clonar
  personagens, atores sem autorização, ou reaproveitar áudio sintético de
  outro serviço como se fosse uma gravação real. Só a voz de quem usa o
  sistema, ou de alguém que autorizou. Ver `docs/spec/voz-clonada-local.md`.

- **As três decisões de `docs/log/perguntas-para-o-utilizador.md`
  (14/08/2026), decididas pelo utilizador ao delegar em "tome a melhor
  decisão":**
  1. **Assinatura de plugins passa a cobrir o `code`, não só o
     `manifest`.** A justificação antiga (código não seria serializável
     de forma determinística) estava tecnicamente errada. Sem plugins
     externos reais em circulação ainda, o custo da mudança quebradora é
     baixo agora e só cresce com o tempo — corrigir já.
  2. **Wake word: local, nunca por um serviço de fala na nuvem.** Escuta
     contínua só entra com um motor a correr na própria máquina, sem
     áudio a sair — a mesma disciplina que já levou a construir o
     Whisper local para o reconhecimento manual. Uma wake word que manda
     áudio para a nuvem 24 horas por dia é uma categoria de exposição
     diferente de um pedido pontual, e vai contra o resto do projeto.
  3. **Capacidades de plugin — Executar Voz e Ler Memória autorizadas
     já** (mesma disciplina de permissão explícita por plugin que as
     outras dez já têm). **Guardar Preferências fica condicionada**: só
     se autoriza depois de existir isolamento por plugin no
     armazenamento (`plugins:<id>:` ou equivalente) — sem isso, um
     plugin já podia ler ou escrever por cima dos dados de outro.

- **A palavra-passe do login fica decorativa (19/08/2026, decisão
  explícita do utilizador).** O `LoginScreen` aceita qualquer texto não
  vazio e não guarda hash nenhum — é intencional, vem da Parte 5 da spec
  original ("facial (simulado), digital (simulado)…") e está documentado
  em `SPEC.md` §8. A auditoria de 19/08 apresentou a alternativa (uma
  palavra-passe a sério, com hash, como a do Controlo Direto) e o
  utilizador respondeu para deixar de fora. A razão contra mantém-se:
  num sistema sem servidor não há recuperação, e esquecê-la seria ficar
  trancado fora da própria máquina. **Não voltar a propor.** Quem quiser
  um primeiro fator forte liga o 2FA (chave física, verificada
  criptograficamente) ou entra pelo Windows Hello — os dois são reais.

## Git

Mensagens de commit em português, focadas no **porquê**, não no que já se
vê no diff. Nunca usar `--no-verify` nem saltar hooks sem pedido explícito.
Nunca commits vazios. Preferir commits novos a `--amend`, exceto quando
pedido.

## Orquestração multi-modelo (trabalho noturno)

Quando se pede para pôr várias IAs locais a trabalhar (Claude local,
DeepSeek, Qwen, Kimi…) enquanto a pessoa dorme: **um só prompt**, colado
diretamente na conversa (nunca guardado num ficheiro à parte — isso é
ruído, o prompt é para o chat), para o Claude Code local, que é quem
abre os terminais das outras sozinho e as comanda — nunca vários prompts
separados para a pessoa colar um a um em cada terminal à mão. O prompt
manda iniciar o Jarvis primeiro (`npm run tauri dev`, num terminal à
parte que fica aberto para se poder testar ao vivo a qualquer momento),
depois ler `docs/log/fila-de-trabalho.md` — essa sim fica no
repositório, porque é o mecanismo que faz as sessões não colidirem entre
si (cada uma reserva um item por `git push` antes de começar).

## Onde procurar mais contexto

- `SPEC.md` — o que está feito, parcial, ou por fazer.
- `docs/spec/jarvis-spec-completo.md` — a especificação original.
- `docs/log/historico-sessoes.md` — o histórico de decisões, sessão a
  sessão. É a memória entre conversas — lê-o antes de assumir que algo
  ainda está por decidir.
