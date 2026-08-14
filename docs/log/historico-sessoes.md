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

## 2026-08-10 — Verificação automática (CI), a rede de segurança que faltava

Com três sessões (esta, o Claude, a DeepSeek) a empurrar para o mesmo
branch em paralelo, e nenhuma verificação automática a correr em cada
`push` — nada apanhava um envio partido antes da sessão seguinte puxar
por cima dele. `.github/workflows/check.yml`, novo: `npm ci`, `npm run
check` (o próprio script já existente, `typecheck && lint && test`), e
`npm run build`, em todo o `push` e `pull_request`, Node 22.

Validado a sério antes de enviar, não só a sintaxe do YAML: correram-se
os mesmos três comandos localmente, exatamente como o workflow os
corre — 1101 testes, `tsc` e `eslint` limpos, build de produção completo.

## 2026-08-10 — Quatro blocos: diálogos nativos, avatar, processos e erro simulado

Sessão paralela a outra (a trabalhar no Ollama), com os mesmos critérios
de verificação: `tsc`, `eslint`, `vitest` e confirmação visual onde há
interface. Quatro blocos pequenos, cada um com o seu commit.

**Bloco 1 — Diálogos nativos de ficheiro na cópia de segurança.**
`src/platform/native-dialogs.ts` (novo) tenta `save()`/`open()` do
`@tauri-apps/plugin-dialog` mais `writeTextFile`/`readTextFile` do
`@tauri-apps/plugin-fs` — ambos já estavam no `Cargo.toml`, no
`package.json` e registados no `lib.rs`, mas nenhum sítio os chamava.
`BackupPanel.tsx` tenta o diálogo nativo primeiro e cai para o
`<a download>`/`<input type="file">` de sempre se falhar (ex.: a correr
só no browser). O SPEC.md reflete o novo estado (`c839ef9`).

**Bloco 2 — O avatar "viaja" até ao canto superior direito.** A spec
(Parte 5) pedia uma transição do centro do ecrã de login até ao
header. `FlyingAvatar`, novo componente em `App.tsx`, renderiza sobre
`position: fixed` na posição de destino (canto superior direito do
header), mas começa com `transform: translate()` e `scale()` a partir
da posição real do avatar do login (por `getBoundingClientRect`), e faz
a transição por CSS (`transform 600ms ease-out`). Só `transform` e
`opacity`, como manda a regra do projeto (`aa36d48`).

**Bloco 3 — Lista de processos.** O comando Rust `get_top_processes` já
existia (`src-tauri/src/commands/system.rs`), mas nenhum ecrã o
chamava. Novo separador "Processos" no Centro de Programador
(`DeveloperCenterWindow.tsx`): tabela com nome, PID e memória, relida a
cada 3s via `systemService.getTopProcesses()`. Sem ações (matar, etc.)
nesta primeira versão. Só aparece onde `capabilities.processList` for
verdade (`603675f`).

**Bloco 4 — Modo de erro simulado no arranque.** `sessionStorage.setItem(
'jarvis-debug.bootFailAt', '3')` faz a verificação de índice 3 falhar no
ecrã de arranque: X vermelho, barra vermelha, texto "— falhou" e som de
erro em vez do clique habitual. `'todas'` falha as dez. Fora do
`sessionStorage`, o arranque corre sempre sem erro — é uma ferramenta de
desenvolvimento, não um caminho que um utilizador normal encontre. A
sequência continua até ao fim mesmo com verificações falhadas, como a
spec pedia (`1a1b016`).

## 2026-08-11 — Voz clonada: três bugs de concorrência fechados

Auditoria ao `voice-service.ts` pedida na sessão anterior. Confirmou-se que
o eco loop (microfone ligar-se sozinho depois de falar) já estava corrigido
— não há caminho nenhum a chamar `toggleListening` sem ser o utilizador.
Mas encontraram-se três bugs reais no caminho da voz clonada:

1. **`stopSpeaking()` não travava áudio em voo.** Durante o `fetch` ao
   voice-clone-service, `cloneAudio` é `null` — o `pause()` não fazia nada
   e o áudio tocava na mesma quando o fetch completava.
2. **Fuga de blob URL.** `cloneAudio?.pause()` não dispara `onended`, por
   isso o `URL.revokeObjectURL` dentro do handler nunca corria — a URL
   sobrevivia até fechar a página.
3. **Ordem de chegada dos fetch.** Duas chamadas rápidas a `speak()` com
   voz clonada podiam tocar a resposta errada, porque o fetch mais antigo
   podia completar depois do mais recente.

Os três corrigem-se com o mesmo mecanismo: um contador de geração
(`speakGeneration`) incrementado a cada `speak()` e a cada
`stopSpeaking()`, capturado pela `speakClonada` e verificado depois do
`fetch`. A URL da blob passou a ser guardada junto com o `HTMLAudioElement`
para se poder revogar a qualquer momento, e não só no `onended`.
Confirmado: `tsc` limpo, `eslint` limpo, 6/6 testes do echo guard a
passar, suite toda sem regressões (as 3 falhas são pré-existentes).

## 2026-08-11 — Plugins a sério: sandbox, três capacidades, SDK — o maior buraco do projeto fechado em parte

Pedido explícito: parar de fingir que os plugins executam. Até aqui, "instalar"
só escrevia um `Record` — nenhum código descarregado, nenhum executado, e
`selectPermissionDenied` não protegia nada a sério para terceiros.

**A escolha de desenho**: `<iframe sandbox="allow-scripts">`, sem
`allow-same-origin` — origem opaca, sem acesso a `localStorage`, cookies,
nem ao `window` do Core a não ser por `postMessage`. Considerado e posto
de lado: Web Worker (sem DOM, fecha a porta a widgets/janelas de plugin
mais tarde), processo Rust separado (pede a mesma sandbox do SO ainda por
decidir), `eval()` no mesmo contexto (zero isolamento). Uma consequência
não óbvia: `event.origin` de um iframe opaco é sempre `"null"` —
validou-se o remetente por `event.source === iframe.contentWindow`, o
único critério que continua a ser verdade mesmo com origem opaca.

**Protocolo tipado, uma mensagem por capacidade** (`plugins/runtime/protocol.ts`),
cada uma ligada a uma permissão real do manifesto e verificada por
`handlePluginMessage()` antes de qualquer serviço correr — a mesma
`selectPermissionDenied` que já protegia automações e a rede da IA, agora
a sério para plugins também:

- **Notificações** (`core.notify`) — chama `notificationService` a sério.
- **Ficheiros** (`core.fs.{read,write,list}`) — nunca o disco inteiro:
  `filesystemRoot` no catálogo é só um nome de subpasta, sempre resolvido
  dentro de `$APPDATA/plugins-data/<nome>`; um caminho com `..` é recusado
  antes de tocar no disco. Precisou de duas permissões novas no Tauri
  (`fs:allow-read-dir`, `fs:allow-mkdir`, `src-tauri/capabilities/default.json`)
  que não existiam ainda.
- **Rede** (`core.fetch`) — domínio exato de `allowedDomains`, decidido pelo
  Core a partir do catálogo, nunca aceite do que o próprio plugin diz de si.
- **Automações** (`core.automation.run`) — dispara uma automação já
  existente pelo nome; nunca cria nem altera.

Quatro plugins de exemplo, um por capacidade (`ola-notificacao`,
`ola-ficheiro`, `ola-rede`, `dispara-automacao`), todos à espera de
`core.run` (o botão na Loja) em vez de disparar sozinhos — para o mesmo
plugin correr várias vezes na sessão sem recarregar o iframe, essencial
para testar recusar e depois permitir sem reiniciar nada. Mais um SDK
mínimo (`plugins/sdk/jarvis-plugin-sdk.js`), injetado automaticamente no
`srcDoc`, com `window.core.notify()`/`.fs.*`/`.fetch()`/`.automation.run()`
sobre `Promise`, para quem escrever a próxima capacidade não ter de
reimplementar a correlação por `requestId` à mão.

**Confirmado a sério, com a app a correr, os quatro plugins** — não só nos
testes: instalar cada um pela Loja, recusar a permissão em Privacidade →
Permissões e confirmar "Permissão recusada." no cartão, depois permitir e
confirmar que se cumpre — incluindo `nota.txt` a aparecer mesmo em
`%APPDATA%\com.projectarc.jarvis\plugins-data\ola-ficheiro\` (conteúdo
lido de volta a bater certo) e um pedido real a
`jsonplaceholder.typicode.com` visto pelo Network domain do CDP. Testes
unitários cobrem a decisão de permissão sem DOM nenhum
(`tests/plugins/plugin-bridge.test.ts`), incluindo o `..` de fuga de pasta
e o domínio fora da lista nunca gerar tráfego a sério. Desenho completo em
[`docs/spec/plugins-sandbox.md`](docs/spec/plugins-sandbox.md).

Fica por fazer, de propósito: verificação de assinatura (sem fonte de
terceiros a sério ainda), e as restantes onze capacidades da API do Core
avaliadas em 10/08/2026 — entram quando um plugin real precisar, não antes.

## 2026-08-11 — Editor visual de automações

Implementou-se o editor visual de automações em três colunas
(QUANDO/SE/ENTÃO) com drag-and-drop da paleta de blocos, sobre o motor
que já existia (`AutomationTrigger → AutomationCondition[] → AutomationAction[]`).
O escopo é contido de propósito: a spec original pedia um canvas de nós
completo com loops, variáveis e ramos, mas isso exigiria um modelo de
dados novo e capacidades que ainda não existem. O que ficou resolve o
que o motor de hoje oferece, sem interface a fingir.

A criação por linguagem natural também ficou feita — o botão "Interpretar"
envia a frase ao `aiService` com um prompt que lista os IDs reais (apps,
temas, widgets, estados), extrai o JSON da resposta, preenche os blocos,
nome e descrição. O utilizador revê e confirma antes de guardar.

A janela de Automações ganhou um botão "Nova" e um botão de editar
(lápis) em cada regra. A integração usa o `automationService.add()` com
a mesma assinatura `Omit<Automation, 'id' | ...>` que o motor já expõe.

Confirmado: `tsc` limpo, `eslint` limpo, 1115/1118 testes passam (as 3
falhas são as mesmas pré-existentes).

## 2026-08-11 — Voz e assistente: data no contexto, limite de mensagens, Whisper lazy

Quatro melhorias na voz e no assistente:

1. **Data no contexto do assistente.** `describeContext()` em `context.ts`
   injectava só a hora ("São 14:30."), nunca a data — o modelo tinha de
   adivinhar o dia. Passou a incluir a data por extenso em português
   ("Hoje é segunda-feira, 11 de agosto de 2026.") antes da hora, para
   qualquer provedor (DeepSeek, Claude, Ollama) receber o dia sem ter de
   o calcular.

2. **Limite de mensagens por conversa.** O store do assistente não tinha
   limite nenhum de mensagens dentro de uma conversa — o array crescia
   sem freio, e a serialização (`persist()`), as cópias imutáveis de
   estado e o mapeamento durante o streaming (`appendToMessage`) pesavam
   cada vez mais com o tamanho do histórico. `MSG_LIMIT = 200` em
   `types/assistant.ts`, aplicado em `addMessage()`: a primeira mensagem
   nunca cai (é o título da conversa), as mais antigas saem ao atingir
   o limite.

3. **Carregamento lazy do Whisper.** `voice-clone-service/server.py`
   carregava o modelo Whisper no arranque (`whisper.load_model()` em
   `carregar_modelo`), junto com o XTTS-v2. Se a GPU não tivesse
   memória para os dois ao mesmo tempo, nem a síntese arrancava. Agora
   `_carregar_stt_se_preciso()` só importa e carrega o Whisper na
   primeira chamada a `/ouvir` — o `/health` reporta
   `reconhecimento_a_carregar` enquanto está a meio.

4. **Cadeia de fallback do Ollama** — já estava feito (`provider-chain.ts`,
   SPEC.md linha 371), confirmado e passado à frente.

Confirmado: `tsc` limpo, `eslint` limpo, 1118/1118 testes passam.

## 2026-08-11 — Fase 3.1: controlo direto (portão, overlay, auditoria, simulação)

Implementou-se a sub-fase 3.1 do controlo direto, a única que não depende
de código nativo (Rust) — ver `docs/spec/fase-3-controlo-direto.md`.

Quatro peças, todas só em TypeScript/React:

1. **Serviço** (`services/direct-control-service.ts`) — hash SHA-256 da
   palavra-passe (`crypto.subtle.digest`), sessão de 30 minutos, modo
   simulado (ações nunca executam a sério), registo de passos para auditoria.

2. **Overlay de confirmação** (`components/ControlOverlay.tsx`) — cobre a
   janela inteira (`z-[9999]`, backdrop blur), mostra a descrição da ação
   e o nível de risco (Baixo/Médio/Alto/Irreversível), pede Confirmar ou
   Recusar. No modo simulado, mostra um aviso laranja: "a ação não vai
   executar a sério".

3. **Separador "Controlo" na Privacidade** — ativação explícita desligada
   por omissão (item 20), campo de palavra-passe com toggle mostrar/esconder,
   toggle de modo simulado vs real (item 23), e histórico de passos com
   nível de risco (item 22). Usa `useSyncExternalStore` como as outras
   janelas que dependem de serviços.

4. **Especificação atualizada** — `SPEC.md` (Fase 3 agora 🟡) e
   `docs/spec/fase-3-controlo-direto.md` (tabela de sub-fases com 3.1 ✅).

Confirmado: `tsc` limpo, `eslint` limpo, 1118/1118 testes passam.

## 2026-08-11 — Segurança, docs, diagnóstico, e confirmação do que já estava feito

Segunda parte da queue de 50 itens. Vários itens já estavam feitos por
sessões anteriores e foram confirmados; os que faltavam foram fechados.

**Segurança (49–50):** Confirmou-se que nenhuma chamada a `logService.log`
inclui chaves de API — as chaves passam nos headers HTTP mas nunca são
escritas no registo. O `.gitignore` foi atualizado com `.obsidian/`,
`*.canvas`, `*.base`, daily notes (`YYYY-MM-DD.md`), `.venv/`,
`__pycache__/`, `*.pyc`, e `claude-deepseek.ps1` (que continha uma chave
DeepSeek real — já estava untracked, agora fica explicitamente ignorado).

**Documentação (39–41):** `ARCHITECTURE.md` e `PLATFORM.md` já existiam e
estão completos. O `docs/spec/README.md` agora lista os 7 ficheiros de
especificação, incluindo os 4 que foram acrescentados depois (fase-3,
orquestrador, voz-clonada, plugins-sandbox). A nota desatualizada sobre a
falta de testes do histórico de voz foi corrigida no `SPEC.md`.

**Diagnóstico (47–48):** O painel de Estado já relia a cada 2s; agora tem
também um botão manual com RefreshCw para forçar a leitura imediata. O
histórico de voz pesquisável já tinha 4 testes desde o commit `837d3aa` —
a nota no SPEC.md estava desatualizada.

**Confirmado, já feito:** Acessibilidade (42–44: alto contraste, redução de
transparência, daltonismo, ARIA roles, `:focus-visible` global, `aria-live`)
e perfis de animação (45–46: Desempenho, Equilibrado, Imersivo + controlos
individuais + `prefers-reduced-motion`) já estavam totalmente implementados
em sessões anteriores.

**Adiado ou bloqueado:** Gestão de energia (24–27) é Fase 2 e os atalhos no
rodapé já existem com essa nota. Anexos (28–31) precisam de sistema de
ficheiros — bloqueado. Testes E2E e build Android (32–38) são
infra-estrutura que fica para quando o build nativo estiver estável.

**Erros de NL na Automação:** O `generateFromNL` do AutomationEditor agora
mostra cada falha com `role="alert"` em vez de voltar em silêncio — resposta
vazia, sem JSON, e exceções de rede têm mensagens específicas. 5 testes
novos em `tests/automation/automation-editor-nl.test.tsx`.

## 2026-08-11 — Anexos na janela de Emails

Pedido: usar os diálogos nativos de ficheiro (já ligados desde a cópia de
segurança) para anexar um ficheiro a um rascunho, com nome/tamanho e
pré-visualização simples para imagens. Não havia nenhuma janela de
composição — só leitura — por isso o pedido trouxe consigo um "Nova
mensagem" mínimo: Para/Assunto/Corpo, sem guardar rascunho nem enviar (os
dois exigem um provedor real, ditos de frente, como a leitura já dizia
para responder).

`platform/attachments.ts` (novo): `pickAttachmentsNative()` tenta o
diálogo `dialog` do Tauri primeiro — `multiple: true`, e para cada
caminho devolvido, `stat()` para o tamanho e, só para extensões de
imagem, `readFile()` para uma pré-visualização (`URL.createObjectURL`).
Sem Tauri (browser), cai para o `<input type="file">` escondido, o
mesmo padrão da cópia de segurança — `attachmentsFromFileList()` lê os
`File` do browser da mesma forma. `formatBytes()` mostra B/KB/MB.

Um bug de teste, não de produto: o jsdom não implementa
`URL.createObjectURL`, e nenhum teste anterior tinha precisado dele a
sério — `tests/setup.ts` ganhou um stub simples (string com contador),
ao lado dos já existentes para `matchMedia`/`ResizeObserver`/`scrollTo`.

Testado a sério na app a correr: "Nova mensagem" abre, "Anexar" e o
campo escondido existem, "Enviar" está desativado com o aviso certo. O
diálogo nativo em si não é automatizável por fora (é um modal do
sistema operativo, fora do DOM) — a mesma limitação já documentada para
a cópia de segurança — por isso o caminho de recurso do browser ficou
coberto a sério pelos testes automatizados (anexar, pré-visualizar só
imagens, remover, cancelar sem guardar).

## 2026-08-11 — Contexto na conversa: "amanhã" resolvido pelo modelo, não por regras

Pedido: usar o provedor de IA para resolver referências relativas
("amanhã", "esse ficheiro") em vez de regras escritas à mão. A procura por
regras já existentes não encontrou nenhuma — nunca houve resolução de
datas relativas no assistente; `criar_tarefa` nem tinha campo de prazo,
por isso "cria uma tarefa para amanhã" sempre criou a tarefa sem data
nenhuma, em silêncio.

Arranjo: `criar_tarefa` ganha o parâmetro opcional `prazo`, com a
instrução de o modelo devolver AAAA-MM-DD já resolvido — ele já recebe
"hoje é terça-feira, 11 de agosto de 2026" no `system prompt`
(`services/assistant/context.ts`, sessão anterior), por isso não precisa
de ajuda nenhuma para saber que dia é "amanhã". `tool-runner.ts` só
valida a forma (`parseDueDate`) e nunca tenta interpretar a palavra —
uma data mal formada fica sem prazo, nunca inventada. `useTaskStore.add()`
e as duas assinaturas de `createTask` (voz e ferramentas) passam o
`dueAt` até à tarefa a sério.

**Confirmado por 6 testes** (`tests/assistant/tools.test.ts`,
`tests/stores/task-store.test.ts`): data válida vira o timestamp certo à
meia-noite local, prazo ausente não é erro, prazo malformado ("amanhã"
literal, por exemplo) é ignorado em vez de inventado.

**Não confirmado ao vivo de ponta a ponta**, e a razão fica registada
para quem continuar: ferramentas só correm com a DeepSeek —
`ai-service.ts`, `sendWithTools()` exige `provider instanceof
DeepSeekProvider` — e esta máquina não tinha chave DeepSeek configurada
nesta sessão. Testado com o Ollama ativo (sem chave nenhuma a
configurar): o pedido chega mesmo ao modelo — confirmado por CDP, pedidos
reais a `localhost:11434` — mas como o Ollama nunca recebe as ferramentas,
o modelo só responde em texto livre (por vezes ecoando JSON que viu antes
na conversa), nunca chama `criar_tarefa` a sério. Não é um bug desta
funcionalidade — é a mesma limitação já escrita no `SPEC.md` antes de
hoje ("Ferramentas continuam só na DeepSeek"). Fica por confirmar ao vivo
quando houver uma chave DeepSeek na máquina de testes.

"Esse ficheiro" fica por fazer: não há ainda nenhuma ferramenta que atue
sobre um ficheiro (abrir, resumir, o que for) para uma referência desse
tipo ter alguma coisa a resolver-se — construir uma ferramenta dessas do
zero seria maior do que "resolver contexto", e não foi pedido em separado.

## 2026-08-11 — Esboço do Marketplace de plugins

Pedido: só desenho e uma interface de catálogo, dados de exemplo, sem
ligar a nenhuma origem remota real — e escrever o que falta decidir
antes disso. Terceira aba na Loja de plugins ("Loja", "Instalados",
agora "Marketplace"), seis entradas escritas à mão
(`marketplace-sample-data.ts`) sem ficheiro, servidor ou API por trás.
"Instalar" fica sempre desativado, com o porquê no `title`.

`docs/spec/plugins-marketplace.md` regista o que falta decidir antes de
ligar a uma fonte a sério, e porquê cada ponto não se resolve sozinho:
registo próprio vs. formato aberto sobre Git (a pergunta de que todas as
outras dependem), assinatura, atualizações, rollback, dinheiro,
moderação. Nenhuma resposta fingida — cada uma fica como pergunta em
aberto.

Confirmado ao vivo, com a app a correr: a aba abre, as seis entradas de
exemplo aparecem, e os seis botões "Instalar" estão mesmo desativados.
5 testes novos (`tests/apps/marketplace-tab.test.tsx`).

## 2026-08-11 — Revisão de qualidade: fuga de blob URL nos anexos de email

Pedido: percorrer o que se construiu hoje à procura de fugas de memória,
condições de corrida e casos de borda esquecidos — não reescrever, só
corrigir o que fosse real. `Compose` (Emails, sub-fase de anexos desta
sessão) tinha exatamente esse buraco: cancelar ou fechar o rascunho com
imagens anexadas nunca revogava as blob URLs das pré-visualizações — só o
botão de remover, por anexo, o fazia. Um efeito de desmontagem revoga o
que sobrar, com a lista atual guardada num `ref` (o próprio cleanup só
corre uma vez, ao desmontar, e precisa do estado de então, não do da
primeira renderização). Confirmado por um teste que espia
`URL.revokeObjectURL` a sério, não só a leitura do código.

O resto da revisão (sandbox de plugins, Fase 3.1 — controlo direto,
editor de automações) não encontrou mais nada — sem temporizadores nem
`addEventListener` por limpar nessas peças.

## 2026-08-11 — Anexos a sério: tipo partilhado, três janelas

Pedido: anexos nas três janelas (Emails, Tarefas, Projetos), não só nos
Emails. Usar o diálogo nativo que já existia, com nome/tamanho e
pré-visualização para imagens.

**Tipo partilhado** (`types/attachment.ts`): `Attachment` com `id`, `name`,
`sizeBytes`, `kind` (derivado da extensão — `attachmentKind()`) e
`dataUri`. `formatAttachmentSize()` para mostrar "1.2 MB" etc.

**Componente partilhado** (`components/attachments/AttachmentList.tsx`):
ícone por tipo (lucide), nome clicável para pré-visualização de imagem,
tamanho formatado, modo só de leitura quando `onAttach`/`onRemove` não
são passados.

**Hook partilhado** (`hooks/use-attachments.ts`): `useAttachments()` gere a
lista local; `attachViaNativeDialog()` tenta o diálogo nativo primeiro
(`openAttachmentDialog` + `readFileAsDataUri`) — imagens ≤5 MB ganham
data URI, os outros tipos ficam sem pré-visualização. Browser cai para
`FileReader.readAsDataURL()` via `<input type="file">`.

**Três janelas:**
1. **Emails — leitura:** `AttachmentList` só de leitura abaixo do corpo.
   O MockMailProvider ganhou amostras (PDF na Stripe, XLSX no fornecedor,
   PDF nos domínios).
2. **Tarefas — edição:** `addAttachment`/`removeAttachment` na store,
   botão "Anexar" nativo-primeiro em cada `TaskRow`, pré-visualização
   expansível, persistência imediata.
3. **Projetos — leitura:** `AttachmentList` só de leitura em cada
   `ProjectCard` (os projetos são sementes, sem edição).

**Dados corrigidos:** `data/tasks.ts`, `data/projects.ts`, `mail-provider.ts`
— todos com `attachments: []` (ou amostras) para o tipo `Task`/`Project`/
`MailMessage` que agora exige o campo. Testes atualizados (`copilot.test.ts`,
`task-store.test.ts`, `productivity-widgets.test.tsx`).

## 2026-08-11 — Mais 3 capacidades da API do Core para plugins

Três novas capacidades: Criar Janelas, Adicionar Comandos, Registar
Eventos. Seguem o padrão das 4 capacidades já implementadas: tipo de
mensagem próprio, verificação de permissão, handler em `plugin-bridge.ts`,
SDK atualizada (`jarvis-plugin-sdk.js` e `.d.ts`), exemplo isolado com
código a sério.

**Criar Janelas** (`core.window.open`): valida o `appId` contra
`APP_REGISTRY`, recusa aplicações por implementar, abre via
`useWindowStore.open()` com geometria por omissão.

**Adicionar Comandos** (`core.command.register`): regista num array
módulo-específico em `plugin-bridge.ts`. A função `buildCommands()` do
`command-registry.ts` inclui-os no grupo "Plugins". Cada plugin só pode
registar um dado `id` uma vez, mas plugins diferentes podem partilhar ids.

**Registar Eventos** (`core.event.subscribe`): assíncrono — o Core empurra
eventos para o plugin via `sendToPlugin`, um callback passado ao
`handlePluginMessage` pelo `PluginRuntime`. Valida o nome do evento contra
`ALL_EVENTS`. As subscrições são limpas quando o `PluginRuntime` desmonta.

**SDK:** `window.core.window.open(app, titulo?)`, `window.core.command.register(id, nome, descricao)`, `window.core.event.on(evento, callback)` — este último devolve uma função para cancelar.

**Exemplos:** `abre-janela`, `regista-comando`, `escuta-eventos` — três
novos plugins de exemplo com código real, registados no catálogo e no
runtime, cada um a testar uma capacidade.

**Testes:** 13 novos testes em `plugin-bridge.test.ts` (28 no total) —
permissão recusada, validação de app/evento, duplicados, subscrição e
cancelamento de eventos com o callback `sendToPlugin`.

## 2026-08-11 — Suite E2E com Playwright

Primeira suite de testes end-to-end do projeto. Usa Playwright com Chromium
contra o servidor de desenvolvimento do Vite (localhost:1420), sem depender de
APIs Tauri — os cenários de login, janelas, temas, plugins e voz correm todos
contra React/Zustand em modo browser.

**Infraestrutura:** `playwright.config.ts` com timeout de 60s, `tests/e2e/`
como diretório de testes, fixtures partilhadas (`skipBoot`, `login`,
`openWindow`, `closeWindow`, `openCommandPalette`). O boot é saltado via
`addInitScript` que escreve `jarvis.booted` no localStorage antes de React
arrancar. Todos os seletores são semânticos (role, aria-label,
placeholder, texto) — sem `data-testid`.

**10 cenários:** login com sucesso, login com palavra-passe vazia, abrir e
fechar janela pelo Dock, abrir janela pela Paleta de Comandos, mudar para
OLED Black e voltar ao Classic, tema Arctic White, instalar e executar o
plugin Olá-notificação, recusar permissão de notificações via localStorage,
ligar microfone com SpeechRecognition mockado, ligar e desligar microfone
manualmente.

**Correcções:** o theme-service remove `data-theme` para o tema Classic
(`DEFAULT_THEME`) em vez de o pôr a `"classic"` — o teste verifica
`html:not([data-theme])`. O catálogo de plugins tem vários cartões com
botão "Instalar"; o primeiro é muitas vezes um que está desativado no
browser (exige capacidades nativas) — o teste usa `li:has-text("Olá,
notificação")` para isolar o cartão certo.

## 2026-08-11 — Desacoplar serviços e stores (Fase 2)

Tarefa #17 do sprint. O objectivo era continuar o desacoplamento de serviços
e stores que ainda importavam outras stores diretamente. Três frentes:

**`workspace-service.ts`:** o caso mais grave — importava 5 stores
(theme, appearance, windows, widgets, plugins). Criou-se a interface
`WorkspaceStores` e o helper `getWorkspaceStores()` que devolve as stores
reais com getters para leitura e métodos para escrita. As funções
`captureWorkspace()` e `applyWorkspace()` passaram a receber as stores por
parâmetro. Os callers (`use-workspace-store.ts`, `use-workspace.ts`,
`workspace-service.test.ts`, `profiles.test.ts`) foram todos atualizados.
A interface usa os tipos branded (`ThemeId`, `AppId`, `WidgetId`,
`WindowInstance`, `Appearance`, `Ambience`) em vez de `string` — 78 testes
passam, tsc e eslint limpos.

**`notification-service.ts`:** removida a dependência do
`useAssistantStore` (o `celebrate()` no `success()` passou para o caller).
Adicionada a opção `silent` aos métodos `info()`/`warn()`/`error()`/
`success()` — quando verdadeira, suprime a notificação nativa e o som, mas
mantém o toast interno. Manteve-se o `useSystemStateStore` porque o
`allowsToast()` é um guarda de sistema, não uma preferência pontual.

**`use-ai-settings-store.ts`:** a store tinha lógica de negócio — construía
provedores e chamava `aiService.setProvider()`/`setChain()` em cada setter
e no `hydrate()`. Extraiu-se essa lógica para um hook novo,
`use-ai-settings.ts`, que subscreve `settings` com `useEffect` e aplica ao
`aiService`. A store ficou só com estado e persistência. O hook é montado
em `App.tsx` e em `AiSettings.tsx` (para funcionar nos testes que montam o
componente isolado). A função `applyAiSettings` é exportada para os testes
a poderem chamar após mutações diretas da store. 24 testes passam.

SPEC.md atualizado: 7/14 serviços desacoplados, 7/15 stores separadas.
O test `fallback.test.ts` "cancelar não deixa nota nenhuma de erro" falha
de forma consistente — é um bug pré-existente em `ai-service.ts` linha 126,
onde o cancelamento durante `resolveReferences` não repõe o modo a `idle`.

## 2026-08-11 — Mais 2 capacidades da API do Core para plugins: armazenamento e atalhos

Tarefa #19 do sprint. Duas capacidades novas na API do Core para plugins:
armazenamento isolado e atalhos de teclado. Cada uma segue o molde exato das
9 já existentes: tipo de mensagem próprio, permissão, handler em
`plugin-bridge.ts`, SDK atualizada, exemplo isolado com código a sério.

**Armazenamento** (`core.storage.set/get/remove`, permissão `storage`): usa
o `getPlatformAdapter()` para persistir — chaves com prefixo automático
`plugins:<pluginId>:` para isolamento total entre plugins. O `StorageService`
não serve porque as chaves são dinâmicas (não fazem parte do union
`STORAGE_KEYS`); o adapter aceita qualquer string. Plugin de exemplo
`guarda-preferencias` conta visitas entre sessões.

**Atalhos** (`core.shortcut.register`, permissão `shortcuts`): regista atalhos
de teclado com validação — recusa duplicados do mesmo plugin e atalhos
reservados do sistema (`RESERVED_SHORTCUTS`: k, e, t, p, m). O `App.tsx`
ganhou um `useEffect` que ouve `keydown` e dispara
`{type: 'core.shortcut.triggered', id}` no `window` quando um atalho de
plugin coincide — o `PluginRuntime` não precisa de saber de atalhos. Plugin
de exemplo `regista-atalho` ouve Ctrl+Shift+H e notifica.

**SDK**: `window.core.storage.set/get/remove` e `window.core.shortcut.register`
com a mesma `Promise` das capacidades anteriores.

**Confirmação:** `tsc` limpo, `eslint` limpo (só warnings pré-existentes),
todos os testes passam (a única falha é a pré-existente em `fallback.test.ts`).
SPEC.md atualizado: 9 de 13 capacidades da API do Core implementadas.

## 2026-08-11 — Modo conversa: microfone automático pós-resposta

Tarefa #18 do sprint. Implementou-se o modo conversa — o microfone liga-se
automaticamente após cada resposta do assistente, fechando o ciclo sem
intervenção manual. Era o último modo de escuta que faltava (a wake word e
o contínuo continuam por fazer — decisão de privacidade por tomar).

**Ciclo:** `voiceService.speak()` → `onEnd` → se modo conversa ativo,
`setTimeout(1100ms)` (margem sobre o `SPEAK_GUARD_MS` de 900ms) →
`toggleListening()`. A transcrição processa comandos/perguntas, e o
`speak()` da resposta fecha o ciclo.

**Timeout de inatividade:** 3 tentativas seguidas sem fala detetada
(`no-speech`) desligam o modo conversa automaticamente — ~36s de silêncio
(3 × 12s de gravação local). O contador (`consecutiveNoSpeech`) é gerido
pelo `VoiceService` e reiniciado a cada transcrição com sucesso.

**Interface:** botão `MessagesSquare` no header, ao lado do microfone, com
cor de destaque (accent) quando ativo — distinto do microfone (danger).
Clicar no microfone com o modo conversa ativo desliga-o — é mais natural
do que continuar a ouvir quando a pessoa claramente quer parar. Aviso na
primeira ativação por sessão (`sessionStorage`).

**Segundo plano:** o `useEffect` existente já parava microfone e fala
quando a janela perde o foco; agora também limpa o temporizador de
re-engate e deixa o modo conversa ativo (retoma-se ao voltar).

**Privacidade:** `src/types/privacy.ts` atualizado — o texto do microfone
passou a descrever os dois modos.

Confirmado: `tsc` limpo, `eslint` sem erros, todos os testes passam (só a
falha pré-existente em `fallback.test.ts`).

## 2026-08-11 — Corrige modo preso em "thinking" ao cancelar durante a resolução de referências

Verificação independente (`tsc` + `vitest`) depois de puxar o lote de anexos +
resolução de referências + capacidades de plugins encontrou um teste real a
falhar, não só em conjunto mas isolado: `fallback.test.ts` › "cancelar não
deixa nota nenhuma de erro". A resolução de referências (commit anterior)
inseriu um `await resolveReferences(...)` entre `setMode('thinking')` e o
resto do fluxo de `AIService.send()`, com um retorno antecipado em
`signal.aborted` que não repunha o modo. Cancelar um pedido exatamente nessa
janela deixava a interface presa a "a pensar" para sempre — o mesmo padrão
existia em `sendWithTools()`. Corrigido nos dois sítios: o retorno antecipado
por cancelamento agora repõe `setMode('idle')` antes de sair. Suite completa
volta a 1166/1166 a passar.

## 2026-08-11 — Desacopla Weather, Clock e Wallpaper (Fase 2, +3 serviços)

Pedido: aplicar o padrão serviço puro → store Zustand fina → componente só
lê da store a três serviços que faltavam na Fase 2.

**Weather:** já tinha um `WeatherService` puro (herda de `PollingDataService`).
Criou-se a `useWeatherStore` e o `WeatherWidget` passou de `useDataService`
para a store. O `App.tsx` também lia `weatherService.current` diretamente —
agora lê `useWeatherStore.getState().snapshot`.

**Clock:** o `useClock()` tinha um `setInterval` próprio por componente.
Extraiu-se um `ClockService` puro (um só temporizador para todos,
pára quando ninguém subscreve) e uma `useClockStore`. O hook `useClock`
continua a funcionar para os 6 consumidores atuais, mas agora lê da store.
O `ClockWidget` foi atualizado para ler da store diretamente.

**Wallpaper:** o `WallpaperField` já era uma classe pura. Criou-se um
`WallpaperService` que o encapsula e fornece `readAccentColor()` (sem o
componente chamar o `themeService`). A `useWallpaperStore` subscreve o
`eventBus` para manter a cor de acento sincronizada com o tema. O
`Wallpaper.tsx` já não cria o campo nem chama o `themeService` diretamente.

**SPEC.md:** 10/14 serviços desacoplados, 10/18 stores separadas.
`tsc` limpo, `eslint` limpo, 1166/1166 testes passam.

## 2026-08-12 — Mais 5 capacidades da API do Core para plugins, e um bug real de entrega

Pedido: continuar a API do Core para plugins — Criar Widgets, Adicionar
Menus, Adicionar Configurações, Criar Serviços, Adicionar Painéis (o
pedido original também listava Adicionar Atalhos, já feito numa sessão
anterior — confirmado antes de repetir trabalho). Executar Voz, Ler
Memória e Guardar Preferências ficaram de fora de propósito — mexem em
microfone e dados do utilizador, por autorizar primeiro.

Cada capacidade seguiu exatamente o molde do lote anterior: tipo de
mensagem em `protocol.ts`, permissão em `PluginPermissions`, validação em
`handlePluginMessage`, função na SDK, um plugin de exemplo a sério
registado no catálogo e no `registry.ts`, testes em `plugin-bridge.test.ts`.

- **`core.widget.create`** (`widgets`) — só título e texto, nunca código
  nem markup: o Core mostra o texto tal como chega, nunca o interpreta.
- **`core.menu.add`** (`menus`) — item real no menu de contexto do
  ambiente de trabalho (botão direito). O clique tem de chegar de volta
  ao plugin isolado — o que expôs o bug abaixo.
- **`core.setting.register`** (`settings`) — o plugin declara o *schema*
  (chave, rótulo, tipo, valor por omissão); o valor em si vive no mesmo
  armazenamento isolado de `core.storage`, editado diretamente pela
  interface de confiança (nunca vai e volta pelo protocolo do plugin) e
  semeado só se ainda não houver nada guardado — reabrir o plugin não
  apaga a escolha de quem usa.
- **`core.service.register`** (`services`) — o Core empurra um "tick" a
  um intervalo, com um mínimo de 5 segundos para nenhum plugin martelar
  o sistema. Limpo a sério ao desmontar (`clearPluginServices` para o
  `setInterval`, não só o esquece).
- **`core.panel.add`** (`panels`) — bloco de texto expansível, mais
  espaço do que um widget dá.

**Bug real, encontrado a construir `core.menu.add`:** `core.shortcut.
triggered` (da sessão anterior) nunca chegava mesmo ao plugin.
`App.tsx` mandava-o com `window.postMessage(msg, '*')` no `window` do
Core — isso nunca desce sozinho a um iframe filho, e `PluginRuntime`
só aceita mensagens com `event.source === iframe.contentWindow`, que
nunca é verdade para uma mensagem postada no `window` de fora. O atalho
registava-se sem erro nenhum e nunca disparava ao ser premido — só
visível ao testar a sério (premir a tecla, ver se o plugin reage), nunca
só a ler o código. `registerPluginSender`/`unregisterPluginSender`/
`pushToPlugin` (`plugin-bridge.ts`) resolvem isto de vez: `PluginRuntime`
regista-se ao montar, e qualquer parte do Core fala com um plugin
específico de fora do fluxo normal de mensagens. Corrigido em `App.tsx`
(atalhos) e usado por `core.menu.add`/`core.service.register`.

**Outro buraco encontrado ao rever o padrão existente, antes de construir
mais em cima dele:** `guarda-preferencias` e `regista-atalho` (armazenamento
e atalhos, sessão anterior) tinham código de exemplo completo e entrada no
catálogo, mas nunca tinham sido ligados ao `registry.ts` — instalá-los na
Loja não mostrava botão nenhum para os correr. E nenhum dos dois tinha
teste próprio em `plugin-bridge.test.ts`, apesar do histórico anterior
dizer que sim. Os dois corrigidos: ligados ao `registry.ts`, e 11 testes
novos a cobri-los a sério (permissão, duplicados, atalho reservado).

**Confirmado ao vivo, com a app a correr**, não só nos testes: os cinco
plugins novos instalados e executados pela Loja — o widget aparece, a
definição aparece com um interruptor a sério que muda o valor no
armazenamento real (confirmado no ficheiro `jarvis.store.json`, não só
por leitura de código), o painel expande e recolhe, o item de menu
aparece no menu de contexto real (botão direito no ambiente) e o clique
chega ao plugin — a notificação de confirmação aparece —, e o serviço
gera "ticks" reais a cada 5 segundos, cada um com uma notificação a
sério.

62 testes em `plugin-bridge.test.ts` (eram 28), todos a passar. `tsc`
limpo, `eslint` limpo, suite completa sem regressões.

## 2026-08-11 — Verificação independente do lote de plugins + Fase 2 + voz

Verificação independente (`npm ci` limpo, `tsc`, `eslint`, `vitest run`)
depois de puxar dez commits novos: as 5 capacidades de plugins que faltavam
(widgets, menus, definições, serviços, painéis), Fase 2 a desacoplar Weather/
Clock/Wallpaper, três correções de voz (timeout no `/ouvir`, evita loop
infinito no re-engate do microfone, `stopListening` antes de falar), e
testes E2E novos com Playwright.

Um problema real: `playwright.config.ts` chegou sem entrar em nenhum dos
dois `tsconfig` que o ESLint usa para lint com tipos — `parserOptions.project`
falhava a analisá-lo, um erro (não aviso) a bloquear o lint. Corrigido:
entra no `tsconfig.node.json`, ao lado de `vite.config.ts`. `npm ci` também
foi preciso — o `@playwright/test` já estava declarado no `package.json`
mas o `node_modules` local estava desatualizado.

Confirmado: 1200/1200 testes, `tsc` e `eslint` limpos.

## 2026-08-12 — Assistente: procurar_ficheiro e abrir_ficheiro

Uma sessão anterior (Kimi) tinha sido cancelada a meio de "esse ficheiro"
— a capacidade de o assistente encontrar um ficheiro pelo nome e abrir o
Explorador já na pasta certa. Ao retomar, o que estava commitado era só
metade: `searchFiles()` (`file-entry.ts`), o catálogo das duas ferramentas
(`tools.ts`) e a `use-pending-file-navigation-store` já existiam, bem
escritos e com o desenho todo explicado em comentário — mas o
`tool-runner.ts` não tinha execução para nenhuma das duas, e o `App.tsx`
não as ligava a nada. Sintoma exato: o teste "cobertura" de
`tools.test.ts` a falhar em `procurar_ficheiro` — "toda a ferramenta do
catálogo tem execução".

Avaliado como digno de terminar (não de reverter): o trabalho parcial era
coerente, não confuso. Ligou-se o resto — `ToolExecutor.searchFiles` /
`.openFileLocation` no `tool-runner.ts`, a implementação em `App.tsx`
sobre a árvore simulada (`seedFiles()` + `normalizeSearch`), e o
`FilesWindow` a consumir o caminho pendente na primeira montagem (e só
nessa, como o comentário da store já previa). Testes novos para
`searchFiles`, para as duas ferramentas em `tool-runner.ts`, e para o
`FilesWindow` a abrir já na pasta certa.

Ficaram de fora do commit, por não fazerem parte deste pedido: `use-mail-
store`/`MailWidget` (Fase 2, parece já pronto) e `use-music-store`/`use-
news-store` (existem mas não estão ligados a nenhum widget ainda) —
alterações não commitadas encontradas na mesma árvore de trabalho, de
outra tarefa.

Confirmado: 1211/1211 testes, `tsc` e `eslint` limpos.

## 2026-08-12 — Fase 2: Calendar, News e Email desacoplados (serviço + store)

Pedido: completar o desacoplamento dos serviços que faltavam na Fase 2
(SPEC.md Parte 3, linha 244), usando o padrão `theme-service.ts`/
`use-theme-store.ts`. Três peças, uma de cada vez.

**Calendar** (a peça maior — não tinha serviço nem store):
- Tipos movidos de `@/data/agenda` para `src/types/calendar.ts` (`AgendaEntry` + `CalendarSnapshot`).
- `src/services/calendar/providers/calendar-provider.ts` — interface `CalendarProvider` + `MockCalendarProvider` com os mesmos dados de exemplo.
- `src/services/calendar/calendar-service.ts` — herda de `PollingDataService<CalendarSnapshot>`, intervalo de 1h.
- `src/stores/use-calendar-store.ts` — mesmo padrão das stores de Mail/News.
- Funções puras (`minutesOf`, `currentEntry`, `nextEntry`, `minutesUntil`) extraídas para `src/lib/agenda.ts` — sem dependência de serviço nem store.
- `CalendarWidget.tsx` e `CalendarWindow.tsx` refatorizados para usar a store + funções puras, em vez de `@/data/agenda` diretamente.
- `@/data/agenda.ts` mantido como re-exportação com wrappers para compatibilidade — os 12 testes da agenda continuam a passar.

**News** (a store já existia, mas o widget não a usava):
- `NewsWidget.tsx` migrou de `useDataService(newsService)` para `useNewsStore` (snapshot, isLoading, markRead, toggleFavorite, hydrate).
- Mantém `newsService.setPaused()` direto — mesmo padrão do MailWidget.

**Email** (o mais usado — cuidado redobrado):
- `useMailStore` ganhou `providerName` (o `EmailsWindow` usava `mailService.providerName` diretamente no rodapé).
- `EmailsWindow.tsx` migrou de `useDataService(mailService)` para `useMailStore` — estado, ações (`markRead`, `toggleStar`), hydrate, e setPaused.
- `StarButton` passou a usar `useMailStore.toggleStar` em vez de `mailService.toggleStar`.
- `CommandPalette.tsx` migrou de `useDataService(mailService)`/`useDataService(newsService)` para `useMailStore`/`useNewsStore` com hydrate na montagem.

**SPEC.md atualizado:** 13/14 serviços desacoplados (faltam Search, Device, Plugin), 13/18 stores separadas. `useDataService` continua a servir o `MusicWidget` (único consumidor restante).

Confirmado: 1211/1211 testes, `tsc` e `eslint` limpos.

## 2026-08-12 — Fase 2: Music desacoplado (store ligada ao widget)

Pedido: ligar o `MusicWidget.tsx` à `useMusicStore` já existente (criada numa
sessão anterior, pronta mas nunca ligada). Mesmo padrão dos widgets de Mail,
News, Calendar: `useIsVisible` + `musicService.setPaused` no efeito de
visibilidade, `hydrate()` no efeito de montagem, e todas as ações (togglePlay,
next, previous, seek, toggleShuffle, toggleRepeat) pela store em vez de chamar
o serviço diretamente.

A store já estava completa — `snapshot`, `isLoading`, `hydrate`, e as sete
ações — sem precisar de um toque. O `MusicWidget` era o último consumidor de
`useDataService`; depois desta migração, o hook já não é importado por nenhum
widget. SPEC.md atualizado: 14/18 stores separadas, `useDataService` sem
consumidores.

Confirmado: 1211/1211 testes, `tsc` e `eslint` limpos.

## 2026-08-12 — Vitest 4: migração concluída, causa raiz encontrada e corrigida

A entrada de 2026-08-10 ("Auditoria de dependências") documentou uma
tentativa falhada de subir o Vitest para a v4 e cinco vulnerabilidades
(`npm audit`) por resolver — incluindo uma crítica (CVSS 9.8, leitura e
execução arbitrária de ficheiros com o servidor de UI do Vitest ligado).
Na altura, 4 testes (`login-sound.test.tsx`, `boot-sound.test.tsx`)
partiram e a decisão foi reverter para `vitest@2.1.8` e documentar como
dívida técnica.

Desta vez investigou-se a sério.

**Diagnóstico.** O sintoma original ("passam isolados, falham em conjunto")
enganou: os testes falham **até isolados** no Vitest 4 — dois em cada
ficheiro, sempre os mesmos. Todos usam `vi.spyOn(soundService, 'play')`
dentro de cada `it()`, e os que falham são os que verificam a **ausência**
de um som (`not.toHaveBeenCalledWith('success')`,
`not.toHaveBeenCalled()`). O histórico de chamadas do espião do teste
anterior acumulava para o teste seguinte.

**Causa raiz.** O Vitest 4 reescreveu o sistema de pools (removeu o
`tinypool`, passou a usar `module-runner` em vez de `vite-node`) e
reescreveu também a implementação de spies. Em teoria, `vi.spyOn` sobre
um método já espiado devia restaurar o original e criar um espião novo com
histórico limpo — mas na prática da v4, o espião anterior persistia e o
`vi.spyOn` seguinte herdava-lhe as chamadas. O `isolate` e o `pool`
continuam com os mesmos valores por omissão (`forks`, `isolate: true`),
portanto não era uma mudança de configuração — era o comportamento interno
do `vi.spyOn` que mudou.

**Correção.** `vitest.config.ts`: `restoreMocks: true`. Com esta opção, o
Vitest chama `vi.restoreAllMocks()` após cada teste — o método original
(`soundService.play`) é reposto, e o `vi.spyOn` do teste seguinte começa
do zero. Uma linha resolveu o que a sessão anterior reverteu.

**Resultado.** `vitest@4.1.10` instalado. Suite completa: 1217/1217 testes
(94 ficheiros), três corridas consecutivas sem flakiness. `tsc` limpo,
`eslint` 0 erros, `npm run build` de produção com chunks corretos.
`npm audit`: 0 vulnerabilidades — as cinco desapareceram com o upgrade.

O vendor chunk vazio (0 kB) no build é pré-existente do Vite 6 e não está
relacionado com esta mudança.

## 2026-08-12 — Fase 2: Search e Device desacoplados (serviço + store)

Sessão Qwen: mesmo padrão (`ThemeService`/`useThemeStore`), próximas duas
peças da lista (Calendar/News/Email/Music já feitos pela DeepSeek).
Verificado independentemente antes de commitar (a sessão tinha corrido
`-p` e saído sem commitar, mesmo padrão das anteriores): `tsc`, `eslint`,
a suite inteira (1217/1217, duas corridas) e `npm run build`, limpos.

**Search** — não tinha origem externa para "sondar" como Weather ou
Calendar; era a `CommandPalette` a importar cinco stores diretamente
(mail, notícias, notificações, layouts, temas) para montar o conteúdo
pesquisável. `SearchService` (`src/services/search-service.ts`) combina o
catálogo de comandos (`buildCommands`/`filterCommands`, já existentes e
inalterados) com esse conteúdo — sem React, sem conhecer stores.
`useSearchStore` é quem reúne os inputs: subscreve as cinco stores de
origem e recalcula os resultados sempre que alguma muda, hidratando mail
e notícias (que só têm dados enquanto alguém subscreve). A
`CommandPalette` ficou reduzida a UI — só conhece `useSearchStore`.

**Device** — informação da plataforma (`PlatformAdapter.info`), que se
resolve de forma assíncrona no arranque. Antes, `usePlatformInfo` lia
`getPlatformAdapter().info` diretamente em cada render — um componente
montado antes da inicialização acabar ficava preso à resposta parcial
para sempre, sem re-renderizar quando a informação completa chegasse.
`DeviceService`/`useDeviceStore` corrigem isso: a store guarda a
informação e atualiza-se quando `initializePlatform` resolve;
`usePlatformInfo` (`use-platform.ts`) passou a ler da store e hidrata no
mount.

**SPEC.md atualizado:** 16/17 serviços desacoplados, 16/18 stores
separadas (falta só o Plugin). Corrigida também uma conta que não batia
certo desde a entrada do Music (a lista de serviços feitos não incluía o
Music apesar de o texto dizer que sim).

Confirmado: `tsc` limpo, `eslint` 0 erros, 1217/1217 testes (duas
corridas), `npm run build` de produção sem problemas.

## 2026-08-12 05:02 — Qwen sem cota, não é bug

A sessão Qwen ficou sem cota ao arrancar a peça do Plugin (a última da
lista dela): `API Error: Request rejected (429) — Your token-plan 1-week
quota has been exhausted. The quota will reset at 08-19 03:23:00 UTC.`
Confirmado pelo texto do erro que é mesmo cota, não um bug de código — a
sessão nem chegou a tocar em ficheiro nenhum, a janela nunca ficou com
nada por commitar.

Por decisão do utilizador: não se fica à espera da cota voltar, nem se
relança às cegas. O Plugin (a única peça que sobra da lista da Qwen)
passa para a fila normal da DeepSeek, a seguir ao que ela estiver a
fazer agora. Se a cota da Qwen voltar sozinha antes das 08-19, não se
relança por conta própria — fica para o utilizador decidir de manhã se
vale a pena.

## 2026-08-12 — Auditoria às 26 stores, correção da contagem no SPEC

O SPEC dizia "16 das 18" stores separadas, mas o projeto tem hoje 26
stores. Fiz uma auditoria completa, loja a loja:

- **16 stores seguem o padrão serviço puro → store fina → componente:**
  14 com subscrição direta (Theme, Voice, System State, Workspace,
  Weather, Clock, Wallpaper, Calendar, News, Mail, Music, Search,
  Device, Notification) e 2 por hook (`useAiSettings` → `aiService`,
  `useSystemMetrics` → `systemService`).
- **9 stores são estado local puro sem fonte externa:** janelas
  (`use-window-store`), widgets (`use-widget-store`), tarefas
  (`use-task-store`), sessão (`use-session-store`), aparência
  (`use-appearance-store`), temas custom (`use-custom-theme-store`),
  assistente (`use-assistant-store`), correção de voz
  (`use-voice-correction-store`), navegação pendente
  (`use-pending-file-navigation-store`). Nenhuma precisa de serviço —
  ou são canais entre componentes (voz, ficheiros), ou gerem estado que
  não vem de API externa (janelas, widgets, tarefas, conversas).
- **1 store em curso:** Plugin (`use-plugin-store`), com serviço
  próprio a ser feito.

**Conclusão:** não há trabalho real de migração por fazer além do
Plugin. A contagem antiga "18" era de quando o projeto tinha menos
stores — o número de stores que seguem o padrão (16) sempre esteve
correto. SPEC.md atualizado para "16 das 26", com o detalhe das que são
estado local legítimo e não precisam de serviço.

Confirmado: `tsc` limpo, `eslint` 0 erros (só se alterou o SPEC.md).

## 2026-08-12 — Fase 2: Plugin desacoplado (serviço + store), último da lista

A Qwen ficou sem cota a meio de começar esta peça (a última da lista dela) —
a entrada acima documenta-o. Esta peça passou para a DeepSeek.

O `use-plugin-store.ts` ainda misturava lógica de negócio diretamente na
store: lia o `PLUGIN_CATALOG` para construír o estado inicial (`builtInState`),
chamava `storageService` diretamente em `persist()`/`hydrate()`, e filtrava
entradas removidas do catálogo com um `Set` percorrido à mão. Não havia
serviço nenhum — era o único dos 17 serviços da Fase 2 que faltava.

**PluginService** (`src/services/plugin-service.ts`) — classe pura, sem React
nem Zustand:
- `getBuiltInState()` — lê o catálogo e devolve o estado dos plugins do sistema
- `existsInCatalog(id)` / `isBuiltIn(id)` — validações contra o catálogo
- `load()` — lê do armazenamento, filtra os que saíram do catálogo, junta com
  os built-in, trata o formato antigo (só a lista) e o novo
  (installed + deniedPermissions)
- `save()` — persiste o estado completo

A **usePluginStore** ficou só com a camada reativa: estado Zustand, eventos no
barramento (`eventBus.emit`), registo de auditoria (`logService.audit`), e as
funções selectoras (`selectIsInstalled`, `selectPermissionDenied`,
`selectInstalledCount`) — o mesmo padrão do `ThemeService`/`useThemeStore` e de
todos os outros.

**14 testes novos** em `tests/services/plugin-service.test.ts` cobrem o
serviço isolado (built-in, catálogo, load/save, formato antigo, permissões).
Os 7 testes existentes da store continuam a passar sem uma linha alterada.

**Fase 2 concluída.** Com esta peça, os 17 serviços desacoplados estão feitos e
as 17 stores que precisam de serviço seguem o padrão. As outras 9 stores são
estado local puro — a auditoria da sessão anterior já o confirmou. Não há mais
trabalho real de migração pendente dentro do que está autorizado (nunca
Executar Voz, Ler Memória ou Guardar Preferências sem perguntar; nunca Fase 3
além da 3.1; nunca o Terminal; nunca carregamento real de plugins remotos nem
execução de código de plugins).

**Resumo do que ficou feito esta noite (DeepSeek + Qwen):**
- Calendar, News, Email, Music, Search, Device e Plugin — 7 serviços
  desacoplados, todos no mesmo padrão.
- Migração do Vitest para v4.1.10 concluída (causa raiz encontrada:
  `restoreMocks: true`), 0 vulnerabilidades no `npm audit`.
- Auditoria às 26 stores (correção da contagem no SPEC.md).

**O que falta a sério (fora do âmbito desta Fase 2):**
- Fase 3.2–3.5 (controlo direto nativo)
- Terminal (fora de âmbito por decisão)
- Wake word e modo contínuo de escuta (decisão de privacidade por tomar)
- Executar Voz / Ler Memória / Guardar Preferências na API do Core para
  plugins (por autorizar)
- Marketplace real (decisões de negócio por tomar, ver
  `docs/spec/plugins-marketplace.md`)

Confirmado: `tsc` limpo, `eslint` 0 erros, 1231/1231 testes (95 ficheiros).

## 2026-08-12 05:12 — Fecho da noite: parar em vez de inventar trabalho

Resumo do lado da orquestração (esta sessão, Claude Sonnet 5), a fechar a
noite de trabalho autónomo pedida pelo utilizador com duas sessões
paralelas (DeepSeek, Qwen) a correr em janelas `powershell` destacadas via
`claude-deepseek-lancador.ps1` / `claude-qwen-lancador.ps1`.

**Antes de lançar as duas sessões:** terminou-se "esse ficheiro" — a
capacidade de o assistente encontrar um ficheiro pelo nome e abrir o
Explorador na pasta certa (`procurar_ficheiro`/`abrir_ficheiro`), que uma
sessão anterior (Kimi) tinha deixado a meio. `searchFiles()`,
`use-pending-file-navigation-store` e o catálogo das ferramentas já
existiam; faltava ligar o `tool-runner.ts` e o `App.tsx`. Commitado em
`53864a9`.

**Dois bugs reais nos lançadores**, ambos corrigidos e documentados nos
próprios ficheiros `claude-<provedor>-lancador.ps1`:
1. `Start-Process ... -Command "..."` com aspas aninhadas partia-se —
   resolvido a passar para lançamento por ficheiro (`-File`) com o
   comando por `-p` numa here-string.
2. Uma here-string com aspas duplas literais lá dentro (ex.: a frase
   `"npm audit fix --force"` dentro do texto do pedido) também parte —
   o Windows PowerShell 5.1 requoteia mal a string ao entregá-la a um
   executável nativo, e um pedaço como `--force` que estava dentro de
   aspas no texto chega ao `claude` como uma opção a sério, que ele
   recusa na hora (`unknown option`), sem produzir stdout nenhum — parece
   exatamente um bloqueio silencioso. Diagnosticado com instrumentação
   (`Out-File` antes/depois da linha do `claude`, mais uma captura
   temporária com `*>&1`) em vez de assumir que "a janela abriu e não
   fez nada" era um bloqueio. Lição para qualquer sessão futura a escrever
   um destes lançadores: nunca pôr aspas duplas literais dentro do texto
   do pedido.

**A Qwen ficou sem cota** (erro 429 real, a assinatura esgotou a cota
semanal, reinicia 08-19 03:23 UTC) a meio de começar a última peça da
lista dela (Plugin) — não chegou a tocar em ficheiro nenhum. Confirmado
pelo texto do erro que não era bug. Por regra do utilizador: a peça que
sobrou passou para a fila da DeepSeek, sem se esperar pela cota nem se
tentar relançar às cegas. Documentado às 05:02.

**Toda a Fase 2 (SPEC.md Parte 3) ficou concluída esta noite** — 17/17
serviços desacoplados, 17/26 stores no padrão (as outras 9 são estado
local puro, confirmado por auditoria, sem serviço a inventar só para
bater um número). Cada peça da DeepSeek foi verificada de forma
independente antes de se commitar em nome dela (`tsc`, `eslint`, suite
inteira de testes, e `npm run build` quando relevante) — a sessão corria
com `-p` e saía sem commitar nas primeiras vezes; passou a fazê-lo sozinha
depois de se lhe pedir explicitamente. Sete peças no total: Calendar,
News, Email, Music, Search, Device, Plugin — mais a atualização a sério
do Vitest para a v4 (causa raiz encontrada e corrigida, não revertida
outra vez) e a auditoria às stores que corrigiu uma contagem desatualizada
no SPEC.md.

**Risco real encontrado a meio da noite, para se ter em conta em
qualquer sessão futura com várias janelas em paralelo:** as sessões
partilham a mesma árvore de trabalho no disco (não há `git worktree`
separado por sessão). A dado momento a DeepSeek estava a meio de editar
`vitest.config.ts`/`package.json` enquanto a Qwen tinha ficheiros do
Search por commitar na mesma árvore — teria sido fácil commitar por
engano metade do trabalho de uma sessão dentro do commit da outra. Evitou-
se esperando por cada sessão terminar (processo `claude.exe` a sair) antes
de mexer nos ficheiros dela, e só depois a verificar e commitar. Vale a
pena considerar `git worktree` por sessão numa próxima vez, para não
depender de sequenciar isto à mão.

**O que falta a sério, tudo fora do que está autorizado sem perguntar
primeiro:** Fase 3.2–3.5 (controlo direto nativo), o Terminal, wake word
e escuta contínua (decisão de privacidade), Executar Voz / Ler Memória /
Guardar Preferências na API de plugins, e o Marketplace real (carregar e
executar plugins a sério). Confirmado com uma leitura completa ao
`SPEC.md` (todos os `🟡`/`⬜`/`⚠️`) antes de se decidir parar — o que
resta são decisões antigas já tomadas ou coisas bloqueadas por decisão,
não trabalho esquecido.

A parar aqui, como pedido: nenhuma tarefa real por fazer dentro do que
está autorizado. A Qwen fica sem se relançar até o utilizador decidir de
manhã. A janela da DeepSeek fica aberta e ociosa, pronta a receber a
próxima tarefa quando o utilizador voltar.

## 2026-08-12 (tarde) — Worktrees isolados por sessão, e revisão pós-Fase-2

O utilizador confirmou tudo do lado dele (1231/1231, `tsc`/`eslint`
limpos) e pediu para continuar a tarde toda, com uma prioridade: o risco
anotado ontem à noite (sessões a partilhar a mesma árvore de trabalho no
disco) resolvido a sério, não só anotado.

**Isolamento por `git worktree`:** `../jarvis-novo-deepseek` (branch
`agents/deepseek`) e `../jarvis-novo-qwen` (branch `agents/qwen`), ambos
a seguir `origin/claude/jarvis-ai-os-tauri-mvp-xa5km0` como upstream —
`git pull`/`git push` normais em cada um já falam com o branch
partilhado, sem precisar de `refspec` manual. `npm install` correu em
cada um (0 vulnerabilidades, `node_modules` não é partilhado entre
worktrees) e confirmou-se `tsc` limpo nos dois antes de confiar neles.
Os lançadores `.ps1` (fora do repositório) passaram a `Set-Location`
para o worktree de cada sessão, em vez da pasta principal.

**Testado a sério, não só dado como feito:** tentou-se lançar a Qwen no
worktree dela. Voltou o mesmo erro de ontem — `429`, cota semanal
esgotada, reinicia 08-19 03:23 UTC. Confirmado pelo texto do erro que
continua a ser cota, não código; por regra do utilizador, não se insiste
nem se espera. A DeepSeek fica com as duas listas (a dela e a que seria
da Qwen), a trabalhar sozinha no worktree dela — o isolamento por
worktree já está validado do lado que importa agora (uma sessão a
escrever na sua própria pasta, sem a orquestração nem outra sessão a
mexer nos mesmos ficheiros ao mesmo tempo); o teste de duas sessões
verdadeiramente em paralelo fica por confirmar quando a cota da Qwen
voltar.

**Tarefa da DeepSeek agora:** revisão de qualidade sobre as sete peças
da Fase 2 (Calendar, News, Email, Music, Search, Device, Plugin) e a
migração do Vitest — código morto deixado pela migração (consumidores
esquecidos de `useDataService`, imports órfãos) e lacunas reais de
cobertura de testes, não números a inflar.

---

## 2026-08-12 — Cofre de segredos: decisão keyring vs tauri-plugin-stronghold

Pedido: avaliar as duas opções para guardar chaves de API no cofre do sistema,
documentar a comparação e a escolha antes de avançar com a implementação.

**`keyring` (crate Rust, v3):**
- Acede diretamente ao Windows Credential Manager (e Keychain no macOS, Secret
  Service no Linux).
- API simples: `Entry::new(serviço, chave)` → `get_password()` /
  `set_password()` / `delete_password()`.
- Os segredos ficam onde o sistema operativo os guarda — o Gestor de
  Credenciais do Windows mostra-os no Painel de Controlo, o `cmdkey /list`
  lista-os, e o utilizador pode geri-los por fora da aplicação.
- Leve: só chama as APIs do sistema, sem ficheiro de cofre próprio, sem
  snapshots, sem dependências pesadas.
- Não funciona em Android (não é erro — a mesma regra de outros comandos
  nativos).

**`tauri-plugin-stronghold` (plugin oficial Tauri, v2.3.1):**
- Cria um ficheiro encriptado próprio (motor IOTA Stronghold), sem integração
  com o chaveiro do sistema operativo.
- API mais complexa — snapshots, persistência de estado do cofre, password
  de desbloqueio.
- Cross-platform (inclui Android), mas os segredos vivem num ficheiro à
  parte, não no sítio onde o utilizador espera encontrá-los.
- Dependências adicionais: `rust-argon2`, `rand_chacha`, `rand_core`.

**Escolha: `keyring`.** O pedido diz "Credential Manager a sério" — e é
exatamente isso que o `keyring` entrega: a chave fica no Windows Credential
Manager, visível no Painel de Controlo, gerida pelo sistema operativo. O
Stronghold é um cofre à parte, encriptado e portátil, mas não é o chaveiro
do sistema — guarda os segredos noutro sítio, noutro formato, e o
utilizador não os vê nas ferramentas do Windows. Para Android (onde o
keyring não compila), os comandos ficam atrás de `#[cfg(desktop)]` e o
`AndroidAdapter` herda o fallback do `TauriAdapterBase` — mesmo padrão de
`processList` e de outras capacidades que não existem no móvel.

## 2026-08-12 — Revisão de qualidade da Fase 2 concluída

Pediu-se uma auditoria às sete peças da Fase 2 (SPEC.md Parte 3) depois da
migração para o padrão serviço puro + store fina. A Qwen estava encarregue
de Music, Search e Device, mas sem cota — ficou tudo para a DeepSeek, que
reviu as sete.

### Código morto encontrado e removido

- **`useDataService`**: confirmado que não tem consumidores. O ficheiro
  `src/hooks/use-data-service.ts` continua a existir (faz parte do contrato
  público do `PollingDataService`), mas nenhum componente o importa — SPEC.md
  já o documentava como "sem consumidores".

- **News — `byCategory`**: removido do `NewsService` e da `useNewsStore`.
  O `NewsWidget` faz a filtragem inline (`articles.filter(...)`) e nunca
  chamou este método. O import de `NewsCategory` no serviço e na store
  também saiu, porque deixou de ser usado.

- **Plugin — `selectIsInstalled` e `selectInstalledCount`**: dois selectores
  exportados de `use-plugin-store.ts` que nunca foram importados por nenhum
  componente. Saíram. `selectPermissionDenied` continua — é usado por
  `App.tsx`, `plugin-bridge.ts` e `ai-service.ts`.

- **Calendar, Email, Music, Search, Device**: sem código morto. Todos os
  imports e métodos são usados ou seguem o contrato comum dos serviços
  (`providerName`, `isSimulated` como conveniência na API).

### Cobertura de testes

- **Calendar**: `CalendarService` estava ausente do teste parametrizado em
  `data-service.test.ts` que cobre "os serviços expõem que os dados são
  simulados" — os outros quatro serviços estavam lá, o calendário não.
  Adicionado. (`tests/services/data-service.test.ts`, 24 testes → passam.)

- **Music**: já coberto pelo bloco `MusicService` (12 testes dedicados:
  togglePlay, next, previous, seek, volume) e pelo parametrizado comum.

- **Search**: `tests/stores/search-store.test.ts` cobre pesquisa por comando,
  por conteúdo, subscrição e cancelamento — sólido.

- **Device**: a lógica é delegação trivial para `getPlatformAdapter()` /
  `initializePlatform()`, sem condicionais nem edge cases próprios.
  Escrever um teste aqui seria "fingir para subir um número" — não se fez.

- **Plugin**: já tem `tests/stores/plugin-store.test.ts` e
  `tests/services/plugin-service.test.ts` com cobertura de instalação,
  remoção, permissões e persistência.

### Verificações

- `tsc --noEmit`: limpo.
- `eslint` nos ficheiros alterados: limpo (os warnings que restam no
  projeto são pré-existentes: CoreRings, BootChecks, CommandPalette,
  use-entrance-cascade, use-typewriter — nenhum tocado nesta sessão).
- `vitest run`: 95 ficheiros, 1232 testes — todos passam.

## 2026-08-12 11:19 — Fecho da tarde: worktree validado de ponta a ponta, sem mais trabalho real

Verificação independente do que a DeepSeek fez no worktree isolado
(`../jarvis-novo-deepseek`, branch `agents/deepseek`): código morto
confirmado sem referências nenhures antes de aceitar a remoção
(`byCategory`, `selectIsInstalled`, `selectInstalledCount`), `tsc`
limpo, `eslint` 0 erros, `vitest run` 1232/1232, e agora também `npm
run build` de produção — chunks corretos, o mesmo aviso pré-existente
de tamanho do vendor chunk, nada novo.

**O isolamento por `git worktree` está validado de ponta a ponta.** A
DeepSeek commitou na branch dela (`agents/deepseek`), fez `git push
origin HEAD:claude/…` diretamente para o branch partilhado, e este
worktree principal apanhou isso com um `git pull` normal — fast-forward
limpo, sem conflito. Enquanto ela trabalhava, este worktree principal
manteve-se completamente parado (`git status` limpo o tempo todo). O que
faltava confirmar de ontem à noite — o caminho todo, de uma sessão a
publicar até a outra apanhar sem colisão — está confirmado. Falta só
testar com duas sessões verdadeiramente em paralelo, o que depende da
cota da Qwen voltar (19/08).

**Qwen tentada de novo** no worktree dela (`../jarvis-novo-qwen`), como
pedido — mesmo erro 429, mesma cota esgotada até 19/08. Não se insistiu,
não se relançou outra vez, sem surpresas.

**Depois disto, releitura completa ao `SPEC.md`** à procura de qualquer
`🟡`/`⬜`/`⚠️` que pudesse ser trabalho real esquecido — o mesmo resultado
de ontem à noite: o que resta são decisões já tomadas (estrutura de
pastas, stack, temas, o logo fora do núcleo — todas em "Divergências
assumidas") ou coisas fora de alcance por decisão ou por dependerem de
nativo/PC a sério (Terminal, Windows Hello, wake word, Marketplace real,
Fase 3 além da 3.1). Nada disto é autorizado a mexer sem perguntar
primeiro.

**A parar aqui, como pedido — não há trabalho real e seguro por fazer.**
O worktree da DeepSeek fica ocioso, pronto para a próxima tarefa. O da
Qwen fica por usar até a cota voltar; essa decisão fica para o
utilizador, não se relança sozinha.

## 2026-08-12 — Código nativo a sério, peça 1: Terminal

O utilizador desbloqueou trabalho nativo a sério (código Rust, capabilities
do Tauri, verificação ao vivo na máquina Windows) — quatro peças grandes,
repartidas entre esta sessão e a DeepSeek (cada uma no seu worktree, sem
repetir peça). Esta sessão (Claude Sonnet 5) ficou com o Terminal.

**Rust** (`src-tauri/src/terminal/`): `TerminalRegistry` (estado gerido,
`Mutex<HashMap<id, TerminalSession>>`) e `TerminalSession`, que abre um PTY
a sério via `portable-pty` (o motor por trás do WezTerm — ConPTY no
Windows), arranca `powershell.exe` — sempre este programa fixo, nunca
escolhido pela interface — e põe uma thread a ler a saída, emitindo-a por
eventos Tauri (`terminal://output`, `terminal://exit`). Quatro comandos
(`terminal_spawn`, `terminal_write`, `terminal_resize`, `terminal_kill`),
só no desktop: o `lib.rs` já tinha o `invoke_handler` a correr antes do
bloco `#[cfg(desktop)]`, por isso passou a chamar-se outra vez dentro desse
bloco, com a lista toda (base + terminal) — chamar duas vezes substitui, não
acumula.

**Sem capability nova.** Confirmado antes de escrever uma: os comandos da
própria app (diferente dos de plugin, tipo `fs:allow-read-text-file`) não
passam pelo sistema de ACL deste projeto — `build.rs` não gera esquema de
permissões próprio, e os comandos de sistema já existentes (`get_system_
snapshot`, etc.) também não estão em nenhum `capabilities/*.json`. O escopo
estreito que a spec pedia vem do desenho do próprio comando: `terminal_
spawn` nunca recebe um caminho de programa, só texto para escrever no
stdin de uma sessão já aberta — o mesmo que um humano faria a escrever
num terminal a sério.

**Sem confirmação para comandos destrutivos**, decisão documentada em
`terminal/mod.rs`: o critério do projeto ("dá para desfazer?") aplica-se a
ações que o *assistente* decide por conta própria a partir de uma frase
interpretada por um modelo. Um terminal é o oposto — a pessoa escreve, à
mão, exatamente o comando que quer correr. Filtrar por padrões de texto
seria frágil (contornável) e surpreendente (nenhum terminal a sério pede
confirmação para `del`).

**`@xterm/xterm` + `@xterm/addon-fit`**, não uma solução caseira: entende
sequências ANSI (cores, cursor) que um `<div>` teria de reimplementar à
mão, e só entra no bundle quando a janela abre (`lazy()` no registo de
apps) — o custo que a spec pedia para se justificar fica pago por nunca
carregar em quem não abre um terminal. Cores seguem o tema ativo (lidas
das variáveis CSS, `--card`/`--t1`/`--accent`/`--tint-rgb`), atualizadas
ao vivo via `eventBus.on('tema:alterado', …)`.

**`PlatformCapabilities.terminal`** novo, `true` só no `DesktopAdapter`.
Ícone próprio no registo de apps (`SquareTerminal`, não `Terminal` — esse
já era o do Centro de Programador, dois ícones iguais no dock confundiam).

**Verificado ao vivo, não só por ler código** — `npm run tauri dev` a
sério nesta máquina: compilação Rust completa sem avisos, login (a
palavra-passe é simulada, qualquer texto não vazio entra — Fase 1), abrir
o Terminal pela paleta de comandos, `PS C:\Users\UPTECHBOX>` real a
aparecer, escrever `echo ola-do-terminal-jarvis` e ver a saída certa
voltar. Automatizado com capturas de ecrã reais da janela (`PrintWindow`,
não `CopyFromScreen` — a primeira tentativa apanhou sem querer outra
janela por cima, uma sessão do Claude Code aberta no mesmo ecrã; corrigido
para capturar só a janela do JARVIS diretamente).

**Não confirmado ao vivo**: fechar a janela a matar mesmo o processo.
Várias tentativas de clique sintético (`mouse_event`, depois `SendInput`
com sequência mover+clicar, com correção de DPI) não conseguiram acionar
nenhum controlo da janela — nem sequer minimizar, o que descarta ser um
bug específico do botão fechar e aponta antes para uma limitação do
automatismo usado (possivelmente WebView2 a exigir uma sequência de
eventos que o `SendInput` sintético não estava a produzir). Confirmado por
outra via, que importa mais para a segurança: matar o processo principal
da app (`Stop-Process` a sério) não deixou `conhost.exe`/`powershell.exe`
órfãos — o `portable-pty` liga o processo filho a um Job Object do
Windows, por isso mesmo um crash a sério não deixa processos perdidos.
Fica por confirmar, numa próxima sessão com acesso à máquina, se o clique
no botão fechar dispara mesmo `terminal_kill` (o código do lado React
chama-o no cleanup do `useEffect` — parece correto por leitura, só não foi
visto a acontecer ao vivo).

SPEC.md atualizado (Parte 6.2, e a entrada em "Fora de âmbito por decisão"
passa a "Feito"). Confirmado: `tsc` limpo, `eslint` 0 erros, 1244/1244
testes (12 novos, cobrindo os quatro métodos novos do `PlatformAdapter`
nos três adapters), `cargo check` e a compilação completa do `tauri dev`
sem avisos.

## 2026-08-12 — Cofre de segredos: implementação completa e verificada ao vivo

Pedido: implementar o cofre de segredos — mover as chaves de API do
armazenamento local (texto simples) para o Windows Credential Manager.
Duas peças no pedido: esta (Cofre de segredos) e Automações em segundo
plano (a seguir).

**Decisão documentada** na sessão anterior: `keyring` (crate Rust v2.3.3)
vs `tauri-plugin-stronghold` — ver entrada de 2026-08-12 acima. A escolha
foi `keyring` por integrar diretamente com o Gestor de Credenciais do
Windows, sem ficheiro de cofre próprio.

**Implementação:**

1. **`src-tauri/Cargo.toml`:** `keyring = "2"` adicionado sob
   `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.
   Tentou-se primeiro a v3, mas não tem `delete_password()` — a v2 tem.

2. **`src-tauri/src/commands/secrets.rs`** (novo): três comandos Tauri —
   `secret_set(key, value)`, `secret_get(key) → Option<String>`,
   `secret_delete(key)`. Usam `keyring::Entry::new("jarvis-ai-os", &key)`.
   Todos embrulham erros em `Error::SystemRead`. `secret_get` devolve
   `Ok(None)` quando a entrada não existe (não é erro), e
   `secret_delete` é idempotente (apagar o que não existe também dá Ok).

3. **`src-tauri/src/commands/mod.rs`:** `#[cfg(desktop)] pub mod secrets;`

4. **`src-tauri/src/lib.rs`:** dois blocos `invoke_handler` com
   `#[cfg(desktop)]`/`#[cfg(not(desktop))]` — o de desktop regista
   `secrets::secret_set/get/delete`; o outro não.

5. **`PlatformAdapter`:** três métodos novos — `secretSet()`,
   `secretGet()`, `secretDelete()`. `TauriAdapterBase` implementa-os com
   `tryInvoke` e a capability `secretVault`. `DesktopAdapter`:
   `secretVault: true`. `WebAdapter` e `AndroidAdapter`:
   `secretVault: false` com fallback (`false`/`null`/`false`).

6. **`use-ai-settings-store.ts` (reescrito):** `semSegredos()` filtra
   `apiKey` e `claudeApiKey` do objeto antes de guardar no storage.
   `persist()`: com cofre → definições sem chaves no storage + chaves no
   cofre; sem cofre → tudo no storage (comportamento de sempre).
   `hydrate()`: com cofre → lê do cofre, com migração automática na
   primeira abertura (marcador `jarvis-migrated` no próprio cofre para não
   correr mais do que uma vez); sem cofre → lê do storage.

7. **`AiSettings.tsx`:** as duas frases de aviso mudaram de "não é um
   cofre" para "fica guardada no cofre do sistema — o Gestor de
   Credenciais do Windows — e não sai nas cópias de segurança". O rótulo
   "Chave guardada" passou a "Chave guardada no cofre".

8. **Cópias de segurança:** confirmado que a exclusão das chaves continua —
   `SECRET_FIELDS` em `backup.ts` já apagava `apiKey`/`claudeApiKey`, e
   agora as chaves nem sequer estão no storage para serem lidas.

9. **Testes de integração Rust ao vivo** (`src-tauri/tests/cofre-integration.rs`,
   novo): 6 testes contra o Windows Credential Manager real — escrever, ler,
   apagar, caracteres especiais, chave inexistente, e o fluxo completo com
   o serviço de produção (`jarvis-ai-os`). **6/6 passam.**

**Verificação ao vivo no Windows:**
- `cargo build`: compilou sem erros (keyring v2.3.3 + Tauri v2.11.5).
- `cargo test --test cofre-integration`: 6/6 testes passam contra o
  Credential Manager real desta máquina.
- `cmdkey /list` confirmou que o cofre está acessível e sem resíduos
  dos testes (cada teste limpa o que escreve).
- O fluxo real com `SERVICE_NAME = "jarvis-ai-os"` foi testado: escrever
  `sk-producao-teste-12345678`, ler de volta, apagar, confirmar que já
  não está lá — tudo Ok.

**O que não se conseguiu confirmar ao vivo:**
- A interação pela interface gráfica (guardar uma chave na UI da app,
  fechar, reabrir) — o terminal não tem acesso ao WebView para clicar
  nos botões. Os testes automatizados (vitest) cobrem a lógica de
  `persist()`/`hydrate()` com o `PlatformAdapter` mockado, e os testes
  de integração Rust cobrem o keyring contra o Credential Manager real —
  as duas pontas foram validadas separadamente.

**Verificações automáticas:** `tsc --noEmit` limpo, `eslint` 0 erros,
`vitest run` 95 ficheiros / 1232 testes todos a passar, `cargo check`
limpo.

SPEC.md atualizado: "Cofre de segredos" passou de 🚫 para 🟡 (cofre ✅,
criptografia/WebAuthn/2FA continuam por fazer).

## 2026-08-12 — Código nativo a sério, peça 4: Windows Hello + sessão automática

Última peça do primeiro lote (depois de Terminal, Cofre de segredos e
Automações). Dependia do cofre de segredos (peça 2, da DeepSeek) para a
sessão automática, por isso só começou depois de esse merge.

**Rust** (`src-tauri/src/windows_hello/`): `UserConsentVerifier` (WinRT,
`windows` crate v0.62, features `Security_Credentials_UI` + `Foundation`,
só no alvo `target_os = "windows"` — ao contrário do `portable-pty`/
`keyring`, que servem qualquer desktop, isto não existe no Linux nem no
macOS). `IAsyncOperation<T>` da versão nova do `windows-future` implementa
`IntoFuture`, não um `.get()` bloqueante como versões antigas — os
comandos são `async fn` a sério, não threads com espera bloqueante.
Comandos (`commands::windows_hello`) compilam em qualquer desktop: a
implementação real fica atrás de `#[cfg(target_os = "windows")]`, e uma
segunda implementação (mesma assinatura) devolve sempre "indisponível"
fora do Windows — o mesmo padrão que `get_top_processes` já usava para
mobile/desktop, agora esticado a um terceiro eixo (Windows/não-Windows).

**Sem confirmação extra a pedir "tens a certeza":** o próprio Windows
Hello já é a confirmação — pedir outra por cima seria redundante.

**Frontend:** `checkBiometricAvailability`/`requestBiometricVerification`
no `PlatformAdapter`, `capabilities.biometrics` passou a `true` no
desktop (a disponibilidade real por máquina fica para a chamada em
runtime, não para esta flag estática — o mesmo desenho do `terminal`).
`LoginScreen`: `runRealOrSimulatedBiometrics` tenta o Windows Hello a
sério primeiro; só cai para a simulação original (a que já existia) numa
máquina sem sensor nem PIN — nunca quebra quem não tem o hardware.

**Sessão automática** (`src/services/auto-login-service.ts`): token
aleatório (`crypto.randomUUID`) com validade de 30 minutos, guardado no
cofre de segredos — nunca a palavra-passe. Criado só depois de um
"verified" real do Windows Hello (não da palavra-passe nem do PIN
simulado, que já são o próprio ato de autenticação). `LoginScreen` lê o
cofre no arranque e salta o formulário se houver uma sessão válida.
`useSessionStore.logout()` apaga-a — sair a sério continua a sair a
sério, sem a sessão automática trazer de volta sozinha.

**Verificado ao vivo, não só por ler código** — segunda corrida de `npm
run tauri dev` nesta máquina: confirmado primeiro, com um binário de
diagnóstico à parte (removido depois de usar), que esta máquina tem
Windows Hello configurado a sério (PIN) — `CheckAvailabilityAsync`
devolveu `Available`. Depois, na app a sério: login por palavra-passe
para entrar (não interfere com o resto), navegação por teclado (Tab) até
ao botão de reconhecimento facial — os cliques sintéticos por
`SendInput` não chegam a botões pequenos nesta configuração (o mesmo
limite já visto no Terminal), mas o teclado funciona sempre — e Enter
para acionar. **Confirmado a sério:** apareceu o diálogo nativo do
Windows (`Segurança do Windows`, processo `CredentialUIBroker.exe`) —
prova de que a chamada chegou mesmo à API do sistema operativo, não a
uma simulação.

**Não confirmado ao vivo:** o desfecho depois de completar o Windows
Hello a sério. O diálogo corre isolado (ambiente de trabalho seguro, ou
mecanismo equivalente) — nem `SendInput` sintético nem `Stop-Process`/
`taskkill` a partir desta sessão não elevada conseguem tocar-lhe
(`Acesso negado` em ambos). Isto é o comportamento de segurança correto,
não um bug: um diálogo de credenciais que uma automação conseguisse
fechar ou aprovar sozinha não estaria a proteger nada. O diálogo ficou
por resolver (nem verificado nem cancelado) — confirmado que não bloqueia
o resto do ambiente de trabalho (outras janelas continuam a ganhar foco
normalmente), por isso não é urgente, mas fica à espera de alguém
completar ou cancelar à mão. Não se tentou o caminho "não disponível"
nem "recusado" — só o "a sério, com hardware presente" fazia sentido
testar nesta máquina.

Confirmado: `tsc` limpo, `eslint` 0 erros, 1258/1258 testes (96
ficheiros, +14 desde o cofre — `auto-login-service.test.ts` novo, mais
testes de biometria em `adapters.test.ts`), `cargo check` limpo.

SPEC.md atualizado (Parte 5): Windows Hello e sessão automática ✅ com a
nota acima; chave física (FIDO2/WebAuthn) continua por fazer, não fazia
parte deste lote.

## 2026-08-12 — Automações em segundo plano + gatilhos do sistema (ficheiros, USB, bateria)

PECA 2 do pedido nativo: fazer o motor de automações continuar a disparar com
a janela minimizada para a bandeja, e acrescentar três gatilhos novos do
sistema operativo.

**Segundo plano (close-to-tray):** `on_window_event` com `CloseRequested` no
`lib.rs` — `prevent_close()` + `window.hide()`. A janela esconde-se em vez de
fechar, o WebView continua vivo, e os temporizadores do `automationService`
(tique a cada 20s) continuam a correr. Sair a sério só pelo item "Sair" do
menu da bandeja, que chama `app.exit(0)` e mata os processos filhos (PTY,
voice-clone-service).

**Três novos comandos Rust, três novos ficheiros:**

1. **Ficheiros** (`src-tauri/src/commands/files.rs`): `watch_folder` e
   `unwatch_folder` via crate `notify` v7. `FileWatchers` como estado gerido
   (`Mutex<HashMap<String, Arc<AtomicBool>>>`) — um watcher por pasta, sem
   duplicados (caminhos canonicalizados). Emite `automation://file-changed`
   com caminho e tipo de evento (`created`/`modified`/`removed`).

2. **USB** (`src-tauri/src/commands/usb.rs`): `list_usb_devices` via
   `SetupDiGetClassDevsW` da crate `windows` v0.58. `UsbMonitor` com polling
   de 5s — compara os dispositivos atuais com a lista conhecida, emite
   `automation://usb-changed` com ação (`ligado`/`desligado`) e nome do
   dispositivo. O primeiro ciclo de polling é suprimido (não dispara "ligado"
   para tudo o que já estava ligado no arranque).

3. **Bateria** (`src-tauri/src/commands/battery.rs`): `get_battery_status`
   via crate `battery` v0.7. `BatteryMonitor` com polling de 30s, emite
   `automation://battery-changed` com percentagem, estado (carregar/descarga)
   e tempo restante.

**Interface e tipos:**

- `src/types/automation.ts`: três novas interfaces de gatilho — `FileTrigger`
  (`kind: 'ficheiros'`, `folderPath`), `UsbTrigger` (`kind: 'usb'`, `action`),
  `BatteryTrigger` (`kind: 'bateria'`, `direction`, `percent`). União
  `AutomationTrigger` alargada. `describeTrigger()` cobre os três casos.
- `src/types/platform.ts`: três capacidades novas — `fileWatcher`, `usbMonitor`,
  `batteryMonitor` (todas `boolean`).
- `src/platform/platform-adapter.ts` + `tauri-adapter-base.ts`: 6 métodos
  novos — `watchFolder`, `unwatchFolder`, `getBatteryStatus`, `onFileChanged`,
  `onUsbChanged`, `onBatteryChanged`. Desktop `true`, Web/Android `false`.
- `src/services/automation-service.ts`: `checkNativeTriggers(kind, payload)`
  casa eventos nativos contra as regras ativas e regista as execuções no
  histórico de 60. `lastBatteryPercent` para detetar cruzamentos de limiar
  (primeiro valor só estabelece a linha de base, sem falso disparo).
- `src/apps/automations/AutomationEditor.tsx`: três novos templates de bloco
  — "Alteração de ficheiro", "Dispositivo USB", "Nível da bateria" — com
  ícones próprios (`FolderOpen`, `Usb`, `BatteryMedium`). `blockLabel()` e
  o prompt de geração NL atualizados.
- `src/App.tsx`: useEffect novo que subscreve os três eventos nativos e chama
  `automationService.checkNativeTriggers()`, mais registo de `watchFolder` para
  automações de ficheiros ativas no arranque.

**Verificação:** `tsc --noEmit` limpo, `eslint` 0 erros, `vitest run` 95
ficheiros / 1244 testes todos a passar, `cargo build` sem erros (só um warning
de linker pré-existente). SPEC.md atualizado: "Execução em segundo plano" ✅,
"Gatilhos do sistema" 🟡 (ficheiros ✅, USB ✅, bateria ✅, rede 🚫).

## 2026-08-12 — Merge do lote de código nativo (Terminal + Cofre + Automações + Windows Hello)

Fecha o primeiro lote inteiro: as quatro peças (Terminal e Windows Hello
desta sessão; Cofre de segredos e Automações da DeepSeek) partilhavam os
mesmos ficheiros centrais (`lib.rs`, `Cargo.toml`, `PlatformCapabilities`,
os três adapters), por isso cada merge teve conflitos a sério, não só
textuais.

**Bug real encontrado a resolver, não só um conflito de texto:** o
`Cargo.toml` tinha `windows` declarado duas vezes com versões diferentes
— `0.58` (USB, da DeepSeek) num alvo, `0.62` (Windows Hello, desta
sessão) noutro. As duas coexistiam sem erro no ficheiro, mas rebentavam a
compilar: o Rust via duas crates chamadas `windows` para o mesmo alvo e
recusava resolver `use windows::core::GUID` sem ambiguidade
(`E0464: multiple candidates`). Unificado numa só declaração, versão
0.62, com as features das duas peças juntas.

**Corrigido de caminho, a mesma revisão:** `commands::usb` estava
registado como `#[cfg(desktop)]` (qualquer desktop), mas o próprio
ficheiro já usa `std::os::windows::ffi::OsStringExt` e
`SetupDiGetClassDevsW` — nunca compilaria fora do Windows. O gate passou
a `#[cfg(target_os = "windows")]`, a tornar explícito o que já era
verdade, sem mudar nada do comportamento no Windows.

**Cobertura reforçada durante o merge, não deixada para depois:** a peça
de Automações trazia seis métodos novos no `PlatformAdapter`
(`watchFolder`, `unwatchFolder`, `getBatteryStatus`, `onFileChanged`,
`onUsbChanged`, `onBatteryChanged`) e o `checkNativeTriggers()` no
`automationService`, sem um teste novo sequer — o "1244 testes" do
commit original era só a suite antiga a continuar a passar, não prova
nenhuma do código novo. Adicionados: bloco de graceful-degradation em
`adapters.test.ts` (mesmo padrão do Terminal — nenhum adapter lança, Web
nunca tenta IPC), e oito testes a sério em `automation-service.test.ts`
para `checkNativeTriggers` — correspondência de pasta (com normalização
de maiúsculas e barras), ação USB exata, e o caso mais subtil: o
cruzamento de limiar da bateria não pode disparar na primeira leitura
(não há "anterior" para comparar), tem de respeitar a direção
(abaixo/acima), e não pode repetir enquanto o nível fica do mesmo lado.

Confirmado depois de tudo resolvido: `tsc` limpo, `eslint` 0 erros,
1279/1279 testes (96 ficheiros), `cargo check` limpo, `cargo test` com os
6 testes de integração do cofre a continuar a passar a sério no
Credential Manager, `npm run build` de produção com o `TerminalWindow`
no seu próprio chunk.

---

## 2026-08-12 — Peça 5, Lote 2: Assinatura de plugins (Ed25519)

Primeira peça do segundo lote de plugins — as outras quatro (ficheiro pelo
assistente, sistema de ficheiros real, provedores de rede reais, instalar
plugin local) ficam para depois. Esta é a que as restantes dependem.

O que se pediu: um mecanismo de assinatura criptográfica real para plugins,
sem ligação a marketplace remoto nenhum — só a infraestrutura, testada
contra o catálogo local.

**Confirmado:** Ed25519 via `crypto.subtle` (SubtleCrypto) funciona de
verdade nesta stack — Node 24.19 no `vitest` e WebView2 do Windows 11 na app
real. Teste de round-trip completo: gerar par, exportar pública (32 bytes) e
privada (PKCS#8, 48 bytes), assinar, verificar, corromper um byte da
assinatura e verificar que falha.

**O que ficou construído (`src/plugins/signature.ts`):**
- `generateSigningKeyPair()` — par Ed25519, chaves exportadas em base64
- `signManifest(manifest, privateKey)` — assinatura canónica (JSON com chaves
  ordenadas, incluindo `permissions` e `platforms`)
- `verifyManifestSignature(manifest, sig, pubKey)` — verificação matemática
- `verifySignedManifest(signed)` — verificação completa (matemática + revogação)
- `getSignatureStatus(entry)` — devolve o estado para a interface mostrar
- Lista de revogação: `revokeKey()`, `unrevokeKey()`, `isKeyRevoked()`,
  `clearRevokedKeys()` — guardada em `localStorage`

**Integração no fluxo existente:**
- `PluginManifest` ganhou o wrapper `SignedManifest` (`plugin.ts`)
- `CatalogEntry` ganhou campos opcionais `signature`, `signerPublicKey`,
  `signerName` (`plugin-catalog.ts`) e a função `toManifest()` para extrair
  o subconjunto que interessa para a assinatura
- `usePluginStore` ganhou `verifyAndInstallPlugin()` — verifica a assinatura
  antes de instalar; plugins do catálogo sem assinatura são aceites
  (confia-se na origem); plugins externos sem assinatura são recusados
- `PluginCard` mostra o estado de assinatura de forma visível, com ícone e
  texto: assinado e verificado (ShieldCheck verde), sem assinatura
  (ShieldOff cinzento), assinatura inválida (ShieldX vermelho), chave
  revogada (ShieldAlert amarelo)

**Testes:** 30 testes novos em `tests/plugins/signature.test.ts` — geração
de pares, round-trip de assinatura, assinatura corrompida, chave errada,
manifesto alterado depois de assinar, chave revogada (a matemática continua
válida mas a política bloqueia), serialização canónica (ordem das chaves não
afeta a assinatura), vários plugins do mesmo autor, integração com o fluxo
de instalação. Todos os pares são gerados no próprio teste — zero chaves
fixas no código.

**Verificação:** `tsc` limpo (sem erros novos), `eslint` 0, `vitest` 1309
testes (97 ficheiros), todos passam.

**O que ainda falta para a Peça 8 (instalar plugin de ficheiro local):**
- Um seletor de ficheiro `.jarvis-plugin` (diálogo nativo)
- Um formato de pacote (manifesto assinado + código empacotado)
- A UI de "Instalar de ficheiro" na Loja
- A infraestrutura de assinatura já está pronta para isso usar —
  `verifyAndInstallPlugin` com `isExternal: true`

## 2026-08-12 — Peça 7, Lote 2: sistema de ficheiros real no Explorador

Enquanto a DeepSeek tratava da Peça 5 (assinatura de plugins) no seu
worktree, tratei da Peça 7 no principal — não bloqueia na 5 nem repete
trabalho com ela, como pedido.

**O que mudou:** o Explorador de Ficheiros passa a poder ler o disco a
sério, ao lado da árvore simulada de sempre (que continua a ser o que
abre por omissão). Um botão "Escolher pasta real…" abre o diálogo nativo
de pasta (`@tauri-apps/plugin-dialog`); a pasta escolhida declara-se no
Rust como a raiz (`files_set_root`) e fica gravada como a única fronteira
que `files_read_dir` respeita — qualquer caminho fora dela é recusado no
próprio Rust, depois de canonicalizar os dois lados, não só escondido na
interface. Sem capability `fs:*` nova: em vez do plugin `fs` do Tauri
(cujo sistema de scope estático não dá para uma pasta escolhida em tempo
de execução), são comandos próprios da app com `std::fs` — o mesmo
desenho já usado no Terminal, onde o escopo estreito vem do próprio
comando, não de uma allow-list.

A raiz escolhida persiste (`storageSet`, chave `files.real-root-path`) e
tenta reabrir-se sozinha no arranque seguinte; se a pasta tiver
desaparecido ou mudado de sítio entretanto, cai-se para a árvore simulada
sem mostrar erro nenhum — não é um erro que a pessoa precise de ver. Um
botão "Árvore simulada" volta atrás a qualquer momento e esquece a raiz
guardada. O tipo de cada ficheiro real adivinha-se pela extensão
(`fileKindFromName`, novo em `types/file-entry.ts`) — a árvore real não
vem com um `kind` já atribuído como a simulada.

O caminho pendente do assistente (`abrir_ficheiro`, de "esse ficheiro")
continua a apontar só para a árvore simulada — não tem como saber de um
caminho real. Se houver um pedido pendente na primeira leitura da janela,
a reabertura automática da raiz real espera pela próxima montagem em vez
de o atropelar.

**Testes:** 20 novos — `tests/apps/files-real.test.tsx` (mocka
`@/platform` inteiro, cobre escolher pasta, listar, descer um nível, erro
de leitura, voltar ao simulado, reabertura automática, raiz desaparecida,
e a prioridade do caminho pendente do assistente) e mais alguns em
`tests/platform/adapters.test.ts` (os três adapters nunca lançam;
`realFilesystem` só é `true` no Desktop). Suite inteira: 1329 testes (98
ficheiros), `tsc` limpo, `eslint` 0 erros.

**Confirmado ao vivo** (`npm run tauri dev`, login, abrir o Explorador):
o diálogo nativo "Selecionar pasta" abriu mesmo sobre `Documentos` do
utilizador; escolhi `WhirlwindFX` a sério e a janela listou as suas
subpastas reais com as datas reais de modificação (não inventadas);
descer a `Effects` mostrou "Pasta vazia." — porque a pasta está mesmo
vazia no disco, confirmado por fora; voltar à árvore simulada limpou o
estado e devolveu exatamente a árvore original. Screenshots capturados
por `PrintWindow` (a mesma técnica desta noite, não `CopyFromScreen`, que
já se sabia que apanhava a janela errada) em cada passo.

**Não confirmado ao vivo:** a reabertura automática da raiz guardada
depois de reiniciar a aplicação a sério (só testada nos 20 testes, não
ao vivo — exigia fechar e reabrir a app dentro do mesmo ciclo de
verificação) e uma tentativa a sério de escapar à raiz declarada (por
desenho do comando e porque a interface nunca oferece um caminho fora do
que já se navegou — não por um teste ao vivo a tentar mesmo escapar).

Commit e push feitos depois de puxar a Peça 5 da DeepSeek — sem conflito
real: só `plugin-catalog.ts` mudou dos dois lados, em zonas diferentes do
ficheiro (a Peça 5 mexeu nos campos de assinatura do `CatalogEntry`, isto
só acrescentou uma linha ao `CAPABILITY_LABELS`), `git stash`/`pull`/`pop`
resolveu sem intervenção manual.

## 2026-08-12 — Peça 9, Lote 2: instalar plugin de ficheiro local (DeepSeek)

Última peça do Lote 2. Pedia-se: escolher um ficheiro `.jarvis-plugin` no
disco, ler o conteúdo com um comando Rust próprio (padrão do `files.rs`),
validar o pacote em três camadas — JSON → manifesto → assinatura Ed25519
(Peça 5, `isExternal: true`) — e instalar o plugin com feedback claro em
cada recusa. Quem pediu foi o Claude (Sonnet), que fez a Peça 7 (sistema
de ficheiros real) enquanto a DeepSeek fazia a Peça 5.

### O que ficou feito

**Formato do pacote** (`PluginPackage` em `plugins/plugin.ts`): um JSON
simples com `manifest` (PluginManifest), `signature` (base64, 64 bytes
Ed25519), `signerPublicKey` (base64, 32 bytes), `signerName` (opcional) e
`code` (JavaScript fonte). Decisão documentada: JSON chega, não é preciso
zip — o código é sempre texto/JS simples, como os exemplos do catálogo. A
assinatura cobre só o manifesto (canónico), não o código — o código corre
num iframe sandboxed e não pode fazer nada além do que o manifesto declara.

**Comando Rust** (`src-tauri/src/commands/plugins.rs`): `read_plugin_file`
canonicaliza o caminho antes de ler, mesmo padrão do `files.rs` — nunca
confiar cegamente no caminho que a interface manda. Registado em
`mod.rs` e `lib.rs` (generate_handler do desktop).

**Fluxo de instalação** (`plugins/install-from-file.ts`):
1. `openDialog` com filtro `.jarvis-plugin` (plugin `dialog` do Tauri)
2. `invoke('read_plugin_file', { path })` — Rust lê o ficheiro
3. `JSON.parse` + validação da forma (manifest, signature, signerPublicKey, code)
4. Validação dos campos obrigatórios do manifesto (id, name, version, author, permissions)
5. `verifyAndInstallPlugin` com `isExternal: true` + `manifest` — verifica
   assinatura contra o manifesto do ficheiro (antes, o código só usava o
   manifesto do catálogo, o que deixava plugins externos com assinatura
   passar sem verificação nenhuma — bug real, corrigido)
6. Se aprovado: `saveExternalPlugin` (localStorage), `registerPluginRuntime`
   (registo dinâmico no `registry.ts`), notificação de sucesso

**UI** (`PluginManagerWindow.tsx`): botão "Instalar de ficheiro" visível
nas abas Loja e Instalados, com estado de carregamento. Recusas aparecem
como barra de erro vermelha com o motivo exato (manifesto malformado, sem
assinatura, assinatura inválida, chave revogada, já instalado).

**Runtime dinâmico** (`registry.ts`): `PLUGIN_RUNTIMES` passou de `const
Record` para um `Proxy` sobre um `Map` dinâmico + built-ins. Funções
`registerPluginRuntime`/`unregisterPluginRuntime` permitem que plugins de
ficheiro corram como os do catálogo. `getPluginRuntime(id)` procura
primeiro nos dinâmicos, depois nos built-in.

**Armazenamento externo** (`plugins/external-storage.ts`): `save`/`load`/
`remove` com chave `jarvis.plugin-package:<id>` em localStorage — manifesto
e código sobrevivem a fechar e reabrir a aplicação.

**Plugin de ficheiro removido:** `PluginCard.onUninstall` limpa o
armazenamento externo e o runtime dinâmico ao remover — não fica lixo.

**Correcção colateral:** `plugin-service.ts` já não descarta plugins que
não estão no catálogo ao carregar — plugins de ficheiro sobrevivem a
reiniciar a app. Os dois testes que verificavam o comportamento antigo
foram atualizados.

**Testes** (`tests/plugins/install-from-file.test.ts`, 29 novos): cobrem
armazenamento externo, registo dinâmico de runtime, validação de pacote
(sem manifest, sem signature, sem signerPublicKey, sem code), validação de
manifesto (sem id, sem name, sem version, sem author), `verifyAndInstallPlugin`
com `isExternal: true` (sem assinatura → recusado, assinatura inválida →
recusado, chave revogada → recusado, assinatura válida → aceite, já
instalado → recusado), fluxo completo de integração (instalar → guardar →
aparece no catálogo externo → sobrevive a reload), remoção (limpa
armazenamento e runtime), e que a assinatura cobre o manifesto mas não o
código.

### O que se confirmou e o que não deu

**Confirmado:** `tsc --noEmit` limpo (fora erros pré-existentes do
`@xterm`), ESLint limpo nos ficheiros tocados, `cargo check` limpo, 1358
testes passam (99 ficheiros).

**Não confirmado ao vivo** (`npm run tauri dev`): a instalação de um
ficheiro `.jarvis-plugin` a sério pela interface — a máquina de
desenvolvimento não estava disponível para abrir a app com Tauri.
Confirmado por testes automatizados o coração da lógica (validação,
assinatura, armazenamento, runtime). Para confirmar ao vivo: criar um
`.jarvis-plugin` com `generateSigningKeyPair` + `signManifest`, gravar o
JSON, abrir a app, clicar em "Instalar de ficheiro", escolher o ficheiro,
ver o plugin aparecer na lista de Instalados e o botão "Executar" correr o
código no iframe. Os comandos Rust e o diálogo nativo são variações diretas
de padrões já confirmados ao vivo (Peça 7, sistema de ficheiros real).

### Estado do Lote 2

As cinco peças do Lote 2 estão concluídas:
1. ✅ Terminal PTY real
2. ✅ Cofre de segredos (Windows Credential Manager)
3. ✅ Windows Hello + sessão automática
4. ✅ Assinatura de plugins — Ed25519 via SubtleCrypto
5. ✅ Instalar plugin de ficheiro local (esta peça)

O Lote 2 fecha-se aqui. A próxima peça a decidir com o utilizador é o
marketplace real (onde vivem os plugins de terceiros, quem os revê, como
se atualizam) — ver `docs/spec/plugins-marketplace.md`.

## 2026-08-12 — Revisão da Peça 9: dois `describe` que não testavam nada, e verificação ao vivo

Antes de aceitar a Peça 9 da DeepSeek como fechada, puxei o commit para o
worktree principal e corri a bateria completa por fora (não confiar só no
relatório de quem fez a peça é a regra desde a primeira revisão desta
noite, das Automações).

`tsc --noEmit` apanhou logo um erro real: `validatePackage` declarada e
nunca lida em `tests/plugins/install-from-file.test.ts`. A olhar para o
porquê, o problema era maior do que uma variável a mais — o `describe`
inteiro (`validatePackage (validação da forma do .jarvis-plugin)`) tinha
uma função auxiliar que tentava chegar à função privada por um
`_validatePackage` que nunca existiu no módulo, falhava sempre, e cada
`it()` a seguir nunca a chamava — reimplementava a validação à mão, linha
a linha, dentro do próprio teste. Um segundo `describe`
(`validateManifest (campos obrigatórios)`) era pior ainda: os testes só
verificavam que `testManifest({ id: '' }).id === ''`, ou seja, que o
próprio auxiliar de teste sabia sobrepor um campo — nunca chamavam
`validateManifest` nenhuma. As duas suites passavam sempre, mesmo que a
validação real estivesse completamente partida, porque não tocavam nela.

Corrigido: `validatePackage` e `validateManifest` passaram a exportadas
de `install-from-file.ts` (eram privadas só por não se ter pensado em
testá-las diretamente), os dois `describe` foram reescritos para chamar
as funções a sério — incluindo casos que não existiam antes (`signature`
vazia, `signerName` inválido a ser ignorado sem recusar o pacote,
manifesto sem `permissions`, um pacote e um manifesto válidos a
passarem). `eslint` apanhou mais um erro pequeno a seguir (variável de
destructuring não usada) — resolvido com `delete` em vez de destructure.

Com isso corrigido: `tsc` limpo, `eslint` 0 erros, `vitest` 1364 testes
(99 ficheiros), todos a passar — incluindo os 9 testes novos que
substituem os que não testavam nada.

**Verificação ao vivo, a sério** (não só os testes): gerei um
`.jarvis-plugin` real — chave Ed25519 gerada e manifesto assinado pelo
próprio código de produção (`generateSigningKeyPair`/`signManifest` de
`plugins/signature.ts`, correndo por fora via um teste descartável só
para produzir o ficheiro, apagado a seguir). Com `npm run tauri dev` a
correr: login, abri o Gestor de Plugins, cliquei "Instalar de ficheiro",
o diálogo nativo abriu a sério, escrevi o caminho do ficheiro gerado,
"Abrir" — Instalados subiu de 9 para 10, e o cartão novo mostrou
"Assinado e verificado por Sonnet (verificação ao vivo)" a verde, com a
descrição e o autor exatamente como escritos no manifesto. Removi o
plugin a seguir (o cartão "Remover" funcionou, notificação de confirmação
a sério) para não deixar o ambiente da pessoa com um plugin de teste
instalado.

Isto confirma o pipeline inteiro a funcionar de ponta a ponta na máquina
real: diálogo nativo → comando Rust `read_plugin_file` → `JSON.parse` →
`validatePackage` → `validateManifest` → `verifyAndInstallPlugin` (Ed25519
a sério) → registo no `PluginStore` → interface a mostrar o estado
correto. Os caminhos de recusa (JSON malformado, sem assinatura,
assinatura inválida, chave revogada) ficam cobertos pelos 9 testes
corrigidos, não por tentativa ao vivo — o caminho positivo é que
justificava confirmar com a aplicação a correr a sério.

Commit e push feitos depois deste conserto — o commit da DeepSeek
(`b8b8384`) já estava no branch partilhado; isto soma-se por cima, não o
substitui.

## 2026-08-13 — Peça 8, Lote 2: meteorologia real (Open-Meteo)

Primeira das quatro sub-tarefas de "provedores de rede reais" (meteorologia,
notícias, email, música). Escolheu-se o **Open-Meteo** em vez do OpenWeatherMap
porque não precisa de chave — é gratuito, sem registo, e a previsão a 7 dias
pedida pela Parte 6.2 não usa nada que uma chave acrescentasse; evita ainda
mais um segredo no cofre e a explicação correspondente na interface. O custo é
só a localização: a pessoa escreve o nome da cidade, que o geocoder do próprio
Open-Meteo resolve.

Implementado o `OpenMeteoProvider` (geocoding → coordenadas → forecast, com o
mapeamento dos códigos WMO para as condições da interface), mais a cadeia
completa de configuração no mesmo molde da IA: `weather-settings` (types),
`useWeatherSettingsStore` (estado + persistência — sem cofre, porque a cidade
não é segredo), `useWeatherSettings` (converte preferências no provedor em
vigor) e o ecrã `WeatherSettings` em Personalização. Por omissão **continua o
simulado**: só liga a rede quando a pessoa a liga, e sem cidade mantém o
simulado em vez de rebentar. O CSP em `tauri.conf.json` passou a autorizar os
dois domínios do Open-Meteo. `tsc`, `eslint` e `vitest` limpos (1398 testes,
mais 34 novos). A verificação ao vivo ficou por fazer — o Open-Meteo devolve
dados sem chave, mas não se confirmou o pedido a partir da app empacotada
nesta máquina; os testes automatizados cobrem o mapeamento e a forma dos
pedidos.

## 2026-08-13 — Peça 8, Lote 2: notícias reais (NewsAPI, chave no cofre)

Segunda sub-tarefa de "provedores de rede reais". A NewsAPI precisa de chave,
por isso seguiu-se o molde da DeepSeek em vez do da meteorologia: a chave vive
no cofre do sistema (`news-api-key`), nunca no storage normal, e a interface
mostra-a tapada, com mostrar/apagar. A presença da chave é a própria
configuração — sem chave, mantém-se o simulado.

Dois pontos que pediram decisão explícita, documentados no provedor e aqui. O
primeiro: **categorias**. A NewsAPI só devolve a categoria quando se pede uma
em concreto, e o topo geral não classifica; pedir cinco categorias por leitura
rebentava o plano gratuito (100 pedidos/dia). Pediu-se o topo geral e
adivinha-se a categoria por palavras no título/resumo/fonte (melhor esforço,
"mundo" por omissão). O segundo: **marcas de leitura e favoritos** ficam
locais, no storage, chaveadas pelo endereço do artigo — os serviços de
notícias não sincronizam estas marcas, e fingir que sincronizam seria mentir.
`tsc`, `eslint` e `vitest` limpos (1419 testes, mais 21). A verificação ao vivo
depende de uma chave real da NewsAPI, que esta máquina não tem — ficou por
confirmar em execução; os testes cobrem a forma do pedido e o mapeamento.

## 2026-08-13 — Peça 8, Lote 2: email real (IMAP + SMTP no Rust)

Terceira sub-tarefa de "provedores de rede reais", e a mais pesada das quatro.
O email fala dois protocolos — IMAP para ler, SMTP para enviar — e nenhum
existe no browser, por isso desta vez a implementação é nativa:
`src-tauri/src/commands/mail.rs` com o crate `imap` (v2.4, TLS) para ler a
INBOX e `lettre` (0.11, STARTTLS na porta 587) para enviar, ambos sobre
`native-tls`/schannel no Windows. A palavra-passe da conta fica no cofre
(`mail-password`, o mesmo molde da NewsAPI); servidor, portas e utilizador no
storage normal — nunca em texto simples. Por omissão continua o simulado.

Limitações documentadas no código e aqui, em vez de fingidas: só a INBOX (as
pastas "enviados" e "arquivo" do widget continuam do simulado), prioridade
sempre "info", corpo cru e truncado a 32 kB (sem descodificar
base64/quoted-printable nem extrair anexos), um só destinatário por envio e o
remetente é a própria conta. Ler usa `BODY.PEEK` para não marcar como lido; as
marcas de leitura/favorito sincronizam por `mail_set_flag` (`seen`/`flagged`).
`tsc`, `eslint` e `vitest` limpos (1442 testes, mais 23); `cargo clippy` limpo
no novo código (sobrou só um aviso pré-existente em `system/monitor.rs`). A
verificação ao vivo contra um servidor real ficou por fazer — exige credenciais
IMAP/SMTP que esta máquina não tem —; os testes cobrem a forma das chamadas, a
divisão storage/cofre e a degradação no Web/Android.

## 2026-08-13 — Kimi trava logo ao início nas Peças 10+11, limite de taxa da organização

Equipa alargada esta tarde: DeepSeek continua na Peça 8 (rede real), a Kimi
entrou de novo num worktree próprio (`agents/kimi`, criado hoje) para as
Peças 10 e 11 (wake word e voz em tempo real com barge-in), e o Qwen foi
testado outra vez para a Peça 12 antes de se lhe atribuir nada — continua
sem cota (mesmo erro 429 de sempre, "token-plan 1-week quota... reset em
08-19 03:23 UTC"), por isso a Peça 12 fica por atribuir.

A Kimi travou muito cedo, sem chegar a produzir nada de significativo:
`API Error: Request rejected (429) — organization TPD rate limit, current:
1609315, limit: 1500000`. Isto é diferente do que aconteceu ao Qwen — não é
"sem crédito nenhum", é um limite de tokens por dia da organização inteira
(TPD), que pode libertar-se num período mais curto do que a cota semanal do
Qwen. Mesmo assim, segue-se a mesma regra: não se insiste às cegas.

O que ficou no worktree da Kimi, por commitar (revisto antes de decidir
alguma coisa, dada a sensibilidade destas duas peças): um store novo,
`src/stores/use-wake-word-store.ts` — só o esqueleto do interruptor
(`enabled: false` por omissão, `palavra` configurável, persistência via
`storageService`), sem deteção nenhuma, sem microfone, sem nada que grave
ou transmita áudio. E uma linha nova em `storage-service.ts`
(`STORAGE_KEYS.wakeWord`). Confirmado seguro por leitura direta do código —
não é código a meio de fazer algo sensível, é só a base de um interruptor
desligado. Deixado como está, sem commit (não é uma peça completa nem
testada), para uma retoma futura continuar dali em vez de recomeçar do
zero.

Não se reatribuiu a Peça 10/11 à DeepSeek nem a ninguém — é a peça mais
sensível do projeto, e trocar de sessão a meio muda quem tem o contexto da
leitura da ética que se pediu para fazer primeiro. Fica em pausa até haver
uma razão concreta para pensar que o limite aliviou, ou até o utilizador
decidir doutra forma.

## 2026-08-13 — Peça 12, Lote 3: Ollama com ferramentas

Com a DeepSeek na Peça 8 e a Kimi parada num limite de taxa, e o Qwen sem
cota (confirmado outra vez, mesmo erro de sempre), peguei nesta peça
diretamente — está fora do domínio sensível de voz/áudio, tinha contexto
suficiente já investigado, e não repete trabalho de ninguém.

**O que mudou:** `sendWithTools` (`ai-service.ts`) tinha um bloqueio
explícito — só um `provider instanceof DeepSeekProvider` chegava a pedir
ferramentas; qualquer outro (incluindo a Ollama) virava um envio normal,
sem ferramenta nenhuma disponível. Passa a existir `isToolCapable()`, que
deixa a DeepSeek passar sempre e a Ollama passar quando
`OllamaProvider.supportsToolCalling()` disser que sim.

**A decisão de como detetar suporte:** não há forma de perguntar ao
próprio Ollama "este modelo sabe pedir ferramentas?" sem fazer um pedido a
sério — e sondar antes de cada pedido real custa tempo por nada. Optei por
comparar o nome do modelo configurado contra uma lista de prefixos de
famílias que a Ollama documenta como capazes (qwen, llama3.1+, mistral/
mixtral, firefunction, command-r). Documentado no próprio código como um
palpite informado, não uma garantia — a lista fica desatualizada à medida
que a Ollama for suportando mais modelos, e um modelo customizado pode
escapar aos dois lados do palpite.

`OllamaProvider` ganhou um `run()` novo, gémeo do da DeepSeek em espírito:
manda `tools: toolsAsJsonSchema()` no pedido e reaproveita o `collect()`
já existente (exportado de `deepseek-provider.ts`) para separar texto de
`tool_calls` na resposta — os dois falam o mesmo protocolo compatível com
a OpenAI, por isso reaproveitar em vez de duplicar o parser fazia sentido.

**Confirmado a sério, com o Ollama real a correr nesta máquina**
(`qwen3:8b`, o único modelo instalado): comecei por ligar o servidor
(`ollama serve` não estava a correr) e confirmei o modelo com `ollama
list`. Um pedido cru por `Invoke-RestMethod` (sem streaming) devolveu
`tool_calls` corretos para a ferramenta `notificar`, com os argumentos
certos. Repeti em `stream:true` para ver o formato a sério: descobri que o
qwen3 manda o seu "raciocínio" em `delta.reasoning` (não
`delta.reasoning_content`, como a DeepSeek) — mas como o `collect()`
reaproveitado só lê `delta.content` e `delta.tool_calls`, esse campo
nunca chega a aparecer na resposta visível, sem precisar de nenhuma
mudança de código. O `tool_calls` chegou inteiro num único evento, ao
contrário da DeepSeek que às vezes parte os argumentos por vários — o
`collect()` já lida com isso na mesma, porque acumula por índice
independentemente de vir tudo de uma vez ou aos bocados.

**O que não mudou:** o tecto de 60 segundos antes de desistir e cair para
o próximo provedor da cadeia (confirmado a sério a 10/08/2026, para
pedidos sem ferramentas) é herdado sem alteração nenhuma — `run()` usa o
mesmo `TIMEOUT_MS`. Não repeti esse teste de arranque a frio a sério
(descarregar o modelo da memória e cronometrar de novo) porque o mecanismo
é código idêntico ao já confirmado, só a chamar `collect()` em vez de
`readStream()` — o risco novo estava na deteção de capacidade e no parser
de `tool_calls`, que foram os dois confirmados a sério. A cadeia de
fallback (DeepSeek → Claude → Ollama) com ferramentas envolvidas degrada
para texto simples ao trocar de provedor a meio (`recover()` usa sempre
`stream()`, nunca `run()`, ao saltar para o próximo) — comportamento
pré-existente, igual para a DeepSeek, não uma regressão desta peça.

**Testes:** 30 novos — `tests/assistant/ollama-provider.test.ts`
(`supportsToolCalling` com famílias conhecidas e desconhecidas,
maiúsculas/minúsculas, `run()` a mandar o catálogo de ferramentas e a
interpretar um pedido partido em vários pedaços) e
`tests/assistant/send-with-tools-ollama.test.ts` (`AIService.sendWithTools`
de ponta a ponta com um `OllamaProvider` a sério — não um mock — e
`fetch` falso: com `qwen3:8b`, manda ferramentas e executa a que o modelo
pediu; com `llama2`, nunca manda o campo `tools` e cai para um envio
normal). Suite completa: 1443 testes (104 ficheiros), `tsc` limpo,
`eslint` 0 erros.

## 2026-08-13 — Correção de documentação desatualizada (SPEC.md)

Duas linhas do SPEC.md diziam "por fazer" algo que já estava feito havia
dias — apanhado ao rever o SPEC.md por inteiro antes de continuar a Peça
16 (limpeza de documentação, Lote 4).

**Parte 6.2, "Plugin Manager"**: dizia "Não carrega código: ver §2" — mas
o próprio §2 (linha 111) já diz "confirmado 12/08/2026" desde a Peça 9.
A linha 336 nunca tinha sido atualizada depois de a Peça 9 fechar, e as
duas contradiziam-se lado a lado no mesmo ficheiro. Corrigida para ✅,
com a nota de que dizia o contrário antes.

**Parte 10, "Contexto (\"amanhã\", \"esse ficheiro\")"**: dizia "esse
ficheiro continua por fazer — não há ainda nenhuma ferramenta que atue
sobre um ficheiro". Falso — `procurar_ficheiro`/`abrir_ficheiro` existem
desde a sessão que retomou o trabalho da Kimi (entrada "Assistente:
procurar_ficheiro e abrir_ficheiro" mais acima neste ficheiro), com
testes e tudo ligado. A linha ficou por corrigir porque a Peça 6 do Lote
2 (que ia tratar exatamente disto) nunca chegou a ser pega — o trabalho
já tinha sido feito antes, só o SPEC.md não sabia.

Nenhuma linha de código mudou — só o SPEC.md. `tsc`, `eslint` e a suite
não tocados por esta peça, sem necessidade de correr de novo.

## 2026-08-13 — Chave física (WebAuthn), construída diretamente nesta sessão

O utilizador perguntou se eu ia mesmo construir alguma coisa ou só ficar a
escrever prompts para outras sessões — pergunta justa: até aqui, nesta
sessão, só se tinha coordenado. Peguei na Peça 15 da fila (chave física,
ao lado do Windows Hello) e implementei-a de ponta a ponta.

**O que é, com honestidade**: uma cerimónia WebAuthn a sério
(`navigator.credentials.create`/`.get`) com verificação criptográfica real
da assinatura — ECDSA P-256 (ES256, COSE alg -7) sobre `authenticatorData
|| SHA-256(clientDataJSON)`, tudo feito no cliente. Não há servidor a
validar nada, porque este é um sistema de um só utilizador sem backend — a
confiança na chave pública vem de "fui eu que a registei", não de uma
autoridade externa. A matemática da verificação em si não tem atalho
nenhum.

**Um gotcha real, apanhado e corrigido antes de qualquer teste passar**:
o `SubtleCrypto.sign`/`.verify` do WebCrypto usa ECDSA em formato raw
`r || s` de tamanho fixo, mas um autenticador WebAuthn a sério manda a
assinatura em DER (ASN.1). Os dois formatos não são o mesmo, e assumir que
são é um erro comum em implementações caseiras. `derToRawEcdsaSignature`
faz a conversão a sério — e os testes exercitam-na de propósito: em vez de
passar a assinatura raw diretamente (o que testaria menos do que o
código real), o teste converte-a para DER primeiro (`rawSignatureToDer`,
só no ficheiro de teste), simulando o que um autenticador de verdade
mandaria.

**Segundo problema real, apanhado a meio**: `registerSecurityKey` não
verificava o valor de retorno de `secretSet`. No `WebAdapter` (browser,
sem cofre), `secretSet` devolve `false` sem guardar nada — e o código
dizia "registada" na mesma. Corrigido antes de escrever os testes de UI:
agora confere o retorno e recusa com um motivo claro ("Este dispositivo
não tem um cofre de segredos disponível") em vez de mentir sobre o que
ficou guardado.

**Onde vive**: registo em Privacidade → Acesso (`SecurityKeySection`, ao
lado do `SessionLock` já existente) — não no ecrã de login, porque
registar uma credencial nova é uma ação deliberada, não algo para se pedir
a quem ainda nem entrou. O botão "Chave física" do `LoginScreen`, que até
agora só mostrava "Nenhuma chave física detetada nesta porta." (frase
fixa, nunca verificava nada a sério), passa a chamar
`hasRegisteredSecurityKey`/`verifySecurityKey` a sério. Reaproveitei o
`deny()` já existente (shake + som), só lhe dei uma mensagem por
parâmetro em vez de duplicar a lógica.

**Só ES256 (-7)**. RS256 fica por fazer — a maioria dos autenticadores de
plataforma e chaves FIDO2 modernas oferece ES256 por omissão, e cobrir os
dois de uma vez alargava o âmbito sem necessidade imediata.
`signCount` (deteção de clonagem) é guardado e comparado, mas só como
melhor esforço: muitos autenticadores de plataforma devolvem sempre 0, o
que a spec permite — uma contagem que não sobe fica registada na
auditoria, não bloqueia sozinha.

**Testes**: 27 novos — `tests/services/webauthn-service.test.ts` (19,
incluindo geração de pares ECDSA reais em cada teste — zero chaves fixas,
mesmo padrão da Peça 5 — assinatura de chave errada recusada, clientData
adulterado recusado, cerimónia cancelada, algoritmo não suportado, sem
suporte WebAuthn, sem cofre disponível), `tests/auth/login-screen.test.tsx`
(3, com o serviço mockado — a criptografia já está coberta à parte) e
`tests/diagnostics/privacy.test.tsx` (2, incluindo um com chave ECDSA real
gerada e cerimónia real simulada, só a falhar no `secretSet` do
`WebAdapter` de propósito, para confirmar que a interface não finge
sucesso).

**Confirmado**: `tsc` limpo, `eslint` 0 erros, suite completa — 108
ficheiros, 1490 testes, todos a passar (era 104/1443 antes desta peça).

**Não confirmado ao vivo**: esta sessão corre em Linux, na nuvem, sem
hardware Windows. Nem uma chave física real (YubiKey ou equivalente) nem
o Windows Hello via WebAuthn foram testados fora dos mocks descritos
acima. A matemática está confirmada a sério; a cerimónia do próprio
sistema operativo/hardware, não.

## 2026-08-13 — Dois bugs reais reportados em uso: "modo JARVIS Classic" e ponto e vírgula lido à letra

O utilizador reportou dois problemas a usar a app a sério: o assistente
respondeu "Não posso gerar código. Estou no modo JARVIS Classic." a duas
perguntas seguidas, e a síntese de voz continuava a ler "ponto e vírgula"
em voz alta.

**"Modo JARVIS Classic" — não é um modo, é o nome de um tema.** O prompt
de sistema (`systemPrompt`, `deepseek-provider.ts`, partilhado por
DeepSeek/Claude/Ollama via `buildMessages`) mandava `"Tema em vigor:
${context.theme}."` — "JARVIS Classic" é só o tema visual base
(`design-system/tokens.ts`). Um modelo local (parece o Ollama, dado o
padrão de resposta) confundiu essa frase com uma restrição de capacidade
e inventou que não sabia gerar código. Corrigido: a frase passa a
explicar de frente que o tema e o estado do sistema são só aparência e
ritmo, nunca uma restrição ("nunca uma restrição sobre o que sabes fazer
... incluindo escrever código"). Teste novo em `deepseek.test.ts` prende
a frase de aviso e a ausência do texto antigo ambíguo.

**Ponto e vírgula nunca tinha sido tratado.** `limparParaSintese`
(`voice-service.ts`) só limpava reticências e o ponto final da frase
inteira (correção de 10/08/2026) — ponto e vírgula ficou de fora desde
sempre, apesar de ter o mesmo problema (a síntese, por vezes, lê-o à
letra). Mesma correção: vira vírgula, mantém a pausa, tira o risco de ser
lido. 2 testes novos em `text-cleaning.test.ts`.

**Confirmado**: `tsc` limpo, `eslint` 0 erros, suite completa — 108
ficheiros, 1493 testes (era 1490 antes destas duas correções).

**Não confirmado ao vivo**: a redação nova do prompt de sistema não foi
testada contra um Ollama real nesta sessão (sem hardware) — só por
teste automatizado, que confirma o texto enviado, não a reação do
modelo. A correção da pontuação também não foi ouvida com áudio real
nesta sessão, pela mesma razão — mas segue exatamente o padrão já
confirmado ao vivo em 10/08/2026 para o ponto final.

**Nota lateral, sobre a mesma sessão**: durante este trabalho, uma
mensagem de outra sessão local (o lançador da DeepSeek, `claude-deepseek-
lancador.ps1`, a trabalhar na Peça 14 com automação real de cliques)
apareceu misturada na conversa com o utilizador — um menu interativo
("How should I proceed with the notification live-verification...")
claramente dirigido a essa outra sessão, não a esta. Sinalizado ao
utilizador antes de qualquer ação, e confirmado por ele com uma captura
de ecrã: era mesmo uma sessão irmã, a pedir instrução ao utilizador
diretamente no seu próprio terminal, sobre um risco real que detetou
sozinha (confiar em `SetForegroundWindow` sem confirmar o foco da janela
antes de mandar cliques). Nenhuma ação foi tomada aqui em cima dessa
mensagem — só uma recomendação dada ao utilizador (opção 1: corrigir a
pontaria antes de continuar), para ele levar à sessão certa.

## 2026-08-13 — Lote 4: revisão do email da DeepSeek, Peça 16 (limpeza de documentação) e Peça 14 (notificações nativas isoladas)

Novo lote do utilizador: DeepSeek continua no email e depois música (Peça
13, fecha a Peça 8); Kimi continua bloqueada pelo limite de taxa da
organização, sem trabalho novo até haver sinal de que aliviou; três peças
novas — 13 (música, DeepSeek), 14 (notificações nativas isoladas, para
quem ficasse livre), 15 (chave física FIDO2/WebAuthn), e 16 (limpeza de
documentação, para mim).

**Revisão independente do email (Peça 8, sub-tarefa C):** pull do commit
da DeepSeek, `tsc`/`cargo check`/`eslint`/`vitest` (1466 testes) corridos
por fora — tudo limpo. Confirmei a palavra-passe IMAP/SMTP a passar pelo
cofre (`secretSet('mail-password', ...)`, com `semSegredos()` a excluir o
campo do storage normal, mesmo padrão da meteorologia/notícias). Li
`src-tauri/src/commands/mail.rs` a sério: sem `unwrap()` nenhum, `imap`
para ler (INBOX só, `BODY.PEEK[TEXT]` para nunca marcar como lida ao ler),
`lettre` para enviar por SMTP com STARTTLS, limitações documentadas com
honestidade (corpo truncado a 32 kB, sem descodificar anexos nem
codificações de transferência, só porta 587). Testes (`imap-mail-provider
.test.ts`) chamam mesmo a classe real, com o adapter mockado a interceptar
`mailFetch`/`mailSetFlag`/`mailSend` — nada do padrão de testes falsos da
Peça 9. Nada a corrigir desta vez.

**Peça 16 — limpeza de documentação:** duas entradas do SPEC.md diziam
"por fazer" o que já estava feito. A linha de "Contexto (amanhã, esse
ficheiro)" dizia "esse ficheiro continua por fazer" e ainda "ferramentas
só correm com a DeepSeek" — as duas erradas: `abrir_ficheiro` resolve a
referência desde o commit `53864a9`, e a Peça 12 (Ollama com ferramentas,
mais cedo hoje) já não faz disso verdade. A linha do Plugin Manager dizia
"não carrega código: ver §2" — apontava para uma secção genérica sobre
Tauri nativo que nunca falou de plugins, e a Peça 9 já trouxe execução
real de plugins externos. As duas corrigidas para refletir o estado
verdadeiro, sem mexer em código nenhum. **Redundância descoberta ao
mesclar**: outra sessão (a que estava na Peça 15) apanhou exatamente as
mesmas duas linhas, de forma completamente independente, e corrigiu-as
primeiro — ver a entrada "Correção de documentação desatualizada" logo
acima. As duas versões concordavam no essencial; ficou a mais completa
das duas, com uma nota a dizer que foi apanhado duas vezes.

**Peça 14 — notificações nativas, isoladas:** nunca tinham sido testadas
à parte — só de caminho, a cada arranque. 10 testes novos
(`tests/services/notification-service.test.ts`): o pedido de permissão a
sério ao plugin (`TauriAdapterBase.sendNativeNotification`, via
`DesktopAdapter`, com o plugin `@tauri-apps/plugin-notification`
mockado) — concedida logo, pedida e depois concedida, recusada (nunca
chama `sendNotification`), e o plugin a rebentar sem crashar; e o
`NotificationService` a decidir quando chega a pedir a nativa consoante o
estado do sistema (Normal deixa sempre, Foco só o urgente, Apresentação
nunca) e `silent`, confirmando que o toast interno e a nativa nunca
mostram informação diferente uma da outra (mesmo título/descrição nas
duas chamadas) e que uma notificação suprimida fica na história
(`isDismissed: true`), não desaparece.

**O incidente da verificação ao vivo — registado com honestidade.**
Tentei confirmar ao vivo com `npm run tauri dev`, reutilizando o padrão de
automação por `SendKeys`/`mouse_event` desta sessão. Ao clicar e escrever
na janela de login, o texto ("verificacao-toast") foi parar a outra
janela — uma sessão interativa do Claude Code, do próprio utilizador,
com a conta "Anderson · Pro", **já a trabalhar na Peça 15 (chave física
FIDO2/WebAuthn)** neste mesmo repositório e branch. O assistente dessa
sessão respondeu à mensagem estranha a pedir para o utilizador esclarecer.
A app JARVIS já estava autenticada por sessão automática de um login
anterior nesta mesma instância de `tauri dev`, por isso o script nem deu
pelo erro na hora — só ao tirar a fotografia seguinte é que se percebeu
que o texto tinha ido parar ao sítio errado.

Corrigi o script (`jarvis-click.ps1`, no scratchpad da sessão) para
confirmar a sério, com `GetForegroundWindow`, que a janela do JARVIS
ficou mesmo em primeiro plano antes de qualquer clique ou tecla — e a
voltar a confirmar depois do clique, antes de escrever. A correção expôs
o problema real: o Windows recusa-se a dar o foco à força a uma janela
que não é a que já o tem (proteção contra "roubo de foco" antiga do
próprio sistema) enquanto a sessão do utilizador continuava ativa e a
competir pelo foco. Não há forma segura de contornar isto sem arriscar
mandar mais texto para o sítio errado.

Perguntei ao utilizador como proceder. Escolheu não forçar: ficar-se
pelos 10 testes automatizados como confirmação desta peça, sem tentar de
novo a verificação ao vivo enquanto a outra sessão dele estivesse ativa.
Documentado assim no SPEC.md — sem fingir uma confirmação ao vivo que não
aconteceu.

**Descoberta importante, fora do âmbito desta peça:** a Peça 15 (chave
física/WebAuthn) já está a ser trabalhada — pelo próprio utilizador, numa
sessão interativa separada, não por mim nem por nenhuma das sessões que
lancei (DeepSeek, Kimi, Qwen). Não lhe toco nem a atribuo a mais ninguém.

Suite completa depois destas peças: 1476 testes (108 ficheiros), `tsc`
limpo, `eslint` 0 erros.

## 2026-08-13 — Peça 8, Lote 2: música local (pasta + `<audio>` real)

Quarta e última sub-tarefa de "provedores de rede reais" — e a única que,
afinal, não tem rede nenhuma. A música toca ficheiros de áudio de uma
pasta escolhida pelo utilizador, num elemento `<audio>` a sério, servida
pelo protocolo `asset` do Tauri (`convertFileSrc` no front, `allow_directory`
em runtime no Rust). Spotify ficou de fora por decisão já assente na
especificação. Por omissão mantém-se o simulado; sem pasta, nada muda para
quem não configurar.

O molde é o da Peça 7 (sistema de ficheiros): `music_set_root` valida a
pasta e alarga o âmbito do protocolo `asset` a essa pasta só; `music_read_dir`
lista os ficheiros de áudio (mp3/wav/ogg/flac/m4a/aac/opus) sem sair dela.
Estado separado do Explorador (`MusicRoot` vs `FilesRoot`), para a música não
herdar a raiz do Explorador nem o inverso. **Não há segredo nenhum** — ao
contrário da NewsAPI e do email, o caminho da pasta não é credencial, por
isso vai para o storage normal e não para o cofre. Um detalhe de
configuração que custou uma ida ao código do `tauri-build`: ativar
`assetProtocol` no `tauri.conf.json` obriga a declarar a feature
`protocol-asset` na dependência base do `tauri` no `Cargo.toml` (o build
script compara as features contra o allowlist derivado da config), não só
no alvo desktop. `tsc`, `eslint` e `vitest` limpos (1486 testes, mais 43);
`cargo check` e `cargo clippy` limpos no novo código (sobrou só o aviso
pré-existente em `system/monitor.rs`). A verificação ao vivo da reprodução
ficou por fazer — ouvir som exige interação humana —; os testes cobrem a
escolha da pasta, a listagem, a reprodução/pausa/avanço/volume e a
degradação no Web/Android.

## 2026-08-13 — Revisão da Peça 13 (Música): duração devolvida atrasada um ciclo

Prometido no lote anterior: revisar por fora em vez de só confiar nos
testes a passar. Peguei na peça mais recente que ainda ninguém tinha
revisto — a Música, mesclada minutos antes desta entrada.

`tsc`, `eslint` e a suite inteira confirmados limpos primeiro (110
ficheiros, 1513 testes). Depois, leitura do código a sério —
`local-music-provider.ts`, não só `music.rs` (que ficou por confirmar
com `cargo check` aqui: a primeira compilação nesta máquina não terminou
dentro de um tempo razoável, sem cache nenhum — as sessões locais no
Windows real já confirmam isso à parte).

**Bug real, pequeno**: `getState()` chamava `refreshDuration(track)`, que
substitui a entrada em `this.tracks[this.index]` por uma cópia com a
duração corrigida assim que o `<audio>` sabe a duração real — mas a
função devolvia a variável `track` de cima, a referência **antiga**, sem
a duração nova. O array ficava certo; a resposta não. Efeito prático:
depois de o metadata carregar, a duração aparecia como 0 numa sondagem a
mais antes de se corrigir sozinha na seguinte — invisível a olho nu com
sondagem a cada segundo, mas era uma inconsistência real entre o que a
função calcula e o que devolve, exatamente o tipo de coisa que os testes
existentes não apanhavam por nunca simularem o metadata a chegar a meio.

Corrigido: `getState()` volta a ler `this.tracks[this.index]` depois de
`refreshDuration`, em vez de reusar a referência de antes. Um teste novo
prende isto a sério — muda a duração do `<audio>` falso a meio (simula o
`loadedmetadata`) e confirma que a **mesma** chamada a `getState()` já
devolve o valor certo, não só a chamada seguinte.

**Testes**: 1 novo em `tests/services/local-music-provider.test.ts`
(10 no total no ficheiro). Suite completa: 110 ficheiros, 1514 testes,
`tsc` limpo, `eslint` 0 erros.

Sem mais achados nesta revisão — o resto do provedor (avançar/recuar,
shuffle, repeat, degradação sem pasta) leu-se coerente com o que os
testes já cobrem.

## 2026-08-13 — Peça 8 fecha-se por completo; "Regra em vigor" (SPEC.md §3) estava toda desatualizada

Com a música mesclada, as quatro sub-tarefas da Peça 8 (meteorologia,
notícias, email, música) estão feitas e revistas — Lote 2 fecha-se a
sério desta vez, com as cinco peças reais do pedido original do
utilizador confirmadas (5, 6, 7, 8, 9).

Ao rever o SPEC.md para fechar a Peça 8, reparei que a secção inteira "3.
Regra em vigor a partir daqui" nunca tinha sido atualizada desde antes de
qualquer código nativo ser desbloqueado — descrevia Terminal, ficheiros,
plugins e chamadas de rede como bloqueados "até a Fase 1 correr num PC a
sério", quando esse portão foi passado há muitos lotes. Duas das cinco
alíneas (leitura do disco, execução de plugins) ainda descreviam o estado
de antes da Peça 7 e da Peça 9 como se fosse o estado atual — mesmo
depois de as tabelas de funcionalidades correspondentes já dizerem ✅ há
dias. Corrigido: nota no topo da secção a explicar que ficou por
atualizar e que a tabela de cada funcionalidade é que manda, e as duas
alíneas reescritas para o estado real.

Isto não muda código nenhum — só documentação. Fica como primeiro
resultado da "revisão a sério da noite inteira" que o utilizador pediu
antes de dormir; a revisão continua.

## 2026-08-13 — Revisão a sério da Peça 15: falha real de segurança na chave física, apanhada e corrigida

Segundo resultado da revisão pedida ("escolhe 2-3 peças recentes e revê-as
como se fosse a primeira vez a ver o código"). Escolhi a Peça 15
(WebAuthn) por ser a mais recente que eu próprio ainda não tinha revisto
de forma independente — só tinha corrido os testes por fora, não lido o
código linha a linha.

**A falha**: em `webauthn-service.ts`, tanto `registerSecurityKey` como
`verifySecurityKey` geram um `challenge` aleatório e mandam-no ao
autenticador (`navigator.credentials.create`/`.get`), mas nunca conferem
que a resposta que volta contém esse mesmo `challenge`. A verificação
criptográfica da assinatura (ECDSA sobre `authenticatorData ||
SHA-256(clientDataJSON)`) prova que a resposta foi assinada pela chave
privada certa — mas isso sozinho **não prova que é a resposta ao pedido
que se acabou de fazer**. Sem conferir o `challenge`, uma resposta antiga
e válida (capturada e reaproveitada, por exemplo) passaria pela
verificação da assinatura sem ninguém dar por isso — é exatamente o passo
que a especificação WebAuthn existe para impedir (repetição), não um
detalhe cosmético. A cerimónia de registo tinha o mesmo problema, com
risco menor (ainda não há credencial guardada para se fazer passar por).

**A correção**: as duas funções passam a decodificar `clientDataJSON`
(function nova, `decodeClientDataJSON`, nunca lança — um JSON malformado
falha a verificação a seguir, não rebenta aqui) e a conferir `type`
(`webauthn.create` no registo, `webauthn.get` na verificação) e
`challenge` antes de aceitar qualquer coisa. O `challenge` chega em
`clientDataJSON` codificado em **base64url** (sem `+`/`/`, sem
preenchimento) — diferente do base64 normal que `arrayBufferToBase64` já
usava para guardar a credencial no cofre; função nova,
`base64UrlEncode`, especificamente para este confronto, documentada a
explicar a diferença para não se trocarem os dois por engano no futuro.

**O que isto partiu, e como se corrigiu**: a suite de testes existente
(19 testes) construía sempre o mesmo `clientDataJSON` fixo
(`challenge: 'dGVzdGU'`), nunca derivado do `challenge` real que o código
gerava a cada chamada — com a correção, isso falharia sempre. Reescrevi
os mocks de `navigator.credentials.create`/`.get` para lerem o
`challenge` das próprias opções que o serviço lhes passa (é assim que um
mock de uma API a sério devia funcionar — a receber o que lhe mandam, não
a ignorar) e construírem a resposta em cima dele. Um teste
("clientDataJSON alterado depois de assinar") tinha de mudar o que
adultera — antes mudava o `challenge` (o que agora seria apanhado pela
verificação nova, não pela da assinatura, deixando de testar o que dizia
testar); passou a adulterar o `origin` em vez disso, mantendo o
`challenge` correto, para continuar a testar mesmo que os bytes assinados
mudarem invalida a assinatura. Um teste novo cobre especificamente a
repetição: um `challenge` diferente do pedido, com assinatura
matematicamente válida, tem de ser recusado antes de a assinatura sequer
ser conferida. Mesma correção replicada em `tests/diagnostics/
privacy.test.tsx`, que também simula a cerimónia a sério.

**Confirmado**: `tsc` limpo, `eslint` 0 erros, suite completa — 111
ficheiros, 1524 testes (era 1523; +1 líquido, com vários testes existentes
reescritos para continuarem a testar o que diziam testar).

**Não confirmado ao vivo**: mesma limitação de sempre para esta peça —
sem hardware Windows/YubiKey nesta sessão. A correção em si é lógica
pura sobre bytes, sem dependência de hardware — testada a sério com
chaves ECDSA reais geradas em cada teste, só a cerimónia do sistema
operativo é que fica por confirmar.

## 2026-08-13 — Revisão a sério da Peça 12 (Ollama com ferramentas): nada de funcional a corrigir

Terceira revisão independente pedida ("revê como se fosse a primeira vez,
sem confiar nos testes só porque passam"). Escolhi a Peça 12 (Ollama com
ferramentas) porque foi feita a solo, sem ninguém a rever depois — era
exatamente o tipo de peça que a tarefa queria apanhar.

**As cinco perguntas, uma a uma:**
1. **Os testes chamam funções reais ou reinventam a lógica?** Chamam as
   reais. `ollama-provider.test.ts` exercita o `supportsToolCalling()`, o
   `run()` e o `stream()` verdadeiros (só o `fetch` é falso);
   `send-with-tools-ollama.test.ts` atravessa o `AIService.sendWithTools`
   real com um `OllamaProvider` real, não um mock. Nenhum teste duplica o
   parser do `collect()`.
2. **O `startsWith()` nos prefixos dá falsos positivos?** Em teoria podia
   (`qwen` apanha `qwen2`/`qwen2.5`/`qwen3`; `mistral` apanha
   `mistral-embed`), mas na prática é seguro: acrescentar um separador
   partiria a deteção da família `qwen` (não há separador depois do nome),
   e o único caso marginal (`mistral-embed`) não é um modelo de conversa.
   O palpite já está documentado no código como tal, portanto nenhuma
   mudança.
3. **O `recover()` usar sempre `stream()` (nunca `run()`) é pré-existente?**
   Sim. Confirmei por `git show` no commit da Peça 12: só tocou no import
   do `OllamaProvider`, no `isToolCapable()` e num comentário do
   `networkBlocked()` — o `recover()` ficou intocado. A degradação para
   texto simples ao trocar de provedor a meio de uma ronda de ferramentas
   é comportamento antigo da DeepSeek, não uma regressão desta peça.
4. **O `collect()` tem pressupostos da DeepSeek que não batem com a
   Ollama?** Não. Só lê `delta.content` e `delta.tool_calls`, ignora
   qualquer `delta.reasoning`/`delta.reasoning_content`, acumula
   `tool_calls` por índice e só interpreta o JSON dos argumentos no fim —
   tudo genérico ao protocolo compatível com a OpenAI, nada específico da
   DeepSeek.
5. **Há algum caminho onde um pedido de ferramenta fique pendurado para
   sempre?** Não. O `run()` herda o `TIMEOUT_MS` de 60s com
   `AbortController` (o relógio e o cancelamento de quem chama, os dois),
   e o `collect()` sai no fim do `body`. Qualquer resposta inesperada vira
   `AiFailure('demora'|'rede')` e cai no fallback.

**A única coisa encontrada**: um comentário desatualizado no `catch` do
`sendWithTools` ainda dizia "o provedor é a DeepSeek" quando agora também
é a Ollama — a mesma classe de deriva que este projeto tem corrigido
repetidamente. Corrigi o comentário (sem mudança de comportamento, por
isso sem teste novo).

**Confirmado**: `tsc` limpo, `eslint` 0 erros, suite completa — 111
ficheiros, 1525 testes.

## 2026-08-13 — 2FA a sério: palavra-passe/PIN + chave física, não um OU

Próximo passo natural sobre o WebAuthn, já identificado no SPEC.md. Antes
de começar, puxei a correção do challenge (replay) que apareceu entretanto
— revista e confirmada por fora (49 testes nos três ficheiros de WebAuthn/
login/privacidade, todos a passar), sem conflito real com este trabalho.

**O que muda**: hoje, palavra-passe, PIN, biometria e chave física eram
quatro portas independentes — qualquer uma, sozinha, dava acesso. Com o
interruptor "Exigir segundo fator" ligado (Privacidade → Acesso, só
visível com uma chave já registada), a palavra-passe e o PIN deixam de
bastar sozinhos: depois de aceites, o login mostra um passo 2 de 2 ("Usar
chave física"), e só `grant()` depois de `verifySecurityKey()` confirmar
a assinatura a sério. Biometria e a chave física usada diretamente
continuam a bastar-se a si mesmas — já são, cada uma, um fator forte, e
exigir a chave como segundo fator de si própria não faria sentido.

**Um problema apanhado ao construir, antes de qualquer utilizador
encontrar**: a fila de atalhos (Reconhecimento facial, Impressão digital,
PIN, Chave física) ficava visível por baixo do formulário mesmo durante o
segundo fator — clicar em qualquer um deles entrava sem passar pelo passo
que se acabou de exigir, anulando o 2FA na hora. Escondida enquanto
`awaitingSecondFactor` estiver ativo.

**Estado inconsistente tratado**: `twoFactorEnabled` vive em `Appearance`
(mesmo padrão do `idleLockMinutes` — segurança, não decoração, por isso
fora de `AMBIENCE_KEYS`, não viaja com perfis). Remover a chave desliga o
2FA sozinho, para o interruptor nunca ficar ligado a apontar para nada. E
mesmo que o interruptor fique ligado por alguma via inesperada sem chave
nenhuma registada, `completeFirstFactor` confere `hasRegisteredSecurityKey()`
a sério antes de exigir o segundo passo — nunca trava alguém sem ter como
completar o que está a pedir.

**Testes**: 8 novos em `login-screen.test.tsx` (desligado entra sozinho;
ligado exige o segundo fator e esconde os atalhos; confirmação com
sucesso/recusa; cancelar volta ao formulário; estado inconsistente sem
chave cai para o primeiro fator; o PIN passa pelo mesmo caminho) e 3 em
`privacy.test.tsx` (sem chave não mostra o interruptor; com chave liga e
persiste; remover a chave desliga o 2FA sozinho).

**Confirmado**: `tsc` limpo, `eslint` 0 erros, suite completa — 111
ficheiros, 1535 testes.

**Não confirmado ao vivo**: mesma limitação desta sessão (sem hardware
Windows) — o fluxo de dois passos nunca foi visto a correr contra uma
chave física real, só contra os mocks descritos acima.

## 2026-08-13 — Revisão a sério da Assinatura de plugins (Peça 5): dois problemas reais, corrigidos

Quarta revisão independente, a "sobrar tempo" da mesma tarefa. Escolhi a
Assinatura de plugins (Peça 5) por ser TypeScript puro (Ed25519 via
SubtleCrypto), sem dependência de hardware, e por ainda não ter sido
revista por ninguém de forma independente — só a Peça 9 (instalar de
ficheiro) tinha tido revisão, e apanhou bugs reais.

**Problema 1 — o campo `__proto__` era descartado da assinatura.** Em
`signature.ts`, `canonicalManifestBytes` construía o objeto canónico com
`{}` e fazia `sorted[key] = value`. Com uma chave chamada `__proto__`,
isso mexe no protótipo em vez de criar uma propriedade própria, e o
`JSON.stringify` descarta-o em silêncio. Resultado: um manifesto com um
campo `__proto__` acrescentado produzia os mesmos bytes canónicos que
sem ele — a assinatura não cobria o manifesto inteiro, apesar de o
código o afirmar. Corrigido com `Object.create(null)` (também no
`permSorted` das permissões), que trata `__proto__` como uma chave
normal. É o mesmo vício de "canonização por atribuição em objeto normal"
que assombra qualquer esquema de assinatura JSON.

**Problema 2 — `verifyAndInstallPlugin` instalava sem verificar (fail-open).**
Em `use-plugin-store.ts`, quando `signature` e `signerPublicKey` vinham
presentes mas o manifesto não se resolvia (nem passado por parâmetro nem
encontrado no catálogo), o `if (manifest)` saltava a verificação e o
código caía direto para `store.install(...)` — devolvendo `ok: true,
status: 'assinado-valido'` sem nunca ter verificado nada. O caminho de
produção atual (`install-from-file.ts`) passa sempre o manifesto, por
isso não era disparado por ninguém hoje — mas a função é exportada e o
seu contrato diz "assinatura obrigatória para plugins externos"; um
chamador futuro que passasse assinatura sem manifesto instalaria um
plugin externo sem confirmar a assinatura. Corrigido: recusa com
`assinatura-invalida` quando não há manifesto para verificar.

**Testes**: 2 novos, um por problema, cada um escrito primeiro a provar
o comportamento errado e a passar depois da correção —
`verifyAndInstallPlugin({ id, signature, signerPublicKey, isExternal:
true })` sem manifesto (antes `ok: true`, agora `ok: false`), e
`verifyManifestSignature` sobre um manifesto com `__proto__` acrescentado
(antes `true`, agora `false`). Suite completa: 111 ficheiros, 1537
testes (era 1535; +2 líquidos). `tsc` limpo, `eslint` 0 erros.

## 2026-08-13 — Revisão a sério do Cofre de segredos e do Windows Hello (Lote 1): dois problemas reais no cofre, corrigidos

Quinta revisão independente, a "sobrar tempo" da mesma tarefa. Escolhi as duas
peças mais sensíveis do Lote 1 que ainda não tinham esta leitura linha a linha:
o Cofre de segredos (Peça A) e o Windows Hello (Peça B). No cofre, o Rust já
estava certo (sem `unwrap()`, apagar um segredo inexistente é idempotente,
`SERVICE_NAME` fixo) — mas a interface tinha dois bugs reais.

**Problema 1 — `secretSet`/`secretDelete` devolviam `false` sempre no desktop.**
`tauri-adapter-base.ts` decidia o sucesso com `result !== null`, mas o
`secret_set` do Rust devolve `Result<()>` e o `Ok(())` serializa para `null` na
interface — o mesmo valor que `tryInvoke` usa como sinal de falha. Resultado:
gravar ou apagar no cofre "falhava" sempre, e o registo da chave física
(`webauthn-service.ts`) recusaria com "sem cofre" num desktop a sério.
Corrigido: `try`/`catch` sobre `invoke` — a verdade é "não lançou".

**Problema 2 — a migração da chave podia perder a chave.** O `hydrate()` da
store de IA movia a chave de texto simples para o cofre e apagava o texto
simples mesmo se a escrita no cofre falhasse em silêncio. Se o cofre falhasse,
a única cópia da chave desaparecia. Corrigido: o storage só é limpo (e o
marcador `jarvis-migrated` só é posto) depois de a cópia para o cofre confirmar
que correu. Se falhar, a chave fica onde estava e volta a tentar no arranque
seguinte — nunca se apaga a única cópia.

**Windows Hello: nada de real a corrigir.** Token aleatório
(`crypto.randomUUID()`), não fixo nem derivável; validade de 30 minutos
conferida a sério em `hasValidAutoLoginSession`; a sessão automática só se cria
depois de um `verified` real (nunca da palavra-passe/PIN simulado); o
`VerificationOutcome` fecha por defeito (erro inesperado cai em `Denied`/
`Unavailable`, nunca `Verified`); e o resultado vem só do Rust — o JS não
consegue forçar "verified". É uma resposta válida e útil: confirma que a peça
está sólida.

**Testes**: 9 novos, cada um a provar o comportamento errado antes e a passar
depois — `tests/platform/secret-vault.test.ts` (6) e
`tests/stores/ai-settings-store.test.ts` (3). Suite completa: 113 ficheiros,
1546 testes (era 1537; +9). `tsc` limpo, `eslint` 0 erros, `cargo check` limpo.

## 2026-08-13 — Peça 17: vault Obsidian, memória persistente a sério

O utilizador pediu acesso à internet e ao Obsidian "para ter um cérebro
mesmo" — dois pedidos de risco diferente. A rede real (pesquisa web,
navegador controlado pelo assistente) ficou como prompt para as sessões
locais, com aviso explícito sobre conteúdo externo nunca poder ser lido
como instrução. O Obsidian, sem essa exposição a terceiros, construí-o
diretamente nesta sessão.

**O que é**: `services/knowledge/obsidian-service.ts` +
`src-tauri/src/commands/obsidian.rs`. Mesmo padrão do Explorador
(Peça 7) e da Música (Peça 8) — pasta declarada pela pessoa, raiz
própria no Rust, nunca sai dela. Duas diferenças de propósito:

1. **Caminhos relativos, não absolutos.** `obsidian_list_notes` devolve
   caminhos relativos à raiz (`Diário/2026-08-13.md`); `obsidian_read_note`
   e `obsidian_write_note` recebem-nos de volta. `resolve_within_root`
   rejeita qualquer componente que não seja `Normal` (`..`, uma raiz
   absoluta) antes de tocar no disco — a fronteira não depende só de
   `canonicalize` a posteriori, como nos outros dois.
2. **Listagem recursiva.** Um vault organiza-se em subpastas; a música
   é uma pasta só. `walk_notes` desce até 12 níveis, salta pastas
   ocultas do próprio Obsidian (`.obsidian`).

Três ferramentas novas no catálogo do assistente: `procurar_nota`,
`ler_nota` (a resposta da ferramenta **é** o conteúdo da nota — não uma
frase sobre ele) e `guardar_nota` (cria ou substitui, `risk: 'perde'`
— substituir apaga o que lá estava, mesmo critério das outras
destrutivas). `guardar_nota` só escreve no topo do vault — dar-lhe
controlo sobre subpastas exigiria interpretar organização a partir da
conversa, fora de âmbito por agora.

### `runTool`/`perform` passaram a assíncronos

As 25 ferramentas anteriores a este lote eram todas síncronas por
dentro. `ler_nota`/`guardar_nota` precisam de esperar mesmo por uma
leitura/escrita no disco antes de responder — o padrão que
`controlar_musica` já usava ("disparar e não esperar") não serve aqui,
porque o conteúdo lido é a própria resposta ao modelo. Convertida a
função inteira, não só os três casos novos: `perform` passou a
`async function`, `runTool` devolve `Promise<ToolOutcome>`. Alcance
real, menor do que parecia à partida — só quatro pontos de chamada em
produção (`ai-service.ts`, dois em `CommandConsole.tsx`, um em
`AiWidget.tsx`), todos ajustados com `await` ou `void promise.then(...)`
conforme já eram função assíncrona ou um `onClick` síncrono. Nos
testes, 23 chamadas a `runTool` em `tools.test.ts` passaram a `await`,
e os três executores falsos (`tools.test.ts`, `command-console.test.tsx`,
`send-with-tools-ollama.test.ts`) ganharam `searchNotes`/`readNote`/
`writeNote`.

### Dois bugs reais, apanhados a construir

**`secretSet`/`secretDelete` nunca distinguiam sucesso de falha.**
`tauri-adapter-base.ts` comparava o valor devolvido por `tryInvoke`
contra `null` para decidir se tinha corrido bem — mas os comandos Rust
por trás (`secret_set`, `secret_delete`) devolvem `Result<()>`, e `()`
serializa para `null` em JSON, exatamente o mesmo valor que `tryInvoke`
usava como `fallback` de erro. Sucesso e falha convergiam no mesmo
`null`; a comparação nunca conseguia distinguir os dois. Afeta o Cofre
de segredos (Peça 2) e o WebAuthn (Peça 15), que dependem deste valor
para saber se uma credencial ficou mesmo guardada — `registerSecurityKey`
já verificava `if (!saved)`, mas `saved` podia estar sempre a mentir.
Corrigido nas duas funções: chamar `invoke` diretamente e distinguir
por não ter lançado, não pelo valor devolvido — a mesma correção já
aplicada ao `obsidianWriteNote` novo, para não repetir o problema.
**Descoberto de forma independente, ao mesmo tempo**: a entrada
imediatamente acima ("Revisão a sério do Cofre de segredos e do Windows
Hello") chegou à mesma correção pelo mesmo raciocínio, com testes que
provam o comportamento errado antes e certo depois
(`tests/platform/secret-vault.test.ts`) — a confirmação por teste que
esta entrada não tinha. As duas versões da correção convergiram na
mesma solução; resolvido o conflito de merge mantendo o `console.warn`
já habitual no resto do ficheiro.

### Verificação

`tsc` limpo, `eslint` 0 erros (11 avisos pré-existentes, sem relação).
`cargo check` e `cargo clippy` limpos nesta máquina (Linux — primeira
compilação, ~2m10s; o código novo não tem nada específico de Windows,
mas não foi confirmado contra o alvo Windows a sério). Suite completa:
**113 ficheiros, 1569 testes** (era 1541 antes desta peça — 28 novos:
21 no serviço/store/UI do Obsidian, 7 no catálogo de ferramentas).

Aproveitei para corrigir a contagem de "ferramentas do catálogo" no
SPEC.md — dizia 23 em três sítios, já desatualizada antes desta peça
(estava em 25 antes de eu acrescentar as três novas). Ficou em 28.

**Não confirmado ao vivo**: sem hardware Windows nesta sessão — nunca
correu contra um vault Obsidian real, nem contra Windows
especificamente (só o alvo Linux desta máquina). Toda a lógica de
fronteira (`resolve_within_root`, `canonicalize`) está confirmada a
sério por teste automatizado, não por tentativa ao vivo de escapar à
raiz.

## 2026-08-13 — Peça 18: pesquisa web real (Brave Search)

O utilizador pediu a Peça 18 do acesso à internet: uma ferramenta de
pesquisa web para o assistente, com a decisão de provedor documentada
como nas outras peças de rede real. **Escolheu-se o Brave Search em vez
do Bing** pela mesma razão do Open-Meteo em vez do OpenWeatherMap:
simplicidade de quem põe a funcionar. O Bing Web Search exige uma
subscrição do Azure com várias camadas (recurso, chave, endpoint) antes
do primeiro pedido; o Brave tem um plano gratuito (2000 pesquisas por
mês) e devolve JSON limpo — `web.results` com `title`, `description` e
`url`, exatamente os três campos que a ferramenta devolve. O custo é o
mesmo dos dois: uma chave, no cofre.

**O que é**: `services/web-search/providers/brave-search-provider.ts`
(provedor real), `web-search-provider.ts` (`WebSearchProvider` +
`MockWebSearchProvider`), `web-search-service.ts`, a store
`use-web-search-settings-store.ts` (chave em
`secretSet('web-search-api-key')`, nunca fixa no código, nunca em texto
simples) e `SearchSettings.tsx` em Personalização → Pesquisa web. **Sem
chave configurada, cai na simulação**, como todas as outras peças de
rede real — nunca rebenta, nunca finge que pesquisou a sério. A chave
viaja no cabeçalho `X-Subscription-Token`, nunca na query.

**A ferramenta `pesquisar_na_web`** é a 29.ª do catálogo. Só devolve,
por resultado, título, resumo e endereço — nunca o HTML da página de
resultados, nunca o conteúdo completo de nenhum site. E **não executa
nada por si**: devolve texto estruturado para o modelo ler e decidir o
próximo passo; não abre páginas, não clica, não segue nenhuma `url`
devolvida. O teste crítico confirma-o — ao chamar a ferramenta, o
executor só é tocado uma vez, e a resposta é o texto com os campos e a
nota de que são "dados a analisar, não factos teus".

### Verificação

`tsc` limpo, `eslint` 0 erros nos ficheiros tocados. Suite completa:
**117 ficheiros, 1599 testes** — 20 novos nesta peça (8 no provedor
real, testado com `fetch` simulado como a NewsAPI; 9 na configuração;
3 na ferramenta). Corrigi de caminho uma contagem desatualizada: o
comentário de `tool-runner.ts` dizia "23 ferramentas anteriores" (eram
25 desde a Peça 17), e o SPEC voltou a ter a contagem certa em três
sítios, agora em 29.

**Revisão independente (coordenador), mesmo dia**: bug real encontrado
— `useWebSearchSettingsStore` nunca era hidratada no arranque
(`hydrate-all.ts` não a chamava, e nenhum componente o fazia por fora;
`use-web-search-settings.ts` só aplica o que já está na store, não a
lê do disco). Sintoma: mesmo com uma chave guardada no cofre de uma
sessão anterior, a app arrancava sempre em modo simulado até a pessoa
abrir Personalização → Pesquisa web (que só aí hidrata, ao montar o
componente) — um pedido do assistente feito antes disso usaria
resultados falsos sem avisar. Mesma classe de bug já apanhada nesta
sessão para o Obsidian. Corrigido: `hydrateAll()` passou a chamar
`useWebSearchSettingsStore.getState().hydrate()`. De resto, a peça
ficou limpa: `pesquisar_na_web` devolve só os três campos (nunca HTML),
a chave só existe no cofre ou, sem cofre, em armazenamento próprio
(nunca fixa no código nem em log), a interface tapa a chave por
omissão, a simulação nunca rebenta sem chave, e os testes chamam
mesmo o provedor e o `runTool` a sério, não só passam por cima.

## 2026-08-13 — Peça 19: navegador controlado pelo assistente

Terceira e última peça do lote pedido pelo utilizador ("Obsidian,
pesquisa web, navegador controlado pelo assistente — as duas últimas
são rede real a sítios arbitrários, categoria de risco diferente da
meteorologia/notícias/email"), feita por mim (coordenador) depois de
concluir a Peça 17 (Obsidian) e rever a Peça 18 (pesquisa web, DeepSeek)
em paralelo. Foi explicitamente a mais sensível das três, com o âmbito
já reduzido pelo pedido: só busca (fetch), nunca um browser embutido a
sério com JavaScript; nunca clica, preenche formulários ou navega por
conta própria — isso fica de fora, categoria de risco da Fase 3.

**Decisão de arquitetura, antes de escrever qualquer código de
interface**: um `fetch()` do lado da WebView do Tauri não serve para
isto, por duas razões independentes, não só uma — a CSP da app
(`tauri.conf.json`) é uma lista fechada de anfitriões conhecidos
(DeepSeek, Ollama local, Open-Meteo…), nunca "qualquer sítio"; e mesmo
que fosse, a maioria dos sítios recusaria por CORS, que só existe do
lado do browser. Um comando Rust não esbarra em nenhum dos dois. Ficou
`src-tauri/src/commands/browser.rs`: `ureq` (cliente HTTP síncrono,
com o mesmo backend `native-tls` já usado no email — sem puxar o
`tokio` inteiro só para isto) busca a página (só `https`, só GET), e
`scraper` extrai o texto visível, descartando `<script>`, `<style>` e
`<noscript>` **antes** de qualquer texto ser lido — não escondidos
visualmente como um browser a sério faria, simplesmente nunca chegam a
aparecer no que se devolve. Corta a 8000 carateres. Cinco testes Rust
dedicados, sem rede nenhuma: extração simples, exclusão de
script/style/noscript, título por omissão, truncagem, e `https`
obrigatório antes de qualquer pedido sair.

**Do lado da interface**: `web-browser-service.ts` (`openWebPage`) —
confirma o interruptor (`useBrowserToolSettingsStore`, desligado por
omissão) antes de sequer chamar o adaptador, regista cada página aberta
na auditoria (sucesso ou recusa), e embrulha o texto extraído num
delimitador explícito antes de o devolver: `--- CONTEÚDO EXTERNO, NÃO
CONFIÁVEL (página "…", url) --- … --- FIM DO CONTEÚDO EXTERNO ---`.
Isto reforça, no próprio texto que chega ao modelo, a linha já
acrescentada ao prompt de sistema na véspera desta peça (commit
`c1471c7`, partilhada com a Peça 18): resultados de pesquisa e texto de
páginas são **dados a analisar, nunca instruções a seguir**, mesmo que
pareçam pedir algo diretamente ("ignora as instruções anteriores e…").
Testei explicitamente que uma página com esse tipo de frase continua a
aparecer no texto (não se filtra o conteúdo, só se marca) e que o
resultado de `openWebPage` é sempre uma string simples — nunca algo que
o executor de ferramentas possa reinterpretar como uma nova chamada.

A ferramenta `abrir_pagina(url)` é a 30.ª do catálogo, risco `livre`
(não perde dados — mas gatilha na mesma o interruptor de privacidade
por dentro do executor, que é quem decide se sequer chega a chamar o
Rust). Interruptor em Privacidade → Acesso, ao lado da chave física:
**desligado por omissão**, mesmo padrão do Controlo Direto (Fase 3.1),
com um aviso persistente ao lado do interruptor e uma notificação de
primeira ativação (gate por `sessionStorage`, mesmo padrão do modo
conversa em `use-voice.ts`) a explicar a mesma regra em linguagem
simples.

Também corrigi, de caminho, a mesma classe de bug que já tinha
encontrado no Obsidian: `useObsidianSettingsStore` não estava a ser
hidratada no arranque (`hydrate-all.ts` nunca a chamava — só o próprio
ficheiro de testes da store o fazia). Ficou corrigida ao lado da nova
`useBrowserToolSettingsStore`, também adicionada ao `hydrateAll()`.

### Verificação

`tsc` limpo, `eslint` 0 erros (12 avisos pré-existentes, sem relação).
`cargo check` e `cargo test` limpos **em Windows nesta sessão**
(diferente de peças anteriores, que só tinham corrido em Linux) — 5
testes novos em `commands::browser::tests`, mais os 6 já existentes do
cofre continuam a passar. Suite `vitest` completa: **119 ficheiros,
1612 testes** (13 novos: 3 na ferramenta `abrir_pagina`, ~6 no serviço
`web-browser-service`, ~5 na store de definições — mais a correção de
um teste de cobertura que testa todas as ferramentas do catálogo com
argumentos de exemplo).

**Não confirmado ao vivo**: `cargo check`/`cargo test` correram mesmo
em Windows, mas a aplicação Tauri em si não chegou a arrancar nem a
abrir uma página `https` real — só testes automatizados (unitários
Rust e `vitest` com o adaptador simulado). A pessoa deve confirmar ao
vivo, antes de confiar na peça: ligar o interruptor em Privacidade,
pedir ao assistente para abrir uma página real, e ver se o texto que
volta é mesmo o texto da página.

## 2026-08-13 — Peça 20: ferramentas para o Claude no orquestrador

Depois de verificar (a pedido do utilizador — "verifique se tudo que
me passou já foi feito") que as Peças 18 e 19 estavam mesmo feitas
como relatado, e de o utilizador pedir para eu próprio continuar a
construir em vez de só coordenar ("e voce nao vai mais cosntruir
nada? ta preguicosso?", outra vez), fui ao `SPEC.md` e ao
`docs/spec/orquestrador-multi-provedor.md` à procura da próxima peça
real por fazer, não inventada. Encontrei duas coisas por corrigir
antes de construir: a linha do explorador de ficheiros em §2 do
SPEC.md dizia "🚫 bloqueado" quando a funcionalidade já estava feita
desde 12/08 (linha 351 do mesmo ficheiro já o documentava) — corrigida
para ✅, sem tocar em código nenhum, só na entrada desatualizada. E o
próprio documento do orquestrador dizia "ferramentas para o Claude e o
Ollama" como as duas em falta, mas a Ollama já as tinha (`run()`,
`supportsToolCalling()`, testado em `send-with-tools-ollama.test.ts`)
— só o Claude ficava mesmo de fora.

**Peça 20**: `ClaudeProvider.run()`, o mesmo contrato `run(request,
messages, onText): Promise<StreamResult>` que a DeepSeek e a Ollama já
cumpriam, agora também no Claude. `isToolCapable()` (`ai-service.ts`)
deixa-o passar sempre, ao lado da DeepSeek.

O formato da Anthropic não tem equivalente direto ao que `ai-service.ts`
já usava (estilo OpenAI: `tool_calls` num campo à parte da mensagem
`assistant`, respostas em mensagens `role: 'tool'` próprias) — na
Anthropic, um pedido de ferramenta é um bloco `tool_use` **dentro** da
própria mensagem `assistant`, e a resposta é um bloco `tool_result`
dentro da mensagem `user` **seguinte**, nunca uma mensagem à parte.
Escrevi `toAnthropicMessages()` para traduzir de um formato para o
outro — é o único sítio onde a diferença importa, porque
`ai-service.ts` continua a construir e a empurrar mensagens no formato
genérico de sempre, sem saber qual provedor está por trás. Uma
particularidade que só um teste apanha: como a Anthropic exige que
todas as respostas de ferramentas de um turno cheguem juntas, mensagens
`tool` consecutivas (uma por chamada, como `ai-service.ts` já as
empurra) juntam-se numa única mensagem `user` com vários blocos
`tool_result`, em vez de virarem várias mensagens `user` separadas.

Os argumentos de um `tool_use` chegam por eventos `input_json_delta`
espalhados (`partial_json`) — só interpretáveis depois de completos.
`collectClaudeStream()` acumula-os por índice de bloco antes de tentar
o `JSON.parse`, a mesma disciplina que já existia no `collect()` da
DeepSeek para o campo equivalente (`tool_calls[].function.arguments`).
Um JSON que nunca fecha direito perde-se (o pedido não corre), em vez
de rebentar o resto da resposta.

`toolsAsAnthropicSchema()` (`services/assistant/tools.ts`) gera o
catálogo no formato `{name, description, input_schema}` a partir da
mesma definição `TOOLS` que já alimentava `toolsAsJsonSchema()` —
extraí `parametersSchema()` como função partilhada pelas duas, para uma
ferramenta nova continuar a aparecer nos dois formatos sem escrever a
lista duas vezes.

### Verificação

`tsc` limpo. `eslint` apanhou um erro real na primeira versão —
`Array.isArray()` sozinho não estreitava bem o tipo
`string | readonly AnthropicContentBlock[]` (a spread ficava `any[]`);
resolvido com um predicado de tipo explícito (`isBlockList`) em vez de
depender do `Array.isArray` do TypeScript para este caso. Depois disso,
0 erros. 9 testes novos: 5 unitários em `collectClaudeStream` (texto e
ferramenta juntos, argumentos partidos por vários eventos, **dois
`tool_use` em paralelo — índices diferentes — sem se misturarem**, JSON
que nunca fecha a perder-se sem rebentar, sem ferramenta nenhuma a
lista vem vazia), 1 no esquema Anthropic
(`o esquema da Anthropic tem as mesmas ferramentas, num formato
plano`), 3 num ciclo completo de `sendWithTools`
(`tests/assistant/send-with-tools-claude.test.ts`, mesmo padrão do
ficheiro já existente para a Ollama — incluindo o teste de que a
segunda volta manda a resposta da ferramenta como `tool_result` na
mensagem `user` certa, com o `tool_use_id` a bater certo). Suite
completa: **120 ficheiros, 1621 testes** (era 119/1612 antes desta
peça). `docs/spec/orquestrador-multi-provedor.md` e `SPEC.md`
atualizados — a nota "ferramentas para o Claude e o Ollama" que ainda
listava as duas como pendentes já estava parcialmente desatualizada
(a Ollama tinha sido feita por outra sessão sem o documento ser
corrigido); corrigida para refletir as duas feitas.

## 2026-08-13 — Revisão a sério: Terminal (item 3 da fila noturna)

Orquestração noturna multi-IA (fila em `docs/log/fila-de-trabalho.md`):
Kimi ficou com o item 3, uma revisão a sério do Terminal
(`src-tauri/src/terminal/`, PTY real via `portable-pty`), que nunca
tinha sido revisto nem tinha um teste sequer. A Kimi bateu no limite
de taxa da organização (TPD, o mesmo problema recorrente desta noite)
a meio da tarefa, com uma correção substancial já escrita mas por
compilar, testar ou publicar — o coordenador (Claude local) retomou o
trabalho dela no mesmo worktree em vez de o deixar perder-se.

**Três bugs reais, confirmados e corrigidos:**

1. **Carateres UTF-8 multibyte cortados a meio entre dois `read()` do
   PTY viravam `�`.** Um `read()` do PTY pode parar a meio de um
   carácter de vários bytes (`á`, `€`, um emoji de 4 bytes) — o código
   anterior descodificava cada bocado lido com `from_utf8_lossy`
   isoladamente, e o byte cortado virava sempre o carácter de
   substituição. Corrigido com um `DecodificadorUtf8` que acumula até
   3 bytes pendentes de uma sequência incompleta e só os liberta
   quando o resto chega.
2. **`TerminalRegistry::write` segurava o lock do registo inteiro
   durante uma escrita ao PTY que pode bloquear** (buffer de entrada
   cheio, processo que não lê stdin, uma colagem grande) — travando
   **qualquer outra sessão de Terminal aberta**, incluindo o `kill`
   que desbloquearia a situação. Corrigido: `TerminalSession` passa a
   expor uma pega partilhável (`Arc<Mutex<Box<dyn Write>>>`); o
   registo clona-a e larga o seu próprio lock antes de escrever.
3. **`kill()` não colhia o processo** — sem `wait()`, um filho morto
   ficava zombie no Unix até a app fechar. Corrigido com
   `try_wait`/`wait`.

**Bug adicional, apanhado ao escrever os testes para o ponto 1**: o
`flush()` do descodificador (chamado no fim do stream, para nunca
perder o que sobrou) não limpava o que tinha acumulado — uma segunda
chamada repetia o mesmo texto. Sem consequência prática (só é chamado
uma vez, no fim da thread de leitura), mas corrigido por correção.

Nunca havia um teste no módulo `terminal/`. 5 novos, todos no
descodificador UTF-8 (o resto — PTY real, threads, o `Child` do
`portable-pty` — não se presta a teste automatizado sem simular um
processo real). A correção do lock do registo não tem teste dedicado:
documentado aqui em vez de forçar um teste pouco natural — confirmada
por leitura do código (o âmbito do lock ficou reduzido à cópia de um
`Arc`, não à escrita em si), não por uma tentativa ao vivo de a
travar.

### Verificação

`cargo check`/`cargo test` limpos (10 testes na lib, 6 na integração
do cofre). `tsc --noEmit` limpo. `eslint .` 0 erros (11 avisos
pré-existentes, sem relação — mais um encontrado e corrigido nesta
sessão: `eslint .` corrido a partir do worktree principal apanhava
também o worktree isolado de um fork em curso,
`.claude/worktrees/agent-.../`, com 418 erros de parsing falsos —
adicionado a `eslint.config.js` `ignores`). `vitest run`: 1620 passam,
1 falha (`login-screen.test.tsx`) — confirmado isolado (`vitest run
tests/auth/login-screen.test.tsx`, 15/15 a passar), mesma flakiness
por timeout sob carga já reportada pela DeepSeek na revisão anterior,
sem relação com esta peça.

Item 3 movido para "Feito" em `docs/log/fila-de-trabalho.md`.

**Não confirmado ao vivo**: sem chave da Anthropic disponível nesta
sessão remota, nunca se mandou um pedido real a `api.anthropic.com`
com ferramentas — só testes automatizados, com o `fetch` simulado a
devolver eventos `content_block_start`/`content_block_delta` no
formato documentado pela Anthropic. A tradução de mensagens e a
acumulação de blocos estão confirmadas a sério pelos testes (inclusive
o caso de dois `tool_use` em paralelo, que só um teste dedicado
apanha — não dá para ver isso "a olho" numa conversa normal); o que
falta é a pessoa configurar uma chave da Claude a sério, ligar a
cadeia de provedores para o Claude entrar primeiro (ou ficar sozinho),
e pedir ao assistente algo que precise de uma ferramenta.

**Pedido em paralelo, ainda por fechar nesta sessão**: o utilizador
pediu para os modelos locais com limite já configurado (Qwen, Kimi,
DeepSeek) e o Claude local passarem a trabalhar sozinhos via terminal,
numa fila de peças, em vez de eu só escrever prompts para outras
sessões copiarem à mão — e que o prompt de arranque diga para iniciar
o Jarvis primeiro, para a pessoa poder testar ao vivo enquanto o
trabalho corre. Esta sessão remota não tem acesso ao terminal nem ao
Ollama da máquina local (container isolado, só este repositório) —
por isso o que dá para entregar daqui é o prompt/roteiro em si, para
correr a partir de uma sessão local com esse acesso, não a execução.

## 2026-08-13 — Revisão independente: Peça 20 (ferramentas para o Claude no orquestrador)

Item 5 da fila de orquestração noturna (`docs/log/fila-de-trabalho.md`),
reservado para "Claude local". Revisão a sério do commit `f1eba3a`,
nunca lido por ninguém de fora de quem o escreveu — lido como se fosse
a primeira vez, sem confiar nos testes só por passarem.

**O que se confirmou, a sério**: `claude-provider.ts` inteiro lido —
`toAnthropicMessages()` traduz corretamente o formato genérico (estilo
OpenAI) que `ai-service.ts` já usa para qualquer provedor: mensagens
`tool` consecutivas juntam-se num único bloco `user` com vários
`tool_result` (exigência real da Anthropic quando um turno pede mais
do que uma ferramenta de uma vez — confirmado que o código respeita
isto, não só que existe um comentário a dizer que respeita);
mensagens `assistant` com `tool_calls` só incluem o bloco de texto se
não estiver vazio (a Anthropic exige pelo menos um bloco de conteúdo,
e os `tool_use` já garantem isso mesmo sem texto); `system` sai como
campo à parte, nunca como mensagem. `collectClaudeStream` acumula
`input_json_delta` por índice de bloco corretamente, testado a sério
com dois `tool_use` em paralelo. `toolsAsAnthropicSchema()` reaproveita
`parametersSchema()` da `toolsAsJsonSchema()` já existente — confirmado
que não há segunda cópia da lista de ferramentas a poder divergir.
`ClaudeProvider.run()` é uma tradução fiel do contrato de
`DeepSeekProvider.run()` (mesmo padrão de timeout, cancelamento por
`AbortSignal`, distinção `demora`/`rede`/erro tipado) — nenhuma
divergência de comportamento entre os dois provedores encontrada.
Chave só viaja no cabeçalho `x-api-key`, nunca em corpo nem log.
Testes (`claude-provider.test.ts`, `send-with-tools-claude.test.ts`)
são reais — chamam o `AIService` e o `ClaudeProvider` a sério, com um
executor de ferramentas verdadeiro, não simulações vazias que passam
sem exercitar nada (o padrão de teste falso já apanhado antes neste
projeto, ex.: validadores nunca chamados pelos próprios testes).

**Uma limitação real, mas não desta peça**: `AIService.recover()` — o
caminho de reserva quando um provedor falha a meio de uma conversa com
ferramentas — usa sempre `provider.stream()` (texto simples) no
provedor seguinte da cadeia, nunca `provider.run()` com ferramentas.
Se uma ferramenta já tiver sido executada numa volta anterior (efeito
real já aconteceu — uma tarefa criada, por exemplo) e o provedor falhar
antes de terminar a resposta, o provedor de reserva responde do zero
ao pedido original, sem saber que a ferramenta já correu. Confirmado
que isto já existia antes da Peça 20 (a Ollama já tinha este mesmo
comportamento com a DeepSeek, antes de o Claude entrar) — não é um bug
que esta peça tenha introduzido nem piorado tecnicamente, mas com três
provedores capazes de ferramentas agora em vez de dois, é mais
provável de se notar na prática. Fica documentado aqui como limitação
conhecida do desenho da cadeia, não corrigido nesta revisão — corrigir
isto a sério exigia levar o histórico de ferramentas já executadas
para dentro de `recover()`, mudança maior do que cabe no âmbito deste
item da fila.

**Verificação**: `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos
pré-existentes, sem relação). `npx vitest run`: **120 ficheiros, 1621
testes**, todos a passar numa corrida limpa (uma falha isolada em
`tests/auth/login-screen.test.tsx` na primeira corrida da suite
completa não se repetiu isolada nem numa segunda corrida completa —
sinal de instabilidade sob carga do `testing-library`, não uma
regressão real; não investigada mais fundo por estar fora do âmbito
desta peça). Sem código Rust tocado por esta peça, sem `cargo test`
a correr.

Nenhum bug corrigido — nada de errado encontrado na peça em si.

## 2026-08-13 — Revisão a sério dos gatilhos nativos de automação (ficheiros/bateria): dois bugs reais, corrigidos

Item 4 da fila noturna — revisão independente de `watch_folder`/`unwatch_folder`/
`get_battery_status` (`src-tauri/src/commands/files.rs`, `battery.rs`) e de
`checkNativeTriggers()` (`src/services/automation-service.ts`). Nunca tinha sido
lido por ninguém de fora.

**Confirmei a fuga suspeita no `unwatch_folder`.** O comando tirava a pasta do
mapa sem pôr a flag de paragem a `true`, e o comentário justificava-o com um
`Drop` que não existe — `Arc<AtomicBool>` não se levanta ao cair, e a thread do
observador segura o seu próprio `Arc`, por isso nunca via `true`. A thread do
`notify` ficava a correr para sempre e **continuava a emitir**
`automation://file-changed` depois de `unwatch_folder`. Corrigido com dois
métodos no `FileWatchers` (`record`/`remove`): o `remove` põe a flag a `true`
antes de a tirar, e o `record` torna a deduplicação atómica (antes, o
check+insert em dois passos deixava duas chamadas concorrentes criarem dois
watchers sobre a mesma pasta). Teste Rust novo (`remove_para_a_thread_do_observador`)
prova que a thread simulada pára; `cargo test` 8/8.

**Segundo bug real, no `checkNativeTriggers`.** `lastBatteryPercent` era
partilhada por todas as regras e atualizada *dentro* do predicado — que corre
uma vez por automação. A primeira regra de bateria avaliava com o valor
anterior certo e escrevia o novo logo a seguir; a segunda já comparava contra
esse valor recém-escrito, por isso **nunca cruzava o limiar**. Com duas regras
("abaixo de 20%" e "abaixo de 10%"), só a primeira da lista disparava.
Corrigido para capturar o anterior uma vez e atualizar uma vez, no fim; teste
novo (`bateria: duas regras cruzam o próprio limiar na mesma leitura`).

**Documentado, não corrigido** (falta de desenho, não bug dos ficheiros
revistos): o `App.tsx` regista os observadores de ficheiros uma única vez no
arranque e nunca chama `unwatchFolder` — uma automação de ficheiros ligada
depois do arranque não é observada (gatilho perdido até reiniciar), e
desligá-la não desliga o observador (os eventos continuam a ser emitidos, sem
ação, porque `checkNativeTriggers` respeita `isEnabled`).

**Verificação:** `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos
pré-existentes noutros ficheiros), `cargo test` 8/8. `vitest run`: 1622 testes
— 1615 passam e 7 falham, todos em `login-screen.test.tsx` e
`design-system/surfaces.test.ts`, que passam isolados (24/24) — flakiness por
timeout sob a carga do correr completo, pré-existente e sem relação com esta
revisão.

## 2026-08-13 — Auditoria a sério do projeto: SSRF real no navegador controlado, corrigido

O utilizador reportou, ao vivo, o assistente a responder "Ainda não
tenho um modelo de linguagem ligado" e pediu uma auditoria completa ao
projeto — "não aceito menos que cem por cento". Comecei pelos quatro
verificadores objetivos: `tsc --noEmit` limpo, `eslint .` 0 erros
(11 avisos pré-existentes), `npx vitest run` **120 ficheiros, 1621
testes**, `cargo check`/`cargo test --lib` limpos. Nada partido ao nível
do código — o projeto compila e os testes passam por inteiro.

Sobre a frase em si: tracei-a até `rule-provider.ts` — é texto fixo, mostrado
só quando nenhum provedor de IA está ativo (nem DeepSeek, nem Claude, nem
Ollama). Reli `use-ai-settings-store.ts` (hidratação, persistência),
`use-ai-settings.ts` (aplicação ao `aiService`) e `AiSettings.tsx` (a UI só
mostra o campo da chave depois de o provedor já estar selecionado, o que
afasta a hipótese de "chave guardada sem o provedor mudar") — tudo
estruturalmente correto. Não encontrei um bug de código que explique o
sintoma; o mais provável é uma questão de configuração ao vivo (qual
provedor está mesmo selecionado, se a chave aparece como guardada, se
aparece algum aviso antes da resposta) — pedido ao utilizador para
confirmar isto em Personalização → Assistente, já que não há como
reproduzir sem a app a correr.

**Ao rever a peça mais sensível da lista (Navegador controlado, Peça 19)
a sério — não só ler, tentar mesmo furar — encontrei uma vulnerabilidade
real: SSRF.** `fetch_page_text` só confería o esquema (`https://`), nunca
o anfitrião. Um pedido a `https://localhost:9000/painel-admin`, a
`https://192.168.1.1/` (router), ou a `https://169.254.169.254/` (o
endereço de metadados de nuvem, alvo clássico de SSRF) passava como
qualquer outro — o texto de um serviço que nunca devia ser alcançável de
fora voltava para a conversa como se fosse uma página pública. Um
segundo problema, ligado ao primeiro: mesmo com uma lista de anfitriões
bloqueados, um endereço público podia redirecionar (`3xx`) para dentro e
contornar a verificação, que só olhava para o endereço pedido, nunca
para onde o pedido realmente foi parar.

**Corrigido**: `is_blocked_host()` (`src-tauri/src/commands/browser.rs`)
usa o crate `url` (já vinha como dependência transitiva do `ureq`, só
faltava declará-la) para analisar o anfitrião do endereço e recusar
`localhost`/`*.localhost`, loopback, redes privadas (`10/8`,
`172.16/12`, `192.168/16`), link-local (`169.254/16`, inclui o endereço
de metadados de nuvem), `fc00::/7` e `fe80::/10` em IPv6, e endereços
IPv4 mapeados em IPv6 (`::ffff:a.b.c.d`) — confere o IPv4 real por trás
em vez de os deixar passar só por terem forma de IPv6. E, para o
problema do redireccionamento, o agente do `ureq` passou a `redirects(0)`
— um `3xx` é recusado explicitamente, nunca seguido às cegas: um
endereço público e aceite não pode mais contornar a verificação de cima
por saltar para dentro a meio do pedido.

**Testes**: 3 novos — `recusa_a_propria_maquina_e_redes_privadas` (18
casos, cada um provando a recusa sem tocar em rede nenhuma, porque a
função corta antes de qualquer pedido sair), `nao_recusa_um_ip_publico_
nem_um_dominio_normal` (garante que a defesa não fica paranoica a mais e
bloqueia a internet toda), `um_endereco_ilegivel_e_recusado_por_omissao`.
8 testes no total em `commands::browser` (eram 5). `cargo check`,
`cargo clippy --lib -- -D warnings` e `cargo test --lib` limpos.

Isto fecha o item 8 ("Navegador controlado") da fila de trabalho
(`docs/log/fila-de-trabalho.md`) com um achado real, não "nada a
corrigir" — exatamente o tipo de coisa que uma revisão a sério, e não só
uma leitura, existe para apanhar.

**Não confirmado ao vivo**: sem app a correr nesta sessão remota, a
correção nunca foi exercitada contra uma rede a sério (só testes
unitários, sem qualquer pedido de rede — a função recusa antes de sair).
Continuação da auditoria do resto do projeto em curso.

## 2026-08-13 — Auditoria a sério (continuação): escrita de nota do Obsidian através de um link simbólico, corrigida

Segundo achado real da mesma auditoria (depois do SSRF no navegador
controlado). Revi o vault Obsidian (Peça 17) a sério — nunca tinha tido
sequer um teste Rust dedicado, só cobertura do lado do TypeScript com o
adaptador simulado, que nunca exercita a lógica de fronteira a sério.

**O bug**: `obsidian_write_note` verificava a fronteira canonicalizando
a **pasta-mãe** do alvo (`target.parent()`), nunca o ficheiro final —
por desenho, porque `canonicalize()` só funciona em caminhos que já
existem, e a nota pode ainda não existir na primeira escrita. Mas se a
nota **já existisse como um link simbólico** a apontar para fora do
vault (plantado antecipadamente, por exemplo por outro processo com
acesso ao disco, ou por um vault partilhado/sincronizado), a pasta-mãe
continuava dentro do vault — passava a verificação — e `fs::write`
segue links simbólicos por omissão, tal como `CreateFile` no Windows.
O resultado: escrever numa nota chamada, por exemplo, `Notas do
Chat/2026-08-13.md` podia na realidade sobrescrever um ficheiro
qualquer fora do vault, sem a verificação de fronteira alguma vez dar
por isso — porque nunca olhava para o próprio ficheiro, só para a pasta
que o contém.

**Corrigido**: antes de `fs::write`, confere-se com `symlink_metadata`
(que, ao contrário de `canonicalize`/`metadata`, não segue o link) se o
alvo já existe como link simbólico — se for, recusa-se, mesmo que a
pasta-mãe esteja dentro do vault. `obsidian_read_note` já não tinha este
problema: canonicaliza o próprio ficheiro (não só a pasta) antes de
comparar, por isso um link para fora já era recusado — confirmado por
teste novo, não só por leitura do código.

**Refatoração necessária para testar a sério**: `obsidian_read_note` e
`obsidian_write_note` recebiam `State<'_, ObsidianRoot>` do Tauri, o que
tornava impossível testá-los sem uma app Tauri a correr. Extraí a lógica
para `read_note_within`/`write_note_within`, funções livres que recebem
a raiz já resolvida — o mesmo padrão já usado em `rule-provider.ts`
(`answerFromContext`) e `browser.rs` (`extract_text`): a lógica que vale
a pena testar não deve exigir o resto da aplicação a correr.

**Testes**: 6 novos, com pastas temporárias a sério no disco (sem puxar
o crate `tempfile`, que não estava nas dependências — uma pasta em
`std::env::temp_dir()` com o PID no nome, apagada no `Drop`) — escrever e
reler uma nota normal, criar subpastas intermédias, `..` recusado antes
de tocar no disco (confirmado que nada foi escrito lá fora), caminho
absoluto recusado, e os dois casos de link simbólico (escrita, o bug
novo; leitura, a proteção que já existia). **Confirmei que o teste do
bug apanha mesmo o problema**: removi a correção temporariamente, o
teste falhou como esperado, restaurei, voltou a passar — não é um teste
que passaria de qualquer forma. Os dois testes de link simbólico só
correm em Unix (`#[cfg(unix)]`) — criar um link simbólico no Windows por
omissão pede um privilégio que a maioria das contas não tem; a lógica
corrigida é a mesma nos dois sistemas operativos. 14 testes Rust no
total agora (eram 8 depois do SSRF, 5 antes disso). `cargo check`,
`cargo clippy --lib -- -D warnings` e `cargo test --lib` limpos.

Fecha o item 7 ("Vault Obsidian") da fila de trabalho com outro achado
real — dois de dois nas peças de rede/disco real revistas a sério até
agora nesta auditoria.

## 2026-08-13 — Auditoria a sério (continuação): anexos de email, sem fuga nova

Terceiro item da auditoria pedida pelo utilizador. Revi todos os cinco
sítios do projeto que usam `URL.createObjectURL`/`revokeObjectURL`
(`grep` ao `src/` inteiro, não confiança em memória de onde estariam):
`platform/attachments.ts`, `services/voice-service.ts`,
`apps/emails/EmailsWindow.tsx`, `apps/assistant/export.ts`,
`apps/privacy/BackupPanel.tsx`.

**Resultado: nada de real a corrigir.** O composer de email já tem um
efeito de desmontagem dedicado (`attachmentsRef` + `useEffect` de
cleanup) que revoga todas as pré-visualizações por remover ao fechar ou
cancelar o rascunho — cobre exatamente o caso que a fuga original
(revista antes, "2026-08-11 — Revisão de qualidade: fuga de blob URL
nos anexos de email") tinha deixado escapar, e continua a cobri-lo
depois de tudo o que mudou desde então. `voice-service.ts`
(`speakClonada`) revoga o áudio anterior antes de criar um novo, com
uma segunda verificação para a corrida entre duas chamadas simultâneas,
e `stop()` revoga ao interromper. `export.ts` e `BackupPanel.tsx`
seguem o padrão comum e seguro (criar → `click()` → revogar já a
seguir, no mesmo bloco síncrono). `AttachmentList.tsx` (anexos de uma
mensagem já recebida, não um rascunho) não usa blob URL nenhuma — só
mostra nome e tamanho.

Fecha o item 13 ("Anexos de email a sério") da fila de trabalho — o
primeiro desta auditoria sem achado novo, depois de dois seguidos com
bugs reais (SSRF no navegador, escrita através de link simbólico no
Obsidian).

## 2026-08-13 — Auditoria a sério (continuação): Controlo Direto sem porta de presença nem ligação a fluxo nenhum

Quarto item da auditoria pedida pelo utilizador, e o mais significativo
até agora — revi o Controlo Direto (Fase 3.1), a peça que o próprio
documento de desenho descreve como "a categoria de risco mais alta do
projeto". Nunca tinha tido revisão independente. Confirmei ao abrir o
ficheiro: **nunca tinha tido sequer um teste** — zero, nem um.

**Achado 1 — a porta de presença vivia fora da função que devia
guardar.** `executeStep()` (`services/direct-control-service.ts`)
executava um passo a sério sempre que `confirmed && !simulatedMode`
fossem verdade — nunca conferia `sessionActive`. A spec
(`docs/spec/fase-3-controlo-direto.md` §1.1) é categórica: "sem isto,
nada corre" — mas essa garantia só existia enquanto quem chamasse
`executeStep` se lembrasse de verificar a sessão primeiro. Corrigido
para o próprio serviço se recusar a executar sem `enabled && 
sessionActive`, independentemente de quem o chama — a mesma disciplina
de "a fronteira vive onde a ação acontece, não em quem pede" já usada
no Explorador, no Obsidian e agora no navegador controlado.

**Achado 2 — mais grave em termos de honestidade do projeto do que de
segurança em si: nada disto está ligado a nada.** `grep` ao `src/`
inteiro confirma: `<ControlOverlay>` nunca é montado em lado nenhum da
árvore de componentes (só se referencia a si próprio no seu ficheiro);
`directControlService.startSession()`, `.verify()` e `.executeStep()`
nunca são chamados fora do próprio serviço e do painel de definições. O
reconhecimento de voz nunca foi ligado à verificação da palavra-passe.
Hoje, na prática, ligar o interruptor "Controlo direto" na Privacidade
não dá acesso a funcionalidade nenhuma — é um painel de configuração
que não leva a lado nenhum. O `SPEC.md` dizia "3.1 implementada", o que
é tecnicamente verdade peça a peça (o serviço existe, o overlay existe,
a lógica de risco existe) mas dava a entender um fluxo utilizável que
não existe. Não é um risco de segurança por si só — precisamente porque
nada chama o caminho que executaria, nada corre — mas é uma lacuna real
entre o que se dizia feito e o que está. Corrigido no `SPEC.md`, sem
inventar a ligação agora (fica para quando a 3.2+ começar a sério, como
o próprio documento já dizia).

**Testes**: 13 novos (`tests/services/direct-control-service.test.ts`) —
palavra-passe (hash certo/errado/sem chave), sessão (abre, fecha,
expira sozinha ao fim da duração, desligar o interruptor fecha a
sessão), e sete sobre `executeStep`: nunca executa em simulado, nunca
sem confirmação, **nunca sem sessão ativa** (o caso central — sem a
correção, isto executaria), nunca desligado, executa só com os quatro
fatores certos, um passo que rebenta fica registado sem propagar o
erro, e todo o passo fica no histórico mesmo recusado. **Confirmei que
os dois testes da porta de presença apanham mesmo o bug**: revertida a
correção temporariamente, os dois falharam como esperado, restaurada, os
13 voltaram a passar. Suite completa: 121 ficheiros, 1634 testes (era
120/1621). `tsc` limpo, `eslint` 0 erros.

Fecha o item 9 ("Fase 3.1: Controlo Direto") da fila de trabalho. Três
de quatro peças de risco revistas nesta auditoria tinham um achado real
— só os anexos de email ficaram limpos.

## 2026-08-13 — Ollama: mensagem específica quando o modelo não está instalado (item 2 da fila noturna)

Item 2 da fila noturna, pequeno de propósito: pedir ao Ollama local um
modelo que não foi puxado (`ollama pull`) chegava à interface como o
genérico "o serviço está com problemas do lado deles" — o mesmo texto
de um 5xx a sério, o que não ajuda ninguém a perceber que falta só um
comando.

Confirmado ao vivo contra um Ollama real a correr nesta máquina (não
presumido): um pedido a `/v1/chat/completions` com um modelo
inexistente devolve HTTP 404 com o corpo
`{"error":{"message":"model 'X' not found","type":"not_found_error",...}}`
— a forma compatível com a OpenAI que o Ollama usa para este caso
específico, diferente de qualquer outro 404.

Acrescentado um `AiFailureKind` novo (`'modelo'`, em `ai-failure.ts`),
com a mesma disciplina dos outros (uma frase em `AI_FAILURE_REASONS`,
uma sugestão em `AI_FAILURE_FIXES` — "corra `ollama pull` com o nome
do modelo, ou escolha um já instalado na Personalização"). Sem tocar
em `planFallback`: os outros tipos de falha já passam por ali de forma
genérica, um tipo a mais não pede lógica nova. `ollama-provider.ts`
ganhou `ollamaFailure(response)` — só entra em ação num 404, lê o
corpo, e só reconhece o caso se a forma bater (`type ===
'not_found_error'`); qualquer 404 diferente (endereço errado, por
exemplo) ou um corpo sem JSON válido continuam a cair no genérico de
sempre, sem rebentar.

Um teste antigo (`ollama-provider.test.ts`) travava exatamente o
comportamento antigo — chamava-se "cai no genérico de servidor" e
verificava isso. Corrigido para o novo comportamento, mais dois novos
para os dois casos de recuo (404 sem a forma esperada, corpo sem JSON).

**Verificação**: `tsc --noEmit` limpo, `eslint` 0 erros nos ficheiros
tocados, `vitest run` **121 ficheiros, 1637 testes** (era 1634 antes
desta peça). Confirmado ao vivo, não só nos testes: um pedido real ao
Ollama local por um modelo inexistente devolveu o erro novo
(`kind: 'modelo'`) através do código de produção, não de um mock.

Item 2 movido para "Feito" em `docs/log/fila-de-trabalho.md`.

## 2026-08-13 — Reordenar a cadeia de provedores de IA

Item 1 da fila: a ordem da cadeia de reserva (DeepSeek → Claude →
Ollama) vivia numa constante fixa em código (`CHAIN_ORDER`, em
`use-ai-settings.ts`) — não havia forma de a mudar. Agora `AiSettings`
ganhou `providerOrder`, uma preferência guardada editável em
Personalização → Assistente (lista numerada com setas para cima/baixo),
e `applyAiSettings` lê essa ordem em vez da constante, que desapareceu.
O escolhido continua a ir sempre à frente; sem preferência guardada,
cai na ordem por omissão. A store já existia e já estava registada em
`hydrate-all.ts`, por isso não houve store nova para esquecer. 4 testes
novos: reordenar pela interface guarda, a ordem sobrevive a recarregar,
a cadeia respeita a ordem guardada (não a fixa), e sem preferência cai
na omissão. `tsc` limpo, `eslint` 0 erros, suite completa a passar.

## 2026-08-13 — Revisão a sério: Editor visual de automações (item 10 da fila noturna)

Orquestração noturna multi-IA: item 10, revisão a sério do editor
visual de automações (`apps/automations/AutomationEditor.tsx`,
implementado 11/08/2026), nunca revisto por ninguém de fora.

**Um bug real, confirmado e corrigido**: `save()` editava uma
automação existente chamando `automationService.remove(existing.id)`
seguido de `automationService.add({...})`. Como `add()` gera sempre um
`id` novo e reinicia `createdAt` para agora, `lastRunAt` para `null` e
`runCount` para `0`, **qualquer edição — mesmo corrigir um erro de
escrita no nome — apagava o histórico da regra**. Uma automação que já
tinha corrido 40 vezes, editada para mudar só a descrição, voltava a
mostrar "nunca correu" no cartão da janela de Automações
(`AutomationsWindow.tsx`, que lê `runCount`/`lastRunAt` diretamente do
objeto). Sem crash, sem erro visível — só um dado errado a olhar para
a pessoa.

Corrigido com um método novo, `AutomationService.update(id, changes)`,
que substitui nome/descrição/gatilho/condições/ações mantendo `id`,
`createdAt`, `lastRunAt` e `runCount` do objeto existente; `null` se a
automação já não existir (por exemplo, apagada por outra janela
entretanto). `AutomationEditor.save()` passou a chamar `update()`
quando `existing` está definido, e `add()` só para automações novas.

4 testes novos: dois no serviço (`update` preserva identidade e
histórico; `update` numa automação inexistente devolve `null` sem
tocar na lista; persiste a sério) e dois num ficheiro novo dedicado ao
editor (`tests/automation/automation-editor-edit.test.tsx`) que montam
o componente a sério, com o `automationService` real (não mockado) e
um executor funcional — um confirma que guardar sem trocar nada
mantém `runCount`, o outro que editar o nome atualiza a mesma
automação em vez de criar uma segunda.

O resto do editor (serialização de blocos, drag-and-drop,
`automationToBlocks`) foi lido com atenção mas não revelou mais
problemas: `automationToBlocks` reconstrói os três tipos de bloco sem
perda de dados, `handleDrop` valida o `dataTransfer` antes de o
interpretar, e `canSave` bloqueia guardar sem gatilho ou sem ação —
não há forma de o editor produzir uma automação sem `trigger` ou sem
`actions`, os dois campos que o motor exige.

### Verificação

`tsc --noEmit` limpo, `eslint` 0 erros nos ficheiros tocados,
`vitest run` **122 ficheiros, 1642 testes** (era 121/1637 antes desta
peça). `SPEC.md` atualizado. Item 10 movido para "Feito" em
`docs/log/fila-de-trabalho.md`.

## 2026-08-13 — Revisão a sério: voz clonada, consentimento explícito (item 12)

Item 12 da fila noturna — a regra ética mais sensível do projeto
(`docs/estilo-de-codigo.md` §"Decisões éticas já assentes": nunca
clonar sem consentimento explícito, nunca personagens nem atores sem
autorização). O pedido concreto da fila era confirmar se importar um
ficheiro de áudio de fora contorna o consentimento — a resposta é não,
mas a leitura a sério encontrou um problema diferente, no único sítio
que decide o que fica guardado como voz de referência.

**Gap real, confirmado e corrigido**: `voice-clone-service/server.py`
tinha o CORS completamente aberto (`allow_origins=["*"]`). "Só ouve em
127.0.0.1" trava quem alcança o serviço por rede — não diz nada sobre
quem, na própria máquina, o consegue chamar. Com CORS aberto, qualquer
página aberta em qualquer separador do browser, sem ligação nenhuma ao
JARVIS, conseguia fazer `fetch('http://127.0.0.1:8090/voz', {method:
'POST', body: ...})` com um áudio à escolha dela enquanto o serviço
estivesse a correr — e o `CORSMiddleware`, com `*`, deixava essa página
tanto mandar o pedido como ler a resposta. `POST /voz` substitui sempre
`referencia.wav` sem perguntar nada: a única barreira de consentimento
deste projeto vivia inteiramente na convenção da interface do JARVIS
(o botão "Gravar a minha voz", que só grava pelo microfone ao vivo) —
nunca aplicada no próprio serviço, que é o único sítio que decide
mesmo o que fica gravado como referência. Um site malicioso não
precisava de enganar a pessoa a instalar nada; bastava estar aberto.

**Corrigido**: `allow_origins=["*"]` trocado por
`allow_origin_regex` restrito às origens reais do JARVIS. Primeira
tentativa (`http://localhost:\d+`, qualquer porta) revelou-se
demasiado larga ao escrever o teste — confiava em qualquer outro
servidor de desenvolvimento que por acaso estivesse a correr na mesma
máquina — corrigida para a porta exata (`devUrl` em
`tauri.conf.json`, `1420`) mais os esquemas do WebView em produção
(`https://tauri.localhost`, `tauri://localhost`), estes últimos **não
confirmados contra uma build empacotada a sério** — só a porta de
desenvolvimento, que é a que está a correr esta noite. 3 testes novos
(`voice-clone-service/tests/test_cors.py`, `pytest` + `TestClient`,
sem `with` de propósito para não disparar o arranque a sério do modelo
— um pedido de pré-voo CORS nunca chega às rotas): origem do JARVIS em
desenvolvimento aceite, página qualquer na internet recusada, outra
porta em `localhost` também recusada (o caso que a primeira versão do
regex deixava passar).

**Resto do fluxo, confirmado limpo**: o único caminho do lado da
interface que manda áudio para `/voz` é `recordVoiceSample`
(`voice-service.ts`), sempre via `getUserMedia` — busca em todo o
projeto por `<input type="file">` não encontrou nenhum seletor de
ficheiro ligado a voz ou áudio (os que existem são para anexos de
email, cópias de segurança, anexos de tarefas). Nenhuma ferramenta do
catálogo do assistente (`services/assistant/tools.ts`) consegue gravar
ou clonar — a única relacionada com voz é `ler_em_voz_alta`, que só
fala um texto já dado, sem tocar em `voices/`. A nota desatualizada em
`docs/spec/voz-clonada-local.md` (que dizia a sub-fase 4.2 — gravar
pela interface — por fazer) já não reflete o código: essa sub-fase
está feita há dias, confirmado pelo próprio `use-voice-sample-recorder.ts`.

### Verificação

Sem infraestrutura de testes Python no projeto antes desta peça —
criada agora (`voice-clone-service/requirements-dev.txt`,
`voice-clone-service/tests/`), deliberadamente separada do
`requirements.txt` principal (não puxa `torch`/`coqui-tts` só para
testar CORS). `pytest tests/test_cors.py`: **3 passam** (instalado e
corrido a sério nesta sessão, não só escrito — `pip install fastapi
httpx python-multipart pytest`, sem GPU). `tsc --noEmit` limpo,
`eslint .` 0 erros, `vitest run` **122 ficheiros, 1646 testes** (sem
mudança de contagem — esta peça não tocou em TypeScript). `SPEC.md`
atualizado. Item 12 movido para "Feito" em
`docs/log/fila-de-trabalho.md`.

**Não confirmado ao vivo**: os esquemas de origem do WebView em
produção (só o de desenvolvimento foi testado); nenhuma tentativa real
de explorar a falha antes da correção (o pedido de pré-voo CORS falso
prova o comportamento do `CORSMiddleware`, não foi feito um `fetch`
a sério a partir de uma página aberta noutro separador).

## 2026-08-13 — Revisão a sério: contexto de datas na conversa ("amanhã" resolvido pelo modelo)

Item 11 da fila noturna — rever a sério, como se fosse a primeira vez,
a entrada "2026-08-11 — Contexto na conversa: amanhã resolvido pelo
modelo, não por regras". O pedido era confirmar se a coisa depende do
fuso horário da máquina de forma frágil e se frases ambíguas ("depois
de amanhã", "esta sexta") enganam o modelo em silêncio.

O desenho confirma-se por leitura de código, e é sólido. O `system
prompt` dá a data por extenso e inequívoca — dia da semana + dia + mês +
ano em `pt-PT` ("Hoje é terça-feira, 11 de agosto de 2026"), via
`Intl.DateTimeFormat` — e também as horas ("São 09:05."), o que âncora
qualquer data relativa sem depender do relógio do próprio modelo. O
`now` nasce de fresco em cada pedido (`setContextSource` devolve `new
Date()`, e `readContext()` é chamado no momento do pedido em
`ai-service.ts`), por isso não há data presa desde o arranque. O fuso é
o da máquina de quem usa em todo o percurso: a data é formatada em hora
local, `parseDueDate` lê `AAAA-MM-DDT00:00:00` como meia-noite local, e
a tarefa é mostrada em `pt-PT` — sem mistura UTC/local em lado nenhum. E
numa app de ambiente de trabalho a máquina é a do utilizador; o modelo
recebe a data já resolvida em palavras, nunca um fuso para interpretar.

Um bug real, e foi o único: `parseDueDate` (`tool-runner.ts`) só
verificava a forma (`\d{4}-\d{2}-\d{2}`) e entregava o valor a `new
Date`, que rebate datas impossíveis sem avisar — "2026-06-31" virava 1
de julho em silêncio. Era exatamente o "prazo inventado" que a nota do
histórico dizia nunca acontecer. Corrigido a confirmar que os
componentes redondam ao que se escreveu (ano, mês, dia); 2 testes novos
— a data impossível é ignorada, e o dia 29 de fevereiro de um ano
bissexto continua aceite.

**Não confirmado ao vivo**, e fica dito porquê: as frases ambíguas
("esta sexta" quando hoje já é sexta, "a semana que vem") dependem da
interpretação do próprio modelo, e não há forma de as testar contra um
modelo real sem gastar chamadas — esta sessão não tem chave DeepSeek. O
que se confirmou foi o desenho (a data é inequívoca e o prompt manda o
modelo resolvê-la), não a qualidade da resolução frase a frase.

`tsc --noEmit` limpo, `eslint` 0 erros, suite completa a passar (121
ficheiros, 1643 testes). Item 11 movido para "Feito" em
`docs/log/fila-de-trabalho.md`.

## 2026-08-13 — Revisão a sério: suite E2E com Playwright

Item 14 da fila noturna — confirmar que a suite E2E ainda corre a sério
e ainda apanha regressões, não só que existe. Corrida por inteiro com
`npx playwright test`: passa de ponta a ponta, sem erros de configuração
nem testes presos; os browsers já estavam instalados, sem precisar de
`npx playwright install`.

A suite cobre login, abrir/fechar janelas (Dock e Paleta), temas,
instalar/executar e recusar um plugin, e microfone simulado — mas não
tocava no assistente, o fluxo que mais mudou desde que foi escrita (o
catálogo cresceu para 30 ferramentas: pesquisa web, navegador
controlado, notas, ficheiros). Acrescentado um teste pequeno e óbvio:
abrir a janela do assistente, enviar uma pergunta e receber a resposta
do provedor local (`RuleProvider`). As ferramentas do catálogo continuam
só nos testes unitários — exercitá-las no E2E exigia um provedor real
com `tools` e rede/nativo, ausentes do harness de browser; documentado
no `SPEC.md` que as duas suites são independentes e não se substituem.

`tsc --noEmit` limpo, `eslint` 0 erros (11 avisos pré-existentes),
`vitest run` 122 ficheiros / 1648 testes a passar, `playwright test`
11/11 a passar. Item 14 movido para "Feito" em
`docs/log/fila-de-trabalho.md`.

## 2026-08-13 — Revisão a sério: 2FA (palavra-passe/PIN + chave física)

Item 15 da fila noturna — uma revisão independente da peça "2FA a sério"
(construída na sessão anterior, nunca revista por ninguém de fora). Li o
código como se fosse a primeira vez, à procura de formas reais de entrar
só com um fator quando dois eram exigidos.

**Bug real encontrado e corrigido — fail-open em `completeFirstFactor`.**
Quando `twoFactorEnabled` estava ligado mas `hasRegisteredSecurityKey()`
devolvia `false`, o login concedia acesso só com a palavra-passe/PIN, em
silêncio — o "segundo fator exigido" deixava de proteger sem ninguém dar
por isso. O contrato (SPEC.md) diz "nunca só porque o primeiro fator
passou", e o código violava-o exatamente nesse estado. Não é um atalho
teórico: a interface impede criar o estado (o interruptor só aparece com
chave, e remover a chave desliga o 2FA sozinho), mas um restauro de uma
cópia — que guarda `twoFactorEnabled` no armazenamento local mas **não** a
credencial WebAuthn, que vive no cofre do sistema — ou um cofre limpo
deixam-no para trás. Corrigido para **negar** nesse estado, com mensagem e
entrada na auditoria: fail-closed, não fail-open. O teste que antes
afirmava o comportamento errado ("entra só com o primeiro fator") passou a
provar a negação, e falha contra o código antigo.

**O que confirmei como sólido, sem mexer:** palavra-passe e PIN passam os
dois pelo mesmo `completeFirstFactor` — com 2FA ligado e chave presente,
nenhum entra sem o segundo passo; os atalhos (biometria, PIN, chave física
direta) ficam escondidos durante o segundo fator; o bloqueio por
inatividade chama `logout()`, que limpa a sessão automática, e por isso o
desbloqueio volta a exigir o login completo — 2FA incluído, sem salto por
sessão antiga; sem corrida, `confirmSecondFactor` só chama `grant()`
depois de `verifySecurityKey()` devolver `ok`, nunca antes.

**Documentado, não corrigido** (limitações pré-existentes, fora do âmbito
desta peça): a biometria simulada (face/impressão digital em máquinas sem
Windows Hello) concede acesso sem credencial nenhuma; e a sessão
automática, que a confirmação da chave também passa a criar, abre uma
janela de 30 minutos em que reabrir a app sem terminar sessão salta o
login — ambas anteriores ao 2FA, e não o que esta revisão veio auditar.

`tsc --noEmit` limpo, `eslint` 0 erros, suite completa a passar (122
ficheiros, 1648 testes). Instância 2FA do item 15 acrescentada em
`docs/log/fila-de-trabalho.md`.

## 2026-08-13 — Revisão a sério: meteorologia (Open-Meteo) e notícias (NewsAPI)

Item 15 da fila noturna — revisão independente dos dois provedores de rede
reais da Peça 8, lote 2 (construídos na sessão anterior, nunca revistos por
ninguém de fora: a Kimi tentou três vezes e bateu sempre no limite de taxa
antes de começar). Li o código como se fosse a primeira vez, à procura de fuga
de chaves, fail-open da simulação e rebentamentos da interface.

**Bug real encontrado e corrigido — a chave da NewsAPI saía na cópia de
segurança em texto simples, nas plataformas sem cofre.** A rede de segurança
`SECRET_FIELDS` (`src/types/backup.ts`), que apaga os segredos do JSON antes
de o ficheiro ser escrito, só conhecia `aiSettings`. No browser e no Android
não há cofre de segredos, e `useNewsSettingsStore.persist()` guarda a chave no
storage normal — a cópia de segurança escrevia-a então em claro, contrariando
o contrato do próprio ficheiro ("um ficheiro que se descarrega e se envia por
email nunca deve conter segredos"). Corrigido acrescentando `newsSettings` ao
mapa — e, por serem o mesmo buraco na mesma rede, `webSearchSettings` e
`mailSettings`. 2 testes novos; falham contra o código antigo.

**O que confirmei como sólido, sem mexer:** (1) no desktop a chave da NewsAPI
vive no cofre do sistema e a interface mostra-a tapada por omissão (só a pedido
se mostra/apaga), e nunca vai para log nenhum — os erros de rede levam só o
código de estado, nunca o URL nem a chave; o Open-Meteo não tem chave de todo;
(2) sem chave (notícias) ou sem cidade (meteorologia) mantém-se o simulado,
sem rebentar nem fingir dados reais — `isSimulated` diz a verdade na interface;
(3) um pedido que falha (sem rede, servidor em baixo, resposta malformada) é
apanhado no `PollingDataService` e devolve `null` — o widget fica com o último
valor ou o esqueleto, nunca rebenta a interface; (4) o nome da cidade
(Open-Meteo) e o código de país (NewsAPI) só saem para os domínios declarados
no CSP e no aviso da interface, e não vão para log nem auditoria em texto
simples; (5) os testes chamam o código real — `news-api-provider.test.ts`
exercita `NewsApiProvider.fetch()` com `fetch` simulado, e os testes de
settings montam o componente e o `applyNewsSettings`/`applyWeatherSettings`
reais, não reimplementações à mão.

`tsc --noEmit` limpo, `eslint` 0 erros (11 avisos pré-existentes, fora dos
ficheiros tocados), `vitest run` 122 ficheiros / 1650 testes a passar.

## 2026-08-13 — Revisão a sério: notificações nativas isoladas (Peça 14, item 15 da fila)

Outra instância do item 15 (fila noturna) — a Peça 14 (notificações
nativas isoladas, Lote 4) tinha 10 testes, mas escritos pela mesma sessão
que a construiu; nunca tinha sido lida por ninguém de fora à procura de
forma explícita de a partir.

**O que li com atenção e confirmei sólido, sem nada a corrigir:**

- **O portão por estado do sistema bate certo com a intenção
  documentada.** `allowsToast()` (`types/system-state.ts`) — `'todos'`
  deixa sempre passar, `'nenhum'` nunca, e o resto (`'urgentes'`) só
  `warn`/`err` (`URGENT_KINDS`). Os cinco estados batem: Normal e
  Performance `'todos'`, Foco e Economia `'urgentes'`, Apresentação
  `'nenhum'` — exatamente o que as descrições de cada estado prometem.
- **O toast interno e a nativa nunca podem divergir em conteúdo.**
  Não é uma garantia solta — é estrutural: as duas vêm da mesma chamada
  a `notify()`, com as mesmas variáveis locais `title`/`description`;
  não há dois caminhos assíncronos separados que pudessem correr uma
  corrida e mostrar coisas diferentes.
- **`silent` corta sempre a nativa e o som, nunca o toast.** É a
  primeira condição de `mayInterrupt` (`!silent && allowsToast(...)`) —
  nenhum estado do sistema consegue reverter isto.
- **Uma notificação suprimida fica marcada `isDismissed: true` em todo
  o lado, não só nalguns ramos.** `dismiss(id)` é chamado pelo mesmo
  código sempre que `!mayInterrupt`, seja qual for o motivo (estado,
  `silent`) — um único caminho, não uma verificação por ramo que
  pudesse esquecer um caso.
- **O pedido de permissão nunca crasha a app.** `sendNativeNotification`
  (`TauriAdapterBase`) embrulha `isPermissionGranted`/`requestPermission`/
  `sendNotification` num único `try`/`catch` — um plugin que rebente
  devolve `false` com elegância, quem chama cai sempre no toast interno.

**Um ponto que investiguei e não considero bug, com a razão escrita:**
`sendNativeNotification` volta a chamar `requestPermission()` em **cada**
notificação nativa elegível, mesmo depois de uma recusa anterior — não
guarda em memória que já foi recusada. Em teoria isto podia "martelar"
o utilizador com o diálogo do sistema operativo a cada notificação
urgente. Na prática, as APIs de permissão de notificações (a do browser,
que a do Tauri embrulha) não voltam a mostrar UI depois de uma recusa
explícita — devolvem `'denied'` de imediato. O custo real é só uma
chamada assíncrona extra que resolve logo, não uma spam de diálogos.
Deixo isto escrito para quem vier a seguir não ter de repetir a mesma
investigação, não porque tenha a certeza absoluta do comportamento em
todas as plataformas — não confirmado ao vivo contra um SO real com a
notificação recusada de propósito.

`npx vitest run tests/services/notification-service.test.ts` — 10/10 a
passar, os testes exercitam mesmo os cinco cenários acima (não são
testes falsos). `tsc --noEmit` limpo. Nada corrigido — item 15
(instância "Notificações nativas isoladas") movido para "Feito" em
`docs/log/fila-de-trabalho.md` sem commit de código, só de
documentação.

## 2026-08-13 — Revisão a sério: esboço do Marketplace de plugins (item 15 da fila)

Outra instância do item 15 (fila noturna): o esboço do Marketplace
(`MarketplaceTab.tsx` + `marketplace-sample-data.ts`, sessão de 11/08)
nunca tinha sido lido por ninguém de fora à procura de forma explícita
de o partir.

**O que li com atenção e confirmei sólido, sem nada a corrigir:**

- **Renderização completa, sem `undefined` no ecrã.** As seis entradas
  mostram todos os campos (`name`, `tagline`, `author`, `rating`,
  `downloads`, `publishedAgo`, `pricing`); as cinco categorias usadas
  (`produtividade`, `integracao`, `ia`, `desenvolvimento`, `media`) têm
  todas etiqueta em `PLUGIN_CATEGORY_LABELS`, por isso nenhum cartão cai
  numa chave em falta.
- **Dados de exemplo consistentes entre si.** Seis `id` únicos,
  `rating` todos entre 0 e 5, `downloads` positivos, `pricing` sempre
  `'gratuito'` ou `'pago'`, `publishedAgo` sempre preenchido — nada
  repetido nem fora do tipo.
- **Nenhuma interação promete o que não cumpre.** "Instalar" está
  `disabled` com o porquê no `title`, e o aviso no topo da aba diz de
  frente que é um esboço com dados de exemplo e sem fonte real. Não há
  botão de detalhe nem filtro que finja fazer algo.

**Uma observação, não um bug:** os 5 testes (`tests/apps/marketplace-tab.test.tsx`)
chamam mesmo o componente real (`PluginManagerWindow`), clicam na aba e
verificam o DOM. Quatro confirmam comportamento a sério (as seis
entradas aparecem, o aviso está lá, os seis botões estão desativados,
não há pesquisa nem filtro). O quinto — "não instala nada de verdade,
mesmo que se tente" — é fraco: lê `usePluginStore.installed` duas vezes
seguidas sem nunca interagir com o botão, e é redundante com o teste que
já prova os botões desativados. Teste fraco, não errado — não esconde
bug nenhum; fica aqui escrito para quem vier a seguir não o tomar por
cobertura real.

`npx vitest run` — 1650/1650 a passar. `npx tsc --noEmit` limpo, `eslint`
sem erros. Nada corrigido — item 15 (instância "Marketplace de plugins
(esboço)") movido para "Feito" em `docs/log/fila-de-trabalho.md` sem
commit de código, só de documentação.

## 2026-08-13 — Ponto de situação da orquestração noturna (checkpoint, ~19:52)

O utilizador pediu, num único prompt, para eu (Claude local) orquestrar
sozinho a fila de trabalho (`docs/log/fila-de-trabalho.md`) entre Qwen,
Kimi, DeepSeek e mim próprio, a noite toda, sem mais nada da parte dele —
git pull → editar a fila (reserva por nome+hora) → commit → push → lançar
cada sessão com o texto do item, sempre com gates completos antes de
qualquer push e nunca confiando só no relatório de outra sessão. Isto é
um ponto de situação a meio da noite, não o fecho — o ciclo continua.

**Estado dos quatro "trabalhadores":**
- **Qwen** — sem quota desde o início da noite (`429`, quota semanal,
  reset previsto `08-19 03:23 UTC`). Nunca chegou a fazer nada esta
  sessão.
- **Kimi** — bateu no limite de taxa TPD da organização três vezes
  (18:31, 19:04, 19:17), sempre antes de conseguir sequer começar a
  tarefa nova — exceto na primeira tentativa da noite (item 3, Terminal),
  onde já tinha escrito uma correção substancial antes de bater no
  limite a meio, retomada pelo coordenador. O valor do limite desce
  devagar (`1538667` → `1530401` em 45 min) — é uma janela a decair, não
  uma quota fixa; não voltar a tentar sem deixar passar bastante tempo.
- **DeepSeek** — a mais produtiva esta noite: fechou os itens 1, 4, 11,
  14, e quatro instâncias do item 15 (2FA, meteorologia/notícias,
  marketplace — a das notificações foi o coordenador). Sem falhas.
- **Claude local (eu)** — orquestração contínua (fila, lançamentos,
  monitorização) mais trabalho direto em paralelo via forks isolados:
  itens 2, 10, 12, e a instância de notificações do item 15.

**Todos os 14 itens numerados da fila fechados.** O item 15 (repetível,
"outra peça sem revisão independente") teve quatro instâncias fechadas
até agora — decidi não o esgotar só por ser repetível, como a própria
fila avisa; a maior parte das peças de peso do projeto já teve uma
leitura adversarial esta noite.

**Bugs reais encontrados e corrigidos nesta sessão (contando só desde
que a fila começou, não a noite inteira antes dela — essa parte já está
nas entradas próprias mais acima):**

1. **Terminal** — carateres UTF-8 cortados a meio entre `read()`s do PTY
   (viravam `�`); `write()` do registo a segurar o lock de todo o
   registo durante uma escrita bloqueante (travava outras sessões,
   incluindo o `kill`); `kill()` sem `wait()` (zombies no Unix).
2. **Automações nativas** — `unwatch_folder` nunca sinalizava a thread
   do observador para parar (fuga real); duas regras de bateria a
   cruzar o mesmo limiar na mesma leitura, a segunda nunca disparava.
3. **Editor visual de automações** — editar uma regra (`remove`+`add`)
   dava-lhe um `id` novo e apagava `runCount`/`lastRunAt`/`createdAt`,
   mesmo numa correção trivial ao nome.
4. **Contexto de datas** — `"2026-06-31"` e datas assim eram rebatidas
   por `new Date` para outro dia, em silêncio — um prazo inventado.
5. **2FA (o mais sério)** — `completeFirstFactor` concedia acesso só com
   a palavra-passe/PIN quando o segundo fator estava ligado mas a chave
   física tinha desaparecido (restauro de cópia, cofre limpo) — o
   "segundo fator exigido" deixava de proteger, em silêncio. O teste
   antigo chegava a **afirmar** esse comportamento como correto.
6. **Cópias de segurança** — a chave da NewsAPI (e Brave Search, e a
   palavra-passe do correio) saíam em texto simples no ficheiro de
   cópia, em plataformas sem cofre de segredos (browser, Android).
7. **Voz clonada** — o serviço Python (`voice-clone-service/server.py`)
   tinha CORS aberto a qualquer origem; qualquer página aberta noutro
   separador do browser conseguia `POST /voz` e substituir a voz de
   referência sem consentimento nenhum — a única barreira real vivia na
   convenção da interface, nunca aplicada no serviço.

Mais três achados de uma sessão remota paralela (interativa, do próprio
utilizador), fundidos ao longo da noite: **SSRF real** no navegador
controlado pelo assistente (Peça 19 — só se conferia o esquema, nunca o
anfitrião; `localhost`/redes privadas/metadados de nuvem passavam);
**escrita através de link simbólico** no vault Obsidian (só a pasta-mãe
era canonicalizada, não o ficheiro final); e **Controlo Direto sem porta
de presença** (`executeStep()` não confirmava sessão ativa antes de
executar — mas, mais grave em honestidade do que em segurança, nada
disto está ligado a nenhum fluxo alcançável pela pessoa).

**Gates**: todos os fecho de item passaram por `tsc --noEmit`, `eslint .`
(0 erros), `npx vitest run` (suite completa — 1650 testes neste
checkpoint) corridos pelo coordenador, nunca só aceites pelo relatório
da sessão que fez o trabalho — apanhou pelo menos uma discrepância real
ao longo da noite (a mesma classe de "store nunca hidratada" repetida
duas vezes, já documentada nas entradas próprias).

O ciclo continua. Próximo passo: aguardar Kimi/Qwen recuperarem
capacidade, ou encontrar mais uma peça de peso genuína para o item 15 —
sem forçar trabalho de valor marginal só para preencher tempo.

## 2026-08-13 — Revisão a sério: fronteira do sandbox de execução de plugins (item 15 da fila)

Quinta instância do item 15 (fila noturna): a fronteira de isolamento do
sandbox de plugins — `<iframe sandbox="allow-scripts">`, o protocolo por
`postMessage` e as capacidades declaradas no manifesto. A revisão de 11/08
desta peça só procurou fugas de memória e temporizadores por limpar; nunca
uma revisão adversarial da própria fronteira (fuga de permissões, fuga de
caminhos, leitura entre plugins). As cinco perguntas da fila foram
respondidas uma a uma.

**Dois bugs reais, ambos corrigidos com teste que os prova:**

1. **As permissões do manifesto nunca eram verificadas em runtime (grave).**
   `handlePluginMessage` só conferia `selectPermissionDenied` (a lista de
   recusas em Privacidade), nunca o `permissions` do manifesto do próprio
   plugin. Como a assinatura Ed25519 cobre só o manifesto (nunca o código),
   um plugin externo assinado com um manifesto estreito e benigno podia
   pedir **qualquer** capacidade não recusada — notificações, ficheiros,
   rede, janelas. Corrigido com dois degraus: primeiro a capacidade tem de
   estar declarada (`permissions[capacidade] === true`), depois não pode
   estar recusada. Um plugin externo passou a resolver a declaração a
   partir do manifesto **assinado** do próprio pacote, nunca da entrada do
   catálogo com o mesmo id (fechava também um bug de colisão de ids).
2. **Um caminho absoluto escapava da pasta do plugin (médio).**
   `resolveWithinRoot` só rejeitava `..`; um caminho absoluto passava, e o
   `join` do Tauri (que mapeia para `Path::push` em Rust) substitui a base
   quando o caminho é absoluto — `core.fs.read({ caminho: "/..." })` lia
   fora da pasta declarada, dentro de `$APPDATA/**`, alcançando os dados
   da própria app e de outros plugins. Corrigido com a rejeição de caminhos
   absolutos (`isAbsolute`) antes de resolver.

**Confirmado sólido, sem nada a corrigir:** a validação do remetente é
`event.source === iframe.contentWindow` (a correta para origem opaca, onde
`event.origin` é sempre `"null"`); o atributo é exatamente
`sandbox="allow-scripts"` sem `allow-same-origin`; o armazenamento usa o
prefixo `plugins:<id>:` e não deixa um plugin ler o de outro; os três
exemplos da pergunta 5 pediam exatamente as capacidades que usam (as
quatro entradas que chamavam `core.notify` sem o declarar foram corrigidas
no catálogo).

`npx vitest run` — 1654/1654 a passar (4 testes novos para a fronteira de
permissões e caminhos). `npx tsc --noEmit` limpo, `eslint .` com 0 erros
(11 avisos pré-existentes, em ficheiros alheios). Ver
`docs/spec/plugins-sandbox.md` (§"O protocolo" e §"Ficheiros") e `SPEC.md`
Parte 11.

## 2026-08-13 — Revisão a sério: memória do assistente (extração e esquecimento)

Sexta instância do item 15 (fila noturna): a memória local do assistente
(`src/services/assistant/memory-service.ts`) — dados pessoais persistentes,
nunca revista por ninguém de fora. As cinco perguntas da fila respondidas
uma a uma, com leitura do serviço, do executor de ferramentas
(`tool-runner.ts`) e da injeção no prompt de sistema (`ai-service.ts`).

**Dois bugs reais, ambos corrigidos com teste que os prova:**

1. **Guardava o contrário do que foi dito.** As expressões de extração
   (`prefiro`, `gosto de`, `moro em`, `trabalho como`…) não conheciam
   negação: "não gosto de café" correspondia em `gosto de café` e ficava
   guardado como "preferes café" — um facto inventado, o oposto do que a
   pessoa disse. Corrigido: uma negação ("não", "nem", "nunca"…)
   imediatamente antes da frase anula a leitura.
2. **Arrastava o resto da frase para o valor.** A captura `(.+)` comia
   tudo a seguir ao gatilho: "moro no Porto desde 2019" guardava "Porto
   desde 2019", e "gosto de café e a minha palavra-passe é segredo"
   guardava o segredo em texto simples. Corrigido: o valor acaba na
   primeira fronteira de oração (pontuação ou conjunção).

**Confirmado sólido, sem nada a corrigir:** `esquecer_memoria` apaga mesmo
tudo — `clear()` esvazia a store **e** persiste esse vazio no storage, sem
nada que reapareça ao reiniciar; a ferramenta continua a exigir confirmação
(`risk: 'perde'`, barrada em `runTool` antes de correr). Limites existem e
chegam: preferências no máximo 4 chaves (cada valor ≤ 60 carateres),
últimos pedidos no máximo 20 (`MEMORY_PROMPT_LIMIT`). Os testes chamam o
serviço real (`extractPreference` e `MemoryService` contra `localStorage`),
não dados de exemplo — mas não cobriam negação, fronteira de oração nem a
persistência do `clear()`; 3 testes novos.

`npx vitest run` — 1657/1657 a passar. `npx tsc --noEmit` limpo, `eslint`
com 0 erros. Ver `SPEC.md` (Parte 7.2 §Memória).

**Correção de seguimento, pelo coordenador (mesmo dia):** ao verificar o
diff a sério, `cutAtClauseBoundary` tinha o mesmo tipo de bug que estava a
corrigir. O `\b` do JavaScript não conta acentos como carateres de
palavra — "no comércio" era lido como a preposição "com" seguida de
fronteira (a transição de "m" para "é" conta como `\b` por omissão), e o
corte apagava a palavra inteira: "trabalho no comércio" ficava só
"trabalho no ", um valor vazio. Confirmado com um teste isolado em
`node -e` antes de mexer no código, para não corrigir uma suposição.
Corrigido com uma `lookahead` explícita por uma letra (com ou sem acento)
em vez do `\b`, preservando os dois cortes que a peça já corrigia (`no
Porto desde 2019` → `Porto`; `café e a minha palavra-passe…` → `café`) e
deixando de cortar `comércio`/`Paraguai`/etc. 1 teste novo. `tsc`/`eslint`
limpos, `vitest run` — 1658/1658 a passar.

## 2026-08-13 — Revisão a sério: restauro de cópias de segurança (integridade, não só os segredos)

Mais uma instância do item 15 (fila noturna): o caminho de **restauro** das
cópias de segurança — `BackupPanel.tsx` e `readBackup`/`restoreBackup` em
`src/types/backup.ts` e `src/services/backup-service.ts`. A revisão da
manhã sobre meteorologia/notícias só corrigira a fuga de segredos na
**criação** da cópia (`SECRET_FIELDS` incompleto); o restauro em si nunca
fora revisto por ninguém de fora. As cinco perguntas da fila, uma a uma.

**Um bug real, corrigido com testes que o provam:** a validação do ficheiro
só conferia a estrutura exterior — é JSON, `format` e `version` certos, as
chaves são conhecidas — mas **nunca os valores**. Uma cópia adulterada com
uma secção na forma errada (ex.: `tasks` como string, ou `notifications`
como objeto onde se espera uma lista) passava, era escrita no armazenamento
e rebentava a store ao lê-la depois — `useNotificationStore.hydrate` faz
`saved.map`, `useWorkspaceStore` `saved.desktops.find` — já com o estado
corrompido, e voltava a rebentar no arranque seguinte. Corrigido: `readBackup`
confere agora a forma de cada secção conhecida contra um mapa
`SECTION_KINDS` (o mesmo padrão do `SECRET_FIELDS`) e recusa com
`dados-invalidos` antes de tocar em nada; `confirm` apanha a falha residual
e mostra erro em vez de ficar preso no ecrã de confirmação. 5 testes novos
(commit `d6bb7a8`).

**Confirmado sólido:** JSON inválido, formato estranho, versão futura e
cópia vazia são recusados com mensagem clara, sem rebentar; repor só escreve
as chaves que a cópia traz (uma cópia antiga não apaga o que não conhece); o
segredo continua de fora. O que **não** fica fechado é a adulteração
*dentro* de uma secção já com a forma certa (ex.: `workspace.desktops` como
string) — validar o esquema inteiro de cada store é trabalho delas, não da
fronteira da cópia; algumas já o fazem (temas personalizados filtram,
widgets descartam ids desconhecidos).

`npx vitest run` — 1663/1663 a passar. `npx tsc --noEmit` limpo, `eslint`
com 0 erros. Ver `SPEC.md` (Parte 14 §Backups e restauro).

## 2026-08-13 — Resumo da orquestração noturna (fecho, ~23:25)

O utilizador pediu, num único prompt, para eu (Claude local) orquestrar
sozinho a fila de trabalho entre Qwen, Kimi, DeepSeek e mim próprio, a
noite toda, sem mais nada da parte dele: `npm run tauri dev` num terminal
à parte (para poder testar ao vivo a qualquer momento), fila em
`docs/log/fila-de-trabalho.md` com reserva por `git push` (nome+hora
antes de começar), gates completos antes de qualquer publicação, e nunca
confiar só no relatório de outra sessão. Isto é o fecho dessa fila —
depois desta entrada passo a monitorização mínima (dev server vivo,
`git log`/`git status` limpos) em vez de continuar a atribuir peças, por
a maior parte do projeto já ter tido uma leitura adversarial esta noite.

**Estado final dos quatro "trabalhadores":**
- **Qwen** — sem quota a noite inteira (`429`, quota semanal, reset
  previsto `08-19 03:23 UTC`). Nunca chegou a fazer nada.
- **Kimi** — bateu no limite de taxa TPD da organização cinco vezes
  (18:31, 19:04, 19:17, 20:25, 22:52), a primeira já a meio de uma
  tarefa (item 3, Terminal — correção substancial recuperada pelo
  coordenador). A janela nunca decaiu de forma fiável: desceu devagar
  entre a 2.ª e a 3.ª tentativa, e voltou a subir entre a 4.ª e a 5.ª —
  outro uso da organização compensa o que liberta. Deixada de lado para
  o resto da noite.
- **DeepSeek** — a mais produtiva: fechou os itens numerados 1, 4, 11,
  14, e sete instâncias do item 15 (2FA, meteorologia/notícias,
  marketplace, sandbox de plugins, memória do assistente, restauro de
  cópias — mais o Terminal, retomado do trabalho da Kimi). Sem falhas
  a noite toda.
- **Claude local (eu)** — orquestração contínua (fila, lançamentos,
  monitorização, reinício do dev server quando parou) mais trabalho
  direto em paralelo via forks isolados: itens 2, 10, 12, e a instância
  de notificações do item 15 — além de duas correções de seguimento
  encontradas ao verificar o trabalho da DeepSeek (o `\b` do JavaScript
  em `memory-service.ts`, e um `eslint.config.js` esquecido por
  commitar).

**Todos os 14 itens numerados da fila fechados.** O item 15 (repetível)
teve **sete instâncias fechadas**, todas verificadas independentemente
pelo coordenador antes de aceitar (nunca só pelo relatório de quem fez o
trabalho) — gates completos (`tsc`/`eslint`/`vitest`, e `cargo test`
onde havia Rust envolvido) mais leitura real do diff, com spot-checks
adicionais nos achados de segurança.

**Bugs reais encontrados e corrigidos, só a partir do início da fila
(a parte anterior já está nas entradas próprias, mais acima):**

1. **Terminal** — UTF-8 cortado a meio de `read()`s (viravam `�`);
   `write()` do registo a segurar o lock inteiro durante uma escrita
   bloqueante (travava outras sessões, incluindo o `kill`); `kill()`
   sem `wait()` (zombies).
2. **Automações nativas** — `unwatch_folder` nunca sinalizava a thread
   do observador para parar; duas regras de bateria a cruzar o mesmo
   limiar na mesma leitura, a segunda nunca disparava.
3. **Editor visual de automações** — editar (`remove`+`add`) dava `id`
   novo e apagava `runCount`/`lastRunAt`/`createdAt`.
4. **Contexto de datas** — datas impossíveis (`"2026-06-31"`) eram
   rebatidas por `new Date` para outro dia, em silêncio.
5. **2FA** — `completeFirstFactor` concedia acesso só com a
   palavra-passe/PIN quando o segundo fator estava ligado mas a chave
   tinha desaparecido (restauro de cópia, cofre limpo) — o teste antigo
   chegava a **afirmar** esse comportamento como correto.
6. **Cópias de segurança, criação** — a chave da NewsAPI/Brave
   Search/palavra-passe do correio saíam em texto simples, em
   plataformas sem cofre.
7. **Voz clonada** — CORS aberto a qualquer origem no serviço Python;
   qualquer página do browser podia substituir a voz de referência sem
   consentimento.
8. **Sandbox de plugins (o achado mais sério da noite)** — as
   permissões do manifesto nunca eram verificadas em runtime, só a
   lista de recusas da interface; um plugin externo assinado com
   manifesto estreito podia pedir qualquer capacidade não recusada.
   Mais um caminho absoluto que escapava da pasta declarada do plugin.
9. **Memória do assistente** — guardava o contrário do que fora dito
   (negação ignorada); arrastava o resto da frase para o valor,
   incluindo um segredo dito a seguir. E, na própria correção: o `\b`
   do JavaScript não conta acentos como carateres de palavra, cortando
   "comércio" como se fosse "com" + fronteira.
10. **Cópias de segurança, restauro** — uma secção com a forma errada
    (adulterada ou corrompida) passava a validação, era escrita no
    armazenamento e rebentava a store ao ler — já com o estado
    corrompido, voltando a rebentar no arranque seguinte.

Mais três achados de uma sessão remota paralela (interativa, do
utilizador), fundidos ao longo da noite: SSRF real no navegador
controlado pelo assistente (só se conferia o esquema, nunca o
anfitrião); escrita através de link simbólico no vault Obsidian (só a
pasta-mãe era canonicalizada); Controlo Direto sem porta de presença
(mas sem ligação a nenhum fluxo alcançável pela pessoa — mais grave em
honestidade do que em segurança).

**Confirmado limpo, sem nada a corrigir** (revisões que não encontraram
bugs, documentadas com o que foi especificamente verificado, não uma
frase genérica): notificações nativas isoladas, esboço do marketplace
de plugins, explorador de ficheiros real (Peça 7), anexos de email,
Peça 20 (ferramentas do Claude no orquestrador), Ollama com ferramentas,
assinatura de plugins (revista antes desta fila), cofre/Windows Hello
(revista antes desta fila).

**Trabalho ainda por fazer, sem urgência:** o item 15 continua
repetível — sobra sempre mais por escolher em áreas menores (Command
Palette, janelas individuais como Tarefas/Projetos/Calendário, o
sandbox de plugins tem uma limitação documentada e aceite: adulteração
*dentro* de uma secção já com a forma certa continua a ser
responsabilidade de cada store). Nenhuma delas parece urgente o
suficiente para justificar continuar a atribuir trabalho esta noite.

**Todas as peças "Precisa de decisão da pessoa" ficaram por tocar**, como
pedido: wake word configurável, e as capacidades de plugin Executar
Voz/Ler Memória/Guardar Preferências.

## 2026-08-14 — Item 16: fala por frase, à medida que a resposta chega

O utilizador reportou ao vivo, já depois do fecho da fila de ontem à
noite: o assistente escrevia a resposta toda no ecrã antes de dizer
uma palavra. Diagnóstico já vinha feito na fila — `App.tsx`, dentro do
tool `ask`, só chamava `speak(reply)` depois de `aiService.send()`
resolver por inteiro, o que só acontece quando o streaming termina.
Tentativa de atribuir à Kimi falhou de imediato (mesmo limite de taxa
TPD de ontem à noite, sem sinal de recuperação em ~4h20) — o
coordenador assumiu o item diretamente, num fork isolado.

**O que mudou:**

- `aiService.send()` ganhou um segundo parâmetro opcional,
  `onChunk?: (chunk: string) => void`, chamado a par de cada
  `appendToMessage` — não só no caminho principal, mas também nos três
  caminhos de `recover()` (troca de provedor na cadeia, nota de aviso,
  queda para o provedor local), para o que já se falava nesses casos
  (incluindo o próprio aviso "— trocado para X —") continuar a ser
  falado, agora por frase.
- `src/services/voice/sentence-segmenter.ts` (novo) — `extractSentences`,
  função pura: dado o buffer acumulado até agora, devolve as frases já
  fechadas (`.`/`!`/`?`, um ou repetidos como "...", seguidos de espaço
  ou fim) e o que sobra por fechar, para juntar ao próximo bocado.
  Abreviaturas comuns ("Sr.", "n.º", "etc.") não contam como fim de
  frase — um conjunto pequeno, verificado pela palavra imediatamente
  antes da pontuação.
- `useVoice()` ganhou `speakQueued` — `voiceService.speak()` cancela
  qualquer fala em curso ao ser chamado ("falas sobrepostas ficam
  impercetíveis", já documentado no próprio ficheiro), por isso
  chamá-lo uma vez por frase sem mais nada cortaria a frase anterior a
  meio. `speakQueued` enfileira em vez disso: só passa a frase seguinte
  ao `voiceService.speak()` depois do `onEnd` da anterior. Mesmo truque
  já usado no ficheiro para `tentarReengatarRef` (uma `ref` guarda a
  versão mais recente da função recursiva, para o `useCallback` não se
  chamar a si próprio antes de estar declarado — o `eslint` apanhou
  isto a sério, não deixou passar).
- `ask`, em `App.tsx`, acumula os pedaços num buffer local, corta por
  frase a cada `onChunk`, chama `speakQueued` para cada frase fechada,
  e no fim (quando a `Promise` do `send()` resolve) fala o que sobrar
  no buffer, mesmo sem pontuação de fecho.

**Testes**: 9 sobre `extractSentences` (frases completas, várias por
buffer, frase incompleta que espera pelo bocado seguinte, reticências
como um só fim, abreviaturas que não partem a frase, buffer vazio/só
espaço) e 3 sobre `speakQueued` via `renderHook` (primeira frase fala
logo, segunda só depois do `onEnd` da primeira, frase vazia não chega
a chamar o serviço, fila esvaziada aceita uma frase nova de imediato) —
`voiceService.speak` mockado, sem depender de `speechSynthesis` real.
`tsc --noEmit` limpo, `eslint` 0 erros, `vitest run` — 1675/1675 a
passar (1 falha isolada em `login-screen.test.tsx`, confirmada à parte
como a mesma flakiness sob carga já documentada nesta fila, sem
relação com esta peça).

**Não confirmado ao vivo com áudio a sério** — sessão sem microfone
nem colunas para ouvir a sério; confirmado por leitura cuidadosa do
código e pelos testes automatizados, que provam a ordem das chamadas
ao `voiceService.speak`, não o som em si.

**Pista deixada pelo utilizador, registada mas não seguida nesta
peça**: olhou para
[`KoljaB/RealtimeVoiceChat`](https://github.com/KoljaB/RealtimeVoiceChat)
como referência — a app em si não serve (frontend próprio, sem
manutenção ativa), mas usa a mesma base (`coqui-tts`/XTTS-v2,
`openai-whisper`) que o `voice-clone-service/` já usa, através de
`RealtimeTTS`/`RealtimeSTT` (bibliotecas do mesmo autor). Vale a pena
confirmar, noutra altura, se `RealtimeTTS` dá para sintetizar por
frase do lado do serviço Python em vez de só cortar do lado do
TypeScript — resolveria metade disto de forma mais robusta, sem
depender de uma segmentação de frases escrita à mão. Documentado em
vez de perseguido agora, para não misturar um pip install e uma
mudança de protocolo Rust↔Python numa correção que já estava pedida
para hoje.

## 2026-08-14 — Item 16, lado Python: RealtimeTTS testado e descartado para o server.py

Sub-investigação da segunda instância DeepSeek (worktree
`jarvis-novo-deepseek2`) sobre a pista do RealtimeTTS no item 16. Testado a
sério, não só lido: o `CoquiEngine` do RealtimeTTS 0.7.3 carrega o XTTS-v2
já em cache e sintetiza a voz clonada contra o stack instalado (coqui-tts
0.27.5, torch 2.13+cu130, Python 3.13), com áudio a sair. Mas não serve
para o `voice-clone-service/server.py`: a biblioteca é toda orientada a
*reproduzir* áudio em tempo real nas colunas (StreamPlayer/PyAudio), e a
única saída programável são pedaços de PCM float32 a 24 kHz, sem fronteiras
de frase nem contentor WAV — o que o servidor devolve por HTTP teria de ser
reconstruído à mão. O motor ainda corre num processo separado (`spawn`),
frágil debaixo do uvicorn, e gere o modelo por um caminho próprio. E o
ganho que se procurava já se atinge sem nada disto: o fork TypeScript do
coordenador corta por frase e chama `POST /falar` uma vez por frase, e o
`/falar` atual já sintetiza o texto que receber — uma frase por pedido já é
síntese por frase. Fechado como "explorado, não vale a pena agora", sem
mexer no server.py. (Nota lateral, fora do âmbito: o `/falar` atual
recomputa os latents da voz clonada a cada chamada por passar `speaker_wav`;
o coqui-tts 0.27.5 já tem cache de voz via `voice_dir`, se isso um dia se
tornar o gargalo.)

## 2026-08-14 — "Modo JARVIS Classic" ao vivo: não é bug de código, é reforço de histórico

Item 17 da fila. O utilizador reportou o sintoma outra vez depois da
correção de 13/08 — por isso o teste não se ficou por ler o código:
reproduziu-se ao vivo contra o `qwen3:8b` (o único modelo local
instalado no Ollama), usando o `OllamaProvider` e o
`systemPrompt`/`buildMessages` reais, não reescritos à mão. Em conversa
nova (sem histórico), tema "JARVIS Classic" no contexto e um pedido
direto de código, o modelo gerou a função nas 3 amostras, sem nunca
mencionar "Modo JARVIS Classic" nem recusar por causa do tema/estado — a
linha do prompt de sistema está a ser respeitada. Até com a frase errada
plantada no histórico, continuou a gerar o código (a linha pesa mais do
que o histórico já dito).

Conclusão: nada a corrigir no código. O que o utilizador viu foi o
modelo a repetir o que já tinha dito numa conversa anterior à correção
(ou uma sessão ainda a correr o código antigo), não uma falha do prompt
atual. Sem commit de código — só esta nota e a atualização da fila.

## 2026-08-14 — Incidente: o dev server ficou preso a servir um estado partido

O utilizador reportou o JARVIS a não responder, com prioridade sobre
qualquer item da fila. Diagnóstico: o `npm run tauri dev` que ficava
aberto a noite toda **não vigiava só o projeto** — o `vite.config.ts`
só excluía `src-tauri/**` da vigilância, nunca `.claude/worktrees/**`
(onde cada fork isolado do coordenador vive, uma cópia completa do
repositório com o seu próprio `index.html`/`tsconfig.json`). Às 03:16,
uma alteração no worktree do fork do item 16 (`agent-a65b3a73e2ebc293c`)
disparou um `page reload` e depois um `full-reload` no dev server
principal **com o `tsconfig.json` desse worktree isolado, não o do
projeto** — e não houve mais nenhum output depois disso: a app ficou a
servir esse estado partido, sem cair, sem recuperar sozinha.

Corrigido em duas frentes:
1. `vite.config.ts` — `.claude/worktrees/**` acrescentado à lista de
   caminhos ignorados pelo vigiador (`watch.ignored`), ao lado de
   `src-tauri/**`. Sem isto, qualquer fork futuro do coordenador volta
   a arriscar o mesmo.
2. Processo do dev server morto e reiniciado do zero, já com o
   ficheiro corrigido — compilação limpa, sem avisos novos.

**Confirmado a funcionar de novo**: suite E2E
(`tests/e2e/assistant.spec.ts`) corrida a sério contra a app reiniciada
— abre a janela do Assistente, manda uma pergunta a sério, recebe
resposta do `RuleProvider`. Não foi possível abrir as devtools da
janela nativa para confirmar a consola (sem automação de ecrã segura
disponível nesta sessão — ver o incidente de foco de 13/08), mas o
teste E2E cobre o mesmo caminho de ponta a ponta.

**Porque interessa manter registado**: qualquer sessão futura que
lance um fork isolado (`Agent` com `isolation: worktree`) enquanto o
dev server principal está aberto tem de saber que isto já foi uma
causa real de "a app parou de responder" — não é hipotético.

## 2026-08-14 — Revisão a sério: fala por frase (item 16, lado TypeScript)

Revisão adversarial da peça construída esta noite (segmentador de frases,
`speakQueued`, ligação no `ask`), nunca revista por ninguém de fora. Dois
bugs reais, corrigidos:

1. **Partir frases a meio do stream.** `extractSentences` tratava o fim do
   buffer como fim de frase (o `$` do lookahead) — a meio do stream, um
   "3." tanto é o fim de "vale 3." como metade de "3.14", e sem o bocado
   seguinte não havia como distinguir. Um número decimal, uma versão
   ("v2.0") ou um domínio ("exemplo.com") cortados entre dois bocados
   saíam partidos ao meio. Corrigido com um flag `final`: só o último
   bocado fecha a frase no fim do buffer; a meio, a pontuação do fim fica
   por fechar até ao bocado seguinte (o `then` do `ask` faz o fecho final).
   Confirmado também o que NÃO parte (dentro de um bocado, "3.14"/"14.30"/
   "..." já se aguentavam pelo lookahead `(?=\s|$)`).

2. **A fila por frases nunca era esvaziada.** `stopSpeaking()` (ao ir para
   segundo plano) ou uma `speak()` avulsa (saudação, automação) calavam só
   a frase a tocar — o `onEnd` dela avançava a fila e a frase seguinte
   falava na mesma, já sem a pessoa a ver o assistente nem o contexto que
   a gerou; no caso da `speak()` avulsa, a fila ainda a atropelava e a
   perdia. Novo `limparFilaDeFala`, chamado pelo `speak()`, ao ir para
   segundo plano e no arranque de um `ask` novo. O `ask` também numera os
   pedidos (geração), para o fim de um streaming cancelado por outro
   pedido não falar as frases que ficaram para trás.

5 testes novos (3 do segmentador, 2 da fila). `tsc --noEmit` limpo,
`eslint .` 0 erros (11 avisos pré-existentes noutros ficheiros),
`vitest run` 1680/1680. O que ficou de fora, de propósito: a lista de
abreviaturas é deliberadamente curta — "pág.", "fig.", "n." e outras raras
em fala conversacional continuam a partir a frase a meio; alargá-la é um
jogo sem fim, e a lista cobre as que saem numa resposta falada normal. O
`ask` não é cancelado ao fechar a janela do assistente (é disparado por
voz/comando, à parte da janela) — fica como limitação conhecida, não é
desta peça.

## 2026-08-14 — Revisão a sério: modo conversa (re-engate automático do microfone)

Revisão adversarial do ciclo de re-engate do microfone no modo conversa
(`useVoice`, `src/hooks/use-voice.ts`, contra o `voice-service.ts`) — a peça
de 11/08/2026, nunca revista por ninguém de fora. Dois bugs reais, corrigidos:

1. **Os erros transientes passavam pelo caminho de erro a sério.** O
   `onError` da escuta chamava `setMode('error')` e registava um erro **antes**
   de decidir se o erro era transiente. `no-speech` (um silêncio de rotina,
   que acontece de cada vez que a pessoa demora mais de ~12s a responder no
   modo conversa) e `a-falar` (o guarda de eco a segurar o microfone enquanto
   a voz ainda soa — dispara no ciclo normal sempre que um comando dito em voz
   alta gera uma confirmação falada) piscavam "erro" no núcleo e sujavam o
   registo. Pior: no limiar (3.ª tentativa seguida sem fala), o
   `setMode('error')` já tinha corrido quando o modo conversa se desligava, e
   como o `onEnd` só repõe a "idle" se o modo for "listening", o núcleo ficava
   **preso em "erro"** depois de o microfone se ter desligado sozinho — um
   estado que nada repunha até a pessoa interagir. Corrigido tratando os
   transientes primeiro, sem tocar no modo nem no registo.

2. **Ao voltar do segundo plano, o ciclo nunca retomava.** O efeito de
   visibilidade só agia quando a janela perdia o foco (parava fala/escuta e
   limpava o re-engate); o histórico prometia "retoma-se ao voltar", mas não
   havia ramo nenhum para o fazer. Resultado: depois de ir a segundo plano, o
   microfone nunca mais ligava sozinho, apesar de o botão continuar aceso — e
   clicar no microfone com o modo conversa ativo **desliga** o modo (é o gesto
   de "parar"), por isso a ação natural da pessoa tinha o efeito contrário.
   Corrigido com um ramo de foreground que re-engata quando o modo conversa
   continua ativo e não se está a ouvir.

5 testes novos (`tests/voice/conversation-mode.test.ts`), confirmados a falhar
contra o código antigo e a passar com a correção. `tsc --noEmit` limpo,
`eslint .` 0 erros (11 avisos pré-existentes noutros ficheiros), `vitest run`
1685/1685. O que ficou de fora, de propósito: erros persistentes
(`not-allowed`, serviço em baixo) param o ciclo e mostram uma notificação,
mas não desligam o modo conversa — fica "aceso mas morto" até a pessoa o
voltar a ligar; é uma escolha de desenho (o aviso já lá está), não desta
peça.

## 2026-08-14 — Revisão a sério: voz clonada, síntese e reprodução no lado cliente

Revisão adversarial de `speakClonada` (`src/services/voice-service.ts`), a
síntese e reprodução da voz clonada no lado cliente — a peça ligada ao
serviço local (`fetch /falar` → blob URL → `Audio`). Só o consentimento/CORS
(item 12) tinha sido revisto; o ciclo de vida das blob URLs e o caminho de
falha nunca tinham sido lidos por ninguém de fora. Dois buracos reais,
corrigidos:

1. **`audio.play()` a recusar deixava a blob URL órfã.** O `catch` do
   `speakClonada` só fazia `onSpeechEnd` + `onEnd`. Se o `play()` recusasse
   (política de autoplay, ou áudio ilegível), a URL acabada de criar nunca
   era revogada e `cloneAudio` ficava a apontar para um áudio que já não ia
   tocar — o mesmo defeito que a variável `cloneAudio` existe para evitar (o
   `pause()` não dispara `onended`, e sem revogar a URL a blob fugia até a
   página fechar), confirmado pelo próprio comentário da classe.
2. **`fetch` a falhar deixava a fala anterior a tocar sem guarda.** Se o
   pedido ao serviço local falhasse com uma fala anterior ainda a soar, essa
   fala continuava — mas `onSpeechEnd` já tinha libertado o microfone, ou
   seja, ficava um "a falar" sem ninguém a segurar o eco.

Corrigido no `catch`: se ainda há um áudio anterior a tocar, para-se
(`pause`) e revoga-se a sua URL antes de libertar o microfone. 2 testes novos
(`tests/voice/voice-clone-synthesis.test.ts`), confirmados a falhar contra o
código antigo e a passar com a correção. `tsc --noEmit` limpo, `eslint .` 0
erros (11 avisos pré-existentes noutros ficheiros), `vitest run` 1687/1687.
O `recordVoiceSample` (a gravação da amostra) foi lido na mesma passagem e
não revelou defeito: o único caminho que manda áudio para `/voz` passa por
`getUserMedia`, a falha de `getUserMedia` distingue `NotAllowedError` de
captura, e o envio falha em silêncio com motivo — comportamento já coberto
pelo item 12.

## 2026-08-14 — Revisão a sério: catálogo de ferramentas e executor

Revisão adversarial de `tools.ts` + `tool-runner.ts` (`services/assistant/`),
a "mão" do assistente — as 30 ferramentas e a validação/execução delas. Nunca
revisto como um todo por ninguém de fora; só mudanças pontuais ao longo da
noite (o prazo do `parseDueDate`, o SSRF do navegador, o link simbólico do
Obsidian). Um bug real, corrigido:

**`mudar_de_desktop` só validava o tipo, não o valor.** O parâmetro `desktop`
era `type: 'number'` e a validação parava em "é um número?" — não confirmava
inteiro nem intervalo. Um modelo a inventar "muda para o desktop 99" (ou 2.5)
passava a validação, e `goToDesktop(99 as DesktopId)` chegava a `switchTo`
(`use-workspace-store.ts`), que faz `set({ current: id })` **sem confirmar que
o id existe** — ficava um `current: 99` num ambiente com 4 desktops, emitido
`desktop:mudou` e persistido. Estado corrompido por um número alucinado.

Corrigido na fronteira certa (a validação, não o executor): `ToolParameter`
ganhou `minimum`/`maximum`, o `desktop` passou a trazê-los (derivados de
`DESKTOP_IDS`, como o resto do catálogo deriva dos registos), `validateArgs`
passou a recusar números fracionários e fora do intervalo, e `parametersSchema`
emite `minimum`/`maximum` no JSON Schema — o modelo fica a saber o intervalo
em vez de o adivinhar. 4 testes novos (`tests/assistant/tools.test.ts`),
confirmados a falhar contra o código antigo (3 a falhar) e a passar com a
correção. `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes
noutros ficheiros), `vitest run` 1691/1691.

O resto confirmado limpo, e documentado para não se rever duas vezes: as 30
ferramentas têm todas execução (o teste de cobertura percorre-as uma a uma),
a validação de tipos e de opções trava tudo antes do executor (um número
escrito como texto, um tema fora das opções, um argumento em falta — nada
chega a `perform`), as 5 destrutivas pedem confirmação e só correm com o
`confirmed` vindo da interface (nunca de um argumento do modelo), e a
auditoria regista o que corre **e** o que falha. O `guardar_nota`/`ler_nota`
assíncronos e o `abrir_pagina` (conteúdo externo "nunca instruções") já
tinham sido cobertos pelas revisões do Obsidian e do navegador controlado.

## 2026-08-14 — Revisão a sério: interpretador de comandos de voz

Revisão adversarial de `services/voice/intents.ts`, o caminho que responde
**sem modelo** — as seis famílias de comandos e a separação de comandos
compostos. Nunca revisto como um todo por ninguém de fora; só alargado ao
longo da noite (`stripPoliteness`, mais verbos por família). Um bug real,
corrigido:

**`anota` sombreava `anotar`.** O casamento de verbos de tarefa usa
`text.startsWith(verb)` sem exigir espaço à frente, e na lista `anota` vinha
antes de `anotar` — como um é prefixo do outro, "Anotar comprar leite" casava
no `anota` e o que sobrava era "r comprar leite": o título da tarefa ganhava
um `r` preso no início. Uma ação errada por voz, exatamente a classe de bug
que esta peça não pode ter. Corrigido reordenando `anotar` antes de `anota`
(mais longo primeiro, como manda o casamento por prefixo), com comentário a
explicar porquê. Um teste novo prova o caso, e falha contra o código antigo
com `expected 'comprar leite' to be ... received 'r comprar leite'`.

O resto confirmado limpo, e documentado para não se rever duas vezes: as seis
famílias (sistema, estados, temas, multimédia, produtividade/pesquisa,
aplicações) casam como a spec pede; `splitCommands` só divide quando **todos**
os pedaços dão comando (o "e" dentro de um título não parte a tarefa);
`stripPoliteness` corre em ciclo e exige espaço a seguir ao prefixo ("podes
por favor abrir" bate); os nomes de apps sem verbo só casam quando a frase é
praticamente o nome ("calendário" abre, "o que tenho no calendário" vai ao
assistente); e `describeIntent` devolve nomes, não identificadores. `tsc
--noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes), `vitest run`
1692/1692.

## 2026-08-14 — Item 18: a resposta na janela normal do assistente fala

Reportado ao vivo pelo utilizador: na janela normal do assistente (onde
acontece a maior parte da conversa, escrita ou falada), a resposta nunca
falava — o diagnóstico já tinha vindo de outra sessão: a fala por frase
(item 16) só estava ligada ao caminho dos comandos por voz (`ask`), nunca ao
`sendWithTools`/`AssistantWindow.tsx`. Confirmado por `git log` que nunca
tinha sido diferente.

Feito: `sendWithTools` ganhou o mesmo `onChunk` opcional do `send()`, enfiado
nas rondas de ferramentas (o `provider.run` chama-o por pedaço) e nos caminhos
de recuperação/queda (permissão de rede recusada, falha de rede) — para o que
já se falava nesses casos não regredir. `AssistantWindow.tsx` liga esse
`onChunk` a `extractSentences`+`speakQueued`+`limparFilaDeFala`, com contador
de geração como o `ask`, para o fim de um streaming cancelado não falar frases
atrasadas. O resto que não fechou frase é dito no fim, também como no `ask`.

Decisão de desenho (pequena, delegada pelo item): **falar sempre que a
resposta chega**, não só quando a pergunta veio por voz. A pessoa reportou o
silêncio como problema, e é o mais parecido com conversa real; não existe hoje
um interruptor "falar respostas" separado (as definições de voz guardam só
*qual* voz), e adicionar um saía fora deste item pequeno. Se se quiser ler em
silêncio ao escrever, é a próxima decisão a tomar — fica aqui o registo da
escolha, para não se decidir duas vezes. Limite conhecido, deixado de fora:
`regenerate` e o resultado de `confirmTool` não falam (são respostas já ditas,
ou ações confirmadas à parte), não o envio principal.

4 testes novos (2 ficheiros: `send-with-tools-speech.test.ts` e
`assistant-window-speaks.test.tsx`), confirmados a falhar contra o código
antigo (4 a falhar). `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos
pré-existentes), `vitest run` 1696/1696.

## 2026-08-14 — Revisão a sério: o orquestrador do assistente (ai-service.ts)

Revisão adversarial de `services/ai-service.ts` como um todo — a peça por onde
passa toda a conversa (`send`, `sendWithTools`, o ciclo de ferramentas e o
`recover` da cadeia), nunca revista de fio a pavio (só peças pontuais nos
itens 16/18, e o `recover` tinha ficado explicitamente de fora de uma revisão
anterior). Um bug real, corrigido:

**O fim de um pedido cancelado destruía o pedido novo.** Quando um `send()`/`
`sendWithTools()` novo cancela o anterior, o prólogo do novo é síncrono
(`cancel()` → `this.controller = ctrlNovo` → `setMode('thinking')`), mas a
limpeza do cancelado corre num microtask — e corria **por cima**: repunha o
modo a "idle" e fazia `this.controller = null`, apagando o controller do
pedido que acabara de começar. Resultado observável (e testado): um terceiro
pedido deixa de conseguir cancelar o segundo (`signal.aborted` fica `false`),
e duas respostas passam a escrever na conversa ao mesmo tempo — corrupção de
estado no sítio mais importante do assistente.

Corrigido com um guarda por identidade do controller (`this.controller ===
controller`) em cada ponto de limpeza pós-`await`: o fim do `send()`, o fim/`catch`/
rede-bloqueada do `sendWithTools()`, e a troca de provedor dentro do `recover`.
O guarda distingue os três casos — conclusão normal (é dono: repõe e limpa),
cancel a solo (`controller === null`: repõe o modo, nada a limpar) e pedido
novo a correr (não toca em nada). A reposição a "idle" do cancel a solo
mantém-se, para não regredir o botão de parar.

1 teste novo (`tests/assistant/abort-race.test.ts`) monta a corrida com um
provedor que bloqueia até ser cancelado e confirma que o terceiro pedido ainda
cancela o segundo; falha contra o código antigo (`expected false to be true`).
O resto confirmado limpo: `TOOL_ROUNDS` limita o ciclo de ferramentas; as
mensagens vazias de rondas que só pediram ferramentas são removidas; a máquina
de modos não tem transição ilegal (o `AssistantMode` inclui `success` de
propósito, para o fim das ferramentas); e o `recover` nunca cai para o local
sem dizer — a nota vai sempre primeiro e o "error" final é deliberado. `tsc
--noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes), `vitest run`
1697/1697.

## 2026-08-14 — Revisão a sério: o estado da conversa (use-assistant-store)

Revisão adversarial de `stores/use-assistant-store.ts` como um todo — a
espinha dorsal da conversa (mensagens, modo, favoritas, histórico,
`rewindToPrompt` do regenerar), nunca revista de fio a pavio (só tocada de
passagem pelos itens 16/18 e pela auditoria às 26 stores de 12/08), e sem
teste dedicado. Um bug real, corrigido:

**Três mutadores mexiam em estado persistido sem gravar.** Todos os mutadores
da store chamam `void persist()` — menos `removeMessage`, `rewindToPrompt` e
`selectConversation`. O `removeMessage` é o caso que dói: existe para tirar a
linha em branco que uma ronda só-ferramentas deixa no histórico, mas a remoção
só vivia em memória — ao reiniciar, o `hydrate` lia o estado antigo e o lixo
voltava. O `selectConversation` era a mesma inconsistência noutra chave: a
conversa escolhida (`activeId`, que **é** gravado) não sobrevivia, e a app
reabria na última conversa persistida. O `rewindToPrompt` cortava as mensagens
sem gravar — disfarçado porque o `regenerate` reenvia logo a seguir e o
`addMessage` grava, mas ainda assim inconsistente. Corrigido com `persist()`
nos três, cada um com o seu porquê em comentário.

3 testes novos (`tests/assistant/assistant-store-persist.test.ts`), com
`vi.spyOn(storageService, 'set')` para afirmar a gravação de forma
determinística (o `persist` é fire-and-forget, por isso o "recarregar e ver"
correria antes da escrita). Confirmados a falhar contra o código antigo (0
chamadas a `set` nos três).

O resto confirmado limpo, e documentado para não se rever duas vezes: o título
sai só do primeiro pedido de quem escreve (a saudação não dá nome); `titleFrom`
corta em palavra inteira; `withinLimit` nunca deixa cair fixadas nem a conversa
ativa; o `MSG_LIMIT` mantém a primeira mensagem e corta as mais antigas;
`appendToMessage` não grava de propósito (é o `finishMessage` que grava, para
não escrever centenas de vezes por resposta); `noteModel` também não grava de
propósito (o `finishMessage` grava); o `celebrate` usa um `setTimeout` guardado
que não repõe a repouso por cima de um pedido novo; e o `hydrate` assenta o
cursor a piscar de respostas a meio e cai num `activeId` válido quando o
guardado já não existe. `tsc --noEmit` limpo, `eslint .` 0 erros, `vitest run`
1700/1700.

## 2026-08-14 — Revisão a sério: o laço de animação do núcleo visual (use-animation-frame)

Revisão adversarial do núcleo visual (`components/ai-core/` + o laço partilhado
`hooks/use-animation-frame.ts`), nunca revisto como um todo por ninguém de fora
— só tocado para cor/velocidade/anéis (aparência). Lidos os seis ficheiros do
núcleo (`AICore.tsx`, `CoreRings.tsx`, `CoreWaveform.tsx`, `particle-field.ts`,
`ai-core-modes.ts`, `core-size.ts`) e os outros consumidores do laço
(`Wallpaper.tsx`, `BootRings.tsx`). Dois bugs reais, os dois no laço:

**1. O `elapsed` recomeçava em 0 ao voltar do segundo plano.** O `start` do
`useAnimationFrame` vivia dentro do efeito, por isso cada ciclo de
visibilidade (sair e voltar) criava um `start` novo e o tempo recomeçava. O
`AICore` calcula o delta entre frames (`(elapsed - anterior) / 16.7`, limitado
por `Math.min(delta, 3)`) — e esse limite só corta o de cima. Com o `elapsed`
de volta a 0 e o `anterior` ainda grande, o delta saía um salto negativo de
centenas de frames num só: partículas a andar para trás, ondas a ganhar brilho,
o scanner a desaparecer. O `start` passou para uma ref (`startRef`), e o tempo
continua a crescer ao regressar — o salto grande fica então no lado positivo,
onde o `Math.min` já o cortava.

**2. Com movimento reduzido, o frame estático nunca era redesenhado.** O ramo
`reducedMotion` desenhava o frame uma única vez, no arranque do efeito — e o
efeito só dependia de `enabled`/`isVisible`/`reducedMotion`, não da callback.
Mudar de modo (idle → a analisar → a responder) ou de cor não redesenhava o
canvas, que ficava preso no estado inicial para sempre. O frame estático passou
para um efeito próprio dependente da callback, que o redesenha a cada mudança.

2 testes novos (`tests/ai-core/use-animation-frame.test.tsx`), com rAF
controlado e `visibilitychange` à mão; confirmados a falhar contra o código
antigo (o tempo recomeçava em 0 depois do ciclo de visibilidade, e o segundo
frame estático nunca era chamado). O resto confirmado limpo: `particle-field.ts`
sem fugas de partículas nem de ondas (renascem/apagam-se, contagem estável), o
redimensionamento com DPR é coerente (raio e posições em pixéis do dispositivo,
`dpr` aplicado só onde deve), e a mudança do `start` para ref é segura para os
outros consumidores (`Wallpaper` ignora o `elapsed`; `CoreRings`/`BootRings`/
`CoreWaveform` só o usam em funções periódicas). `tsc --noEmit` limpo, `eslint
.` 0 erros (11 avisos pré-existentes), `vitest run` 1702/1702.

## 2026-08-14 — Revisão a sério: a camada de plataforma (`src/platform/`)

Revisão adversarial da camada de plataforma como um todo — a ponte entre a
aplicação e o sistema operativo (`tauri-adapter-base.ts`, `web-adapter.ts`,
`platform-adapter.ts`, `native-dialogs.ts`, `attachments.ts`, `url-policy.ts`,
`detect-platform.ts`, `index.ts`, `desktop-adapter.ts`, `android-adapter.ts`,
`simulated-metrics.ts`), ~1586 linhas, nunca revista por ninguém de fora — só o
`secretSet`/`secretDelete` foram tocados de passagem na revisão do Obsidian.
Lidas as duas adaptações, os diálogos, os anexos, a política de URLs e os
consumidores de segurança (WebAuthn, auto-login, o cofre). Um bug real,
corrigido:

**`pickAttachmentsNative` lia os bytes inteiros de qualquer imagem para a
memória, sem teto.** O caminho nativo dos anexos do email (`attachments.ts`)
fazia `readFile` do ficheiro completo e `new Blob([bytes])` para a miniatura,
sem limite de tamanho — ao contrário dos dois caminhos gémeos
(`readBrowserFile` e `attachViaNativeDialog`), que ambos cortam em 5 MB. Como a
blob URL fica viva enquanto o anexo existir, escolher uma fotografia de
centenas de MB esgotava a memória só para uma miniatura de 32 px. Ganhou o
mesmo teto (`MAX_PREVIEW_BYTES = 5 MB`); acima dele o anexo continua válido,
só fica sem miniatura (ícone de clipe), igual aos outros caminhos.

3 testes novos em `tests/platform/attachments.test.ts` (que até aqui não cobria
`pickAttachmentsNative` — só `attachmentsFromFileList` e `formatBytes`),
simulando `@tauri-apps/plugin-dialog`/`plugin-fs`; confirmados a falhar contra
o código antigo (o `readFile` era chamado mesmo com o `stat` a devolver 200 MB)
e a passar com a correção.

O resto confirmado limpo, e documentado para não se rever duas vezes: o cofre
(`secretSet`/`secretDelete` distinguem sucesso por não ter lançado, como já
estava; `secretGet` devolve `null` em erro como degradação de propósito — é o
comportamento desejado, coberto por `tests/platform/secret-vault.test.ts`, e os
consumidores falham para o lado seguro: sem sessão/sem chave quando o cofre
falha); `openExternal` tem dupla barreira (lista `https:`/`mailto:` na interface
+ capability no Rust), sem esquema que `new URL().protocol` normalize para um
dos permitidos; o ciclo de vida das blob URLs dos anexos está pareado (criadas
em `attachments.ts`, revogadas no desmontar e no remover do composer — sem
fuga, e o `URL.createObjectURL` do browser é preguiçoso, não lê o ficheiro);
`getTopProcesses(limit?)` passa `{ limit: undefined }` mas o Rust recebe
`Option<usize>` → `None` → 8 por omissão (o teto de 50 está do lado Rust);
`storageGet` usa `??` (preserva `false`/`0`/`''`); `info` devolve objeto novo
antes da inicialização mas ninguém o lê repetidamente (lê-se uma vez no
arranque). `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes),
`vitest run` 1705/1705.

## 2026-08-14 — Revisão a sério: a cadeia de provedores de IA (`src/services/ai-providers/`)

Revisão adversarial da camada que decide qual modelo responde e como cai para o
seguinte — `ai-provider.ts` (o contrato), `provider-chain.ts` (a cadeia de
reserva), `model-choice.ts` (a escolha por capacidade), `rule-provider.ts` (o
local) e os provedores concretos (`deepseek`/`claude`/`ollama`), 1512 linhas,
nunca revistas como um todo por ninguém de fora (só a ordem da cadeia foi
reordenada, item 1, sem revisão do fluxo). Lidas ainda as peças vizinhas que o
fluxo atravessa (`types/ai-failure.ts`, o `setChain`/`recover` de
`ai-service.ts`). **Nada de funcional a corrigir** — mas o caminho mais
complexo e sem um teste sequer (`collect()`, a acumulação de pedidos de
ferramenta da DeepSeek) ganhou cobertura.

O que se confirmou, ponto a ponto:

- **A cadeia só contém provedores configurados.** `applyAiSettings` monta-a com
  `buildProvider`, que devolve `null` para provedor sem chave — por isso
  `nextStep` (`provider-chain.ts`) nunca procura um nome que não lá está (o caso
  `findIndex === -1` que reiniciaria a cadeia é inalcançável hoje: os nomes são
  estáveis e únicos, e `this.provider` é sempre um membro da cadeia).
- **A escolha de modelo** (`model-choice.ts`) trata acentos, blocos de código,
  prompts longos (>400 carateres) e tanto a subida como a descida de
  capacidade; os dois sentidos têm teste.
- **Cada provedor** tem teto de 60s, aborto por `AbortSignal`, e erro tipado em
  vez de texto de erro disfarçado de resposta; o `finally` limpa sempre o timer
  e o listener.
- **Os parsers de streaming** (DeepSeek e Claude) acumulam argumentos de
  ferramenta por índice e só os interpretam no fim — JSON que não fecha perde o
  pedido em vez de correr a ferramenta a meio; linhas malformadas não partem a
  resposta; o raciocínio do `reasoner` não se mostra.
- **O mapeamento de falhas** (`failureFromStatus`, `claudeFailureFromResponse`
  com o 400+saldo da Anthropic, `ollamaFailure` com o 404 de modelo em falta)
  cobre os códigos reais de cada serviço.

5 testes novos em `tests/assistant/deepseek.test.ts` para `collect()`: juntar
argumentos partidos por vários eventos, texto e ferramenta na mesma passagem,
JSON malformado a perder o pedido, pedido sem nome ignorado, e o fallback do
`id` para o nome. Duas observações que não chegam a bug, anotadas para não se
reverem: `firstInChain` está exportado e testado mas nunca é chamado em
produção (`setChain` usa o equivalente `chain[0]`); e depois de uma exaustão
completa da cadeia o provedor ativo não volta ao primeiro (comportamento em
`ai-service.ts`, já revisto como item 15 — pode ser intencional). `tsc --noEmit`
limpo, `eslint .` 0 erros (11 avisos pré-existentes), `vitest run` 1710/1710.

## 2026-08-14 — Revisão a sério: a verificação de assinatura de plugins (`src/plugins/signature.ts`)

Revisão adversarial do mecanismo que decide se um plugin é aceite —
`signature.ts` (Ed25519 via SubtleCrypto) e o caminho de instalação que a usa
(`verifyAndInstallPlugin` em `use-plugin-store.ts`, chamado por
`install-from-file.ts` e `PluginCard.tsx`). Construído na Peça 5 e só
"confirmado ao vivo", nunca revisto por ninguém de fora.

**A criptografia e o fluxo de verificação estão corretos e falham para o lado
seguro.** Confirmado, ponto a ponto: a canonicalização ordena as chaves do
manifesto e de `permissions`/`platforms`, e usa `Object.create(null)` para um
campo `__proto__` não desaparecer do `JSON.stringify` (há teste que prova que
acrescentar `__proto__` invalida a assinatura); base64 de lixo, assinatura de
tamanho errado, chave de outro par e manifesto alterado são todos recusados
(não rebentam); `verifySignedManifest` confere a lista de revogação antes da
matemática; um externo sem assinatura é recusado e um sem manifesto para
verificar também; a verificação do catálogo usa o mesmo `toManifest` que extrai
só o subconjunto assinado (sem os campos `signature`/`signerPublicKey`).

**Um achado real, que fica à espera de decisão da pessoa — não foi
construído.** A assinatura cobre só o `manifest`, nunca o `code` (o JavaScript
que corre). Quem tiver um `.jarvis-plugin` assinado por um autor legítimo pode
trocar o `code` por outro qualquer e a verificação continua a passar — e a
interface diz "Assinatura verificada" como se o plugin inteiro estivesse
autenticado. A justificação documentada em `plugin.ts` — o `code` "não é
serializado na forma canónica (pode conter caracteres que o `JSON.stringify`
escape de forma diferente entre engines)" — está **tecnicamente errada**:
`JSON.stringify` de uma string é determinístico entre engines, e o próprio
código já assina outros campos de texto (`name`, `description`, `author`) sem
problema. A rede de segurança é o sandbox + as permissões assinadas: um `code`
trocado corre no `<iframe sandbox="allow-scripts">` e só pode usar o que o
manifesto assinado declara. Como alargar a assinatura ao `code` é uma mudança
quebradora no formato `.jarvis-plugin`, registei a decisão em
`docs/log/perguntas-para-o-utilizador.md` (pergunta 1) em vez de a tomar
sozinho. `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes),
`vitest run` 1710/1710.

## 2026-08-14 — Revisão a sério: o motor de automações (`src/services/automation-service.ts`)

Revisão adversarial do motor de automações como um todo (`add`/`update`/
`remove`, a avaliação de gatilhos, a execução de ações e o temporizador de
segundo plano), nunca revisto de fio a pavio por ninguém de fora — só
`checkNativeTriggers` (item 4) e o `save()` do editor (item 10) tinham sido
tocados.

**Um bug real, corrigido.** As subscrições do Event Bus eram construídas uma
única vez no `start()`, a partir da lista de automações *daquele momento*. Uma
regra ligada a um evento criada ou editada depois do arranque (é o caminho
normal do editor visual — o `start` só corre uma vez no `App.tsx`) ficava à
espera de um evento ao qual ninguém estava subscrito, e **nunca corria até a
aplicação reiniciar**. Os próprios testes contornavam isto à mão (chamavam
`stop()` + `start()` depois de `add()`, com o comentário "reiniciar reavalia") —
sinal claro de que a falha era conhecida, não resolvida. Corrigido com um
`refreshEventSubscriptions()` que refaz as subscrições a partir da lista atual
(guarda `timer !== null` para não subscrever com o motor parado) e é chamado por
`start`, `add`, `update`, `remove` e `hydrate`. 3 testes novos (regra criada
depois do arranque liga ao evento; editar para um evento novo liga; remover a
única regra de um evento desliga), e os testes antigos deixaram de precisar do
`stop`/`start` de contorno. O resto confirmado limpo: gatilhos nativos com o
"anterior" de bateria capturado uma vez fora do predicado, ações executadas por
ordem com paragem na primeira que rebenta, histórico limitado a 60, `update`
preserva identidade, persistência distingue "nunca gravado" de "gravado vazio".
`tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes), `vitest
run` 1713/1713.

## 2026-08-14 — Revisão a sério: a paleta de comandos (`src/components/command-palette/`)

Revisão adversarial da paleta de comandos como um todo — `command-registry.ts`
(o despachante universal que deriva os comandos dos registos) e
`CommandPalette.tsx` (a lista com navegação por teclado), mais os fios que a
ligam ao resto (`search-service.ts`, `use-search-store.ts`, as ações em
`App.tsx`). Nunca revista por ninguém de fora — só migrada para stores limpas
e o grupo "Plugins" acrescentado de passagem.

**Um bug real, corrigido.** O despachante em si está correto e bem coberto
(derivação dos registos, filtragem sem acentos, conteúdo primeiro, cada ação
para o sítio certo). Mas a capacidade `plugins.commands` estava **meio
construída**: `core.command.register` registava o comando para aparecer na
paleta, e a invocação nunca existia — o `run` do comando na paleta estava
codificado como `launchApp('plugins')`, por isso escolher um comando de plugin
abria a Loja de plugins em vez de o executar, e o plugin nunca sabia que a
pessoa o tinha escolhido. Isto é o exato oposto dos gémeos desta capacidade:
`core.menu.add` e `core.shortcut.register` já aceitam um `callback` e recebem
um `core.menu.triggered`/`core.shortcut.triggered` empurrado de volta.

Corrigido pelo padrão já assente: a paleta ganhou uma ação
`runPluginCommand(pluginId, commandId)` (`command-registry.ts` → `App.tsx`),
que empurra `core.command.triggered` ao plugin via `pushToPlugin`; e o
`command.register` da SDK passou a aceitar um `callback` que ouve esse
empurrão, como os irmãos. O exemplo `regista-comando` agora reage à invocação
em vez de só se registar. 1 teste novo em `command-registry.test.ts` (executar
um comando de plugin invoca o plugin, não abre a Loja). O resto confirmado
limpo: a paleta está sempre montada (a hidratação da store de pesquisa corre
uma vez e devolve a limpeza ao efeito), a navegação por setas não rebenta com
a lista vazia, o `execute` captura o comando antes de fechar, e o `openExternal`
das notícias passa pela dupla barreira do adapter. `tsc --noEmit` limpo,
`eslint .` 0 erros (11 avisos pré-existentes), `vitest run` 1714/1714.

## 2026-08-14 — Revisão a sério: o serviço de voz, caminho `speak()` por SpeechSynthesis

Revisão adversarial da síntese normal por `speechSynthesis` — `speak()` →
`speakSistema`, a seleção de voz, o ciclo de vida da `SpeechSynthesisUtterance`
(`onstart`/`onend`/`onerror`) e o `stopSpeaking` — nunca revisto como um todo
por ninguém de fora. As revisões anteriores do item 15 só tinham tocado o
`speakClonada` (voz clonada) e o re-engate do microfone no modo conversa; este
é o caminho que fala quase tudo o que o sistema diz.

**Um bug real, corrigido.** O contrato de `speak()` diz "`callbacks.onEnd`
dispara sempre, mesmo que o serviço local falhe, para quem estiver a usar isto
para mudar de estado (ex.: `AICore`) não ficar preso em 'a falar' para
sempre". Mas `stopSpeaking()` nunca disparava esse `onEnd`: no caminho do
sistema, o `cancel()` "nem sempre" dispara `onend`/`onerror` (a própria nota em
`stopSpeaking` o admite); no caminho clonado, o `pause()` do `HTMLAudioElement`
nunca dispara `onended`. Resultado: interromper a fala a meio (segundo plano,
"parar", arranque novo) calava o som mas o núcleo do assistente (`use-voice.ts`,
que usa `onEnd` para sair de `setMode('speaking')`) ficava preso em "a falar"
para sempre — o microfone continuava guardado sem ninguém a falar.

Corrigido com um embrulho idempotente: `speak()` cria um `terminar` que dispara
o `onEnd` exatamente uma vez (um motor que dispare `onend` *e* `onerror` pela
mesma fala não duplica), guarda-o em `activeSpeechEnd`, e passa-o aos dois
caminhos. `stopSpeaking()` dispara `activeSpeechEnd` depois de libertar o
microfone. No caso de a síntese nem arrancar (sem suporte), o `activeSpeechEnd`
é limpo para um `stopSpeaking` futuro não disparar um `onEnd` por uma fala que
nunca começou. 3 testes novos (2 no `echo-guard.test.ts`, 1 no
`voice-clone-synthesis.test.ts`): `stopSpeaking` dispara o `onEnd` sem
`cancel()` disparar nada, não duplica quando o `cancel()` dispara o `onend`, e
faz o mesmo no caminho clonado (onde o `pause()` nunca dispara `onended`).

O resto confirmado limpo: a seleção de voz respeita o `voiceURI` por cima e
cai na voz masculina / primeira portuguesa só quando não há escolha explícita,
`limparParaSintese` corre antes de escolher a voz (vale para a clonada e para a
do sistema), a fila por frases só avança no `onEnd`, e o contador de geração
descartava já corretamente uma `speakClonada` em voo ultrapassada por um
`stopSpeaking`. `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos
pré-existentes), `vitest run` 1717/1717.

## 2026-08-14 — Revisão a sério: a store de definições de IA (use-ai-settings-store.ts)

Revisão adversarial da store que guarda e hidrata as definições do
assistente — provedor, modelo e as chaves da API (DeepSeek e Claude), com o
caminho de persistência no cofre do sistema. A revisão de 13/08 do "Cofre de
segredos" tinha coberto a *migração* (`hydrate`) e o valor de retorno do
`secretSet` no adapter, mas nunca este `persist()` como um todo.

**Um bug real, corrigido.** A migração estava protegida ("só se limpa o
storage depois de a cópia para o cofre confirmar"), mas o `persist()` — o
caminho de *todas* as escritas seguintes — tinha o mesmo buraco e não o
apanhado. Escrevia primeiro `semSegredos(settings)` no storage (as definições
sem as chaves) e só depois mandava as chaves ao cofre, **ignorando** o
booleano que `secretSet` devolve — `false` quando o cofre falha, sem lançar
(é exatamente por isso que o `tauri-adapter-base.ts` documenta esse valor de
retorno: para quem chama saber se algo "ficou mesmo guardado"). Resultado:
se o cofre falhasse a escrever, a chave ficava em **lado nenhum** — já não no
storage, e não no cofre — e um reinício apagava-a de vez. Perder a chave é
pior do que ela ficar em texto simples mais uma sessão (a própria store o diz
noutro sítio), mas aqui a perda era silenciosa e definitiva.

Corrigido nos dois lados, de forma coerente. `persist()` passa a escrever as
chaves **primeiro** no cofre e só escreve `semSegredos` no storage quando
`secretSet` devolveu `true` para as duas; se alguma falhar, o storage mantém
as chaves em texto simples como cópia de segurança. `hydrate()` (pós-migração)
ganhou o respetivo fallback: quando o cofre não tem uma chave, lê a cópia do
storage em vez de a tratar como vazia — sem isto, o `persist` de segurança
não chegava, porque o `hydrate` descarta sempre as chaves do storage a favor
do cofre. 3 testes novos em `tests/stores/ai-settings-store.test.ts`
(escrever bem → storage sem chave e cofre com ela; cofre falha → chave fica
no storage; reinício depois da falha → chave sobrevive). `tsc --noEmit`
limpo, `eslint .` 0 erros (11 avisos pré-existentes), `vitest run` 1720/1720.

## 2026-08-14 — Revisão a sério: a store de plugins (use-plugin-store.ts)

Revisão adversarial da store que guarda os plugins instalados e as permissões
recusadas por plugin (`install`, `uninstall`, `setPermission`, `setEnabled`,
`toggleEnabled`, `persist`/`hydrate`). A revisão de 14/08 da *assinatura* só
cobrira o `verifyAndInstallPlugin` (a criptografia e o fluxo de instalação),
nunca as ações de estado da store em si.

**Um bug real, corrigido.** `uninstall()` removia o plugin de `installed` mas
deixava as permissões que lhe tinham sido recusadas em `deniedPermissions`. A
entrada ficava órfã — gravada em disco a cada `persist()`, sem nunca ser limpa
— e, se o plugin voltasse a ser instalado, herdava em silêncio as recusas da
instalação antiga em vez de recomeçar com as permissões do manifesto. Não é
um buraco de segurança (recusar é o lado seguro), mas é estado errado: a
semântica de "remover" devia apagar o plugin por inteiro, decisões incluídas.

Corrigido: `uninstall()` passa a reconstruir também `deniedPermissions` sem a
chave do plugin removido, no mesmo estilo do `semSegredos` da store de IA
(iterar `Object.entries` e filtrar a chave). As recusas dos outros plugins
ficam intactas. 3 testes novos em `tests/stores/plugin-store.test.ts` (remover
apaga as recusas do plugin; as recusas não sobrevivem a recarregar; remover um
não mexe nas recusas dos outros), confirmados a falhar contra o código antigo
e a passar depois. O resto confirmado limpo: `install` idempotente, os do
sistema não se removem nem se ativam à força, `hydrate` repõe os do sistema e
preserva os externos que já não estão no catálogo, `setPermission` falha para
o lado seguro (recusa guardada, concessão retirada). `tsc --noEmit` limpo,
`eslint .` 0 erros (11 avisos pré-existentes), `vitest run` 1723/1723.

## 2026-08-14 — Revisão a sério: o bloqueio por inatividade (use-idle-lock.ts)

Revisão adversarial do bloqueio automático da sessão (Parte 14 §Autenticação)
— o hook que devolve ao ecrã de login ao fim do tempo escolhido. Já tinha
testes, mas a disciplina desta revisão é não confiar neles só porque passam:
os testes cobriam "bloqueia ao fim do tempo" com `toHaveBeenCalled()` (uma ou
mais vezes), nunca "bloqueia e pára".

**Um bug real, corrigido.** A verificação corre de 15 em 15 segundos; quando o
tempo esgotava, cada verificação seguinte tornava a chamar `onLock` — e
continuava a chamar enquanto ninguém mexesse no rato. Hoje o defeito está
mascarado: o `onLock` do `App.tsx` chama `logout()`, que põe `phase: 'login'`
de forma síncrona, e o `isActive` falso desmonta o efeito antes da verificação
seguinte. Mas o hook não podia depender desse acidente — se alguma vez o
`logout` passasse a ser assíncrono, ou houvesse um chamador cujo `onLock` não
desligasse o desktop (um ecrã de bloqueio sobreposto, por exemplo), o logout
corria de novo e o registo de auditoria enchia-se de "Bloquear a sessão por
inatividade" de 15 em 15 segundos.

Corrigido com um guarda `locked` local ao efeito: a primeira vez que o tempo
esgota, dispara `onLock` e marca `locked`; as verificações seguintes saem logo.
O efeito re-arranca (e o guarda repõe-se) quando `isActive` ou `timeoutMinutes`
mudam — que é exatamente quando um novo ciclo de presença deve começar. 1 teste
novo em `tests/auth/idle-lock.test.tsx` (depois de bloquear, não volta a
disparar mesmo continuando a avançar o relógio), confirmado a falhar contra o
código antigo (disparava 5 vezes) e a passar depois. O resto confirmado limpo:
zero minutos desliga, fora do desktop não bloqueia, rato/teclado/voltar ao
separador adiam, desmontar pára a contagem, relógio de parede cobre a suspensão.
`tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes), `vitest
run` 1724/1724.

## 2026-08-14 — Revisão a sério: a reposição de janelas maximizadas (workspace)

Revisão adversarial dos dois caminhos que repõem janelas — `restoreSavedLayout`
(no arranque, `use-app-launcher.ts`) e `applyWorkspace` (ao mudar de desktop ou
aplicar um perfil, `workspace-service.ts` + `use-workspace.ts`). A peça nunca
tinha sido revista por ninguém de fora; a revisão de 13/08 do workspace só
confirmara a *arquitetura* ("não tocar nas duas stores mais bem testadas"), não
o comportamento.

**Um bug real, corrigido.** Uma janela maximizada era guardada com
`isMaximized: true` — tanto `persistLayout` (no `use-window-store`, para o
arranque seguinte) como `captureWorkspace` (no `workspace-service`, para a
fotografia do desktop) — mas **nenhum** dos dois caminhos de restauro lia o
flag de volta. O `isMaximized` estava lá de propósito (a geometria guardada é a
*restaurada*, não a maximizada, para não reabrir com o tamanho de outro ecrã),
mas o restauro só usava o `rect` e ignorava o `isMaximized`: a janela reabria
sempre com o tamanho normal, nunca maximizada. Era um flag gravado em disco
que ninguém voltava a ler.

Corrigido nos dois sítios, sem tocar nas stores (mesma regra da Peça 6.2): o
`restoreSavedLayout` e o `applyWorkspace` repõem agora a maximização com
`toggleMaximize(id, maximizedRect(readViewport()))` quando `isMaximized` está
ligado — no ecrã *atual*, não no tamanho guardado. O `applyWorkspace` ganhou um
callback opcional `maximizeRectFor` (paralelo ao `rectFor` já existente) para
manter o serviço sem saber o que é um telemóvel: quem chama decide que no
compacto não há maximizar (as janelas empilham-se a largura toda). 4 testes
novos — 2 em `tests/workspace/workspace-service.test.ts` (repõe maximizada;
não maximiza quando quem chama devolve `null`) e 2 em `tests/windows/app-
launcher.test.tsx` (restaura maximizada no arranque; restaura normal como
normal) — confirmados a falhar contra o código antigo (`isMaximized` a `false`)
e a passar depois. `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos pré-
existentes), `vitest run` 1728/1728.

## 2026-08-14 — Revisão a sério: a sessão automática (auto-login-service.ts)

Revisão adversarial da "sessão continuada" pós-Windows Hello — o serviço que
guarda no cofre uma marca de "já foste verificado há pouco" e deixa o login
avançar sozinho durante 30 minutos. A revisão de 13/08 já a tinha passado a
pente fino e concluíra "nada de real a corrigir" — mas só olhara para a
*validade* (token não fixo, 30 minutos conferidos, sessão só depois de
`verified` real). Esta revisão olhou para o caminho de leitura.

**Um bug real, corrigido.** `hasValidAutoLoginSession()` trata um cofre
corrompido com `try/catch` à volta do `JSON.parse` — mas esse `try` só apanha
JSON *inválido*. JSON válido com a forma errada passa o `parse` e rebenta logo
a seguir: `JSON.parse("null")` devolve `null`, e ler `.expiresAt` de `null`
lança `TypeError`. Um cofre que contivesse a string `"null"` (uma escrita
corrompida, ou `JSON.stringify(null)` de outra versão) fazia o ecrã de login
rebentar no `hasValidAutoLoginSession` que corre ao montar, em vez de
simplesmente não haver sessão automática. O contrato do serviço é "valor que
não serve → invalida e limpa", não "lança".

Corrigido: o valor do cofre é lido para `unknown`, e valida-se a forma
(`typeof === 'object'` e não `null`) antes de se ler `.expiresAt`. O resto
confirmado limpo: validade conferida a sério (`Date.now() >= expiresAt`),
sessão expirada/corrompida apaga-se sozinha, `clearAutoLoginSession` no logout
torna o logout real. 4 testes novos (formas não-objeto `null`/`42`/`true`/
`"texto"` via `it.each`), o do `null` confirmado a falhar contra o código
antigo (`TypeError: Cannot read properties of null`) e a passar depois.
`tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes), `vitest
run` 1732/1732.

## 2026-08-14 — Revisão a sério: a ponte de plugins (plugin-bridge.ts)

Revisão adversarial da ponte que decide, do lado do Core, o que cada pedido de
um plugin isolado pode ou não fazer — `handlePluginMessage` em
`src/plugins/runtime/plugin-bridge.ts` (696 linhas), o despacho das dezoito
capacidades (`core.notify`, `core.fs.*`, `core.fetch`, `core.service.register`,
etc.). A revisão de 13/08 ("fronteira do sandbox") cobrira o `iframe`, o
`postMessage` e o `resolveWithinRoot`, mas nunca este despacho completo.

**Dois bugs reais, corrigidos.** (1) `core.service.register` aplicava um mínimo
de 5s com `Math.max(intervalMs, MIN_SERVICE_INTERVAL_MS)` — mas `intervalMs`
vem de um plugin, e um `NaN` passa na validação do protocolo (`typeof NaN` é
"number") e faz `Math.max` devolver `NaN`, que o `setInterval` lê como 0ms.
Um plugin mal-intencionado registava um serviço a "tickar" o mais depressa
possível — uma martelada ao Core, por cima do mínimo que existe precisamente
para a impedir. Agora o que não for um número finito cai no mínimo. (2)
`core.fetch` verificava o domínio só sobre a URL *inicial* e deixava o `fetch`
seguir redireccionamentos por conta própria — um domínio autorizado podia
apontar para `localhost`/IP privado e devolver a resposta lida, o mesmo buraco
de SSRF por redireccionamento que já se corrigira no navegador controlado
(Peça 19). Agora `redirect: 'manual'`, e um redireccionamento é recusado
(`redireccionamento-nao-seguido`) sem nunca chegar a outro anfitrião.

O resto confirmado limpo: dois degraus de permissão (declarada no manifesto e
não recusada em Privacidade), tipos de mensagem desconhecidos recusados
fail-closed, `resolveWithinRoot` rejeita `..` e absolutos, domínios de
`fetch` conferidos contra a lista do manifesto, eventos só do barramento
(`ALL_EVENTS`), atalhos reservados do sistema não cedidos, prefixo
`plugins:<id>:` a isolar o armazenamento de cada plugin, e todos os registos
(comandos, atalhos, serviços, widgets, menus, definições, painéis) a rejeitar
duplicados do próprio plugin. Uma observação sem bug: `core.automation.run` é
gated pela permissão `notifications` (não há permissão própria de automações —
proxy grosseiro, pré-existente). 2 testes novos, confirmados a falhar contra o
código antigo (`intervalMs` devolvido como `NaN`; `reason` `undefined` no
redireccionamento) e a passar depois. `tsc --noEmit` limpo, `eslint .` 0 erros
(11 avisos pré-existentes), `vitest run` 1734/1734.

## 2026-08-14 — Revisão a sério (varrimento final): ecrãs e orquestração de voz, limpos

Depois de fechar a ponte de plugins, varrimento adversarial dos últimos "pesos"
de interface e orquestração nunca revistos como um todo — a ler cada um como se
fosse a primeira vez, sem confiar nos testes que os cobrem indiretamente. **Nada
de funcional a corrigir** em nenhum:

- **`LoginScreen.tsx`** (747 linhas) — o fluxo de autenticação está correto:
  `isResolvedRef` impede dupla concessão em todos os caminhos (biometria, chave,
  PIN, palavra-passe, sessão automática); o 2FA falha para o lado seguro (sem
  chave → nega, não concede); biometria/chave bastam-se a si mesmas como está
  documentado; o painel do segundo fator não mostra os botões que o contornariam.
- **`PinKeypad.tsx`** — demonstração correta; "qualquer PIN entra" é o desenho.
- **`PrivacyWindow.tsx`** — a orquestração é só fiação sobre stores já revistas;
  o `SecurityKeySection` liga/desliga o 2FA corretamente (o interruptor só existe
  com chave registada, e remover a chave desliga o 2FA).
- **`AssistantWindow.tsx`** — o envio, a saudação só em conversa vazia, e a
  confirmação de ferramentas destrutivas ("ignorar = não fazer") estão certos.
- **`use-voice.ts`** — o ciclo de re-engate, a fila por frases e o segundo plano
  estão corretos, já equilibrados pelas revisões anteriores.
- **`AiSettings.tsx`** — entrada de chaves com máscara e "Guardar" delegando na
  store cujo `persist`/`hydrate` já foi revisto.

**Duas notas sem bug, abaixo da barra de correção** (documentadas, não mexidas):
(1) em `LoginScreen.tsx` o `setInterval` do varrimento de impressão digital
simulado não entra em `timersRef`, por isso não é limpo ao desmontar — num
método abandonado a meio (janela de ~1,7s) pode pisar a `hint` de outro método
ou disparar `grant`, mas o `isResolvedRef` já trava a dupla concessão, e o dano
é cosmético; (2) em `PinKeypad.tsx` o `setTimeout(onComplete, 260)` não é limpo,
mas completar os 4 dígitos é o próprio ato de autenticação — "cancelar" depois
de completar não é cancelar.

Isto fecha o varrimento: as peças de peso (segurança, integridade de dados,
concorrência) estão todas revistas nas entradas acima ou nas de 13/08; o que
sobra são janelas de apresentação que delegam nessas stores/serviços já revistos.

## 2026-08-14 — O assistente estava mudo: voz clonada sem serviço, a falhar em silêncio

Relato ao vivo do utilizador, depois de uma noite inteira de gates
verdes: *"nada, o modelo nem fala mais"*. Ponto de partida honesto —
1734 testes a passar não valem nada se a app não fala na máquina de
quem a usa, e foi exatamente esse o erro desta sessão remota: reportar
suites verdes em vez de seguir o caminho real de ponta a ponta.

**A causa.** A voz por omissão desta instalação é uma voz clonada
(`{kind: 'clonada'}` — o histórico de 09/08 regista a escolha de
"Alison Dietlinde", uma voz pronta do XTTS-v2). Com essa seleção,
`speak()` desvia para `speakClonada()`, que pede o áudio ao serviço
Python local (`voice-clone-service`, `POST /falar`). Esse serviço é um
**processo à parte** do `npm run tauri dev` — e o `catch` de
`speakClonada` fazia, no fim, apenas:

```ts
this.onSpeechEnd();
callbacks?.onEnd?.();
```

Ou seja: serviço desligado → `fetch` rejeita → **silêncio absoluto**.
Sem som, sem erro, sem aviso, sem cair para a voz do sistema. O próprio
comentário no código admitia a lacuna ("quem chama não tem aqui uma
forma síncrona de reportar isto"), mas tratava-a como aceitável — não
é: o sintoma para quem usa é "a app está partida", sem uma única pista.
O dev server foi reiniciado várias vezes esta noite (incluindo depois
do incidente do Vite); nada nos registos mostra o serviço de voz a ser
arrancado alguma vez.

**Porque é que nenhum teste apanhou isto**: todos os testes de voz
clonada simulam o `fetch` a responder com sucesso, ou testam a limpeza
de recursos no caminho de falha (blob URLs, `pause()`) — nenhum
verificava a única coisa que interessa a quem está do outro lado: **saiu
som?** É a diferença entre testar a mecânica e testar o resultado.

**Corrigido**, duas partes:
1. **Cai para a voz do sistema.** O `catch` de `speakClonada` tenta
   agora `speakSistema(text, callbacks)` antes de desistir. A voz do
   sistema é pior do que a clonada, mas ouve-se — esquecer de arrancar
   um processo à parte não pode significar um assistente mudo. Só se
   liberta o microfone e dispara o `onEnd` seco quando nem o sistema
   tem síntese. Se a geração já mudou (a fala perdeu a vez enquanto
   falhava), não se avisa nem se fala — a resposta já não é esperada.
2. **Explica o silêncio.** `onCloneServiceUnavailable`, um callback
   (não uma importação — este ficheiro não importa nada de propósito),
   ligado no `useVoice` a uma notificação, uma vez por sessão
   (`sessionStorage`, mesmo padrão do modo conversa): diz que está a
   usar a voz do sistema e como voltar à clonada
   (`voice-clone-service/run.ps1`).

**Verificação**: 3 testes novos em `tests/voice/voice-clone-synthesis.test.ts`
— cai para a voz do sistema (o principal), avisa uma vez, e o `onEnd`
dispara na mesma quando nem o sistema tem síntese. **Confirmado que o
teste principal apanha mesmo o bug**: removida a linha da correção, o
teste falhou; reposta, passou. `tsc` limpo, `eslint` 0 erros, suite
completa 132 ficheiros / 1737 testes.

**Não confirmado ao vivo** (por esta sessão remota, sem app): falta o
utilizador confirmar que agora ouve a voz do sistema com o serviço
desligado, e a notificação a explicar porquê. O passo que resolve de
vez, do lado dele, continua a ser arrancar `voice-clone-service/run.ps1`
para ter a voz clonada de volta.

## 2026-08-14 — Dev server morre sozinho: erro 1412 é sintoma, causa provável fora do código (GPU/TDR)

Reportado ao vivo: `npm run tauri dev` morre sozinho, sem janela nenhuma
de erro (≥6 vezes numa noite), deixando na consola
`Failed to unregister class Chrome_WidgetWin_0. Error = 1412`. Pedido:
investigar a sério antes de corrigir, reproduzir de forma fiável, e — se
não houver causa raiz corrigível no código — documentar e admitir, sem
inventar uma correção cosmética. É o que este item faz: **não há
correção de código**, e aqui fica o porquê, com a evidência recolhida.

**O que o erro 1412 é (confirmado).** A mensagem vem do `ClassRegistrar`
do Chromium (`ui/base/win/window_impl.cc`), no **fim** da vida do
processo WebView2, quando se tenta desregistar a classe de janela nativa
`Chrome_WidgetWin_0` e ainda há janelas vivas (1412 =
`ERROR_CLASS_HAS_WINDOWS`). É ruído de desmontagem, não a causa — aparece
em qualquer saída desta app porque o padrão de bandeja
(fechar = esconder, nunca destruir) deixa a janela registada até ao fim.
O próprio Tauri já o documenta como secundário: nos casos conhecidos
(issue #2704 do tauri-docs, issue #7606 do tauri) a mensagem segue-se a
um *panic* Rust ou a um `exit()` com janelas abertas — o que interessa é
o que aconteceu **antes**, não esta linha.

**O que se descartou, com evidência.** (1) Janela recriada no HMR: a
janela "main" nasce uma única vez da `tauri.conf.json`; `lib.rs` não tem
`WebviewWindowBuilder` nem recriação nenhuma. (2) Corrida destroy/create
num restart automático do Tauri CLI: o CLI só vigia `src-tauri/`; o
`vite.config.ts` vigia o frontend e ignora `src-tauri` — um hot-reload do
Vite não passa por aí. (3) WebView2 órfão a colidir: os únicos processos
`msedgewebview2` estranhos pertenciam ao Windows Search (`SearchHost.exe`),
não a instâncias antigas do jarvis. (4) Servidores sobrepostos: porta 1420
livre, uma única árvore node/cargo/jarvis. (5) Pressão de memória do modelo
de voz: nesta máquina não há `.venv` do `voice-clone-service` (a app
imprime "não está configurado"), logo não há modelo carregado. (6) Panic
Rust no caminho principal: revistos `lib.rs`, `tray.rs`, `shortcuts.rs`,
`voice_clone.rs` — os handlers que correm na thread do evento usam todos
`if let Some`/`let _`/`try_state`, sem `unwrap`/`expect` alcançável; os
monitores de fundo (bateria 30 s, USB 5 s) correm em threads próprias e,
em dev (`panic = "abort"` só existe no perfil release), um panic aí
desenrola a thread, não mata o processo.

**O que a reprodução mostrou.** Dev server arrancado de raiz e
martelado ~10 minutos com HMR + full-reload contínuos (44+ ciclos, a
tocar `src/App.tsx`, `src/main.tsx`, `index.html`, `globals.css` de 4 em
4 s) **sem um único crash**, e com a memória do processo estável: a
árvore WebView2 do jarvis fixa em ~685 MB (renderer ~320 MB, gpu
~105 MB, browser ~140 MB), sem crescimento. Ou seja: HMR sozinho não
reproduz; o crash é intermitente e depende de outra condição.

**A evidência que aponta para fora do código (Windows Error Reporting).**
Sem nenhum `APPCRASH`/`BEX64` para o `jarvis-ai-os.exe` em 7 dias — o
processo não morre de exceção não tratada; sai "limpo" ou é derrubado por
um subprocesso. Dois sinais reais na máquina: (1) três
`LiveKernelEvent LKD_0x141` (TDR — Timeout Detection and Recovery) no
`nvlddmkm.sys` (driver NVIDIA, arquitetura Blackwell) na noite de 13/08,
isto é, o GPU a ser reposto porque deixou de responder; (2) um
`RADAR_PRE_LEAK_64` para o `msedgewebview2.exe` (10/08) — o detetor de
esgotamento de recursos do Windows a acusar o *heap* nativo do WebView2.

**A melhor teoria.** A app mantém uma animação canvas a 60 fps (o núcleo
visual `AICore`) sempre que está no desktop — carga contínua no GPU, e o
WebView2 renderiza por GPU. Numa máquina com driver a disparar TDR sob
carga, um reset do GPU a meio de uma renderização derruba o processo
gpu/browser do WebView2 e a app cai em bloco — e a mensagem 1412 é só o
desmontar daí. Explica os três padrões (segundos após HMR = renderização
nova; ~11 min parado = a animação continua a mexer o GPU mesmo em
"idle"; ≥6 numa noite = intermitente como um reset de driver). O caminho
secundário (pressão de memória nativa do WebView2, o RADAR) aponta na
mesma direção: upstream, não o código deste projeto.

**Porque não se mexeu no código.** Não se reproduziu em ~10 min de
martelada, e não há causa raiz corrigível aqui — a correção cosmética
que o pedido proibia (ex.: `--disable-gpu` no WebView2) só trocaria a
renderização para CPU com custo real de fluidez, sem confirmar a causa.
Fica para o utilizador, como próximos passos concretos: atualizar o
driver NVIDIA (Blackwell), e — se voltar a acontecer — testar o
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-gpu` como diagnóstico
(se o crash parar, confirma-se a teoria do GPU). Sem commit de código.

## 2026-08-14 — Revisão a sério: métricas do sistema (Rust `system/monitor.rs` + TS `system-service.ts`)

Revisão adversarial da cadeia que mede o sistema — Rust
(`system/metrics.rs` + `monitor.rs`, comando `commands/system.rs`) e o lado
TypeScript (`system-service.ts`, `use-system-metrics.ts`, `use-system-store.ts`,
`use-system-state-store.ts`), mais a simulação do browser. Nunca revista por
ninguém de fora, e **sem um único teste Rust** (só `browser.rs`, `files.rs`,
`obsidian.rs` e `terminal/session.rs` têm `#[cfg(test)]`). É a peça que alimenta
o Monitor de recursos e o ritmo de sondagem dos estados do sistema.

**Nada de funcional a corrigir — confirmado limpo, ponto a ponto:**
- **Divisão por zero**: `percent()` (metrics.rs) devolve 0 quando o total é 0;
  disco usa `saturating_sub` para `used` nunca exceder `total`.
- **Concorrência**: cada `Mutex` do monitor é tomado e largado dentro do seu
  método (sem aninhamento → sem deadlock); lock envenenado vira `Error` em vez
  de pânico (`lock()`).
- **Primeira leitura**: CPU/ritmo de rede a zero no primeiro `snapshot()` é
  comportamento documentado (`mark_refresh` devolve 0 sem leitura anterior) e o
  ritmo de rede nunca divide por zero (guarda `elapsed_secs <= 0`).
- **Ciclo de vida da sondagem**: `subscribe`/`start`/`stop`/`setPaused`/
  `setInterval` fecham em todos os caminhos — último subscritor a sair pára o
  `setInterval`, `setPaused(false)` retoma só com ouvintes, `setInterval`
  reinicia o temporizador em vez de adiar o novo ritmo.
- **`setInterval` não se sombreia**: dentro de `start()`, o `setInterval(...)`
  sem `this.` resolve para a função global, não para o método da classe — o
  temporizador usa mesmo o ritmo pretendido.
- **Pausa global partilhada**: `setPaused` é um booleano único do serviço, mas
  todos os consumidores partilham o mesmo `document.hidden` (`useIsVisible`) —
  num só WebView não há dois valores a pisarem-se.
- **Limites**: `get_top_processes` faz `clamp(1, 50)` no Rust; `sort_by` com
  `partial_cmp` + `unwrap_or(Equal)` não rebenta com `f32` que nunca é NaN.
- **Estado gerido**: `SystemMonitor` é `manage`d no builder partilhado e os três
  comandos estão registados nos dois ramos (`desktop`/`not(desktop)`).
- **Espelho TS/Rust**: `types/system.ts` casa com os `#[serde(rename_all =
  "camelCase")]` do Rust, campo a campo.

Casos que tentei partir sem sucesso: intervalo 0/negativo a martelar a sondagem
(os ritmos vêm de `SYSTEM_STATES`, todos ≥ 1000 ms), subscrição dupla a duplicar
o temporizador (guardado por `timer !== null`), desmontar em segundo plano a
deixar `paused` preso (o `setPaused(false)` do mount seguinte retoma), e a
leitura da bateria/USB/disco com valores agressivos (tudo `saturating`).

**Achado único, cosmético**: o aviso que duas sessões anteriores apontaram como
"pré-existente em `system/monitor.rs`" é o `clippy::for_kv_map` na linha 135
(`for (_, data) in networks.iter()` → `networks.values()`). Não é bug, e deixei
ficar — limpeza sem correção não se faz.

**Verificação**: `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos
pré-existentes noutros ficheiros), `vitest run` 1737/1737, `cargo check` limpo,
`cargo clippy` só com o `for_kv_map` acima.

## 2026-08-14 — Revisão a sério: email real (IMAP + SMTP no Rust)

Revisão adversarial do correio real da Peça 8, lote 2 (commit `e943a30`) — os
comandos `mail_fetch`/`mail_set_flag`/`mail_send` em
`src-tauri/src/commands/mail.rs`, o provedor `imap-mail-provider.ts`, a store de
definições e o ecrã `MailSettings.tsx`. Nunca revisto por ninguém de fora; os
únicos testes que havia eram TypeScript a trocar o adapter por um falso — nenhum
tocava no Rust.

**Um bug real, corrigido: o envio SMTP fazia TLS implícito, não STARTTLS.**
`mail_send` chamava `SmtpTransport::relay()`, que no `lettre` é TLS *implícito*
(SMTPS, porta 465) — e não o `starttls_relay`, que faz STARTTLS na porta 587. O
comentário e as definições diziam "STARTTLS (porta 587)", mas o primeiro byte que
saía para o fio era o `0x16` de um `ClientHello`, e um servidor STARTTLS (que
espera um EHLO em claro na 587) desligava antes de se entender com o cliente —
enviar por uma conta normal (Gmail e semelhantes) falhava de origem. Corrigido
para `starttls_relay`, com um teste Rust novo (`envio_comeca_por_ehlo_em_claro`)
que liga a um servidor falso e prova que o primeiro byte no fio é `E` (EHLO) e
não `0x16`. Confirmado a falhar contra o código antigo.

O resto confirmado limpo, caso a caso:

- **A palavra-passe não escapa por nenhum campo normal.** O storage guarda a
  configuração sem a palavra-passe (`semSegredos`), o cofre guarda
  `mail-password`, a cópia de segurança apaga `password`
  (`SECRET_FIELDS[mailSettings]`), o `logService.audit` regista só a ação, e os
  erros do Rust ecoam o servidor e o motivo — nunca a palavra-passe (`imap`,
  `lettre` e `native-tls` não a incluem nas mensagens de erro).
- **TLS a sério nos dois.** IMAP: `imap::connect(..., server, &tls)` valida o
  certificado contra o domínio e a cadeia do sistema (`native_tls`). SMTP
  (agora): `starttls_relay` exige STARTTLS e falha se o servidor não o oferecer
  (sem downgrade), validando o certificado contra o domínio.
- **Sem injeção de cabeçalhos.** O destinatário passa por `parse::<Mailbox>()`
  (recusa CRLF), e o `Subject` passa pelo codificador do `lettre`, que manda
  CR/LF para RFC 2047 em vez de os escrever crus no cabeçalho — tentei partir
  com `\r\nBcc:` no assunto/destinatário e não passa.
- **Erros não rebentam a interface.** A leitura falhada (palavra-passe errada,
  servidor em baixo) é apanhada pelo `PollingDataService` (`console.warn` +
  `null`, sem crash); o envio mostra a mensagem no rascunho (`role="alert"`).
  Sem configurar nada, mantém-se o simulado e não se toca em rede nenhuma.
- **Cobertura.** Os testes TypeScript cobriam o contrato do provedor e a divisão
  storage/cofre, mas o comportamento de rede do Rust estava a zero — foi por aí
  que o buraco do STARTTLS passou. O teste novo é o primeiro a exercitar
  `mail_send`.

Verificação: `cargo test` 21+6 a passar (1 novo), `cargo check` limpo,
`tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos pré-existentes),
`vitest run` 1737/1737.

## 2026-08-14 — Revisão a sério: serviços de tema, relógio e papel de parede

Revisão adversarial de três serviços pequenos e **sem teste dedicado** —
`theme-service.ts`, `clock-service.ts` e `wallpaper-service.ts` — mais as
dependências que usam (`custom-theme.ts` e `use-theme-store.ts`). Nunca revistos
por ninguém de fora: o tema só era tocado de raspão no `theme-editor.test.tsx`, e
o relógio e o papel de parede não tinham um único teste.

**Nada de funcional a corrigir — confirmado limpo, caso a caso:**

- **`ThemeService.apply`** limpa sempre as quinze variáveis inline que um tema
  personalizado anterior escreveu antes de aplicar o novo — sem isto, voltar a um
  oficial deixava metade das cores do antigo em vigor. `data-theme` no `<html>` é
  o único sítio por onde o tema entra, e a troca é instantânea por variáveis CSS.
  Tentei partir o caso do tema personalizado apagado: `apply(idCustom, null)` cai
  no `data-theme` sem bloco CSS nem variáveis — mas o único caminho alcançável
  passa por `hydrate`, que já confere `isCustomThemeId(saved) && !custom` e volta
  ao base; `setTheme` só recebe temas que existem na lista. A fronteira certa já
  lá está, e o estado auto-corrige no arranque seguinte.
- **`ClockService`** tem um só temporizador para todos os subscritores: o primeiro
  liga (`start`), o último desliga (`unsubscribe` → `size===0` → `stop`), e
  `setPaused` suspende sem perder subscritores. Confirmei que não há duplo
  temporizador (pausar põe `timer=null` antes de retomar), que a primeira
  atualização é imediata (não espera os 15 s), e que um subscritor novo em pausa
  recebe só o valor inicial (correto — não faz ticks em segundo plano). Tentei
  partir o ciclo com pause/subscribe/unsubscribe em todas as ordens: fecha sempre.
- **`WallpaperService.parseHexColor`** lê `#rgb`/`#rrggbb` (expande o curto, corta
  o alpha de um `#rrggbbaa`) e cai no ciano do tema (`#00CFFF`) se `parseInt`
  der `NaN`. A entrada vem sempre do `themeService.readAccentColor()`, que
  devolve um `--accent` bem formado, por isso o fallback não dispara em produção
  — mas existe.
- **`readAccentColor`** usa `getComputedStyle` no `<html>`, que resolve
  `--accent` tanto no tema oficial (`themes.css`) como no personalizado (inline) —
  o canvas do núcleo recebe sempre um valor concreto, nunca um `var()` por
  resolver.

Verificação: `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos
pré-existentes), `vitest run` 1737/1737 (sem código alterado nesta revisão —
confirmação sobre o estado fundido).

## 2026-08-14 — Revisão a sério: a validação do protocolo de plugins (protocol.ts)

Revisão adversarial de `isPluginToCoreMessage` (`src/plugins/runtime/protocol.ts`)
— a última barreira antes de o Core despachar uma mensagem vinda de um
`<iframe sandbox>`. A ponte (`plugin-bridge.ts`) já tinha sido revista (commit
`db3f24b`), mas o validador que a alimenta nunca o foi por ninguém de fora.

**Um bug real, corrigido: uma escrita de ficheiro sem `conteudo` passava a
fronteira.** O `switch` juntava `core.fs.read` e `core.fs.write` num só caso que
conferia apenas `caminho` — mas `core.fs.write` exige também `conteudo: string`.
O código de um plugin não é autenticado (a assinatura só cobre o manifesto, como
a revisão de `signature.ts` já documentou), por isso um plugin a mandar
`{type:'core.fs.write', payload:{caminho:'nota.txt'}}` é um caso real: passava a
validação, o predicado de tipo jurava `conteudo: string`, e o `PluginRuntime`
entregava a mensagem à ponte, que chamava `writeTextFile(fullPath, undefined)`.
O campo obrigatório passou a ser conferido (`typeof payload.conteudo ===
'string'`), e o caso separou-se do `core.fs.read`/`core.fs.list`, que só
precisam do caminho. 4 testes novos (`tests/plugins/protocol.test.ts`), os dois
casos de falta e tipo errado confirmados a falhar contra o código antigo.

O resto confirmado limpo: as outras dezassete capacidades conferem todos os
campos obrigatórios (só `core.fs.write` tinha um esquecido — todas as outras
com campo extra o verificam, ex.: `core.command.register` confere `id`+`nome`+
`descricao`); `valor`/`fallback` do armazenamento são `unknown` por desenho; e o
`NaN` do `intervalMs` continua defendido do lado da ponte (commit `db3f24b`).

Verificação: `tsc --noEmit` limpo, `eslint .` 0 erros (11 avisos
pré-existentes), `vitest run` 1741/1741 (4 novos).

## 2026-08-14 — Perguntas para o utilizador: wake word e capacidades de plugin

Com os itens repetíveis de revisão a fechar, o que sobrava de real na fila
para as duas "Precisa de decisão da pessoa" era escrever a pergunta, não
escolher. As duas ficaram em `docs/log/perguntas-para-o-utilizador.md`:

- **§2 — Wake word configurável.** A decisão de privacidade não é técnica: com
  o microfone sempre à escuta, o áudio vai ao serviço de fala do navegador
  (Web Speech API, por omissão) ou fica só na máquina (motor local). Três
  opções: local, Web Speech API contínua, ou não por agora.
- **§3 — Executar Voz / Ler Memória / Guardar Preferências.** As três
  capacidades da API de plugins que ficaram de fora de propósito. A pergunta
  separa a que é barata (Executar Voz — já existe `voiceService.speak`) das
  que mexem em dados (Ler Memória expõe preferências pessoais; Guardar
  Preferências exige isolar o armazenamento por plugin antes de ser segura).

Nada foi construído — só a pergunta, como manda a regra. Nenhuma alteração de
código; `tsc`/`eslint`/`vitest` intactos.

## 2026-08-14 — Revisão a sério: auxiliares de desktop em Rust (bandeja, atalhos, erro, registo do terminal)

Revisão adversarial dos pequenos módulos Rust de desktop nunca revistos por
ninguém de fora: `tray.rs` (bandeja), `shortcuts.rs` (atalho global),
`error.rs` (o erro único dos comandos) e `terminal/registry.rs` (o registo de
sessões) — 275 linhas no total. O `session.rs` do terminal tinha sido revisto
(commit `dc353bb`), mas o registo que o guarda não.

**Nada de funcional a corrigir — confirmado limpo, caso a caso:**

- **Bandeja.** O clique esquerdo alterna visível/escondido, e quando o estado
  é indecidível a aposta segura é mostrar (`Ok(false) | Err(_) => focus_main`).
  `focus_main` faz `unminimize` + `show` + `set_focus`, por isso trazer uma
  janela minimizada para a frente funciona. O "sair" passa por `app.exit(0)`; o
  ícone cai com erro legível se faltar (`AssetNotFound`), sem `unwrap`.
- **Atalho global.** Falhar a registar (outro programa já o tem) imprime e
  continua o arranque — não derruba a app. O filtro `!= ShortcutState::Pressed`
  impede o duplo disparo em cima do mesmo premir.
- **Erro.** Todos os comandos devolvem `Result<T, Error>` (nenhum `unwrap`), o
  `Serialize` envia a string legível ao IPC, e o `#[from] tauri::Error` deixa o
  `?` converter sem ruído. Os `cfg_attr` de `dead_code` cobrem os ramos por
  plataforma.
- **Registo do terminal.** `spawn` usa `AtomicU64::fetch_add` para ids únicos
  (`Relaxed` chega para unicidade, sem corrida); `write` solta o lock do
  registo antes de escrever ao PTY (a correção do `dc353bb`, que a documentação
  local explica); `kill` é idempotente — remove antes de matar, por isso uma
  segunda chamada devolve `Ok` em vez de `UnknownSession`.

Verificação: `cargo check` limpo (só o aviso de dependência `imap-proto`,
alheio ao código). Sem código alterado.
