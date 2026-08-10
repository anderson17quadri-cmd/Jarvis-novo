# Histórico de sessões

Diário de trabalho do projeto JARVIS AI OS — Project ARC, em português.
Cada sessão de trabalho (com o Claude Code, local ou não) acrescenta uma
entrada no fim deste ficheiro, com data e um resumo curto do que mudou e
porquê. Não substitui os commits do git (que continuam a ser a fonte
exata de "o quê"); isto é o "porquê", em prosa, para quem voltar ao
projeto dali a semanas não ter de reconstruir o raciocínio a partir dos
diffs.

Formato de cada entrada:

```
## AAAA-MM-DD — título curto

O que se pediu, o que se decidiu, o que ficou feito. Duas ou três frases
chegam a maior parte das vezes. Liga a commits/ficheiros quando ajudar.
```

Mais antigo primeiro, mais recente no fim.

---

## 2026-08-09 — Voz clonada local: vozes prontas, ligação à app, núcleo personalizável

Sessão longa, em duas partes.

Primeiro, a voz: depois de confirmar a clonagem a sério na RTX 5070
(commit `e4bb43d`), descobriu-se que a amostra de referência usada afinal
era uma gravação de outro serviço de IA, não a voz do próprio
utilizador — recusado pelo mesmo princípio de consentimento já assente
nesta conversa. Em vez disso, expôs-se as vozes prontas do XTTS-v2
(gravadas por atores que autorizaram o uso), primeiro uma curadoria de 8
(`f38481d`), depois a lista real e completa que o modelo trouxer —
mais de 40 — depois de o utilizador pedir para testar mais do que as 8
(`5d42e02`). Ligou-se tudo isto a `voice-service.ts` e a
`VoiceSettings.tsx` (sub-fase 4.3, `f99d05f`), para a escolha ficar em
Personalização → Voz, ao lado das vozes do sistema. Corrigiu-se ainda um
bug real, descoberto pelo utilizador ao testar: nomes com acentos ou
letras nórdicas (ex. "Camilla Holmström") chegavam trocados pela Windows
PowerShell 5.1, por o FastAPI não declarar `charset=utf-8` explícito
(`d80d289`). E corrigiu-se o CUDA por omissão do `setup.ps1`, que ainda
apontava para a versão que sabíamos falhar na RTX 5070 (`5c1cf4e`).

Depois, aparência: o núcleo (AICore) ganhou cor e velocidade
personalizáveis, que já estavam desenhadas como "para depois" no
`SPEC.md`. A parte que exigia mais cuidado foi perceber que os anéis em
`CoreRings.tsx` liam `var(--accent)` direto do CSS, por isso escolher uma
cor customizada não lhes mexia nada — só às partículas do canvas.
Passaram a receber a cor já resolvida por prop. Verificado num browser
real com Playwright antes de se dar como funcional (`f5da343`).

O utilizador começou também a configurar o Claude Code localmente
(instalador nativo, VS Code, `PATH` do Windows que não atualizava em
janelas já abertas) para deixar de depender de copiar/colar comandos
nesta conversa. Testou as 58 vozes prontas e escolheu "Alison Dietlinde".

Por fim, memória entre sessões e entre modelos: `CLAUDE.md` (lido sozinho
pelo Claude Code no arranque, aponta para este ficheiro e para
`docs/estilo-de-codigo.md`) e `docs/estilo-de-codigo.md` (as regras do
projeto — língua, comentários, design, verificação, ética — escritas para
qualquer modelo, não só o Claude). O pedido era "todo modelo que vou usar
usar a inteligência já adquirida" — por isso `ollama/Modelfile` traz um
resumo do mesmo ficheiro como prompt de sistema, para criar um modelo
Ollama local (`ollama create jarvis-dev -f Modelfile`) já com as
convenções do projeto, sem depender de as colar a cada conversa. Os dois
ficheiros de regras (`docs/estilo-de-codigo.md` e `ollama/Modelfile`) não
se sincronizam sozinhos — o formato do Ollama não inclui outros
ficheiros — por isso mudar um exige lembrar do outro.

