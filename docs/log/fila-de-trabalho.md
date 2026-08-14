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

### 16. Fala só depois de o texto inteiro estar escrito — **Claude local** (14/08/2026 03:15)

Tentativa de atribuir à Kimi às 03:12 (14/08/2026) falhou de imediato —
mesmo limite de taxa TPD da organização de ontem à noite (`429`,
`current: 1528525`), sem sinal de recuperação em ~4h20. Coordenador
assume o item diretamente.

**Diagnóstico já feito** (sessão remota, não confirmado ao vivo — precisa
de app a correr para testar a sério): `App.tsx`, dentro do tool
`ask` (~linha 425-429):

```ts
ask: (text) => {
  launch('assistant');
  void aiService.send(text).then((reply) => {
    if (reply.length > 0) speak(reply);
  });
},
```

`aiService.send()` só resolve a `Promise` depois de o streaming inteiro
terminar (o texto já todo escrito no ecrã) — só aí `speak(reply)` é
chamado. É por isto que parece "escreve tudo, só depois fala": não há
nada a falar incrementalmente enquanto o texto chega.

**O que se pede**: falar por frase, à medida que o texto vai chegando —
não esperar pelo fim. `aiService` já expõe o streaming pedaço a pedaço
para a store (`appendToMessage`); falta uma forma de, em paralelo,
acumular os pedaços, cortar por frase (`.`, `!`, `?`, seguido de espaço
ou fim), e chamar `voiceService.speak()` (ou o `speak()` do
`use-voice.ts`) para cada frase completa assim que ela fechar — a
próxima frase enfileira-se atrás, não interrompe a que está a falar.
Cuidado com abreviações comuns em português ("Sr.", "n.º", "etc.") não
partirem a frase a meio sem necessidade — não precisa de ser perfeito,
só melhor do que "espera tudo".

**Pista acrescentada pelo utilizador (14/08/2026)**: olhou para
[`KoljaB/RealtimeVoiceChat`](https://github.com/KoljaB/RealtimeVoiceChat)
como possível referência. A app inteira não serve (frontend próprio em
HTML/JS + servidor FastAPI/WebSocket, sem manutenção ativa — não é para
copiar) — mas o `voice-clone-service/` já usa exatamente a mesma base
que esse projeto por baixo (`coqui-tts`/XTTS-v2, `openai-whisper`,
confirmado a funcionar na RTX 5070 desta máquina). O RealtimeVoiceChat
usa essa mesma base através de duas bibliotecas do mesmo autor, feitas
para isto — **`RealtimeTTS`** e **`RealtimeSTT`** (pip install, à parte
da app de demonstração) — que já resolvem sintetizar por pedaços de
frase e deteção de troca de turno (ver `turndetect.py` no repositório,
como referência de desenho, não para copiar código). Vale a pena
confirmar se `RealtimeTTS` dá para o `voice-clone-service/server.py`
sintetizar por frase em vez do texto inteiro de uma vez — pode resolver
metade deste item do lado do serviço Python, sem só empilhar lógica de
corte de frases do lado do TypeScript.

**Sub-investigação em paralelo — DeepSeek #2** (14/08/2026 03:20,
segunda instância, worktree `jarvis-novo-deepseek2`): a pista do
`RealtimeTTS` acima, especificamente — o coordenador já tinha um fork
próprio em curso com o lado TypeScript (corte de frases +
fila de fala) quando esta pista chegou; em vez de interromper esse
trabalho a meio, esta segunda instância investiga só o lado Python
(`voice-clone-service/server.py`) em paralelo. As duas contribuições
fecham-se e reconciliam-se juntas quando ambas terminarem — não é um
item duplicado, é a mesma peça vista dos dois lados.

**Lado TypeScript concluído (Claude local, fork isolado, 14/08/2026,
commit `1dffbb7`)**: `aiService.send()` ganhou `onChunk` opcional
(chamado também nos três caminhos de `recover()`);
`services/voice/sentence-segmenter.ts` (novo, função pura,
`extractSentences`) corta o buffer acumulado em frases fechadas, sem
partir abreviaturas comuns; `useVoice()` ganhou `speakQueued` —
`voiceService.speak()` cancela qualquer fala em curso ao ser chamado,
por isso uma fila local só passa a frase seguinte depois do `onEnd` da
anterior. `ask` (`App.tsx`) liga tudo. 12 testes novos, `tsc`/`eslint`
limpos, `vitest run` 1675/1675 (1 falha isolada pré-existente,
confirmada sem relação). Detalhe em `docs/log/historico-sessoes.md`
("Item 16: fala por frase, à medida que a resposta chega"). **Este
item fica aqui, não em "Feito"**, até a sub-investigação Python acima
terminar e as duas se reconciliarem — a sessão coordenadora decide
quando fechar de vez.

**Concluído — DeepSeek #2** (14/08/2026): RealtimeTTS testado a sério
contra o stack instalado (coqui-tts 0.27.5, torch 2.13+cu130, Python
3.13) — carrega o XTTS-v2 já em cache e sintetiza a voz clonada, mas não
serve para o `server.py`: é uma biblioteca de *reprodução* em tempo real
(StreamPlayer/PyAudio), a saída programável é PCM float32 cru sem
fronteiras de frase nem WAV, e o motor corre num processo separado
(`spawn`) frágil debaixo do uvicorn. Fechado como "explorado, não vale a
pena agora", sem mexer no server.py — o lado Python do item fica
resolvido pela chamada por frase que o fork TypeScript do coordenador já
faz (`POST /falar` por frase). Detalhe em `docs/log/historico-sessoes.md`.

## Rever a sério (nunca construído de novo — ler o código como se fosse a primeira vez, sem confiar nos testes só porque passam)

### 15. Outra peça qualquer sem revisão independente — `[livre, repetível]`

Para quando as catorze de cima estiverem fechadas. Só 5 das 73 entradas
do histórico mencionam uma "revisão independente" alheia — sobra sempre
mais por escolher em `docs/log/historico-sessoes.md`. Todos os catorze
itens acima estão fechados — repetível; instâncias fechadas (2FA,
Notificações nativas isoladas, Meteorologia/Notícias, Marketplace de
plugins, Sandbox de execução de plugins, Memória do assistente) já em
"Feito" abaixo.

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
