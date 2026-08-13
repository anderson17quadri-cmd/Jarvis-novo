# Fila de trabalho — sessões locais (13/08/2026)

> O Claude Code local atribui o primeiro item da lista a cada IA (ver
> `docs/log/prompt-orquestracao-noturna.md`), e continua a atribuir o
> próximo item por baixo a quem for terminando — a fila não é para
> esgotar num turno só, é para durar a noite inteira. Os quatro primeiros
> já têm dono fixo para começar; os restantes são por ordem, primeiro a
> chegar primeiro a servir (reserva por `git push`: nome + hora a seguir
> ao título, `commit`/`push` antes de começar — se o `push` falhar porque
> outra sessão já reservou o mesmo item, `git pull` e escolhe o seguinte).
>
> Cada item fechado ganha a sua entrada normal em
> `docs/log/historico-sessoes.md` e a atualização correspondente no
> `SPEC.md` — as mesmas regras de sempre (tsc limpo, eslint 0 erros, suite
> completa a passar, `git pull` antes de cada `push`, nunca `--force`,
> nunca commitar segredos, tudo em português). Isto aqui é só a fila.

## Rever a sério (nunca construído de novo — ler o código como se fosse a primeira vez, sem confiar nos testes só porque passam)

### 11. "Amanhã" resolvido pelo modelo (contexto de datas na conversa) — **DeepSeek** (13/08/2026 18:50) `[livre]`

Entrada "2026-08-11 — Contexto na conversa: amanhã resolvido pelo
modelo, não por regras". Vale a pena confirmar que isto não depende do
fuso horário da máquina de forma frágil, e que uma frase ambígua
("depois de amanhã", "esta sexta") não engana o modelo de forma
silenciosa.

### 14. Suite E2E com Playwright — `[livre]`

Confirma que a suite ainda corre e ainda apanha regressões a sério — não
só que existe. Corre-a, vê se cobre os fluxos que mudaram desde que foi
escrita (login, várias janelas, o assistente com ferramentas), e
acrescenta o que estiver a faltar de óbvio.

### 15. Outra peça qualquer sem revisão independente — `[livre, repetível]`

Para quando as catorze de cima estiverem fechadas. Só 5 das 73 entradas
do histórico mencionam uma "revisão independente" alheia — sobra sempre
mais por escolher em `docs/log/historico-sessoes.md`.

## Precisa de decisão da pessoa — não construir sem perguntar

### Wake word configurável (escuta contínua)

`SPEC.md` linha ~397: "Exige escuta contínua — decisão de privacidade por
tomar." Liga o microfone sem a pessoa carregar em nada antes — mesma
categoria de risco que o navegador controlado (Peça 19) ou o Controlo
Direto (Fase 3.1), que só avançaram depois de a pessoa escolher o âmbito
explicitamente. Se sobrar tempo, o trabalho certo é escrever as
perguntas concretas num ficheiro `docs/log/perguntas-para-o-
utilizador.md`, não escolher por conta própria.

### Executar Voz / Ler Memória / Guardar Preferências, capacidades de plugin

`docs/spec/plugins-sandbox.md` §"O que ainda falta": mexem em microfone
e dados guardados — exigem autorização explícita antes de se desenhar
sequer o protocolo. Mesma regra: escrever a pergunta, não decidir.

## Feito (mover para aqui ao fechar, com o commit)

### 12. Voz clonada local — consentimento explícito — Claude local — commit `1b16ad5`

**Gap real, corrigido**: `voice-clone-service/server.py` tinha CORS
aberto a qualquer origem (`allow_origins=["*"]`) — qualquer página
aberta noutro separador do browser, sem ligação ao JARVIS, conseguia
`POST /voz` e substituir a voz de referência sem a pessoa dar por
nada. A única barreira de consentimento vivia na convenção da
interface (gravar pelo microfone), nunca aplicada no próprio serviço.
Restrito por `allow_origin_regex` às origens reais do JARVIS
(desenvolvimento confirmado; produção não). Resto do fluxo confirmado
limpo — só `getUserMedia` manda áudio, nenhuma ferramenta do
assistente consegue clonar. 3 testes novos, infraestrutura de testes
Python criada de raiz. Detalhe em `docs/log/historico-sessoes.md`
(13/08/2026, "Revisão a sério: voz clonada, consentimento explícito").

### 10. Editor visual de automações — Claude local — commit `a5b64eb`

`save()` editava uma automação existente com `remove()` + `add()` —
`add()` gera sempre um `id` novo e reinicia `createdAt`/`lastRunAt`/
`runCount`, por isso qualquer edição (mesmo corrigir só o nome)
apagava o histórico da regra. Corrigido com
`AutomationService.update()`, que substitui o conteúdo mantendo a
identidade. 4 testes novos. Detalhe em `docs/log/historico-sessoes.md`
(13/08/2026, "Revisão a sério: Editor visual de automações").

### 1. Reordenar a cadeia de provedores de IA — DeepSeek — commit `2ff489f`

