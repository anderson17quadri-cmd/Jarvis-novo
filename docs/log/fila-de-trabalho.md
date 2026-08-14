# Fila de trabalho — sessões locais (13/08/2026)

> O Claude Code local lê esta fila e atribui item a item a quem estiver
> livre, continuando a atribuir o próximo a quem for terminando — não é
> para esgotar num turno só, é para durar a noite inteira. Reserva por
> `git push`: nome + hora a seguir ao título, `commit`/`push` antes de
> começar — se o `push` falhar porque outra sessão já reservou o mesmo
> item, `git pull` e escolhe o seguinte.
>
> **Só DeepSeek, a partir de agora (14/08/2026, pedido explícito do
> utilizador).** Kimi e Qwen ficam de fora — não atribuir mais nada a
> nenhum dos dois, mesmo que apareçam livres. Se houver mais itens do
> que instâncias de DeepSeek a correr, **abre mais terminais com
> DeepSeek** (duas, três, o que for preciso) em vez de recorrer a Kimi
> ou Qwen — várias instâncias de DeepSeek em paralelo, cada uma com o
> seu próprio item reservado (mesma disciplina de reserva por
> `git push`, para não pegarem no mesmo item). Só volta a Kimi/Qwen se
> o utilizador pedir explicitamente outra vez.
>
> Cada item fechado ganha a sua entrada normal em
> `docs/log/historico-sessoes.md` e a atualização correspondente no
> `SPEC.md` — as mesmas regras de sempre (tsc limpo, eslint 0 erros, suite
> completa a passar, `git pull` antes de cada `push`, nunca `--force`,
> nunca commitar segredos, tudo em português). Isto aqui é só a fila.

## Reportado ao vivo pelo utilizador (14/08/2026) — prioridade sobre o resto

Os itens 16 e 17 estão fechados — ver "Feito" abaixo.

### 18. A resposta na janela normal do assistente nunca fala — `[livre]`

**Diagnóstico já feito** (sessão remota, leitura do código, confirmado
por `git log` que nunca foi diferente — não é regressão de hoje): a
fala por frase (item 16) só está ligada ao caminho de **comandos por
voz** — `services/voice/executor.ts`, `runIntent()` para um intent
`'perguntar'`, chama `executor.ask(intent.text)`, que é o `ask` de
`App.tsx` com o `speakQueued` já ligado. **A janela normal do
assistente (`AssistantWindow.tsx`, onde a maior parte da conversa
acontece, escrita ou falada através dela) usa `aiService.sendWithTools()`
— que nunca, em nenhum commit da história deste ficheiro, chamou
`speak()` nem `speakQueued()`.** Confirmado com `git log -p --follow`
sobre o ficheiro.

**O que se pede**: ligar a mesma fala por frase (o mecanismo já existe —
`extractSentences` + `speakQueued`, ver item 16) também ao caminho de
`sendWithTools`/`AssistantWindow.tsx`, não só ao `ask`. Precisa de uma
decisão pequena de desenho: falar sempre, só quando a pergunta chegou
por voz, ou atrás de uma preferência nas definições de voz (a pessoa
pode preferir ler em silêncio quando está a escrever). Se não houver
sinal já guardado de "isto chegou por voz", o mais simples e mais
parecido com "conversa real" é falar sempre que a resposta terminar,
com a preferência de sempre para desligar se for indesejado — decidir
com bom senso, documentar a escolha.

## Rever a sério (nunca construído de novo — ler o código como se fosse a primeira vez, sem confiar nos testes só porque passam)

### 15. Outra peça qualquer sem revisão independente — `[livre, repetível]`

Para quando as catorze de cima estiverem fechadas. Só 5 das 73 entradas
do histórico mencionam uma "revisão independente" alheia — sobra sempre
mais por escolher em `docs/log/historico-sessoes.md`. Todos os catorze
itens acima estão fechados — repetível; instâncias fechadas (2FA,
Notificações nativas isoladas, Meteorologia/Notícias, Marketplace de
plugins, Sandbox de execução de plugins, Memória do assistente) já em
"Feito" abaixo.

**Em curso — O interpretador de comandos de voz (`services/voice/intents.ts`) — DeepSeek (14/08/2026 04:45)**. As seis famílias de comandos e a separação de comandos compostos nunca foram revistas como um todo por ninguém de fora — só alargadas (`stripPoliteness`, mais verbos por família). É o caminho que responde sem modelo: um bug aqui é uma ação errada por voz.

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

### 15. Catálogo de ferramentas e executor — revisão adversarial — DeepSeek — commit `6776f58`