## 2026-08-09 — O microfone estava mesmo partido: reconhecimento local via Whisper

Depois de escolher "Alison Dietlinde" e ligar a voz por omissão a ela (em
vez da escolha automática do sistema), o utilizador pediu para deixar o
microfone a funcionar de verdade, com autonomia total para trabalhar
diretamente no PC. Testado por CDP antes de mexer em código (não por
suposição): o reconhecimento nativo do WebView2 liga o microfone
(`onaudiostart` dispara) e nunca mais dá sinal nenhum — nem resultado, nem
erro, nem fim. Preso para sempre, sem pista nenhuma para quem usa a app.

O arranjo: `voice-clone-service/server.py` ganhou `POST /ouvir`, com
Whisper sobre o mesmo `torch`+CUDA já instalado para o XTTS-v2 — nenhuma
dependência nova de GPU. `voice-service.ts` passou a gravar com
`MediaRecorder` (isto funciona no WebView2, ao contrário da Web Speech
API) e mandar transcrever ali, sempre que o serviço local estiver a
correr; o reconhecimento nativo do motor fica como segunda opção, com um
relógio de segurança de 9s para nunca mais ficar preso. Confirmado
ponta-a-ponta: um `.wav` com fala real em português voltou como texto
correto (`dba49ab`).

De caminho, confirmaram-se a sério no Windows nativo (não só "por
testar"): a bandeja do sistema, o atalho global `CTRL+ALT+J` (janela
minimizada à força voltou sozinha ao primeiro plano), e a persistência
via plugin `store` (ficheiro real em `%APPDATA%`). Ficou por ligar: os
diálogos nativos de ficheiro (o plugin está registado no Rust, mas
nenhum sítio da interface o chama ainda — a cópia de segurança usa
`<a download>`/`<input type="file">` normais), a lista de processos (o
comando existe, mas nenhum widget o pede), e o build Android (bloqueado
nesta máquina por falta do SDK). O build Windows (MSI/NSIS) também
confirmou — `npm run tauri build` produziu os dois instaladores sem erro
(`src-tauri/target/release/bundle/`), ainda não corridos.

Nota para quem continuar: a instância de `npm run tauri dev` fechou-se
sozinha várias vezes durante os testes automatizados por CDP, sem erro
nenhum no terminal — suspeita-se de pressão de memória (XTTS-v2 e Whisper
carregados ao mesmo tempo no `voice-clone-service`) ou de algo ligado ao
`--remote-debugging-port` usado para testar por fora. Não visto em uso
normal, sem essa flag.

## 2026-08-10 — Voz clonada local: gravar pela interface, e a app arranca o serviço sozinha

Pedido em modo de autonomia total (`--dangerously-skip-permissions`),
por blocos, com verificação a sério (`tsc`, `eslint`, `vitest`, e
confirmação em browser real para peças de interface) e commits pequenos
por peça. Primeiro bloco: as duas sub-fases que faltavam em §Voz clonada
local.

**4.2 — gravar a amostra na interface.** `VoiceSettings.tsx` ganha
"Gravar a minha voz": grava até 12s com `MediaRecorder` (a mesma técnica
já usada no reconhecimento local), com contagem decrescente e um botão
para terminar mais cedo, e manda para `POST /voz`. Esse endpoint deixou
de exigir um `.wav` — passou a converter com `ffmpeg` qualquer formato
que o browser grave (`.webm`/Opus), sempre para PCM mono. Confirmado a
sério: gravei pela interface a correr, e `voices/referencia.wav` mudou
na hora, sem nada a rebentar (`e41581e`).

**4.4 — a app arranca o serviço sozinha.** `src-tauri/src/voice_clone.rs`
novo: tenta a porta 8090 no arranque, só chama `uvicorn` se não houver lá
nada a ouvir, e mata o processo filho ao fechar a janela — confirmado com
um fecho normal, não um "matar já" (`taskkill` sem `/F`), que o Python
saiu junto. Sem `.venv` instalado, desiste em silêncio, nunca impede o
arranque da app. Ao testar a sério (não só o `cargo check`), apanhou-se
um bug verdadeiro: `os.add_dll_directory`, do lado do Python, recusa
caminhos relativos (`WinError 87`, "o parâmetro está incorreto") — a
pasta do serviço tinha de chegar já canonicalizada. Só haveria sinal
disto a testar a sério, num PC a sério — exatamente a razão de tudo isto
não ter avançado antes da Fase 1 confirmar em `§1.1`.

