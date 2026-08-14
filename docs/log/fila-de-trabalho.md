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

Os itens 16, 17 e 18 estão fechados — ver "Feito" abaixo.

### 19. Voz clonada não arranca sozinha na máquina do utilizador — URGENTE, mão na massa, não perguntar ao utilizador

**Não é para diagnosticar por perguntas ao utilizador — já se tentou
isso por várias voltas nesta sessão e ele está fartinho de ser posto a
correr comandos. É para abrir o terminal, olhar a sério, e resolver.**

O código já existe e já foi confirmado a funcionar em 10/08/2026
(`src-tauri/src/voice_clone.rs`, commit `33ef99a`): a app tenta arrancar
`voice-clone-service` sozinha no arranque (`voice_clone::setup`, chamado
de `lib.rs`), procura `.venv/Scripts/python.exe` em três candidatos
relativos ao diretório de trabalho (`voice-clone-service`,
`../voice-clone-service`, `../../voice-clone-service`), desiste em
silêncio se não encontrar. Hoje (14/08/2026), ao vivo:
1. Sem nada na porta 8090, a app devia ter arrancado o serviço sozinha —
   não arrancou (voz ficou robótica, a do sistema — esse fallback é
   comportamento correto de uma correção anterior desta mesma sessão
   quando o serviço clonado não responde, mas o serviço clonado em si
   nunca chegou a subir sozinho).
2. Não há confirmação de qual das duas mensagens (`arrancado sozinho` ou
   `não está configurado ... sem .venv`) apareceu na consola — o
   utilizador mandou um print maior a mostrar só o arranque do Vite, sem
   chegar às linhas do `[jarvis] voice-clone-service`, ou a informação
   perdeu-se a meio da conversa.

**O que fazer, na máquina real, sem intermediar pelo utilizador:**
1. Confirmar se `voice-clone-service\.venv\Scripts\python.exe` existe a
   sério no caminho onde o `npm run tauri dev` corre a partir de
   (`C:\Dev\Projetos\Jarvis-novo`) — os três candidatos de
   `encontrar_pasta_do_servico()` cobrem isso, mas confirmar contra o
   diretório de trabalho real do processo `jarvis-ai-os.exe`, não
   assumir.
2. Matar qualquer `python.exe`/`uvicorn` órfão preso na porta 8090
   (`Get-Process`, `netstat -ano | findstr 8090`, `taskkill /PID ... /F`
   se preciso) antes de testar de novo — evita o falso "já está a
   correr".
3. Arrancar a app do zero, com a porta livre, e ler a sério a saída
   `[jarvis] voice-clone-service ...` — não perguntar ao utilizador o
   que apareceu, o Claude Code local já tem o terminal à frente.
4. Se `arrancar()` falhar (erro do `spawn`), o `Err(err)` já é impresso
   — ler o erro real (permissões, caminho, DLL em falta) em vez de
   adivinhar.
5. Confirmar ao vivo, com o assistente a responder, que a voz clonada
   sai — não só que o processo arrancou.
6. Se o problema for de desenho (por exemplo: o processo morre sozinho
   ao fim de algum tempo, ou os candidatos de caminho não cobrem o
   diretório de trabalho real do `tauri dev`), corrigir o código a
   sério, com teste, não só o comportamento desta vez.

Detalhe da conversa até agora em `docs/log/historico-sessoes.md`,
entrada "O assistente estava mudo" (14/08/2026) — mas essa só cobre o
fallback para a voz do sistema, não o arranque automático em si, que é
uma peça mais antiga (10/08) nunca revista a sério e aparentemente a
falhar agora.

## Rever a sério (nunca construído de novo — ler o código como se fosse a primeira vez, sem confiar nos testes só porque passam)

### 15. Outra peça qualquer sem revisão independente — `[livre, repetível]`

### 15. A fronteira de permissões de plugins (`plugin-bridge.ts` + `install-from-file.ts`) — revisão adversarial — DeepSeek (14/08/2026)

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

