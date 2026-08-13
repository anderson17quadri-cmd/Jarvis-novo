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