**Bloco 2 — Pipeline de reconhecimento completo.** As três etapas que
faltavam entre transcrição e execução: **ruído** — `POST /ouvir` passou a
descartar a alucinação conhecida do Whisper em áudio só com ruído
(`no_speech_prob` por segmento, testado a sério com 3s de silêncio puro);
**silêncio** — `vigiarSilencio`, novo em `voice-service.ts`, mede o volume
por um `AnalyserNode` a cada 100ms e para a gravação sozinha depois de
fala seguida de silêncio, em vez de esperar sempre os 12s do limite de
segurança; **idioma** — `/ouvir` ganhou o mesmo parâmetro que `/falar` já
tinha, só por simetria (a app continua só em português). "Planeamento"
ficou por implementar de propósito: já está coberto pelos comandos
compostos (Parte 10) e pelo encadeamento de ferramentas da DeepSeek
(Parte 7.1).

De caminho, a testar a sério (não só a ler o código), apanhou-se outro
bug real: parar a escuta à mão — voltar a carregar no botão do microfone
a meio de uma gravação — deixava de chamar `onEnd`, e o núcleo ficava
preso em "a ouvir" para sempre. Corrigido para tratar as três formas de
acabar a escuta (limite de segurança, silêncio, botão) da mesma maneira.
Confirmado ao vivo por CDP com um microfone falso do Chromium a "ouvir" a
própria voz do XTTS-v2: a transcrição chegou à memória do assistente, e o
botão voltou sozinho ao estado inativo. A deteção de silêncio em si não
se deixou cronometrar ao vivo — o `--use-file-for-fake-audio-capture` do
Chromium repete o ficheiro em loop, nunca produz silêncio a sério — por
isso essa parte ficou confirmada só por testes com temporizadores
controlados, não pelo browser real.

**Bloco 2, continuação — mais variações em `services/voice/intents.ts`.**
A peça mais valiosa não foi mais uma palavra numa lista: `stripPoliteness`
tira prefixos de cortesia ("podes", "por favor", "consegues", em cadeia)
antes de se procurar o verbo — antes, "podes abrir os emails" não
reconhecia nada e ia sempre parar ao assistente, só "abre os emails" é
que batia. Mais sinónimos por família de comando (abrir, esconder,
pesquisar, tarefa, música), e "fecha tudo"/"reinicia a app"/"reinicia o
jarvis" como variantes que faltavam. 52 testes no total, os 15 novos a
cobrir exatamente estes casos.

**Bloco 3 — Núcleo e personalização.** Duas decisões da Parte 15 que
ficavam por tomar. Esconder os anéis: sim, compensa — `coreRingsVisible`
(Personalização → Aparência → "Mostrar os anéis"), por omissão ligado;
desligado, o núcleo fica só com o brilho central e as partículas (que
vivem num canvas à parte). Perfis de animação: cinco — Minimal, Suave,
Equilibrado, Cinemático, Performance — mas não como uma dimensão nova: um
atalho sobre os três dials que já existiam (partículas, velocidade,
anéis), não duplicando o que os "estados do sistema" (Parte 9) já fazem
para o ritmo e os avisos. "Glow" e "duração das transições", que a spec
original também pedia, ficaram de fora — não há dial nenhum para nenhum
dos dois, e inventar um só para preencher a lista seria personalização a
fingir. "Personalizado" nunca se guarda — deriva-se sempre dos três
dials (`detectAnimationProfile`), para nunca haver dois sítios a poder
discordar sobre qual perfil está ativo. Ambas confirmadas ao vivo por
CDP, não só pelos 7 testes novos: os anéis a desaparecer e a voltar, e
"Minimal" a marcar-se sozinho como ativo.