→ Pergunta já escrita: `perguntas-para-o-utilizador.md` §2 (14/08/2026). A
decisão continua da pessoa; não reescrever, só esperar a resposta.

### Executar Voz / Ler Memória / Guardar Preferências, capacidades de plugin

`docs/spec/plugins-sandbox.md` §"O que ainda falta": mexem em microfone
e dados guardados — exigem autorização explícita antes de se desenhar
sequer o protocolo. Mesma regra: escrever a pergunta, não decidir.

→ Pergunta já escrita: `perguntas-para-o-utilizador.md` §3 (14/08/2026). A
decisão continua da pessoa; não reescrever, só esperar a resposta.

## Feito (mover para aqui ao fechar, com o commit)

### 20. Dev server crasha sozinho (`Chrome_WidgetWin_0`, erro 1412) — DeepSeek — sem commit de código

Investigado a sério e **sem causa raiz corrigível no código**: a mensagem
1412 é ruído de desmontagem do WebView2 (classe de janela ainda registada
ao sair, por causa do padrão bandeja "fechar = esconder"), não a causa.
Descartados com evidência: janela recriada no HMR, corrida destroy/create
do Tauri CLI, WebView2 órfão, servidores sobrepostos, pressão do modelo
de voz, panic Rust no caminho principal. ~10 min de HMR + full-reload
martelados sem reproduzir, memória estável (~685 MB). A evidência aponta
para **fora do código**: três `LiveKernelEvent 0x141` (TDR no
`nvlddmkm.sys`, driver NVIDIA Blackwell) na noite de 13/08 + um
`RADAR_PRE_LEAK_64` no `msedgewebview2.exe` (10/08), e nenhum `APPCRASH`
do próprio `jarvis-ai-os.exe`. Teoria: reset do GPU a meio da animação
canvas de 60 fps do `AICore` derruba o WebView2 e a app cai em bloco.
Próximo passo para o utilizador: atualizar o driver NVIDIA e, se voltar,
testar `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-gpu` como
diagnóstico. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026,
"Dev server morre sozinho: erro 1412 é sintoma, causa provável fora do
código (GPU/TDR)").

### 15. Email real (IMAP + SMTP no Rust, Peça 8 Lote 2, commit e943a30) — revisão adversarial — DeepSeek — commit `271f014`

Revisão a sério dos comandos `mail_fetch`/`mail_set_flag`/`mail_send` em
`src-tauri/src/commands/mail.rs` (mais o provedor IMAP, a store e o ecrã de
definições), nunca revistos por ninguém de fora. **Um bug real, corrigido:**
`mail_send` usava `SmtpTransport::relay()` (TLS implícito, SMTPS na porta 465)
apesar de o comentário e as definições prometerem STARTTLS na 587 — o primeiro
byte no fio era um `ClientHello`, e um servidor STARTTLS desligava antes do
EHLO, por isso enviar por uma conta normal falhava de origem. Corrigido para
`starttls_relay`, com um teste Rust novo que prova que o primeiro byte é EHLO,
não um handshake TLS (falha contra o código antigo). Resto confirmado limpo:
palavra-passe nunca sai do cofre (storage sem `password`, cópia de segurança
tapa, log e erros sem eco), certificado validado contra o domínio nos dois
sentidos, sem injeção de cabeçalhos (destinatário por `parse::<Mailbox>`, assunto
codificado RFC 2047), erros de rede apanhados sem rebentar a interface, simulado
por omissão sem rede. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026,
"Revisão a sério: email real (IMAP + SMTP no Rust)").

### 15. Métricas do sistema (Rust `system/monitor.rs` + `metrics.rs`, TS `system-service.ts` + `use-system-metrics.ts` + `use-system-store.ts`) — revisão adversarial — DeepSeek #2 — sem commit de código

