# Auditoria completa — 20/08/2026

Varrimento de todo o código a pedido do utilizador ("ve oque esta errado ate
acabar a sessão"). Cada achado fica aqui à medida que aparece, com ficheiro,
linha, o que está errado e como se prova. **Nada aqui é corrigido sem antes um
teste que falhe sem a correção.**

Legenda de gravidade:
- **ALTO** — segurança, privacidade, perda de dados, ou falha silenciosa
- **MÉDIO** — comportamento errado que a pessoa nota
- **BAIXO** — código morto, comentário que mente, fragilidade latente

---

## Estado do varrimento

| Área | Linhas | Estado |
|---|---|---|
| src-tauri/ (Rust) | 3900 | ✅ lido ficheiro a ficheiro (19/08) |
| src/plugins/ | 2537 | ✅ lido (19/08) |
| src/platform/ | 1736 | ✅ lido (19/08) |
| src/widgets/ | 1563 | ✅ revisto (item 15, 20/08) |
| src/services/ | 10940 | ✅ varrido (20/08) |
| src/stores/ | 3570 | ✅ varrido (20/08) |
| src/hooks/ | 2021 | ✅ varrido (20/08) |
| src/apps/ | 10442 | ✅ varrido (20/08) |
| src/components/ | 6569 | ✅ varrido (20/08) |
| src/types/ | 3020 | ✅ varrido (20/08) |
| restantes (data, lib, config, design-system, automation, mcp) | ~1100 | ✅ varrido (20/08) |

**O que "varrido" quer dizer, com honestidade**: os ficheiros de lógica densa
foram lidos a sério, linha a linha (serviços, stores, hooks, o Rust todo, a
superfície de plugins, o overlay e a porta de presença). Os ficheiros de
apresentação pura (JSX de layout, listas, estilos) foram varridos por padrão —
promessas de interface contra o código, ações destrutivas, efeitos sem limpeza,
`aria-modal` sem foco, dados de exemplo a passar por reais — e não lidos
palavra a palavra. A diferença importa: um bug de lógica escondido num
componente de apresentação que não bata em nenhum destes padrões pode ter
escapado.

---

## Achados

### A1 — `confirmTool` confia inteiramente em quem chama — **MÉDIO**

`src/services/ai-service.ts:550`

```ts
async confirmTool(call: ToolCall): Promise<void> {
  const outcome = await runTool(call, true);   // `true` = já confirmado
  ...
}
```

Recebe um `ToolCall` qualquer e corre-o com o sinalizador de "já confirmado"
ligado, **sem verificar que esse pedido alguma vez esteve na lista de
pendentes**. Hoje é seguro porque só o `AssistantWindow.tsx:220` lhe chama, e
sempre com uma entrada real da lista. Mas é exatamente o padrão que já deu um
bug real neste projeto: o `directControlService.executeStep` dependia de quem
chamava se lembrar de verificar a sessão, e foi corrigido em 13/08 movendo a
verificação para dentro da função ("a fronteira vive na função, não em quem
chama", `docs/estilo-de-codigo.md`).

O comentário por cima do método diz "Só a interface chama isto, e só depois de
a pessoa ter dito que sim" — uma promessa que o código não impõe. Um caminho
novo (um plugin, uma automação, um atalho de voz) que chame `confirmTool`
diretamente executa uma ferramenta destrutiva sem confirmação nenhuma, e nada
o impede.

**✅ Corrigido (20/08)**: o serviço guarda num `Set` os `call.id` que emitiu
como pendentes; `confirmTool` recusa (e regista na auditoria) qualquer id que
não esteja lá, e consome-o ao usar — um duplo clique não apaga duas vezes. O
botão de recusar passa a chamar `cancelTool`, para uma confirmação recusada não
ficar válida para depois. Três testes em
`tests/assistant/confirm-tool-gate.test.ts`, pelo fluxo real (`sendWithTools`
com um provedor falso a pedir `apagar_tarefas_concluidas`), sem API só-para-testes.

### A2 — Automações por intervalo disparam outra vez a cada arranque da app — **MÉDIO**

`src/services/automation-service.ts:59-66, 356-369, 296-308`

O motor guarda as marcas do último disparo num `Map` **só em memória**:

```ts
private readonly lastFired = new Map<string, number>();
```

e o `hydrate()` repõe `automations` e `runs` do disco, mas **nunca repõe o
`lastFired`**. Consequência, num gatilho `intervalo`:

```ts
if (trigger.kind === 'intervalo') {
  return !this.firedRecently(automation.id, trigger.everyMinutes * 60_000);
}
```

No primeiro `tick()` depois de `start()` — que corre logo, de propósito — o
`lastFired.get(id)` é `undefined`, o `firedRecently` devolve `false`, e a
automação **dispara**. Uma regra "de 6 em 6 horas" corre a cada abertura do
JARVIS: abrir e fechar a app cinco vezes numa hora dispara-a cinco vezes.

O mais irónico é que a informação para o resolver **já está guardada**: o
`record()` escreve `lastRunAt` na automação sempre que uma execução corre bem,
e isso é persistido e reposto pelo `hydrate`. O `firedRecently` é que não olha
para lá.

Afeta também `hora`, embora bem menos: reiniciar dentro do mesmo minuto do
gatilho volta a disparar (a janela de 90s também vive só no `lastFired`).

**✅ Corrigido (20/08)**: `firedRecently` passa a usar o mais recente entre a
marca em memória e o `lastRunAt` persistido — numa sessão longa manda o de
memória, logo a seguir a um arranque só existe o persistido. Dois testes em
`tests/automation/automation-service.test.ts`, confirmados a falhar sem a
correção.

### A3 — "Mostra os widgets" **escondia** os widgets todos — **MÉDIO** ✅ CORRIGIDO

`src/services/voice/intents.ts:289` (antes da correção)

```ts
// "Mostra os widgets" sem nome nenhum: é o inverso de os esconder.
if (/widgets\b/.test(text)) return { kind: 'esconder-widgets' };
```

O comentário diz "é o inverso de os esconder" e o código devolve exatamente o
esconder. Não havia intenção nenhuma para *mostrar* os widgets todos — só a de
esconder. Dizer **"mostra os widgets"** percorria:

1. `text.includes('widget')` → entra no bloco;
2. não começa por verbo de esconder → não é o primeiro `return`;
3. `matchWidget` não encontra nenhum widget nomeado → `null`;
4. cai na linha 289 → **`esconder-widgets`** → `executor.hideAllWidgets()`.

Os widgets desapareciam todos. **Sem confirmação**, porque `esconder-widgets`
não está no conjunto `CRITICAL` (só lá estão `fechar-janelas` e
`reiniciar-interface`).

**Corrigido**: intenção nova `mostrar-widgets`, e o bloco passa a decidir pelo
verbo — só esconde se a frase começar por um `HIDE_VERBS`. O `showAllWidgets`
do `App.tsx` mostra um a um pelo `store.show`, e não pondo `isVisible` a `true`
em bloco, porque é o `show` que resolve colisões de posição na grelha.

Teste em `tests/voice/intents.test.ts`, confirmado a falhar com o bug reposto e
a passar com a correção.

### A4 — Apagar na interface nunca pede confirmação — **BAIXO** (observação, não bug)

`AutomationsWindow.tsx:261`, `HistoryPanel.tsx:268`, `ThemeEditor.tsx`,
`LayoutSettings.tsx`, `TasksWindow.tsx`

**Nenhum** botão de apagar da interface pede confirmação: apagar uma automação
que se construiu (gatilho, condições, ações), esquecer a memória toda do
assistente, apagar um tema personalizado ou um layout guardado — tudo à
distância de um clique, sem desfazer.

**Porque é que fica como observação e não como bug**: a spec exige confirmação
para ações críticas (Parte 10, linha 530) no contexto do **assistente** a
executar — e isso está cumprido nos dois sítios onde se aplica (`CRITICAL` nas
intenções de voz, `risk: 'perde'` no catálogo de ferramentas). Um clique
deliberado da pessoa num botão de lixo é, ele próprio, a intenção. É
consistente em toda a interface — nenhum apaga confirma — por isso é uma
decisão de desenho, não um esquecimento.

Fica registado porque a assimetria é curiosa: o assistente **tem** de pedir
confirmação para `esquecer_memoria`, e o botão "Esquecer tudo" ao lado faz o
mesmo sem perguntar nada.

### A5 — O descarregamento automático do modelo não se consegue travar — **BAIXO** (observação)

`src-tauri/src/ollama.rs:170-192`, `src/services/ollama-auto-setup.ts`

No arranque, se o Ollama não tiver nenhum modelo, o JARVIS descarrega o
`llama3.2:3b` (~2 GB) **sozinho**. Foi pedido explicitamente pelo utilizador
("quero o Llama, sem precisar de adicionar mais nada"), por isso não é um
comportamento inesperado — mas tem duas arestas:

1. **Não há como cancelar.** A notificação diz que começou; não há botão para
   parar. Numa ligação limitada (partilha de dados do telemóvel), são 2 GB que
   se vão sem se poder travar.
2. **Avisa depois de começar, não antes.** É a única coisa em todo o projeto
   que gasta recursos externos sem perguntar primeiro — todo o resto (rede,
   voz, controlo direto) está desligado por omissão com interruptor explícito.

Não corrijo por iniciativa própria: foi pedido assim, e mudar para "pergunta
primeiro" contraria o "sem precisar de adicionar mais nada". Fica registado
para o utilizador decidir se quer um botão de cancelar.

### A6 — A sessão de Controlo Direto sobrevivia ao bloqueio por inatividade — **ALTO** ✅ CORRIGIDO

`src/stores/use-session-store.ts:38` · requisito de
`docs/spec/fase-3-controlo-direto.md` §1.1

A spec do Controlo Direto é explícita, e o requisito não estava implementado:

> **Liga-se ao bloqueio por inatividade que já existe** (Parte 14): se o ecrã
> bloquear por inatividade a meio dos 30 minutos, a sessão de controlo fecha
> imediatamente também, sem esperar pelo temporizador próprio — **cobre o caso
> de teres saído do sítio**.

O `useIdleLock` chamava `logout()`, que só limpava a sessão automática do
Windows Hello e voltava ao ecrã de login. O `directControlService.endSession()`
só era chamado de dois sítios — o botão em Privacidade e o travão de mão
(Esc Esc) — **nenhum deles ligado ao bloqueio**. E o `sessionActive` só olha
para o relógio (`Date.now() < sessionExpiresAt`), sem saber nada da fase da
aplicação.

**O que isto significava na prática**: abrir uma sessão de Controlo Direto (30
minutos), levantar-se, o ecrã bloquear ao fim de 5 minutos de inatividade — e
a sessão de controlo continuava **viva os restantes 25 minutos**, por trás do
ecrã de bloqueio. É exatamente o cenário que a spec nomeia ("cobre o caso de
teres saído do sítio"), e é a camada de Presença, a base de que as outras três
dependem.

**Corrigido** no `logout()`, que é o ponto único por onde a sessão acaba — o
bloqueio por inatividade e o sair à mão passam os dois por lá. Pô-lo em quem
chama seria repetir o erro do `executeStep` (corrigido em 13/08): a fronteira
vive na função, não na memória de quem a invoca.

Teste em `tests/auth/logout-encerra-controlo-direto.test.ts`, confirmado a
falhar sem a correção e a passar com ela.

### A7 — Não há indicador permanente de sessão de Controlo Direto ativa — **ALTO** (por construir)

`src/components/shell/Header.tsx` · requisito de
`docs/spec/fase-3-controlo-direto.md` §1.1 e §1.2

A spec pede duas vezes, com ênfase:

> §1.1 — Indicador **sempre visível** enquanto a sessão está ativa — por
> exemplo "Controlo direto ativo · 18 min" no header, **nunca escondido**.
>
> §1.2 — **Indicador permanente enquanto ativo** — uma borda visível à volta
> do ecrã, **não um ícone escondido numa barra**.

O header **não mostra nada** sobre o Controlo Direto. Mostra a wake word
(`Header.tsx:125`), que é a funcionalidade *menos* perigosa das duas — o padrão
existe e está aplicado ao sítio errado.

Isto não é cosmético: o princípio fundador da Fase 3 (§0) é que a segurança
"não pode viver numa lista de comandos permitidos — tem de viver em **como e
quando** a ação acontece: **sempre visível**, sempre confirmável". A
confirmação por passo está feita (nada corre invisível), mas a metade "sempre
visível" não: uma sessão pode estar armada 30 minutos sem qualquer sinal
persistente de que está.

**Não construí por iniciativa própria** porque é interface, e a regra da casa
(`docs/estilo-de-codigo.md` §Verificação) diz que mudanças de interface se
confirmam na app a sério, não só nos testes — e esta sessão não tem ecrã.
Fica como item para a fila.

### A8 — Não há consentimento por sessão antes do primeiro print — **MÉDIO** (por construir)

`src/services/vision/vision-service.ts` · requisito de
`docs/spec/fase-3-controlo-direto.md` §1.2

> **Consentimento por sessão**, não por sempre: a primeira vez que o controlo
> direto corre depois de reiniciar o JARVIS, pede confirmação explícita antes
> do primeiro print.

Não existe. O `describeScreen()` verifica a porta de presença (correção de
19/08) e captura — sem nunca pedir a confirmação explícita do primeiro print
da sessão. A porta de presença cobre a maior parte do risco, mas não é a mesma
coisa: a spec quer que a primeira captura de cada arranque seja consciente.

### Nota sobre o `SPEC.md`

O `SPEC.md` marca as Fases 3.3–3.5 como implementadas (linha 664 e seguintes) e
descreve o que foi feito com rigor — mas **não menciona** que o indicador
permanente (A7) e o consentimento do primeiro print (A8) ficaram por fazer. É a
mesma classe de lacuna de honestidade já corrigida duas vezes nesta auditoria
(SPEC.md a prometer a mais em 14/08, o aviso do navegador em 15/08): o registo
diz "implementada" e a pessoa que o lê não fica a saber o que falta.

### A9 — Requisitos da Parte 14 (Segurança) ausentes e não assinalados no SPEC.md — **MÉDIO**

O `SPEC.md` marca "Permissões por plugin ✅" (linha 430) e "Painel de
privacidade e permissões ✅" (linha 555). As duas entradas descrevem bem o que
foi construído — mas **nenhuma menciona** que estes pedidos da Parte 14 da spec
original não existem de todo:

| Requisito da Parte 14 | Estado real |
|---|---|
| Permissões com quatro estados: Permitida / Negada / **Permitida uma vez** / **Permitida durante a sessão** | Só permitida/negada. Os dois estados temporários não existem |
| **Modo privacidade** — desativa telemetria, oculta notificações sensíveis, bloqueia histórico de voz, suspende sincronizações, indicador discreto | Não existe (`grep` por `privacyMode`/`modo privacidade` não devolve nada) |
| **Gestão de sessões** — sessão atual, dispositivo, SO, IP, último acesso; encerrar sessão específica ou todas | Não existe |
| **Proteção contra erros** — plugin com comportamento anormal isolado automaticamente, suspenso, relatório gerado | Não existe |

Não é que estejam mal construídos — é que **não estão lá, e o mapa não o diz**.
Quem lê o `SPEC.md` para saber o que falta na Parte 14 fica com a impressão de
que está fechada.

É a mesma classe das duas lacunas já corrigidas nesta auditoria (o `SPEC.md` a
prometer 3.1 como funcional quando nada a alcançava, 14/08; o aviso do
navegador desatualizado, 15/08). O padrão repete-se: o que se constrói fica
bem documentado, o que se decide não construir cai no esquecimento.

**Nota justa**: alguns destes podem ter sido decisões deliberadas de âmbito
(gestão de sessões num sistema de um só utilizador sem servidor faz pouco
sentido). O problema não é a decisão — é não estar escrita.

### A10 — O SPEC.md diz que o gatilho de rede é impossível, e não é — **MÉDIO**

`SPEC.md:543`

> Rede 🚫 — **sem API para eventos de conectividade no Windows**.

A afirmação é falsa, e há prova concreta: o repositório irmão
`anderson17quadri-cmd/sexta-feira` (a cópia que o utilizador mandou trabalhar
em paralelo) tem o gatilho de rede **construído e a funcionar**, em
`src-tauri/src/commands/network.rs` — `GetAdaptersAddresses` do crate
`windows`, a classificar "há rede local" por adaptador `IfOperStatusUp` com
gateway, num poll de 5 segundos, com 5 testes sobre a função pura de
classificação.

Não é um bug de código: o `Jarvis-novo` simplesmente não tem a funcionalidade.
O problema é o **"🚫 sem API"**: um bloqueio dado como técnico e permanente,
quando na verdade a API existe e já foi usada. Quem ler isto para decidir o que
fazer a seguir descarta o item por impossível.

**Correção proposta**: mudar de "🚫 impossível" para "⬜ por construir — ver
`network.rs` no repositório `sexta-feira`, onde já está feito". Trazer o
ficheiro é trabalho pequeno e já provado.

### A11 — Parte 12: provedores em falta, e três deles já existem no repositório irmão — **BAIXO**

`SPEC.md:427` (entrada "AI Orchestrator ✅")

A spec pede treze provedores: OpenAI, Claude, Gemini, Mistral, DeepSeek, Grok,
Cohere, OpenRouter, Ollama, LM Studio, vLLM, Llama.cpp, modelos próprios.
Existem **três** (`DeepSeek`, `Claude`, `Ollama`) mais o local de regras.

A entrada do `SPEC.md` é longa e rigorosa sobre o que foi construído, mas está
marcada ✅ sem dizer que faltam dez provedores, nem que a "execução paralela"
(consultar vários modelos ao mesmo tempo e combinar) não existe.

**O que vale a pena saber**: o repositório irmão `sexta-feira` já tem
**OpenAI, Gemini e LM Studio** construídos e testados
(`src/services/ai-providers/{openai,gemini,lmstudio}-provider.ts`, ~750 linhas,
33 testes segundo o histórico deles). Três dos dez em falta estão a um `git
cherry-pick` de distância — não é preciso escrevê-los.

**Atenção ao trazer**: a mesma alteração no `sexta-feira` alargou a CSP com
coringas (`https:`, `http://localhost:*`) para o marketplace, o que anula a
"lista fechada de anfitriões" que este projeto defende. Trazer os provedores
sem trazer o coringa: bastam as duas entradas concretas
(`https://api.openai.com`, `https://generativelanguage.googleapis.com`,
`http://localhost:1234`).

---

## Resumo do varrimento

| # | Achado | Gravidade | Estado |
|---|---|---|---|
| A1 | `confirmTool` confia em quem chama | MÉDIO | ✅ corrigido |
| A2 | Automações por intervalo repetem-se a cada arranque | MÉDIO | ✅ corrigido |
| A3 | "Mostra os widgets" escondia-os todos | MÉDIO | ✅ corrigido |
| A4 | Apagar na interface nunca confirma | BAIXO | observação |
| A5 | Descarregamento do modelo não se trava | BAIXO | observação |
| A6 | Sessão de Controlo Direto sobrevivia ao bloqueio | **ALTO** | ✅ corrigido |
| A7 | Sem indicador permanente de Controlo Direto ativo | **ALTO** | por construir |
| A8 | Sem consentimento antes do primeiro print | MÉDIO | por construir |
| A9 | Requisitos da Parte 14 ausentes e não assinalados | MÉDIO | ✅ documentado |
| A10 | SPEC.md diz que o gatilho de rede é impossível (não é) | MÉDIO | ✅ corrigido no SPEC.md |
| A11 | Provedores em falta; três já existem no repo irmão | BAIXO | documentado |
| A12 | Wake word ficava "a ouvir" depois de o serviço morrer | MÉDIO | ✅ corrigido |
| A13 | Privacidade mandava dizer a palavra-passe em voz alta (não há voz) | MÉDIO | ✅ corrigido |
| A14 | Modo simulado não travava o print do ecrã | **ALTO** | ✅ corrigido |
| A15 | Assistente dava ficheiros de exemplo por reais | MÉDIO | ✅ corrigido |
| A16 | Janela do Calendário não dizia que a agenda é simulada | MÉDIO | ✅ corrigido |
| A17 | Overlay de Controlo Direto sem gestão de foco nem Escape | MÉDIO | ✅ corrigido |

**Áreas varridas nesta passagem**: `src/services/` (ai-service, automation,
memory, intents, executor, data-service, searxng, ollama-auto-setup),
`src/stores/` (persistência de todas as ações), `src/hooks/` (idle-lock e
efeitos assíncronos de todos), `src/apps/` + `src/components/` (ações
destrutivas, efeitos sem limpeza), e o cruzamento das Partes 12, 13 e 14 da
spec original contra o código.

**Método**: além de ler, cruzou-se a spec com o código requisito a requisito —
foi assim que apareceram A6, A7 e A8, que nenhuma leitura de código sozinha
encontraria (o código está correto naquilo que faz; o que falta é o que não
faz).


---

## Achados da segunda passagem

### A12 — A wake word ficava "a ouvir" para sempre depois de o serviço morrer — **MÉDIO** ✅ CORRIGIDO

`src/hooks/use-voice.ts:475` (antes da correção)

O ciclo de sondagem (`GET /health` de 500 em 500 ms) acabava num `catch {}`
nu. Se o serviço da wake word morresse — processo morto, sem memória, a
fechar sozinho — **cada** sondagem falhava e era engolida em silêncio:

- o indicador no header continuava a dizer que estava a ouvir;
- o interruptor em Privacidade continuava ligado;
- e a palavra deixava de funcionar, sem nada explicar porquê.

A pessoa fica a dizer "Sentinela" para um serviço morto, com a interface a
garantir-lhe que está a ouvir.

É a terceira vez que esta classe aparece neste projeto — a voz clonada muda
(15/08, `speakClonada` a engolir a falha), as falhas de rede dos widgets
(20/08, `PollingDataService` a engolir tudo em `console.warn`), e agora esta.

**Corrigido**: conta falhas seguidas; uma isolada é normal (o serviço a
reiniciar) e não faz nada, mas seis seguidas (~3 s) avisam, registam no
`logService` e desligam o interruptor — o mesmo tratamento que o `activate()`
já dava quando não conseguia armar. Dois testes: o serviço a morrer avisa e
desliga; uma falha passageira não mexe em nada.

### A13 — A Privacidade mandava "dizer a frase em voz alta", e não há caminho de voz — **MÉDIO** ✅ CORRIGIDO

`src/apps/privacy/PrivacyWindow.tsx:680-681` (antes da correção)

O texto por cima do campo da palavra-passe do Controlo Direto dizia:

> "Palavra-passe guardada (hash, nunca em texto simples). **Diz a frase em voz
> alta** para abrir uma sessão de controlo direto."
>
> "Define uma frase que só tu sabes. **Dita por voz**, abre uma sessão de
> controlo direto de 30 minutos."

**Não existe caminho de voz nenhum.** O `directControlService.verify` é chamado
de **um único sítio** — o campo escrito da própria janela de Privacidade
(`PrivacyWindow.tsx:617`). O `use-voice.ts`, o `intents.ts` e o `executor.ts`
não têm uma única referência à palavra-passe.

Quem lê aquilo diz a frase em voz alta, não acontece nada, e não tem como
saber porquê — a interface acabou de lhe garantir que era assim que funciona.
Pior: é a **porta de presença**, a camada de que as outras três do Controlo
Direto dependem.

Curiosamente o `SPEC.md` está certo (linha 660: "abertura manual de sessão por
**palavra escrita** na Privacidade — o caminho 'escrita' da spec §6"). O
comentário no próprio código também ("o caminho alternativo à voz"). Só o
texto que a pessoa lê é que ficou a descrever o plano original da spec §1.1
("Dita por voz, através do reconhecimento que já existe") em vez do que foi
construído.

**Corrigido**: o texto passa a dizer que se escreve no campo, e nomeia
explicitamente que a abertura por voz ainda não está construída — em vez de a
prometer. 14 testes existentes continuam a passar (nenhum dependia do texto).

### A14 — O modo simulado prometia "nunca executam a sério", e o `ver_ecra` tirava prints reais — **ALTO** ✅ CORRIGIDO

`src/services/vision/vision-service.ts` · texto em `PrivacyWindow.tsx:779-782`

A Privacidade promete, por palavras:

> Com o modo simulado ligado, as ações de controlo direto aparecem no overlay
> de confirmação mas **nunca executam a sério** — é para testar o fluxo **sem
> risco**.

A promessa é cumprida por `executeStep`
(`wouldExecute = confirmed && !this.simulatedMode`) — mas o **`ver_ecra` não
passa por lá**. `visionService.describeScreen()` verificava o interruptor e a
sessão (correção de 19/08) e capturava, **sem nunca olhar para o modo
simulado**.

O que isto significava: alguém liga o Controlo Direto, liga o modo simulado
precisamente "para testar sem risco", abre uma sessão, e o assistente tira um
**print real do ecrã** — que, com o provedor de visão configurado para o
Claude, **sai da máquina**. A única coisa que a pessoa fez para se proteger foi
a coisa que a expôs.

É a classe de lacuna de honestidade que mais aparece neste projeto, agora na
sua forma mais cara: não é o texto que está desatualizado em relação ao código,
é um caminho que escapou à barreira que o texto descreve.

**Corrigido**: `describeScreen()` recusa em modo simulado e diz porquê. O teste
que já lá estava (a captura no caminho normal) passou a desligar o modo
simulado explicitamente — antes passava por acidente, já que o modo simulado é
ligado por omissão e a captura acontecia na mesma.

### A15 — O assistente procurava ficheiros numa árvore de exemplo e dava-os por reais — **MÉDIO** ✅ CORRIGIDO

`src/App.tsx:599`, `src/services/assistant/tool-runner.ts:294`

O `procurar_ficheiro` e o `abrir_ficheiro` percorrem `seedFiles()` — a árvore
**simulada** (`src/data/files.ts`: "Árvore de ficheiros simulada. **Não toca no
disco.**"). Nomes como `proposta-barbearia-silva.pdf` são inventados.

Ao mesmo tempo, o Explorador de Ficheiros **lê o disco a sério** desde 12/08
(`capabilities.realFilesystem`, `files_set_root`/`files_read_dir`, com a pasta
escolhida guardada em `files.real-root-path`).

Os dois caminhos nunca se encontram. Resultado: a pessoa escolhe a sua pasta no
Explorador, vê os seus ficheiros, e a seguir pergunta ao assistente "procura o
relatório" — e ele responde com ficheiros **fictícios**, com a confiança de
quem leu o disco. Nem a descrição da ferramenta nem a resposta diziam que era
uma árvore de exemplo.

O `SPEC.md` (linha 492) diz "ligado a sério em `App.tsx` (`seedFiles`/`searchFiles`)"
— tecnicamente verdade (está ligado), mas "a sério" ali lê-se como "ao disco a
sério", que não é o caso.

**Corrigido, pela via honesta**: a resposta da ferramenta passa a dizer
"(árvore de exemplo — a pesquisa no disco a sério ainda não está ligada a esta
ferramenta)", e a descrição no catálogo avisa o modelo em maiúsculas que **não
é o disco real** e que deve dizê-lo. É o mesmo tratamento que a pesquisa web
simulada já tinha.

**Não corrigi ligando ao disco real** — isso é funcionalidade nova (o
`files_read_dir` lê um nível de cada vez; procurar por nome exige descer a
árvore toda, com as decisões de profundidade e desempenho que isso traz). Fica
para a fila.

### A16 — A janela do Calendário não dizia que a agenda é simulada — **MÉDIO** ✅ CORRIGIDO

`src/apps/calendar/CalendarWindow.tsx`

O **widget** do calendário mostra "Agenda simulada"
(`CalendarWidget.tsx:102`). A **janela** — a vista grande, a que se abre para
ver o dia — não mostrava nada: apresentava compromissos inventados como se
fossem os da pessoa.

O serviço tem o sinalizador (`calendarService.isSimulated`), o widget usa-o, a
janela ignorava-o. Das duas janelas ligadas a dados simuláveis, a de Emails
avisa (`EmailsWindow.tsx:208`) e a do Calendário não avisava — inconsistência,
não decisão.

**Corrigido**: a janela mostra "Agenda simulada — não há calendário real
ligado." no fim da lista, no mesmo tom do widget e da janela de Emails.

Também tratado de caminho: o `abrir_ficheiro` (irmão do A15) passou a dizer que
navega na árvore de exemplo, e a descrição no catálogo avisa o modelo.

### A17 — O overlay de Controlo Direto era o único modal sem gestão de foco — **MÉDIO** ✅ CORRIGIDO

`src/components/ControlOverlay.tsx`

Quatro componentes declaram `aria-modal="true"`: a Paleta de Comandos, a
Correção de Voz, o Painel de Notificações e o **overlay de Controlo Direto**.
Os três primeiros gerem o foco ao abrir; o overlay **não gere nada** — e é o
mais crítico dos quatro, o que pergunta se o JARVIS pode mexer no computador.

Duas consequências reais:

1. **O foco ficava atrás do overlay.** Um Enter reflexo — bastante provável,
   já que o overlay aparece por cima do que se estava a fazer — carregava num
   botão escondido por trás dele.
2. **O `aria-modal="true"` mentia.** Diz à tecnologia de apoio que o resto da
   página está inerte, e não estava.

Faltava também o Escape, que a Correção de Voz já tinha.

**Corrigido**: foco ao abrir no **Recusar**, nunca no Confirmar — se alguém
carregar em Enter sem ler, o que acontece é a ação *não* correr; confirmar uma
ação sobre o computador tem de ser um gesto deliberado, nunca o caminho de
menor esforço. E Escape recusa, ao nível da janela (com o `onKeyDown` no
elemento, os primeiros 40 ms — até o foco entrar — engoliam a tecla). Não
colide com o travão de mão: o primeiro Escape recusa o passo, um segundo logo
a seguir continua a acionar o `emergencyStop`.

Dois testes em `tests/diagnostics/control-overlay-teclado.test.tsx`.