Revisão a sério de `tools.ts` + `tool-runner.ts`, nunca revistos como um todo
por ninguém de fora. **Um bug real, corrigido:** `mudar_de_desktop` só validava
o tipo (`number`), não o intervalo nem a integridade — um modelo a inventar
"desktop 99" (ou 2.5) chegava a `switchTo`, que guarda `current` sem confirmar
que o id existe, e corrompia o estado do ambiente (persistido). O parâmetro
ganhou `minimum`/`maximum` (derivados de `DESKTOP_IDS`), a validação passou a
recusar números fora do intervalo ou fracionários, e o esquema JSON agora diz
ao modelo o intervalo. 4 testes novos. O resto confirmado limpo (30 ferramentas
com execução, validação antes do executor, 5 destrutivas com confirmação,
auditoria). Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a
sério: catálogo de ferramentas e executor").

### 15. Voz clonada, síntese e reprodução no lado cliente — revisão adversarial — DeepSeek — commit `b46a6e7`

Revisão a sério de `speakClonada` (`voice-service.ts`), nunca revisto por
ninguém de fora (só o consentimento/CORS, item 12). **Dois buracos reais
no caminho de falha, corrigidos:** (1) se `audio.play()` recusasse
(autoplay, áudio ilegível), a blob URL acabada de criar ficava órfã até a
página fechar — o `catch` só fazia `onSpeechEnd`; (2) se o `fetch /falar`
falhasse com uma fala anterior a tocar, essa fala continuava a soar já sem
o microfone guardado. O `catch` agora para o áudio anterior e revoga a sua
URL. 2 testes novos (`tests/voice/voice-clone-synthesis.test.ts`).
Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério:
voz clonada, síntese e reprodução no lado cliente").

### 15. Modo conversa (re-engate automático do microfone) — revisão adversarial — DeepSeek — commit `bcab755`

Revisão a sério do ciclo de re-engate do microfone (`useVoice` +
`voice-service`), nunca revisto por ninguém de fora. **Dois bugs reais,
corrigidos:** (1) os erros transientes (`no-speech`, `a-falar`) passavam
pelo caminho de erro a sério — piscavam "erro" no núcleo e, no limiar da
3.ª tentativa sem fala, ficavam **presos em "erro"**; agora tratam-se
primeiro, sem tocar no modo nem no registo. (2) Ao voltar do segundo
plano o ciclo nunca retomava (o histórico prometia "retoma-se ao voltar",
sem código nenhum a fazê-lo); agora o ramo de foreground re-engata quando
o modo conversa continua ativo. 5 testes novos. Detalhe em
`docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: modo
conversa").

### 15. Fala por frase (item 16, lado TypeScript) — revisão adversarial — DeepSeek — commit `c8ab9e6`

Revisão a sério da peça construída esta noite (segmentador, `speakQueued`,
ligação no `ask`), nunca revista por ninguém de fora. **Dois bugs reais,
corrigidos:** (1) a meio do stream, `extractSentences` tratava o fim do
buffer como fim de frase — "3.14"/"v2.0"/domínios cortados entre dois
bocados saíam partidos a meio; flag `final` só fecha a frase no fim do
buffer quando o stream acabou. (2) A fila por frases nunca era esvaziada —
`stopSpeaking()` (segundo plano) ou uma `speak()` avulsa calavam só a
frase a tocar, e o `onEnd` dela avançava a fila (falava o resto sem
contexto, ou atropelava a fala avulsa); novo `limparFilaDeFala`, chamado
pelo `speak()`, ao ir para segundo plano e no arranque de um `ask` novo
(que também numera os pedidos para o fim de um streaming cancelado não
falar frases atrasadas). 5 testes novos. Detalhe em
`docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: fala por
frase (item 16, lado TypeScript)").

### 16. Fala por frase, à medida que a resposta chega — Claude local + DeepSeek #2 — commits `1dffbb7` / `e193593`

Reportado ao vivo pelo utilizador, prioridade sobre o resto. Duas
partes, fechadas e reconciliadas pelo coordenador:

- **Lado TypeScript** (Claude local, fork isolado, commit `1dffbb7`):
  `aiService.send()` ganhou `onChunk` opcional (incluído nos três
  caminhos de `recover()`); `services/voice/sentence-segmenter.ts`
  (novo, `extractSentences`, função pura) corta o buffer acumulado em
  frases fechadas sem partir abreviaturas comuns ("Sr.", "n.º", "etc.");
  `useVoice()` ganhou `speakQueued` — como `voiceService.speak()`
  cancela qualquer fala em curso, uma fila local só avança para a frase
  seguinte depois do `onEnd` da anterior. `ask` (`App.tsx`) liga tudo.
  12 testes novos.