Revisão a sério da cadeia que mede o sistema, nunca revista por ninguém de
fora e **sem um único teste Rust**. **Nada de funcional a corrigir** — confirmado
limpo ponto a ponto: `percent()` guarda divisão por zero; mutexes sem
aninhamento (sem deadlock) e envenenados viram erro; primeira leitura a zero é
documentada; ciclo de vida da sondagem (`subscribe`/`start`/`stop`/`setPaused`/
`setInterval`) fecha em todos os caminhos e o `setInterval` de `start()` não se
sombreia com o método; `get_top_processes` com `clamp(1, 50)`; `SystemMonitor`
`manage`d e comandos registados nos dois ramos; espelho TS/Rust casado campo a
campo. O único achado é cosmético — o aviso "pré-existente" de duas sessões é o
`clippy::for_kv_map` em `monitor.rs:135`, não bug, deixado ficar. Verificação:
`tsc` limpo, `eslint` 0 erros, `vitest` 1737/1737, `cargo check` limpo. Detalhe
em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: métricas do
sistema").

### 15. Serviços de tema, relógio e papel de parede (`theme-service.ts` + `clock-service.ts` + `wallpaper-service.ts`) — revisão adversarial — DeepSeek #2 — sem commit de código

Revisão a sério de três serviços pequenos sem teste dedicado, mais as dependências
`custom-theme.ts` e `use-theme-store.ts`. **Nada de funcional a corrigir** —
confirmado limpo: `apply` limpa sempre as variáveis inline do tema personalizado
anterior antes de aplicar o novo; o temporizador único do relógio liga/desliga com
o primeiro/último subscritor e pausa sem perder subscritores (sem duplo
temporizador); o `parseHexColor` do papel de parede trata `#rgb`/`#rrggbb`/alpha e
cai no ciano em malformado; o `readAccentColor` resolve `--accent` nos dois tipos
de tema. O caso do tema personalizado apagado não se alcança (o `hydrate` já o
confere na fronteira). Detalhe em `docs/log/historico-sessoes.md` (14/08/2026,
"Revisão a sério: serviços de tema, relógio e papel de parede").

### 15. A validação do protocolo de plugins (`src/plugins/runtime/protocol.ts`) — revisão adversarial — DeepSeek #2 — commit `600aec2`

Revisão a sério de `isPluginToCoreMessage`, a última barreira antes de o Core
despachar uma mensagem da sandbox — nunca revisto por ninguém de fora (a ponte,
`plugin-bridge.ts`, já tinha sido). **Um bug real, corrigido:** o `switch`
juntava `core.fs.read` e `core.fs.write` num caso que só conferia `caminho`,
deixando passar uma escrita sem `conteudo` — o tipo jurava `string`, e a ponte
escrevia `writeTextFile(fullPath, undefined)`. O campo passou a ser conferido, e
o caso separou-se do `core.fs.read`/`core.fs.list`. 4 testes novos
(`tests/plugins/protocol.test.ts`), confirmados a falhar contra o código antigo.
Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: a
validação do protocolo de plugins (protocol.ts)").

### 15. Varrimento final: ecrãs e orquestração de voz — DeepSeek — sem commit de código

Varrimento adversarial dos últimos "pesos" de interface/orquestração nunca
revistos como um todo (`LoginScreen.tsx`, `PinKeypad.tsx`, `PrivacyWindow.tsx`,
`AssistantWindow.tsx`, `use-voice.ts`, `AiSettings.tsx`). **Nada de funcional a
corrigir** — todos delegam em stores/serviços já revistos, e o fluxo de
autenticação/2FA/voz está correto. Duas notas sem bug (intervalo da impressão
digital e o `setTimeout` do PIN não limpos ao desmontar), abaixo da barra de
correção. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a
sério (varrimento final): ecrãs e orquestração de voz, limpos").

### 15. A ponte de plugins (`src/plugins/runtime/plugin-bridge.ts`, 696 linhas) — revisão adversarial — DeepSeek — commit `db3f24b`