**Bloco 4 — Permissões por plugin, a sério.** Nenhum plugin executa código
próprio, mas duas das entradas do catálogo — "Assistente JARVIS" e "Motor
de automações" — descrevem funcionalidades a sério do próprio sistema, não
código descarregado. Encontraram-se as duas chamadas reais por trás delas
e ligou-se a recusa a impedi-las: a permissão de rede do assistente agora
impede `ai-service.ts` de sequer tentar `provider.stream()` num provedor
remoto (DeepSeek, Claude) — nem à primeira, nem na cadeia, com o motivo
dito e queda para o local, tudo a reaproveitar o mecanismo de fallback já
existente (`AiFailureKind: 'permissao'`); a de notificações das automações
impede a ação `notificar` de chegar a `notificationService`. Não foi só
"a resposta veio de outro sítio" que se provou: 5 testes novos garantem
que a chamada **nunca acontece**, com um provedor de mentira que rebenta o
teste se alguém lhe tocar. Confirmado também ao vivo: o interruptor "Rede"
muda para "Recusada" na Privacidade e persiste. Não se inventou nenhuma
permissão nova nem se tocou nas outras — não há mais nenhuma chamada real
por trás delas.

**Bloco 4, continuação — avaliação da API do Core para plugins.** Pedido
explícito: só avaliar, sem ainda ir ao marketplace/SDK/rollback. As treze
capacidades do original (`docs/spec/jarvis-spec-completo.md:568`) — Criar
Widgets, Criar Janelas, Adicionar Menus, Adicionar Comandos, Adicionar
Atalhos, Criar Notificações, Adicionar Configurações, Criar Serviços,
Executar Voz, Ler Memória, Guardar Preferências, Adicionar Painéis,
Registar Eventos.

**Conclusão: nenhuma entra ainda, e não é falta de tempo.** A spec já o
diz por outras palavras — "isolamento: plugins nunca acedem diretamente a
outros plugins, só via APIs públicas do sistema" — e isso pressupõe que
há alguém do outro lado a chamar a API, dentro de uma sandbox. Sem
execução de código (bloqueado — sandbox, assinatura, ficheiros, ver §2),
construir a API é adivinhar a forma de uma porta para uma sala que ainda
não existe: a mesma razão por que os perfis de animação não inventaram um
dial de "glow" só para preencher a lista.

Mas a avaliação encontrou uma coisa concreta a dizer sobre **como** essas
treze vão ficar caras de construir, quando a sandbox chegar — e vale a
pena deixar escrito agora, antes de se esquecer:

- **Criar Widgets / Criar Janelas** são as mais caras das treze.
  `WIDGET_REGISTRY` (`widgets/registry.ts`) e o equivalente para janelas
  são `Record<WidgetId, WidgetDefinition>` — `WidgetId` é uma união
  fechada de tipos, verificada em tempo de compilação, com `switch`
  exaustivos espalhados pelo código a assumir que a lista é essa e
  nenhuma outra. Torná-la extensível em tempo de execução por um plugin
  não é acrescentar uma função — é mudar `WidgetId`/`AppId` de união
  fechada para `string` aberta, e isso ondula por todos os `switch` que
  hoje o TypeScript prova exaustivos.
- **Criar Notificações / Executar Voz** são as mais baratas — já são
  serviços com um método simples (`notificationService.info(...)`,
  `voiceService.speak(...)`) chamados de vários sítios (automações, voz,
  sistema). Expor isto a um plugin é sobretudo decidir *quem* pode
  chamar, não construir de novo — mas ainda precisa da parte de "quem",
  que é sandboxing.
- **Guardar Preferências / Ler Memória** têm um risco que as outras não
  têm: **isolamento de dados**. `storageService` guarda tudo no mesmo
  ficheiro (`jarvis.store.json`), sem namespace por plugin — um plugin
  malicioso lendo ou escrevendo por cima da chave doutro não é hipotético
  se a API for só "aqui está o storage, usa à vontade". `memoryService`
  guarda o que o utilizador disse por palavras próprias (Parte 7.1) —
  dar-lhe acesso a qualquer plugin sem mediação é o mesmo tipo de decisão
  que já se recusou fazer para a memória do assistente com terceiros.