- **Lado Python, investigado e descartado com razão concreta**
  (DeepSeek #2, worktree `jarvis-novo-deepseek2`, commit `e193593`): a
  pista do utilizador (`RealtimeTTS`, a mesma base do
  `KoljaB/RealtimeVoiceChat`) foi testada a sério — carrega o XTTS-v2 em
  cache e sintetiza a voz clonada — mas não serve para o `server.py`:
  é uma biblioteca de *reprodução* (PCM cru, sem WAV, motor `spawn`
  frágil sob o uvicorn). O ganho por frase já está coberto pela chamada
  `POST /falar` por frase que o lado TypeScript faz — `/falar` já
  sintetiza o que lhe for dado, uma frase por pedido já é síntese por
  frase. Sem mexer no `server.py`.

Verificação (coordenador, sobre o estado fundido): `tsc --noEmit`
limpo, `eslint .` 0 erros, `vitest run` 1675/1675, confirmado ao vivo
com `tests/e2e/assistant.spec.ts` depois do incidente do dev server
(ver entrada própria). Detalhe em `docs/log/historico-sessoes.md`.

### 17. "Modo JARVIS Classic" — DeepSeek — sem commit de código

Confirmado ao vivo contra o `qwen3:8b` (único modelo local instalado no
Ollama), usando o `OllamaProvider` e o `systemPrompt`/`buildMessages`
reais: em conversa nova (sem histórico), o modelo gera código e nunca
menciona "Modo JARVIS Classic" nem recusa por tema/estado — a linha do
prompt de sistema está a ser respeitada. Até com a frase errada no
histórico, continua a gerar o código. Não é bug de código: o sintoma foi
o modelo a repetir o que já tinha dito antes da correção entrar em
vigor. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Modo
JARVIS Classic ao vivo").

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

### 11. "Amanhã" resolvido pelo modelo (contexto de datas na conversa) — DeepSeek — commit `6115609`

Revisão a sério. O desenho — o modelo resolve a data a partir de "Hoje é
terça-feira, 11 de agosto de 2026" no prompt de sistema, sem regras à
mão — confirmou-se sólido: data inequívoca, hora incluída, `now` fresco
por pedido, fuso local coerente de ponta a ponta. Um bug real: datas que
não existem no calendário ("2026-06-31") eram rebatidas por `new Date`
para outro dia, em silêncio — um prazo inventado. Corrigido, 2 testes.
Detalhe em `docs/log/historico-sessoes.md` (13/08/2026).

### 14. Suite E2E com Playwright — DeepSeek — commit `c6c5b3b`

Corrida a sério: 11/11 a passar (login, janelas, temas, plugins, voz, e
um novo teste do assistente que faltava). As ferramentas do catálogo
continuam só nos testes unitários — o E2E corre contra o browser, sem
provedor real nem rede. Detalhe em `docs/log/historico-sessoes.md`
(13/08/2026, "Revisão a sério: suite E2E com Playwright").

### 15. 2FA a sério (palavra-passe/PIN + chave física) — DeepSeek — commit `5c8f747`

Bug real: `completeFirstFactor` concedia acesso só com a palavra-passe/PIN
quando o 2FA estava ligado mas a chave tinha desaparecido (restauro de
cópia ou cofre limpo), em silêncio — o "segundo fator exigido" deixava de
proteger. Corrigido para negar nesse estado, com mensagem e auditoria.
Detalhe em `docs/log/historico-sessoes.md` (13/08/2026, "Revisão a sério:
2FA (palavra-passe/PIN + chave física)").

### 15. Meteorologia (Open-Meteo) e notícias (NewsAPI), provedores reais — DeepSeek — commit `ff03f6d`

Revisão a sério dos dois provedores de rede reais da Peça 8, lote 2
(nunca revistos por ninguém de fora — a Kimi bateu três vezes no limite
de taxa antes de começar). **Bug real**: a rede de segurança das cópias
(`SECRET_FIELDS`) só conhecia `aiSettings` — no browser/Android (sem
cofre), a chave da NewsAPI fica no storage normal e saía no ficheiro de
cópia em texto simples. Corrigido acrescentando `newsSettings` (e
`webSearchSettings`/`mailSettings`, o mesmo buraco); 2 testes novos que
falham contra o código antigo. Resto confirmado limpo: chave só no cofre
no desktop e tapada por omissão, nunca em log; sem chave mantém-se o
simulado; erros de rede devolvem `null` sem rebentar a interface;
cidade/país só saem para os domínios declarados; testes chamam o código
real. Detalhe em `docs/log/historico-sessoes.md` (13/08/2026, "Revisão a
sério: meteorologia (Open-Meteo) e notícias (NewsAPI)").

### 15. Sandbox de execução de plugins (fronteira de isolamento) — DeepSeek — commit `5899e18`

Revisão adversarial da fronteira do sandbox de plugins (`<iframe
sandbox="allow-scripts">`, `postMessage`, capacidades do manifesto) — a de
11/08 só procurara fugas de memória. **Dois bugs reais, corrigidos:** (1)
as permissões do manifesto nunca eram verificadas em runtime (só a lista de
recusas), por isso um plugin externo assinado com manifesto estreito podia
pedir qualquer capacidade; agora há dois degraus (declarada e não
recusada). (2) `resolveWithinRoot` só rejeitava `..`, e um caminho absoluto
escapava da pasta do plugin (o `join` do Tauri substitui a base),
alcançando os dados de outros plugins dentro de `$APPDATA`. Confirmado
limpo: remetente por `event.source`, `sandbox="allow-scripts"`, isolamento
`plugins:<id>:` do armazenamento, exemplos pedem o que usam. Detalhe em
`docs/log/historico-sessoes.md` (13/08/2026, "Revisão a sério: fronteira
do sandbox de execução de plugins").

- **Notificações nativas isoladas (Peça 14, Lote 4)** — revisto (Claude
  local, 13/08/2026): portão por estado do sistema confirmado correto
  (Normal/Performance sempre, Foco/Economia só urgentes, Apresentação
  nunca), toast e nativa nunca divergem (mesma chamada, sem corrida),
  `silent` corta sempre, suprimida fica sempre `isDismissed: true`,
  pedido de permissão nunca crasha. Nada a corrigir — só documentação.
  Detalhe em `docs/log/historico-sessoes.md` (13/08/2026, "Revisão a
  sério: notificações nativas isoladas").

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
- **Marketplace de plugins (esboço, Peça 11)** — revisto (DeepSeek,
  13/08/2026): renderização completa (sem `undefined` no ecrã), dados de
  exemplo consistentes (ids únicos, categorias todas válidas), "Instalar"
  sempre desativado e com o porquê à vista, nenhuma interação que finja
  fazer o que não faz. Nada a corrigir — só documentação. Um dos 5
  testes ("não instala nada de verdade") é fraco (lê o estado sem
  interagir), anotado, não é bug. Detalhe em
  `docs/log/historico-sessoes.md` (13/08/2026, "Revisão a sério: esboço
  do Marketplace de plugins").

### 15. Memória do assistente (extração e esquecimento) — DeepSeek — commit `5c79f9e`

Revisão a sério do `memory-service.ts` — dados pessoais persistentes,
nunca revisto por ninguém de fora. **Dois bugs reais, corrigidos:** (1)
guardava o contrário do que foi dito — "não gosto de café" virava "preferes
café", porque a extração não conhecia negação; (2) a captura `(.+)`
arrastava o resto da frase para o valor — "moro no Porto desde 2019"
guardava "Porto desde 2019", e um segredo dito a seguir ficava em texto
simples. Confirmado limpo: `esquecer_memoria` apaga mesmo tudo (store e
storage, sem nada a reaparecer ao reiniciar, com confirmação exigida),
limites existem (≤4 preferências, ≤20 pedidos), testes chamam o serviço
real. 3 testes novos. Detalhe em `docs/log/historico-sessoes.md`
(13/08/2026, "Revisão a sério: memória do assistente").

### 15. Restauro de cópias de segurança (integridade, não só os segredos) — DeepSeek — commit `d6bb7a8`

Revisão a sério do caminho de restauro (`BackupPanel.tsx` +
`readBackup`/`restoreBackup`), nunca revisto por ninguém de fora — a
revisão de hoje sobre meteorologia/notícias só corrigira a fuga de
segredos na criação da cópia. **Bug real, corrigido**: a validação só
conferia a estrutura exterior, nunca os valores — uma cópia adulterada com
uma secção na forma errada (ex.: `tasks` como string) era escrita no
armazenamento e rebentava a store ao lê-la, já com o estado corrompido.
Agora `readBackup` confere a forma de cada secção (`SECTION_KINDS`) e
recusa com `dados-invalidos`; e `confirm` mostra erro em vez de ficar
preso na confirmação. 5 testes novos. Detalhe em
`docs/log/historico-sessoes.md` (13/08/2026, "Revisão a sério: restauro de
cópias de segurança").