Revisão a sério do despacho das dezoito capacidades de plugin no Core
(`handlePluginMessage`), nunca revisto como um todo — a revisão de 13/08
cobrira só a *fronteira* do sandbox (`iframe`, `postMessage`, `resolveWithinRoot`).
**Dois bugs reais, corrigidos:** (1) `core.service.register` aplicava o mínimo
de 5s com `Math.max(intervalMs, mínimo)`, mas um `intervalMs` `NaN` passa na
validação (`typeof` é "number") e `Math.max(NaN, mínimo)` devolve `NaN`, que o
`setInterval` lê como 0ms — martelada ao Core por cima do mínimo que existe para
a impedir; agora o não-finito cai no mínimo. (2) `core.fetch` seguia
redireccionamentos e verificava o domínio só sobre a URL inicial — um domínio
autorizado podia apontar para `localhost`/IP privado e devolver a resposta
(SSRF por redireccionamento, o mesmo buraco já corrigido na Peça 19); agora
`redirect: 'manual'` recusa o redireccionamento. 2 testes novos, confirmados a
falhar contra o código antigo. Detalhe em `docs/log/historico-sessoes.md`
(14/08/2026, "Revisão a sério: a ponte de plugins (plugin-bridge.ts)").

### 15. A sessão automática (`src/services/auto-login-service.ts`) — revisão adversarial — DeepSeek — commit `f120c82`

Revisão a sério do serviço da "sessão continuada" pós-Windows Hello. **Um bug
real, corrigido:** `hasValidAutoLoginSession` só tratava JSON *inválido* como
cofre corrompido; JSON válido com a forma errada (`"null"`) passava o `parse`
e rebentava a ler `.expiresAt` (`TypeError`), em vez de invalidar a sessão e
limpar o cofre. Agora valida a forma do valor lido antes de tocar no campo. 4
testes novos (formas não-objeto), o de `null` confirmado a falhar contra o
código antigo. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026,
"Revisão a sério: a sessão automática (auto-login-service.ts)").

### 15. A reposição de janelas maximizadas (`workspace-service.ts` + `use-workspace.ts` + `use-app-launcher.ts`) — revisão adversarial — DeepSeek — commit `d21b37d`

Revisão a sério dos dois caminhos que repõem janelas — `restoreSavedLayout`
(arranque) e `applyWorkspace` (mudar de desktop / aplicar perfil). **Um bug
real, corrigido:** `isMaximized` era guardado (`persistLayout` e
`captureWorkspace`) mas nenhum dos dois restauros o lia de volta — a janela
maximizada reabria sempre com o tamanho normal. Agora ambos repõem a
maximização no ecrã atual (`toggleMaximize` com `maximizedRect`), sem tocar
nas stores: o `applyWorkspace` ganhou um callback `maximizeRectFor` (paralelo
ao `rectFor`) para o serviço continuar sem saber o que é um telemóvel, e no
compacto não há maximizar. 4 testes novos, confirmados a falhar contra o
código antigo. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026,
"Revisão a sério: a reposição de janelas maximizadas (workspace)").

### 15. O bloqueio por inatividade (`src/hooks/use-idle-lock.ts`) — revisão adversarial — DeepSeek — commit `d1e5004`

