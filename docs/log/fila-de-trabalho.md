# Fila de trabalho — sessões locais (13/08/2026)

> Cada item abaixo já tem uma IA atribuída diretamente (ver
> `docs/log/prompt-orquestracao-noturna.md` para os quatro prompts
> completos, um por IA) — não é preciso reservar por `git push` como
> antes, já está dividido para não haver choque. Se alguma IA acabar o seu
> item antes das outras, escolhe **outro que ainda não tenha dono** aqui
> em baixo, reserva-o da forma antiga (nome + hora, `commit`/`push` antes
> de começar), e segue o mesmo roteiro.
>
> Cada item fechado ganha a sua entrada normal em
> `docs/log/historico-sessoes.md` e a atualização correspondente no
> `SPEC.md` — as mesmas regras de sempre (tsc limpo, eslint 0 erros, suite
> completa a passar, `git pull` antes de cada `push`, nunca `--force`, nunca
> commitar segredos). Isto aqui é só a fila, não substitui nada disso.

## Por fazer

### 1. Reordenar a cadeia de provedores de IA — **Qwen**

Hoje a ordem é fixa em código (`CHAIN_ORDER` — DeepSeek, Claude, Ollama,
`docs/spec/orquestrador-multi-provedor.md` §3). Falta um ecrã em
Personalização → Assistente para reordenar (arrastar, ou uma lista
numerada com setas para cima/baixo chega) e guardar a preferência. Ver
esse documento inteiro antes de começar — já explica o desenho da cadeia,
o que já está feito, e porquê.

### 2. Ollama — mensagem específica quando o modelo não está instalado — **bónus do Qwen, se sobrar tempo**

Pedido pequeno, já registado em `ollama-provider.ts` e no fim de
`docs/spec/orquestrador-multi-provedor.md` §1: hoje, pedir um modelo que
não está puxado (`ollama pull`) chega como um erro de servidor genérico.
Vale a pena distinguir isso com uma mensagem própria ("modelo não
encontrado — falta `ollama pull <nome>`")? Só se for mesmo pequeno — se
abrir um buraco maior, documentar e passar à frente.

### 3. Revisão a sério do Terminal — **Kimi**

Nunca teve uma revisão independente (`grep` ao histórico confirma).

### 4. Revisão a sério das Automações nativas (gatilhos de ficheiro/USB/bateria) — **DeepSeek**

Nunca teve uma revisão independente.

### 5. Revisão a sério da Peça 20 (ferramentas do Claude no orquestrador) — **Claude local**

Peça acabada de sair (commit `f1eba3a`), ninguém de fora ainda a leu.

### 6. Outra peça qualquer sem revisão independente — `[livre, repetível]`

Para quando as cinco de cima estiverem fechadas. A cultura deste projeto
(ver `docs/estilo-de-codigo.md`) é não confiar só no relatório de quem
construiu — reler o código a sério à procura de bugs reais, não só
conferir que os testes passam. Só 5 das 73 entradas do histórico
mencionam explicitamente uma "revisão independente" alheia — sobra
bastante por escolher.

## Precisa de decisão da pessoa — não construir sem perguntar

### Wake word configurável (escuta contínua)

`SPEC.md` linha ~397: "Exige escuta contínua — decisão de privacidade por
tomar." Isto liga o microfone sem a pessoa carregar em nada antes — mesma
categoria de risco que o navegador controlado pelo assistente (Peça 19) ou
o Controlo Direto (Fase 3.1), que só avançaram depois de a pessoa escolher
o âmbito explicitamente. Não construir isto às cegas: se alguma sessão
chegar aqui com tempo sobrando, o trabalho certo é escrever as perguntas
concretas (que palavra, sempre a ouvir vs. só com um gesto para ativar,
onde fica guardado o áudio, se fica) num ficheiro `docs/log/perguntas-para-
o-utilizador.md`, não escolher por conta própria.

## Feito (mover para aqui ao fechar, com o commit)

_(vazio — a primeira peça fechada desta fila entra aqui)_
