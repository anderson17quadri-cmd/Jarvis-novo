# Prompt — orquestração noturna multi-modelo (13/08/2026)

> Um só prompt, para o **Claude Code local**. É ele que abre os terminais
> das outras IAs sozinho e as comanda — a pessoa não copia nada à mão para
> Qwen/Kimi/DeepSeek. Ver `docs/estilo-de-codigo.md` §"Orquestração
> multi-modelo" — isto é a forma preferida, não uma excepção de uma vez.

Cola isto à sessão do Claude Code local, na raiz do repositório:

---

Vais orquestrar esta sessão de trabalho noturno sozinho — abrir os
terminais das outras IAs, dar-lhes a tarefa, e acompanhar. A pessoa não
vai copiar nada à mão para Qwen, Kimi ou DeepSeek; isso és tu que fazes.

**Passo 0 — Jarvis a correr.** Num terminal à parte, que fica aberto o
resto da noite:

```
npm run tauri dev
```

Não uses esse terminal para mais nada — é para a pessoa poder testar ao
vivo a qualquer momento, sem teres de parar nada.

**Passo 1 — confirma o que tens disponível.** Antes de abrir seja o que
for, confirma nesta máquina como se chama e como se invoca cada CLI
(`which qwen`, `which kimi`, `which deepseek`, ou o que já estiver
configurado — a pessoa já tem limite/acesso configurado nos três). Cada
uma delas deve ter um modo não-interativo (o equivalente ao `claude -p
"..."` que tu próprio usas) para receber uma tarefa e correr sozinha sem
alguém a escrever de volta. Se não conseguires confirmar o comando certo
de alguma, não adivinhes uma flag que pode não existir — avisa a pessoa
em vez de inventar.

**Passo 2 — abre um terminal (ou processo em segundo plano) por IA**, e
manda a cada uma a sua tarefa, redirecionando a saída para um ficheiro de
log próprio (`logs/qwen.log`, `logs/kimi.log`, `logs/deepseek.log` — cria
a pasta `logs/` se não existir; já deve estar ou devia ficar no
`.gitignore`) para poderes acompanhar sem interromper. As quatro tarefas,
incluindo a tua:

---

### Tarefa — Qwen

```
git pull origin claude/jarvis-ai-os-tauri-mvp-xa5km0 primeiro. Lê
docs/estilo-de-codigo.md, depois docs/spec/orquestrador-multi-provedor.md
inteiro (desenho da cadeia de provedores de IA — DeepSeek, Claude,
Ollama).

Peça: reordenar a cadeia de provedores de IA. Hoje a ordem é fixa em
código — CHAIN_ORDER em use-ai-settings-store.ts. Falta um ecrã em
Personalização → Assistente (AiSettings.tsx) para a pessoa reordenar
(arrastar, ou setas para cima/baixo já chega) e guardar a preferência
(storageService, mesmo padrão do resto do projeto).

Se sobrar tempo: ollama-provider.ts tem um pedido pequeno pendente —
pedir um modelo não instalado (ollama pull em falta) hoje chega como
erro genérico; vale a pena uma mensagem própria? Só se for mesmo
pequena.

Antes de terminares: tsc --noEmit limpo, eslint . 0 erros, npx vitest
run completo a passar. Testa ao vivo na app aberta se mexeste em algo
visível. git pull antes do push final. Entrada em
docs/log/historico-sessoes.md, atualiza SPEC.md, marca o item 1 como
feito em docs/log/fila-de-trabalho.md. Nunca --force, tudo em
português.
```

### Tarefa — Kimi

```
git pull origin claude/jarvis-ai-os-tauri-mvp-xa5km0 primeiro. Lê
docs/estilo-de-codigo.md.

Peça: revisão a sério do Terminal — nunca teve uma revisão independente
neste projeto. Não é para construir nada novo, é para ler o código como
se fosse a primeira vez, sem confiar nos testes só porque passam.

Onde está: src-tauri/src/terminal/ (PTY real via portable-pty,
powershell.exe no Windows), xterm.js do lado da interface. SPEC.md,
secção "Janela: Terminal" (Parte 6.2), diz o que já se sabe: sem
confirmação para comandos destrutivos por desenho, fecho da janela
nunca confirmado ao vivo a matar o processo.

Perguntas a responder com evidência no código:
1. O processo filho fica sempre ligado a um Job Object do Windows, ou há
   caminho onde escapa e fica órfão?
2. Alguma forma de o texto do terminal ser interpretado como outra coisa
   que não texto pela interface (escape sequence malicioso)?
3. Duas janelas de Terminal abertas ao mesmo tempo — processos e buffers
   ficam mesmo isolados?
4. Fechar a janela liberta os recursos (handles, threads de leitura do
   PTY), ou fica algo pendurado?
5. Existe algum caminho (bug, não decisão de desenho) onde um comando
   corre sem a pessoa ter escrito nada?

Documenta o que encontrares, mesmo que seja "nada de real a corrigir".
Se encontrares algo real, corrige com um teste que prova o antes/depois.

tsc --noEmit limpo, eslint . 0 erros, npx vitest run e cargo test (se
mexeres em Rust) a passar. git pull antes do push final. Entrada em
docs/log/historico-sessoes.md, marca o item 3 como feito em
docs/log/fila-de-trabalho.md. Nunca --force, tudo em português.
```

### Tarefa — DeepSeek