Revisão a sério do bloqueio automático da sessão (Parte 14 §Autenticação). Já
tinha testes, mas só cobriam "bloqueia ao fim do tempo" (`toHaveBeenCalled`),
nunca "bloqueia e pára". **Um bug real, corrigido:** depois de o tempo esgotar,
a verificação de 15 em 15 segundos tornava a chamar `onLock` — e continuava
enquanto ninguém mexesse no rato. Hoje o `logout` síncrono mascarava-o
(desligava o desktop e desmontava o efeito logo no primeiro disparo), mas o hook
não podia depender desse acidente: um `logout` assíncrono ou um chamador sem
mudança de fase encheria o registo de auditoria de entradas. Guarda `locked`
pára a verificação depois do primeiro bloqueio. 1 teste novo, confirmado a
falhar contra o código antigo (5 disparos) e a passar depois. Detalhe em
`docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: o bloqueio por
inatividade (use-idle-lock.ts)").

### 15. A store de plugins (`src/stores/use-plugin-store.ts`) — revisão adversarial — DeepSeek — commit `c99becd`

Revisão a sério das ações de estado da store de plugins (`install`/`uninstall`/
`setPermission`/`setEnabled`), nunca revistas por ninguém de fora — a revisão de
14/08 da assinatura só cobriu o `verifyAndInstallPlugin`, não estas ações. **Um
bug real, corrigido:** o `uninstall()` removia o plugin de `installed` mas
deixava as permissões recusadas dele órfãs em `deniedPermissions` — gravadas em
disco a cada `persist` e herdadas em silêncio numa reinstalação, em vez de
recomeçar com as permissões do manifesto. Agora o `uninstall` limpa também as
recusas do plugin removido. 3 testes novos, confirmados a falhar contra o código
antigo. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério:
a store de plugins (use-plugin-store.ts)").

### 15. A store de definições de IA (`src/stores/use-ai-settings-store.ts`) — revisão adversarial — DeepSeek — commit `ee7c194`

Revisão a sério da store que guarda e hidrata o provedor, o modelo e as
chaves da API (DeepSeek e Claude), com o `persist()`/`hydrate()` no cofre do
sistema — nunca revisto como um todo (a revisão de 13/08 do cofre cobriu a
*migração* e o `secretSet` no adapter, não este `persist`). **Um bug real,
corrigido:** o `persist()` escrevia as definições sem as chaves no storage
primeiro e só depois mandava as chaves ao cofre, ignorando o booleano que o
`secretSet` devolve (`false` quando o cofre falha). Uma escrita falhada
deixava a chave em lado nenhum — nem storage nem cofre — e um reinício
apagava-a. Agora as chaves vão primeiro ao cofre e só se a escrita correr
mesmo bem é que se tiram do storage; se falhar, o storage mantém-nas, e o
`hydrate()` volta a lê-las do storage quando o cofre não as tem. 3 testes
novos. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a
sério: a store de definições de IA (use-ai-settings-store.ts)").

### 15. O serviço de voz, caminho `speak()` por SpeechSynthesis (`src/services/voice-service.ts`) — revisão adversarial — DeepSeek — commit `98cf0b5`

Revisão a sério da síntese normal por `speechSynthesis` (`speak()` →
`speakSistema`, `stopSpeaking`, a seleção de voz e os estados
`onstart`/`onend`/`onerror`), nunca revisto como um todo por ninguém de
fora — a revisão anterior do item 15 só cobriu `speakClonada`, e a do modo
conversa só o re-engate do microfone. **Um bug real, corrigido:** o
`speak()` promete "`callbacks.onEnd` dispara sempre", mas `stopSpeaking()`
nunca o disparava — o `pause()` do áudio clonado não dispara `onended`, e o
`cancel()` da síntese "nem sempre" dispara nada. Quem usa `onEnd` para sair
de "a falar" (o núcleo do assistente, `use-voice.ts`) ficava preso nesse
estado para sempre ao interromper a fala a meio. O `speak()` embrulha agora
o `onEnd` num fecho idempotente guardado em `activeSpeechEnd`, e o
`stopSpeaking()` dispara-o. 3 testes novos. O resto confirmado limpo
(seleção de voz com `voiceURI` por cima, `limparParaSintese` antes de
escolher a voz, a fila por frases a avançar só no `onEnd`). Detalhe em
`docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: o serviço de
voz, caminho speak() por SpeechSynthesis").

### 15. A paleta de comandos (`src/components/command-palette/`) — revisão adversarial — DeepSeek — commit `ae121c8`