- **Adicionar Menus / Comandos / Atalhos / Configurações / Painéis** têm
  o mesmo problema do primeiro grupo, em menor escala: hoje são registos
  estáticos (`command-registry.ts`, o menu de contexto fixo de 8 itens da
  Parte 6.1), não pontos de extensão.
- **Registar Eventos** é o único já meio-pronto: o Event Bus
  (`services/event-bus.ts`) já existe, já é tipado, e automações já o
  escutam — falta decidir que eventos ficam abertos a um plugin (nem
  todos deviam) e a própria sandbox para o "quem escuta" ser seguro.

Nenhuma linha de código nova. O SPEC.md regista a avaliação; construir
fica combinado para depois de a Fase 1 nativa desbloquear sandbox (o
mesmo pré-requisito que já bloqueia "Carregar e executar um plugin",
sem novidade nenhuma aqui — só a resposta a "o que falta", por escrito).

**Bloco 5 — Automações.** Dois pedidos, um encontrou um bug de
documentação, o outro descreveu porque não é para começar já.

**Templates desligados**: o comentário em `data/automations.ts` dizia que
a automação do arranque era exceção à regra "todas desligadas por
omissão" — nunca foi, nem no código nem no teste que já garantia isto.
Corrigido o comentário, não o código: o próprio teste
(`automation-service.test.ts`) já prova que as cinco vêm desligadas, sem
exceção, e a razão fica escrita — abrir janelas e falar sozinho no
primeiro arranque, antes de a pessoa saber que automações existem, seria
pior do que a fricção de as ligar à mão.

**Editor visual em blocos**: lida a Parte 13 original a sério antes de
decidir. Pede um editor de nós com dez tipos de bloco — incluindo Loop,
Variável, IA e Plugin como passos — ligados visualmente, com zoom, pan,
seleção múltipla, copiar/colar e agrupar. O motor de hoje é
`Gatilho → Condições[] → Ações[]`, uma lista plana, sem ramos nem loops
nem variáveis. Um editor de nós sobre um motor plano seria interface a
fingir — a mesma razão por que o Terminal continua de fora. **Não
começado.** Três decisões por tomar primeiro, nenhuma técnica: se
"editor visual" é mesmo um canvas de nós livre ou bastaria um construtor
mais simples sobre o modelo que já existe; se for o canvas a sério, o
modelo de dados muda primeiro — projeto à parte, maior do que o editor;
e o que fazer aos blocos (Plugin, webhook/API) que dependem de
capacidades ainda bloqueadas nesta app.

**Bloco 6 — Agentes especializados: decidido que não vale a pena, para
já.** Pedido explícito: uma frase de porquê, decisão registada mesmo que
seja "não". Razão: 23 ferramentas (contagem corrigida no SPEC.md — a
nota antiga dizia 21) é pouco para um modelo de tool-calling lidar de
uma vez, sem sinal nenhum de confusão nos testes existentes; o pedido
típico já atravessa "domínios" à vontade (abrir uma janela e criar uma
tarefa no mesmo pedido); e especializar exigia um encaminhador a
escolher o agente, mais orquestração entre agentes para repor o
encadeamento que já funciona sozinho hoje — tudo isso sem nenhum
problema real a resolver. Reabre-se se o catálogo crescer a sério ou
aparecer confusão de verdade entre ferramentas parecidas.

Com isto fecham-se os seis blocos pedidos nesta sessão. As exclusões
explícitas (wake word, Fase 3, Windows Hello, Terminal, serviços da
Fase 2, contexto de conversa por IA) ficaram de fora, como pedido.

## 2026-08-10 — O "ponto" a ser dito em voz alta: reproduzido e confirmado