```
git pull origin claude/jarvis-ai-os-tauri-mvp-xa5km0 primeiro. Lê
docs/estilo-de-codigo.md.

Peça: revisão a sério das Automações nativas (gatilhos de sistema) —
nunca tiveram revisão independente.

Onde está: SPEC.md, procura "Gatilhos do sistema" — watch_folder,
unwatch_folder, get_battery_status (Rust), fileWatcher/usbMonitor/
batteryMonitor (PlatformAdapter), eventos automation://file-changed,
automation://usb-changed, automation://battery-changed,
checkNativeTriggers() no automationService.

Perguntas a responder com evidência no código:
1. watch_folder chamado duas vezes para a mesma pasta duplica o watcher,
   ou é idempotente?
2. Pasta observada apagada do disco a meio — rebenta, fica preso, ou
   falha graciosamente?
3. unwatch_folder é sempre chamado quando a regra que o criou é apagada
   ou desativada, ou pode ficar um watcher órfão?
4. Poll de bateria (30s) e USB (5s) com a app minimizada muito tempo —
   continuam a correr, ou algum pára sem avisar?
5. Uma regra mal configurada trava a verificação das outras, ou falha
   isolada?

Documenta o que encontrares, mesmo que seja "nada de real a corrigir".
Se encontrares algo real, corrige com um teste que prova o antes/depois.

tsc --noEmit limpo, eslint . 0 erros, npx vitest run e cargo test a
passar. git pull antes do push final. Entrada em
docs/log/historico-sessoes.md, marca o item 4 como feito em
docs/log/fila-de-trabalho.md. Nunca --force, tudo em português.
```

### Tarefa — tu (Claude Code local), em paralelo às três de cima

```
git pull origin claude/jarvis-ai-os-tauri-mvp-xa5km0 — vais puxar o
commit f1eba3a (Peça 20), que acabou de sair de uma sessão remota.

Peça: revisão a sério da Peça 20 (ferramentas para o Claude no
orquestrador multi-provedor) — código acabado de nascer, ninguém de
fora ainda olhou para ele.

Onde está: src/services/ai-providers/claude-provider.ts (run(),
toAnthropicMessages(), collectClaudeStream(), isBlockList()),
src/services/assistant/tools.ts (toolsAsAnthropicSchema), ai-service.ts
(isToolCapable). O porquê está em
docs/spec/orquestrador-multi-provedor.md §6 e na última entrada de
docs/log/historico-sessoes.md.

Perguntas a responder:
1. Um turno com DUAS ferramentas ao mesmo tempo — ficam mesmo os dois
   tool_result juntos numa única mensagem user, na ordem certa, com os
   tool_use_id certos? Confirma contra o que a API da Anthropic exige de
   verdade, não só contra o teste que já existe.
2. Um content_block_delta a chegar antes do content_block_start
   correspondente — rebenta, ou ignora graciosamente?
3. Um bloco de texto vazio (só pedido de ferramenta, sem texto) — entra
   como bloco vazio, ou é omitido? A Anthropic aceita um bloco de texto
   vazio?
4. isBlockList() cobre mesmo todos os casos que lhe chegam?
5. Se tiveres uma chave da Anthropic real configurada, confirma contra o
   servidor de verdade — o historico já diz que isto nunca foi feito.

Documenta o que encontrares, mesmo que seja "nada de real a corrigir".

tsc --noEmit limpo, eslint . 0 erros, npx vitest run a passar. git pull
antes do push final. Entrada em docs/log/historico-sessoes.md, marca o
item 5 como feito em docs/log/fila-de-trabalho.md. Nunca --force, tudo
em português.
```

---

**Passo 3 — a fila é grande, não é para parar depois da primeira.**
`docs/log/fila-de-trabalho.md` tem catorze itens construíveis/revisáveis
por baixo dos quatro de cima (explorador de ficheiros real, vault
Obsidian, navegador controlado, Controlo Direto Fase 3.1, editor de
automações, contexto de datas, voz clonada, anexos de email, suite E2E,
e mais). É para durar a noite inteira — cada IA que terminar a sua
tarefa recebe de ti o próximo item por baixo na lista (mesmo padrão:
`git pull`, escreve o teu nome/hora a seguir ao título do item, `commit`,
`push`, só depois começa a trabalhar nele — se o `push` falhar porque
outra sessão já pegou nesse item, `git pull` e passa ao seguinte).
Continua a fazer isto até a lista acabar ou a manhã chegar, o que vier
primeiro. Nunca atribuas o item "Wake word" nem "Executar Voz/Ler
Memória/Guardar Preferências" — precisam de decisão da pessoa, nunca
escolhida por uma IA sozinha.

**Passo 4 — acompanha, não fiques só à espera.** A cada 15-20 minutos
(ou quando notares atividade nos logs), confirma:

- `git log --oneline -10` — houve commits novos de alguma das três?
- Os ficheiros de log (`logs/*.log`) — alguma parou a meio, presa num
  erro, ou a pedir confirmação que ninguém vai dar (nenhuma tarefa
  destas devia precisar disso — se alguma pedir, é sinal de que saiu do
  âmbito combinado)?
- `git status` — algum conflito de merge à espera?

Regra que vale para todos, sempre: **nunca confiar só no relatório de
outra sessão**. Se leres num histórico ou numa mensagem que algo "já
está feito", confirma tu próprio antes de construir por cima.

No fim (ou de manhã, o que vier primeiro), resume à pessoa: o que cada
IA fechou, o que ainda está a meio, e qualquer bug real que se tenha
encontrado nas revisões.

---

Isto fica registado em `docs/log/prompt-orquestracao-noturna.md` e a
fila em `docs/log/fila-de-trabalho.md`, os dois já commitados.