Revisão a sério da paleta de comandos como um todo (`command-registry.ts` +
`CommandPalette.tsx`, mais `search-service.ts`/`use-search-store.ts` e as ações
em `App.tsx`), nunca revista por ninguém de fora. **Um bug real, corrigido:** o
despachante em si está correto e bem coberto, mas a capacidade `plugins.commands`
estava meio construída — `core.command.register` registava o comando para
aparecer, e a invocação nunca existiu: o `run` do comando na paleta estava
codificado como `launchApp('plugins')`, por isso escolher um comando de plugin
abria a Loja em vez de o executar, e o plugin nunca sabia que foi escolhido.
Corrigido pelo padrão dos gémeos (`menu.add`/`shortcut.register`): a paleta
ganhou `runPluginCommand` → `pushToPlugin` empurra `core.command.triggered`, e o
`command.register` da SDK aceita um `callback`. 1 teste novo. Detalhe em
`docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: a paleta de
comandos").

### 15. O motor de automações (`src/services/automation-service.ts`) — revisão adversarial — DeepSeek — commit `ea5857a`

Revisão a sério do motor de automações como um todo (`add`/`update`/`remove`,
a avaliação de gatilhos, a execução de ações e o temporizador de segundo
plano), nunca revisto de fio a pavio por ninguém de fora — só
`checkNativeTriggers` (item 4) e o `save()` do editor (item 10). **Um bug
real, corrigido:** as subscrições do Event Bus eram construídas uma única vez
no `start()`, a partir da lista de automações daquele momento — uma regra
ligada a um evento criada ou editada depois do arranque (caminho normal do
editor visual) ficava à espera de um evento ao qual ninguém estava subscrito e
nunca corria até a aplicação reiniciar. Os próprios testes contornavam isto com
`stop()`+`start()` depois de `add()`. Novo `refreshEventSubscriptions()` refaz
as subscrições a partir da lista atual, chamado por `start`/`add`/`update`/
`remove`/`hydrate`. 3 testes novos. O resto confirmado limpo (gatilhos nativos
com o "anterior" de bateria capturado uma vez fora do predicado, ações por
ordem com paragem na primeira que rebenta, `update` preserva identidade).
Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: o
motor de automações (automation-service.ts)").

### 15. A verificação de assinatura de plugins (`src/plugins/signature.ts`, 281 linhas) — revisão adversarial — DeepSeek — commit `ade5223`

Revisão a sério da criptografia que decide se um plugin é aceite
(`signature.ts` + `verifyAndInstallPlugin` em `use-plugin-store.ts`), nunca
revista por ninguém de fora — só construída e "confirmada ao vivo" na Peça 5.
**A criptografia e o fluxo estão corretos e falham para o lado seguro**
(canonicalização ordenada com proteção de `__proto__`, base64/assinatura/chave
erradas recusadas, revogação conferida antes da matemática, externo sem
assinatura ou sem manifesto recusado). **Um achado real, à espera de decisão da
pessoa (não construído):** a assinatura cobre só o `manifest`, nunca o `code` —
trocar o código não invalida a verificação, e a interface diz "Assinatura
verificada" como se o plugin inteiro estivesse autenticado. A justificação
documentada em `plugin.ts` está tecnicamente errada. Registado em
`docs/log/perguntas-para-o-utilizador.md` (pergunta 1). Detalhe em
`docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: a verificação de
assinatura de plugins").

### 15. A cadeia de provedores de IA (`src/services/ai-providers/`, 1512 linhas) — revisão adversarial — DeepSeek — commit `d435f3c`

Revisão a sério da camada que decide qual modelo responde e como cai para o
seguinte (`provider-chain.ts`, `model-choice.ts`, `rule-provider.ts`,
`ai-provider.ts`, `deepseek`/`claude`/`ollama`), nunca revista como um todo.
**Nada de funcional a corrigir** — confirmado limpo: a cadeia só contém
provedores configurados com nomes estáveis e únicos (o `nextStep` nunca procura
um nome ausente), a escolha de modelo trata acentos/blocos de código/prompts
longos e os dois sentidos, cada provedor tem teto de 60s + aborto + erro
tipado, e os parsers acumulam argumentos de ferramenta por índice e deixam cair
JSON malformado em vez de o executar a meio. O único caminho sem teste —
`collect()` (a acumulação de ferramentas da DeepSeek) — ganhou 5 testes novos
(`tests/assistant/deepseek.test.ts`). Duas observações sem bug: `firstInChain`
nunca chamado em produção; provedor ativo não volta ao primeiro após exaustão
completa (em `ai-service.ts`). Detalhe em `docs/log/historico-sessoes.md`
(14/08/2026, "Revisão a sério: a cadeia de provedores de IA").

