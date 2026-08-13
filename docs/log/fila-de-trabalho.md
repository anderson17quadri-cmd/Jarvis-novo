# Fila de trabalho — sessões locais (13/08/2026)

> Como funciona: cada sessão (Claude local, DeepSeek, Qwen, Kimi — uma por
> terminal) escolhe **um** item por baixo sem dono, escreve o seu nome e a
> hora logo a seguir ao título (`git pull` → editar → `git commit` → `git
> push` **antes** de começar a trabalhar nele — é a reserva), e só aí começa.
> Se o `push` falhar porque outra sessão já reservou o mesmo item entretanto,
> `git pull`, aceitar que perdeu a corrida, e escolher outro. Isto substitui
> um coordenador central: o próprio `git` é quem arbitra.
>
> Cada item fechado ganha a sua entrada normal em
> `docs/log/historico-sessoes.md` e a atualização correspondente no
> `SPEC.md` — as mesmas regras de sempre (tsc limpo, eslint 0 erros, suite
> completa a passar, `git pull` antes de cada `push`, nunca `--force`, nunca
> commitar segredos). Isto aqui é só a fila, não substitui nada disso.

## Por fazer

### 1. Reordenar a cadeia de provedores de IA — `[livre]`

Hoje a ordem é fixa em código (`CHAIN_ORDER` — DeepSeek, Claude, Ollama,
`docs/spec/orquestrador-multi-provedor.md` §3). Falta um ecrã em
Personalização → Assistente para reordenar (arrastar, ou uma lista
numerada com setas para cima/baixo chega) e guardar a preferência. Ver
esse documento inteiro antes de começar — já explica o desenho da cadeia,
o que já está feito, e porquê.

### 2. Ollama — mensagem específica quando o modelo não está instalado — `[livre]`

Pedido pequeno, já registado em `ollama-provider.ts` e no fim de
`docs/spec/orquestrador-multi-provedor.md` §1: hoje, pedir um modelo que
não está puxado (`ollama pull`) chega como um erro de servidor genérico.
Vale a pena distinguir isso com uma mensagem própria ("modelo não
encontrado — falta `ollama pull <nome>`")? Só se for mesmo pequeno — se
abrir um buraco maior, documentar e passar à frente.

### 3. Revisão a sério de uma peça sem revisão independente ainda — `[livre, repetível]`

A cultura deste projeto (ver `docs/estilo-de-codigo.md`) é não confiar só
no relatório de quem construiu — reler o código a sério à procura de bugs
reais, não só conferir que os testes passam. Só 5 das 73 entradas do
histórico mencionam explicitamente uma "revisão independente" alheia.
Escolhe uma peça do `docs/log/historico-sessoes.md` que ainda não tenha
essa revisão, relê o código de propósito (não só os testes — os bugs reais
que já se encontraram este projeto todo estavam todos a passar nos testes
que já existiam antes de alguém olhar a sério), e documenta o que
encontrou — mesmo que seja "nada de real a corrigir", como já aconteceu
antes. Isto não esgota nunca: cada sessão pode pegar noutra peça.

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
