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

## Construir

### 1. Reordenar a cadeia de provedores de IA

Tentativa de atribuir à Qwen às 17:42 (13/08/2026) falhou de imediato —
quota ainda esgotada (`429`, `token-plan 1-week quota exhausted`,
reset previsto `08-19 03:23 UTC`, mesmo erro já visto antes esta
sessão). Item de volta à fila, sem dono, para a próxima sessão livre.

Hoje a ordem é fixa em código (`CHAIN_ORDER` — DeepSeek, Claude, Ollama,
`docs/spec/orquestrador-multi-provedor.md` §3). Falta um ecrã em
Personalização → Assistente para reordenar (arrastar, ou uma lista
numerada com setas para cima/baixo chega) e guardar a preferência.

### 2. Ollama — mensagem específica quando o modelo não está instalado — `[livre, pequena]`

Hoje, pedir um modelo que não está puxado (`ollama pull`) chega como um
erro de servidor genérico. Vale a pena distinguir isso com uma mensagem
própria? Só se for mesmo pequena — se abrir um buraco maior, documentar
e passar à frente.

## Rever a sério (nunca construído de novo — ler o código como se fosse a primeira vez, sem confiar nos testes só porque passam)

### 3. Terminal — **Kimi** (13/08/2026 17:42)

`src-tauri/src/terminal/` (PTY real, `portable-pty`). Nunca revisto.

### 4. Automações nativas (gatilhos de ficheiro/USB/bateria) — **DeepSeek** (13/08/2026 17:42)

`watch_folder`/`unwatch_folder`/`get_battery_status`,
`checkNativeTriggers()`. Nunca revisto.

### 5. Peça 20 — ferramentas para o Claude no orquestrador — **Claude local** (13/08/2026 17:42)

Acabada de sair (commit `f1eba3a`). Ninguém de fora ainda a leu.

### 10. Editor visual de automações — `[livre]`

Entrada do histórico em "2026-08-11 — Editor visual de automações".
Nunca revisto.

### 11. "Amanhã" resolvido pelo modelo (contexto de datas na conversa) — `[livre]`

Entrada "2026-08-11 — Contexto na conversa: amanhã resolvido pelo
modelo, não por regras". Vale a pena confirmar que isto não depende do
fuso horário da máquina de forma frágil, e que uma frase ambígua
("depois de amanhã", "esta sexta") não engana o modelo de forma
silenciosa.

### 12. Voz clonada local — consentimento explícito — `[livre, ético]`

Ver `docs/spec/voz-clonada-local.md` e a regra em
`docs/estilo-de-codigo.md` §"Decisões éticas já assentes": nunca clonar
sem consentimento explícito. Confirma que o código cumpre isto sem
exceção — nenhum caminho (importar um ficheiro de áudio de fora, por
exemplo) consegue treinar uma voz sem o consentimento passar primeiro.

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