### 15. A camada de plataforma (`src/platform/`, ~1586 linhas) — revisão adversarial — DeepSeek — commit `4c8e98d`

Revisão a sério da ponte entre a app e o sistema operativo como um todo
(`tauri-adapter-base.ts`, `web-adapter.ts`, o contrato `platform-adapter.ts`,
diálogos nativos, anexos, política de URLs, deteção, singleton), nunca revista
por ninguém de fora — só o `secretSet`/`secretDelete` tocados de passagem na
revisão do Obsidian. **Um bug real, corrigido:** `pickAttachmentsNative`
(`attachments.ts`, o caminho nativo dos anexos do email) lia os bytes
**inteiros** de qualquer imagem para a memória para a miniatura, sem teto de
tamanho — ao contrário dos caminhos gémeos (`readBrowserFile`,
`attachViaNativeDialog`), que cortam em 5 MB. Uma fotografia de centenas de MB
esgotava a memória só para uma miniatura de 32 px. Ganhou `MAX_PREVIEW_BYTES`
(5 MB); acima disso o anexo continua válido, só sem miniatura. 3 testes novos
(`tests/platform/attachments.test.ts`, que não cobria `pickAttachmentsNative`),
confirmados a falhar contra o código antigo. Resto confirmado limpo: cofre
(`secretGet` devolve `null` em erro como degradação de propósito — coberto por
`tests/platform/secret-vault.test.ts`), `openExternal` com dupla barreira
(lista de esquemas + capability Rust), ciclo de vida das blob URLs pareado
(criação/revogação), `getTopProcesses` com `limit` opcional, storage a
preservar falsos (`??`), consumidores WebAuthn/auto-login a falhar para o lado
seguro. Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a
sério: a camada de plataforma (`src/platform/`)").

### 15. O laço de animação do núcleo visual (`use-animation-frame.ts`) — revisão adversarial — DeepSeek — commit `62d8e69`

Revisão a sério de `hooks/use-animation-frame.ts` e dos seis ficheiros do
núcleo visual (`components/ai-core/`), nunca revistos como um todo por ninguém
de fora (só tocados para cor/velocidade/anéis). **Dois bugs reais, corrigidos,
os dois no laço:** (1) ao voltar do segundo plano o `elapsed` recomeçava em 0
(o `start` vivia dentro do efeito) — o `AICore`, que calcula o delta entre
frames e só limita o de cima (`Math.min(delta, 3)`), via um salto negativo de
centenas de frames num só; o `start` passou para uma ref. (2) Com movimento
reduzido, o frame estático era desenhado uma única vez e nunca redesenhado ao
mudar de modo/cor; passou para um efeito próprio dependente da callback. 2
testes novos (`tests/ai-core/use-animation-frame.test.tsx`), confirmados a
falhar contra o código antigo. Resto confirmado limpo (partículas/ondas sem
fugas, DPR coerente, mudança segura para os outros consumidores do laço).
Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: o
laço de animação do núcleo visual (use-animation-frame)").

### 15. Interpretador de comandos de voz (`intents.ts`) — revisão adversarial — DeepSeek — commit `a554145`

Revisão a sério de `services/voice/intents.ts`, nunca revisto como um todo por
ninguém de fora. **Um bug real, corrigido:** o casamento de verbos de tarefa
usa `startsWith` sem espaço à frente, e `anota` vinha antes de `anotar` — como
um é prefixo do outro, "Anotar comprar leite" casava no `anota` e o título da
tarefa ficava "r comprar leite". Reordenado `anotar` antes de `anota`, com
teste a provar (falha no código antigo). O resto confirmado limpo (seis
famílias, comandos compostos, cortesia, música, estados/temas/widgets,
descrição por nomes). Detalhe em `docs/log/historico-sessoes.md` (14/08/2026,
"Revisão a sério: interpretador de comandos de voz").

