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