Pedido explícito: reproduzir a sério antes de mexer em código, não
inventar uma limpeza genérica sem ouvir onde entrava o ponto a mais.
`BOOT_SPOKEN_LINE` inteira ("Bom dia. Todos os sistemas foram
inicializados com sucesso.") não reproduziu nada de errado a um primeiro
teste — mas isolar só a primeira frase, "Bom dia.", sozinha, é que
mostrou o problema: 1 em 4 gerações do XTTS-v2 saía "Bom dia. Ponto." Sem
mais texto a seguir para dar contexto ao modelo, o ponto final às vezes é
lido à letra. Confirmado com áudio a sério — `POST /falar` seguido de
`POST /ouvir` (Whisper) a transcrever de volta o que realmente foi dito —
não só a ler o código.

Arranjo: `limparParaSintese`, em `voice-service.ts`, chamado por `speak()`
antes de escolher entre a voz clonada e a do sistema (vale para as duas,
mesmo só se ter confirmado o defeito na clonada). Tira o ponto final —
redundante, o fim da string já diz que a frase acabou — e troca
reticências (`...` ou `…`) por vírgula, que já pausa a prosódia sem
arriscar ser lida. Não mexe em pontos a meio de uma frase mais longa,
que servem de pausa real. Confirmado o arranjo com 9 gerações seguidas
de "Bom dia" sem ponto final, todas limpas — contra 1 em 4 antes.

Achado à parte, registado mas não arranjado agora: ao repetir o teste
com a frase completa do arranque, viu-se que o XTTS-v2 tem uma taxa de
fundo de alucinação em texto mais longo (sílabas ou palavras soltas a
mais, por vezes no fim do áudio) que acontece com ou sem o ponto final —
não é o mesmo bug, e uma limpeza de texto não o resolve. Fica escrito no
SPEC.md para quem voltar a isto não pensar que é a mesma coisa.

## 2026-08-10 — Microfone em ciclo infinito: reproduzido, e um buraco real fechado

Pedido explícito, urgente: reproduzir a sério antes de mexer em código, e
confirmar se o microfone volta a ligar-se sozinho depois de o JARVIS
falar. Com um microfone falso (o Chromium a repetir um ficheiro `.wav`),
um ciclo completo — ouvir, transcrever, responder, falar — não voltou a
disparar sozinho em 75 segundos de observação por CDP; e a leitura do
código confirmou que não há nenhum sítio a chamar `toggleListening`
sozinho depois de `speak()`. Até aqui, sem reprodução do "ciclo infinito"
propriamente dito — um microfone falso nunca ouve o que toca nas colunas,
por isso não conseguia mesmo reproduzir eco a sério.

Mas o teste ao vivo apanhou o buraco a sério, só que noutro sítio: a
clicar no microfone a meio de "Testar" uma voz (Personalização → Voz), a
gravação **arrancava à mesma** — o pedido de áudio à voz clonada (rede +
síntese, pode demorar segundos) tinha uma janela em que nada impedia o
microfone de ligar, mesmo antes de o áudio chegar a tocar. É exatamente a
pista que o utilizador tinha dado: o `vigiarSilencio` não sabia nada
sobre `speak()`/`speakClonada()` estarem em curso.

Arranjo: `voice-service.ts` marca "a falar" logo no início de `speak()`
— antes de se pedir o áudio, não só quando ele começa a tocar — e só
larga o bloqueio `SPEAK_GUARD_MS` (900ms) depois de a voz acabar de
verdade (`onend`/`onerror`/`stopSpeaking()`). `toggleListening()` recusa
nessa janela com o motivo `'a-falar'`, com mensagem própria em vez de
falhar em silêncio. Um teste apanhou exatamente o buraco original
(bloquear só a partir de `onplay`, tarde de mais) antes de se corrigir, e
voltou a passar depois. Confirmado ao vivo por CDP, duas vezes — antes do
arranjo (o microfone ligava a meio da fala) e depois (recusado, com o
motivo certo) — e confirmado que o uso normal continua igual quando não
há nada a falar.

## 2026-08-10 — Ollama ligado à janela de definições, confirmado com o modelo a correr

Segundo pedido, prioridade normal: o `OllamaProvider` já existia e já
tinha testes, mas o endereço base era a única coisa editável na
Personalização — faltava escolher o modelo, e o próprio ficheiro dizia
(já desatualizado) "não está ligado à janela de definições". A cadeia
automática (`CHAIN_ORDER`) já incluía o Ollama há um bloco anterior desta
sessão; o que faltava era mesmo só a interface.

Acrescentado a `AiSettings.tsx`: um campo para o nome do modelo, e um
botão "Detetar" que pergunta a `GET {endereço}/api/tags` — o mesmo
endereço que o utilizador já tinha guardado — que modelos já estão
instalados, e mostra-os como chips clicáveis (evita ter de decorar ou
copiar o nome exato, tipo `qwen3:8b`). Erros de deteção (Ollama desligado,
sem nenhum modelo instalado) têm mensagem própria em vez de falhar em
silêncio.

Testado a sério, com o Ollama a correr na máquina, não só com testes que
simulam a resposta: a primeira pergunta pela interface ("Diz uma frase
curta...") gerou pedidos reais a `http://localhost:11434/v1/chat/completions`,
confirmados por CDP — mas excedeu os 60s de limite, porque o modelo
(`qwen3:8b`, 8B parâmetros) ainda estava frio, a carregar pela primeira
vez; a cadeia caiu corretamente para o provedor seguinte, com aviso na
conversa, exatamente como desenhado. Depois de aquecer o modelo (`ollama
run qwen3:8b` a partir da linha de comandos), a mesma pergunta pela
interface teve resposta certa do Ollama dentro do tempo — confirmação
real de ponta a ponta, não só da cadeia de fallback.

Achado à parte: dois comentários no código (`ollama-provider.ts` e
`claude-provider.ts`) diziam "não está ligado à janela de definições",
mas ambos já estavam errados — o mesmo padrão de comentário caído para
trás encontrado antes em `automations.ts`. Corrigidos os dois para
refletir o estado real.

Suite toda: 1101 testes, todos a passar (1 falha isolada em
`login-screen.test.tsx` no correr completo, confirmada como oscilação ao
correr o ficheiro sozinho — não relacionada com este trabalho).

## 2026-08-10 — Auditoria de dependências: uma vulnerabilidade real, uma decidida a não forçar

Com duas sessões locais (Claude, DeepSeek) a trabalhar em paralelo numa
fila grande de tarefas, esta sessão fez algo que nenhuma das duas tinha
na lista: um `npm ci` limpo, num clone à parte, para confirmar que o
projeto instala e corre bem partindo do zero — não só por cima do que já
estava instalado.

O `npm audit` desse clone apontou 10 vulnerabilidades. Duas descobertas:

**`react-router-dom` era peso morto com uma vulnerabilidade a reboque.**
Estava no `package.json` (`^7.1.1`) e listado no `manualChunks` do
`vite.config.ts`, mas `grep -rl "react-router" src/` não encontrou
nenhuma importação em lado nenhum — a app usa o próprio `WindowManager`,
nunca teve rotas. Removido de propósito (não atualizado — apagado),
tirando de uma vez a vulnerabilidade alta associada e peso do bundle
vendor sem função nenhuma. `npm audit` caiu de 10 para 5.

**As 5 restantes (vitest/vite/esbuild, uma delas crítica — CVSS 9.8,
leitura/execução arbitrária de ficheiros com o servidor de UI do Vitest
ligado) só têm correção com `npm audit fix --force`, que sobe o vitest
para a versão 4, major.** Tentei a sério: instalei o `vitest@4.1.10`,
corri a suite toda — 4 testes falharam (`login-sound.test.tsx`,
`boot-sound.test.tsx`), isolados a passarem sozinhos mas a falharem em
conjunto, sinal de estado a vazar entre ficheiros de teste que a versão
2 isolava e a 4 não isola da mesma forma por omissão. Diagnosticar a
fundo (mudança de `pool`/`isolate` entre versões) e corrigir a sério
ficaria para além do que esta peça devia ocupar sozinha, com duas outras
sessões já a trabalhar em paralelo — **decisão: reverter para
`vitest@2.1.8`** (a versão de sempre, suite verde outra vez, 1101/1101),
e deixar a atualização major documentada aqui como trabalho real por
fazer, não escondida nem forçada com testes a falhar.

Confirmado com `tsc`, `eslint`, a suite toda, e um `npm run build` a
sério (produção, não só o `dev`) — o `vite.config.ts` mudou, tinha de se
confirmar que o build ainda produzia os chunks certos.