A ordem da cadeia de reserva deixou de ser fixa (`CHAIN_ORDER`): agora
`AiSettings.providerOrder` guarda a preferência, editável em
Personalização → Assistente (lista numerada com setas para cima/baixo),
e `applyAiSettings` lê-a em vez da constante. 4 testes novos. Detalhe
em `docs/log/historico-sessoes.md` (13/08/2026).

### 2. Ollama — mensagem específica quando o modelo não está instalado — Claude local — commit `8ce8de6`

Confirmado ao vivo contra um Ollama real: modelo em falta devolve 404
com `{"error":{"type":"not_found_error"}}` — distinguido com um
`AiFailureKind` novo (`'modelo'`) do genérico de servidor. 3 testes
novos. Detalhe em `docs/log/historico-sessoes.md` (13/08/2026).

### 3. Terminal — Kimi + Claude local — commit `dc353bb`

`src-tauri/src/terminal/` (PTY real, `portable-pty`). Nunca revisto,
sem um teste sequer. A Kimi bateu no limite de taxa da organização a
meio da revisão, com uma correção substancial já escrita mas por
compilar/testar/publicar — retomada pelo coordenador no mesmo
worktree. Três bugs reais: carateres UTF-8 multibyte cortados a meio
entre dois `read()` do PTY (viravam `�`), `write()` do registo a
segurar o lock de todo o registo durante uma escrita ao PTY que pode
bloquear (travava qualquer outra sessão, incluindo o `kill`), e
`kill()` a não colher o processo (zombies no Unix). 5 testes novos.
Detalhe em `docs/log/historico-sessoes.md` (13/08/2026, "Revisão a
sério: Terminal").

### 4. Automações nativas (gatilhos de ficheiro/USB/bateria) — DeepSeek — commit `1d76067`

`watch_folder`/`unwatch_folder`/`get_battery_status`,
`checkNativeTriggers()`. Revisão a sério: confirmada e corrigida a fuga do
`unwatch_folder` (a thread do observador nunca parava) e o cruzamento de
limiar da bateria com mais do que uma regra. Detalhe em
`docs/log/historico-sessoes.md` (13/08/2026).

- **Explorador de ficheiros real (Peça 7)** — revisto (Claude, sessão
  remota, 13/08/2026): `files_read_dir` canonicaliza antes de comparar
  (`starts_with`), o que resolve `..` e segue links simbólicos até ao
  alvo real antes da comparação — cobre os dois casos que a fila
  levantava. Nada de real a corrigir.
- **Navegador controlado pelo assistente (Peça 19)** — revisto (Claude,
  sessão remota, 13/08/2026): **SSRF real encontrado e corrigido** — só
  se confería o esquema, nunca o anfitrião; `localhost`, IPs privados e
  o endereço de metadados de nuvem passavam, e um redirecionamento podia
  contornar qualquer verificação futura. Ver
  `docs/log/historico-sessoes.md`, entrada "Auditoria a sério do
  projeto: SSRF real no navegador controlado, corrigido".
- **Peça 20 — ferramentas para o Claude no orquestrador** — revisto
  (Claude local, 13/08/2026): tradução `toAnthropicMessages`/
  `collectClaudeStream` confirmada correta a sério (blocos
  `tool_use`/`tool_result`, argumentos por `input_json_delta`
  acumulados por índice, dois `tool_use` em paralelo sem se
  misturarem), contrato `run()` fiel ao da DeepSeek, chave só no
  cabeçalho, testes reais de ponta a ponta. Nada de errado nesta peça;
  documentada uma limitação pré-existente do desenho da cadeia (não
  desta peça) em `docs/log/historico-sessoes.md`, entrada "Revisão
  independente: Peça 20". Commit `0372812` (+ merge `429f4fd`).
- **Vault Obsidian (Peça 17)** — revisto (Claude, sessão remota,
  13/08/2026): **escrita através de link simbólico, real, corrigida** —
  `obsidian_write_note` só canonicalizava a pasta-mãe, nunca o ficheiro
  final; uma nota já existente como link simbólico era escrita através
  dele. Nunca tinha havido teste Rust nenhum deste ficheiro — 6 testes
  novos. Ver `docs/log/historico-sessoes.md`, entrada "Auditoria a
  sério (continuação): escrita de nota do Obsidian através de um link
  simbólico, corrigida".
- **Anexos de email a sério** — revisto (Claude, sessão remota,
  13/08/2026): sem fuga nova. Os cinco sítios do projeto com blob URLs
  revistos um a um; todos corretamente pareados (criação/revogação),
  incluindo o cleanup ao desmontar o composer. Nada a corrigir.
- **Fase 3.1: Controlo Direto** — revisto (Claude, sessão remota,
  13/08/2026): **dois achados reais**. `executeStep()` nunca conferia
  sessão de presença ativa antes de executar (a spec exige "sem isto,
  nada corre") — corrigido para o próprio serviço se defender, não só
  quem o chama. E mais grave em honestidade do que em segurança: nada
  disto está ligado a um fluxo alcançável pela pessoa — o overlay nunca
  é montado, a voz nunca liga a `verify()`. Zero testes antes; 13
  novos. Ver `docs/log/historico-sessoes.md`, entrada "Auditoria a
  sério (continuação): Controlo Direto sem porta de presença nem
  ligação a fluxo nenhum".