### 15. O orquestrador do assistente (`ai-service.ts`) — revisão adversarial — DeepSeek — commit `85c193d`

Revisão a sério de `services/ai-service.ts` como um todo — a peça por onde
passa toda a conversa (`send`, `sendWithTools`, o ciclo de ferramentas e o
`recover` da cadeia), nunca revista de fio a pavio. **Um bug real, corrigido:**
o fim de um `send()`/`sendWithTools()` cancelado corria por cima do pedido
novo — repunha o modo a "idle" e fazia `this.controller = null` já depois de o
pedido novo ter tomado o controller (o prólogo do novo é síncrono; a limpeza do
cancelado é um microtask). Resultado observável: um terceiro pedido deixava de
conseguir cancelar o segundo, e duas respostas escreviam na conversa ao mesmo
tempo. Corrigido com guarda por identidade do controller em cada ponto de
limpeza (`send`, `sendWithTools` — rede bloqueada/`catch`/fim — e a troca de
provedor no `recover`), preservando a reposição do cancel a solo. 1 teste novo
(`tests/assistant/abort-race.test.ts`), falha contra o código antigo. Resto
confirmado limpo (limite de rondas, mensagens vazias removidas, máquina de
modos sem transição ilegal, fallback nunca em silêncio). Detalhe em
`docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: o orquestrador
do assistente (ai-service.ts)").

### 15. O estado da conversa (`use-assistant-store.ts`) — revisão adversarial — DeepSeek — commit `f4d5bf7`

Revisão a sério de `stores/use-assistant-store.ts` como um todo — a espinha
dorsal da conversa (mensagens, modo, favoritas, histórico, `rewindToPrompt`),
nunca revista de fio a pavio e sem teste dedicado. **Um bug real, corrigido:**
três mutadores mexiam em estado que é gravado sem chamar `persist()` —
`removeMessage`, `rewindToPrompt` e `selectConversation` — ao contrário de
todos os outros. A mensagem vazia que o `removeMessage` existe para tirar (uma
linha em branco de ronda só-ferramentas) reaparecia ao reiniciar, e a app
reabria na última conversa persistida em vez da escolhida. `persist()`
acrescentado aos três. 3 testes novos (`tests/assistant/assistant-store-
persist.test.ts`), confirmados a falhar contra o código antigo. Resto
confirmado limpo (título só do primeiro pedido, `MSG_LIMIT` mantém a primeira
mensagem, fixadas/ativa nunca caem do limite, `hydrate` assenta respostas a
meio e cai num `activeId` válido). Detalhe em `docs/log/historico-sessoes.md`
(14/08/2026, "Revisão a sério: o estado da conversa (use-assistant-store)").

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

### 18. A resposta na janela normal do assistente nunca fala — DeepSeek — commit `6e7c9a1`

Reportado ao vivo pelo utilizador. A fala por frase (item 16) só estava
ligada ao caminho dos comandos por voz (`ask`), nunca ao `sendWithTools`/
`AssistantWindow.tsx`, onde acontece a maior parte da conversa. `sendWithTools`
ganhou o `onChunk` opcional do `send` (enfiado nas rondas de ferramentas e nos
caminhos de recuperação/queda), e `AssistantWindow` liga-o a
`extractSentences`+`speakQueued`+`limparFilaDeFala` com contador de geração.
Decisão de desenho documentada: falar sempre que a resposta chega (o silêncio
foi reportado como problema, e é o mais parecido com conversa real); não há
hoje um interruptor "falar respostas" separado, e adicioná-lo saía fora deste
item pequeno. 4 testes novos, confirmados a falhar contra o código antigo.
Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Item 18: a resposta
na janela normal do assistente fala").

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
