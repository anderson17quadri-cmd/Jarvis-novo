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
| src/services/ | 10940 | 🔄 em curso |
| src/stores/ | 3570 | ⬜ |
| src/hooks/ | 2021 | ⬜ |
| src/apps/ | 10442 | ⬜ |
| src/components/ | 6569 | ⬜ |
| src/types/ | 3020 | ⬜ |
| restantes (data, lib, config, design-system, automation, mcp) | ~1100 | ⬜ |

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

**Correção proposta**: o serviço guarda as confirmações que emitiu e
`confirmTool` recusa um `call.id` que não esteja lá (consumindo-o ao usar, para
não servir duas vezes).

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

**Correção proposta**: `firedRecently` cai para o `lastRunAt` persistido quando
não há marca em memória.

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
| A1 | `confirmTool` confia em quem chama | MÉDIO | por corrigir |
| A2 | Automações por intervalo repetem-se a cada arranque | MÉDIO | por corrigir |
| A3 | "Mostra os widgets" escondia-os todos | MÉDIO | ✅ corrigido |
| A4 | Apagar na interface nunca confirma | BAIXO | observação |
| A5 | Descarregamento do modelo não se trava | BAIXO | observação |
| A6 | Sessão de Controlo Direto sobrevivia ao bloqueio | **ALTO** | ✅ corrigido |
| A7 | Sem indicador permanente de Controlo Direto ativo | **ALTO** | por construir |
| A8 | Sem consentimento antes do primeiro print | MÉDIO | por construir |
| A9 | Requisitos da Parte 14 ausentes e não assinalados | MÉDIO | ✅ documentado |
| A10 | SPEC.md diz que o gatilho de rede é impossível (não é) | MÉDIO | ✅ corrigido no SPEC.md |
| A11 | Provedores em falta; três já existem no repo irmão | BAIXO | documentado |

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

