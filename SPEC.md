# Conformidade com a especificação

Mapa entre as partes do documento e o código. Serve para a Fase 2 saber onde
continuar, e para não se perder de vista o que ficou deliberadamente por fazer.

> **A especificação completa vive em [`docs/spec/jarvis-spec-completo.md`](docs/spec/jarvis-spec-completo.md)**
> — Partes 1 a 17, sem cortes, arquivada no repositório. É a **fonte de verdade
> da visão**. O protótipo visual está em
> [`docs/spec/design-reference/jarvis-ai-os.html`](docs/spec/design-reference/jarvis-ai-os.html).
>
> Este ficheiro é outra coisa: o **estado da implementação** face a essa visão.
> A visão não se reescreve para acompanhar o código; quando o código diverge de
> propósito, a divergência fica registada aqui em §*Divergências assumidas*.

Legenda: ✅ implementado · 🟡 parcial · ⬜ Fase 2+ · ⚠️ divergência assumida

---

# ⚠️ Estado de verificação

> **Abre por aqui.** Esta secção diz o que está confirmado, o que está por
> confirmar e o que ficou para trás. Mantém-se atualizada a cada bloco.

## 1. Confirmado

Verificado num contentor Linux, e a interface conduzida em Chromium com Playwright.

| | |
|---|---|
| `tsc --noEmit` | limpo, strict total |
| ESLint | 0 erros |
| Vitest | 1244 testes |
| `vite build` | produz |
| `cargo check` | limpo em desktop **e** em `aarch64-linux-android` |
| `npm run dev` | arranca sem avisos; consola do browser limpa |
| **PWA instalável** | manifesto, ícones 192/512 + `maskable` e service worker ativo. O Chromium reportou **zero erros de instalabilidade** em `Page.getInstallabilityErrors`. Verificado com a rede cortada: a aplicação abre, e **a tipografia carrega** — as três famílias, não só a predefinida —, porque nenhuma delas vem do Google Fonts |
| **Zero pedidos para fora** | Medido em Chromium: com o provedor local, **nenhum pedido sai do `localhost`**. Só sai alguma coisa depois de se escolher a DeepSeek e colar uma chave — e a janela di-lo antes |
| Interface via `WebAdapter` | arranque, login, shell responsivo, AI Core, janelas, encaixe, paleta, temas, menu contextual, grelha de widgets com arrastar e persistência, pesquisa global na paleta, painel de notificações, loja de plugins, Emails, Tarefas, Projetos e Arquivos, **widgets de Disco e Rede**, **estados do sistema**, **sons sintetizados**, **comandos de voz**, **Centro de Programador**, **Privacidade**, **assistente com histórico, memória e contexto**, **quatro desktops com layouts guardados**, os **widgets de Calendário, Tarefas e IA**, o **daltonismo**, o **volume por categoria**, o **bloqueio por inatividade**, o **editor de temas**, a **DeepSeek ligada ao assistente**, o **assistente a executar ações a sério**, os **perfis completos**, com som e plugins, a **correção do que a voz ouviu**, as **cópias de segurança**, a **queda para o provedor local** quando a DeepSeek falha, a **escolha de modelo por pedido**, o **modo copiloto**, os **sons do arranque e do login biométrico**, a **consola de comandos**, a **tipografia à escolha** e o **FPS a sério** |

O utilizador confirmou também no Termux, em browser, via `WebAdapter`.

**Suite E2E (Playwright, `tests/e2e/`).** Corrida a sério em Chromium contra o
`vite` (localhost:1420), 11 cenários a passar: login, abrir/fechar janelas pelo
Dock e pela Paleta, temas, instalar/executar e recusar um plugin, microfone
simulado, e o assistente a responder pelo provedor local. **Não cobre** o
assistente a pedir ferramentas do catálogo (pesquisa web, navegador controlado,
notas, ficheiros) — isso exige um provedor real (DeepSeek/Ollama com `tools`)
mais rede/nativo, ausentes no harness de browser. Essas ferramentas continuam
cobertas pelos testes unitários (`vitest`, em particular
`tests/assistant/tools.test.ts`), não pelo E2E — as duas suites são
independentes e não se substituem.

## 1.1 Confirmado no Windows nativo — 08/08/2026

**Primeira execução a sério, fora do contentor Linux.** `npm run tauri dev`
correu num PC com Windows, e abriu como aplicação nativa — não browser: tem
o seu próprio ícone na barra de tarefas do Windows, distinto do Chrome ou do
Edge. Visto na hora, com prints: arranque, login, desktop com widgets, troca
de tema em tempo real ("Arctic White está agora ativo").

**A prova de que as métricas são reais, não simuladas:** o widget de CPU
mostrou **12 núcleos · 4.0 GHz** — números que só podem vir de uma leitura a
sério do processador da máquina (`sysinfo`, em Rust), não de um valor
inventado no browser. Isto confirma, sozinho, que a ponte
`invoke() → Rust → sysinfo` funciona no nativo a sério.

**O que isto desbloqueia:** este era o pré-requisito combinado desde o
início do projeto para haver comandos Rust novos — "sem comandos nativos
novos até a Fase 1 estar confirmada no PC real". Está confirmada. Passa a
haver via livre para a Fase 3 (`docs/spec/fase-3-controlo-direto.md`) e para
ligar o orquestrador multi-provedor à interface
(`docs/spec/orquestrador-multi-provedor.md`).

**O que isto ainda não confirma**, porque não apareceu nos prints e não foi
testado à parte: bandeja e menu, atalho global, notificações nativas do
sistema, diálogos de ficheiro, persistência via plugin `store`, e os
builds de instalação (MSI/NSIS). Continuam na tabela abaixo, como estavam.

## 2. Por confirmar — só com Tauri nativo

O essencial já correu a sério (ver §1.1) — o que falta abaixo é o resto do
nativo que ainda não apareceu num ecrã: bandeja, atalho global, notificações
do sistema, diálogos de ficheiro, persistência, e os builds de instalação.

> **Já há forma de instalar no telemóvel.** A PWA é a via disponível até o
> build Android do Tauri ser confirmado: `npm run build && npm run preview`, e
> depois "Adicionar ao ecrã principal" a partir de **`http://localhost:4173`**
> (tem de ser `localhost` — sem contexto seguro não há service worker, e sem
> service worker não há convite para instalar). Passos no
> [README](README.md#instalar-no-telemóvel-como-pwa).
>
> O que a PWA **não** traz continua a ser exatamente o que está na tabela
> abaixo: bandeja, atalho global, métricas reais, notificações do sistema e
> ficheiros.

### Primeiro teste a correr, antes de tudo o resto

```bash
npm install     # sem --legacy-peer-deps
```

Um `npm install` limpo já falhou uma vez, com `ERESOLVE`: o `@eslint/js` estava
numa versão que exigia `eslint@^10` num projeto preso ao 9. Num `node_modules`
já povoado não dava sinal — só num clone novo. Corrigido, mas é o primeiro
sítio onde reaparece uma regressão de dependências, por isso corre-se primeiro.

### Depois

```bash
npm run tauri dev              # Windows
npm run android:init           # uma vez, gera o projeto Gradle
npm run tauri android dev      # dispositivo Android
```

| Funcionalidade | Onde vive | Estado |
|---|---|:--:|
| **Rede real** — meteorologia | `services/weather/providers/open-meteo-provider.ts` | ✅ **desbloqueado pelo utilizador 13/08/2026** — Open-Meteo (sem chave), ligado em Personalização → Meteorologia; por omissão mantém-se o simulado |
| **Rede real** — notícias | `services/news/providers/news-api-provider.ts` | ✅ **desbloqueado pelo utilizador 13/08/2026** — NewsAPI (chave no cofre), ligado em Personalização → Notícias; por omissão mantém-se o simulado |
| **Rede real** — pesquisa web | `services/web-search/providers/brave-search-provider.ts` | ✅ **desbloqueado pelo utilizador 13/08/2026** — Brave Search (chave no cofre), ligado em Personalização → Pesquisa web; por omissão mantém-se o simulado. A ferramenta `pesquisar_na_web` só devolve título, resumo e endereço por resultado — nunca HTML nem o conteúdo de nenhuma página — e não executa nada por si |
| **Navegador controlado pelo assistente** (Peça 19) | `services/knowledge/web-browser-service.ts`, `src-tauri/src/commands/browser.rs` | ✅ **desbloqueado pelo utilizador 13/08/2026** — **desligado por omissão**, interruptor explícito em Privacidade → Acesso, com aviso de primeira ativação. Ferramenta `abrir_pagina(url)`: comando Rust (`ureq` + `scraper`, não `fetch()` da interface — a CSP é uma lista fechada de anfitriões conhecidos e a maioria dos sítios recusaria por CORS de qualquer forma) busca a página (só `https`, só GET), extrai o texto visível (script/style/noscript descartados antes de qualquer texto ser lido, não só escondidos), devolve à interface como texto inerte — nunca HTML, nunca nada que corra. O texto chega ao modelo delimitado explicitamente ("CONTEÚDO EXTERNO, NÃO CONFIÁVEL … FIM DO CONTEÚDO EXTERNO"), reforçando a mesma linha já acrescentada ao prompt de sistema para a Peça 18. **Excluído de propósito**: clicar, preencher formulários, navegar por conta própria, executar JavaScript da página — isso é controlo direto sobre um agente autónomo na web, categoria de risco da Fase 3, não desta peça |
| **Rede real** — email | `services/mail/providers/imap-mail-provider.ts`, `src-tauri/src/commands/mail.rs` | ✅ **desbloqueado pelo utilizador 13/08/2026** — IMAP (ler) + SMTP (enviar) reais no Rust (`imap`/`lettre`, envio por STARTTLS na porta 587); palavra-passe no cofre (`mail-password`), ligado em Personalização → Correio; por omissão mantém-se o simulado |
| ~~Provedor de IA~~ | `services/ai-providers/deepseek-provider.ts` | ✅ **desbloqueado pelo utilizador** — ver Parte 7.1 |
| **Reprodução de áudio** — música local | `services/music/providers/local-music-provider.ts`, `src-tauri/src/commands/music.rs` | ✅ **desbloqueado pelo utilizador 13/08/2026** — reprodução de ficheiros de áudio de uma pasta escolhida (mp3/wav/ogg/flac/m4a/aac/opus) num `<audio>` real, servida pelo protocolo `asset` do Tauri; ligado em Personalização → Música; por omissão mantém-se o simulado. **Sem rede, sem Spotify** |
| **Carregamento real de plugins** — sandbox, assinatura, ficheiros | `apps/plugin-manager/`, `plugins/plugin.ts` | ✅ **confirmado 12/08/2026** — lote 2 completo: sandbox de execução, assinatura Ed25519, e instalação de ficheiro local. **Revisão a sério 14/08/2026** da ponte (`plugins/runtime/plugin-bridge.ts`): dois bugs corrigidos — (1) `core.service.register` aceitava `intervalMs: NaN` (o `typeof` é "number", passa na validação) e `Math.max(NaN, mínimo)` devolve `NaN`, que o `setInterval` lê como 0ms — martelada ao Core; agora o que não for finito cai no mínimo. (2) `core.fetch` seguia redireccionamentos por conta própria e a verificação de domínio é só sobre a URL inicial — um domínio autorizado podia apontar para `localhost`/IP privado e devolver a resposta; agora `redirect: 'manual'` recusa o redireccionamento. **Revisão a sério 14/08/2026 da fronteira de permissões** (`plugin-bridge.ts` + `install-from-file.ts`): um terceiro bug corrigido — o portão de runtime lia a permissão como verdade de JavaScript (`if (!declaration.permissions?.[permission])`), por isso um manifesto assinado com `"false"` (string não vazia, verdade em JS) ou `1` passava como "declarada", a contradizer o contrato documentado de permissão `true`; agora compara estrito (`!== true`) e a instalação recusa valores não booleanos |
| **Leitura real do disco** — explorador de ficheiros | `apps/files/`, `data/files.ts` | ✅ **feito, 12/08/2026** — entrada desatualizada corrigida 13/08/2026; ver Parte 6.2 (linha "Arquivos — sistema de ficheiros real") para o detalhe completo |
| Métricas reais do `sysinfo` (CPU, RAM, disco, rede) | `src-tauri/src/system/` | ✅ **confirmado 08/08/2026** — CPU real no Windows, ver §1.1. RAM, disco e rede vêm da mesma leitura, ainda sem print à parte |
| Lista de processos | `src-tauri/src/commands/system.rs` | ✅ **confirmado 10/08/2026** — separador "Processos" no Centro de Programador (DeveloperCenterWindow.tsx), com nome, PID e memória, relido a cada 3s |
| Ícone na bandeja e respetivo menu | `src-tauri/src/tray.rs` | ✅ **confirmado 09/08/2026** — o atalho global (linha abaixo) chama `tray::focus_main`, e correu sem erro |
| Atalho global `CTRL+ALT+J` | `src-tauri/src/shortcuts.rs` | ✅ **confirmado a sério 09/08/2026** — janela minimizada à força, `CTRL+ALT+J` enviado ao sistema (não à janela), e voltou ao primeiro plano sozinha |
| Notificações nativas do sistema | plugin `notification` | ✅ **Peça 14, Lote 4 (13/08/2026)** — isolada por testar (10 testes novos, `tests/services/notification-service.test.ts`): `sendNativeNotification` (`TauriAdapterBase`) — permissão já concedida manda logo; sem permissão, pede primeiro e só manda se for concedida; recusada, nunca chama `sendNotification`; o plugin a rebentar devolve `false` em vez de crashar. `NotificationService.notify()` — confirmado que só pede a nativa quando o estado do sistema deixa (Normal deixa sempre, Foco só urgente, Apresentação nunca), que `silent` corta sempre, e que o toast interno e a nativa nunca duplicam informação de forma confusa (mesmo título e descrição nos dois, verificado por asserção direta) — uma notificação suprimida fica na história (`isDismissed: true`), não desaparece. **Não confirmado ao vivo desta vez**: a automação de clique/teclado (`jarvis-click.ps1`) foi bloqueada pela própria proteção do Windows contra roubo de foco — havia outra janela do Claude Code ativa (sessão interativa do utilizador, a trabalhar na Peça 15) a competir pelo foco, e uma tentativa anterior já tinha mandado texto para essa janela por engano antes de a proteção ser reforçada com verificação de foco a sério. Decisão tomada com o utilizador: não forçar, documentar a cobertura pelos testes automatizados em vez de arriscar interferir outra vez com a sessão dele |
| Persistência via plugin `store` | `services/storage-service.ts` | ✅ **confirmado 09/08/2026** — `%APPDATA%\com.projectarc.jarvis\jarvis.store.json` no disco a sério, com dados reais de sessões anteriores (notificações, memória do assistente, voz escolhida), sobrevive a fechar e voltar a abrir |
| Diálogos nativos de ficheiro | plugin `dialog` | ✅ **confirmado 10/08/2026** — a cópia de segurança (BackupPanel.tsx) chama `save()`/`open()` do plugin, com queda para `<a download>`/`<input type="file">` quando o plugin falha (ex.: a correr no browser) |
| Build Windows (MSI e NSIS) | `npm run tauri build` | ✅ **confirmado 09/08/2026** — os dois instaladores produzidos sem erro: `JARVIS AI OS_1.0.0_x64_en-US.msi` (3,4 MB) e `JARVIS AI OS_1.0.0_x64-setup.exe` (2,6 MB), em `src-tauri/target/release/bundle/`. Ainda não instalados nem corridos a partir do instalador — só a build em si |
| Build Android (APK e AAB) | `npm run android:build` | 🚫 bloqueado nesta máquina — sem Android SDK instalado (`ANDROID_HOME` vazio). Precisa de `npm run android:init` com o SDK/NDK primeiro |
| Instalação como aplicação nativa | Tauri | ⚠️ por testar — **a PWA já cobre isto** no telemóvel |

> No browser, tudo isto está desligado nas capacidades do `WebAdapter` e
> substituído por simulação ou por vazio. Ver [PLATFORM.md](PLATFORM.md).

**Nota de sessão (09/08/2026) — a instância de `npm run tauri dev` fechou-se
sozinha várias vezes** durante estes testes, sem nenhum erro no terminal nem
entrada no visualizador de eventos do Windows — nem sempre a meio de algo
que se estivesse a fazer (uma vez, só a aguardar, sem interação nenhuma). Não
se percebeu a causa a tempo desta sessão. Suspeitas por confirmar: pressão de
memória com o `voice-clone-service` a carregar dois modelos grandes ao mesmo
tempo (XTTS-v2 + Whisper) na mesma GPU/RAM, ou algo ligado ao
`--remote-debugging-port` do WebView2 usado para testar por fora (CDP). Não
aconteceu com a app corrida sem essa flag. Se voltar a acontecer em uso
normal (não só em testes automatizados), vale a pena olhar para o
`Gestor de Tarefas` no momento da falha, e para os registos de eventos do
Windows (`Get-WinEvent -LogName Application`) logo a seguir.

**Reinvestigado a sério 14/08/2026** (item 20 da fila): o sintoma voltou
em uso normal (≥6 vezes numa noite), com
`Failed to unregister class Chrome_WidgetWin_0. Error = 1412`. Conclusão:
a mensagem é ruído de desmontagem do WebView2, não a causa. Descartadas a
pressão do `voice-clone-service` (nesta máquina não há `.venv`, logo não
há modelos carregados), a janela-recriada-no-HMR, a corrida destroy/create
do CLI e o WebView2 órfão. Evidência aponta para fora do código: três
`LiveKernelEvent 0x141` (TDR no `nvlddmkm.sys`, driver NVIDIA Blackwell)
na noite de 13/08 e um `RADAR_PRE_LEAK_64` no `msedgewebview2.exe`
(10/08), sem nenhum `APPCRASH` do próprio `jarvis-ai-os.exe`. Teoria:
reset do GPU a meio da animação de 60 fps do núcleo visual derruba o
WebView2. Próximo passo: atualizar o driver NVIDIA; se voltar, testar
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-gpu` como diagnóstico.
Detalhe em `docs/log/historico-sessoes.md` (14/08/2026).

## 3. Regra em vigor a partir daqui

> **Esta secção ficou por atualizar — corrigido 13/08/2026, na revisão do
> Lote 4.** O portão que descreve ("bloqueado até a Fase 1 correr num PC a
> sério") já foi passado há muitos lotes: há Terminal, Cofre de segredos,
> Automações nativas, Windows Hello, Explorador com leitura real do disco,
> instalação e execução real de plugins, quatro provedores de rede reais
> (meteorologia, notícias, email, música) e chave física WebAuthn, todos
> confirmados nesta máquina Windows. A lista de bloqueios abaixo é histórica
> — cada item já tem o estado atual marcado ao lado, e a linha desse item
> na tabela da funcionalidade correspondente é a fonte de verdade, não esta
> secção. Mantida por registo, não como regra ativa.

A **Fase 2 avançou sem essa confirmação, por decisão do utilizador**, e apenas
na parte que não toca no nativo — o sistema de widgets, testável em browser via
`WebAdapter`.

**Ficava bloqueado até a Fase 1 correr num PC a sério — já correu, ver a nota acima:**

- Comandos Rust novos
- Qualquer integração nativa adicional (bandeja, atalhos, ficheiros, energia)
- Builds Windows e Android
- **Chamadas de rede reais.** Os serviços de meteorologia, notícias, email e
  música têm provedor e interface prontos. A **meteorologia, as notícias e o
  email já são reais** (Open-Meteo sem chave; NewsAPI com chave no cofre; email
  por IMAP+SMTP no Rust, palavra-passe no cofre — ligado pelo utilizador na
  Personalização, ver §2). A **música também já é real, mas não é uma chamada
  de rede**: lê ficheiros de áudio locais (ver abaixo). Ligar um provedor é
  escrever uma classe e registá-la — nenhum componente muda
- **Reprodução de áudio.** O widget de música controla e mostra o estado; tocar
  som já é real a partir de ficheiros locais — uma pasta escolhida pelo
  utilizador, servida ao `<audio>` pelo protocolo `asset` do Tauri (sem Spotify,
  sem rede)
- **Leitura do disco — já é real, 12/08/2026 (Peça 7).** O explorador continua
  com a árvore inventada por omissão, mas escolher uma pasta-raiz pelo diálogo
  nativo liga a leitura a sério (`files_set_root`/`files_read_dir`, ver Parte
  6.2). Não precisou do plugin `fs` do Tauri — comandos Rust próprios, mesmo
  padrão do Terminal
- **Execução de plugins — já é real, 12/08/2026 (Peça 9).** Os catorze plugins
  de exemplo do catálogo correm código a sério num `<iframe>` restrito
  (`docs/spec/plugins-sandbox.md`), e instalar um plugin de um ficheiro
  `.jarvis-plugin` local exige assinatura Ed25519 válida antes de entrar no
  sandbox (Parte 11). O que continua por fazer é só a ligação a uma fonte
  remota real de terceiros (aba "Marketplace", dados inventados à mão) —
  decisão maior, ver `docs/spec/plugins-marketplace.md`
- Funcionalidades cuja verificação exija um dos dois alvos

Se um item da Fase 2 precisar de nativo para funcionar, para-se e regista-se
aqui, em vez de se construir às cegas por cima de uma base ainda não validada.

## 4. Pastas da Parte 3 ainda não criadas

Entram quando tiverem conteúdo. Criar diretórios vazios seria estrutura a
fingir.

| Pasta | Entra quando |
|---|---|
| `src/app/` | Houver router com mais do que uma rota. Hoje `main.tsx` e `App.tsx` estão na raiz de `src/` |
| `src/contexts/` | Houver estado que o Zustand não sirva bem. Hoje não há Context nenhum |
| `src/api/` | Houver chamadas de rede — provedores de IA reais, meteorologia, calendário |
| `src/data/` | ✅ criada — sementes de tarefas, projetos e árvore de ficheiros |
| `src/components/layouts/` | — nome da Parte 3 para o que hoje é `components/shell/` |
| `src/components/pages/` | Houver rotas a que corresponda uma página |
| `src/components/widgets/` | ✅ criada — grelha, moldura e estados |

As cinco que já existem — `constants/`, `utils/`, `animations/`, `workers/`,
`assets/` — têm cada uma um `README.md` que define a fronteira. Ver
[ARCHITECTURE.md](ARCHITECTURE.md) §*Onde pôr um ficheiro novo*.

## 5. Fora de âmbito por decisão

Não é falta de tempo nem esquecimento. São coisas que se decidiu **não**
construir, cada uma com a sua razão — e duas em que a decisão foi revista.

| O quê | Porque não |
|---|---|
| **Workspace — múltiplos desktops e layouts guardados** | ✅ **Feito.** O receio era mexer no `use-window-store` e no `use-widget-store`, as duas peças mais bem testadas do projeto. A solução foi **não lhes tocar**: o `workspace-service` lê o que elas já expõem e escreve pelas ações que elas já têm. Os 568 testes que existiam antes continuam a passar sem uma linha alterada |
| **Terminal** | ✅ **Feito**, 12/08/2026, com PC a sério. PTY real via `portable-pty` (`src-tauri/src/terminal/`) — `powershell.exe` no Windows, `xterm.js` do lado da interface. Ver Parte 6.2. **Revisão a sério (Kimi + coordenador, 13/08/2026)**: três bugs reais corrigidos — carateres UTF-8 multibyte cortados a meio entre dois `read()` do PTY viravam `�` (`DecodificadorUtf8`, guarda os bytes pendentes de uma sequência incompleta até ao próximo read); `TerminalRegistry::write` segurava o lock de **todo** o registo durante uma escrita ao PTY que pode bloquear (buffer cheio, processo que não lê stdin), travando qualquer outra sessão, incluindo o `kill` que a desbloquearia — corrigido para só clonar a pega do escritor (`Arc<Mutex<...>>`) com o lock do registo, e escrever já sem ele; `kill()` não colhia o processo (`wait`), deixando zombies no Unix — corrigido com `try_wait`/`wait`. Nunca tinha um teste. 5 novos, mais um bug apanhado ao escrevê-los: `flush()` do descodificador UTF-8 não limpava o que sobrava, por isso uma segunda chamada repetia o mesmo texto — corrigido |
| **Motor de automações** | ✅ **Feito.** A avaliação inicial estava errada: gatilhos por hora e por evento interno são reais dentro do browser. Só os do sistema — ficheiros, USB, bateria — é que exigem nativo |
| **Widget de GPU** | O `sysinfo` não lê a GPU. Mostrar um número inventado é pior do que não mostrar nada, e é a mesma razão pela qual o Monitor de recursos também não tem cartão de GPU |

O widget de GPU entra se e quando houver uma forma honesta de ler a GPU.

---

## Parte 1 — Prompt de UI/UX e visão geral

Não é uma parte que se "implemente": é o critério com que as outras se julgam.

| Regra | | |
|---|:--:|---|
| Nunca emojis, só SVG | ✅ | Lucide em todo o lado. Nenhum emoji no código nem na interface |
| Paleta original | ✅ | `tokens.ts`, com teste que falha se o CSS divergir |
| Tipografia Inter, 300–700 | ✅ | **No repositório**, não no Google Fonts: a fonte variável cobre os cinco pesos, e a PWA abre offline com a tipografia do design em vez de uma de sistema |
| Sidebar, header, dock, núcleo, painéis | ✅ | Partes 6.1 e 8 |
| Nunca parecer um site | ✅ | Janelas, dock, cursor próprio, menu contextual próprio |
| Responsivo até ao telemóvel | ✅ | Rail → gaveta, janelas empilhadas, widgets empilhados |
| Acessibilidade: ARIA, contraste, teclado, foco | ✅ | ARIA e teclado em todo o lado, e o painel da Parte 15 com alto contraste e redução de transparência |
| Código modular, sem duplicação | ✅ | Registos únicos, adapters, serviços com provedores |

---

## Parte 2 — Design System

| Item | | Onde |
|---|:--:|---|
| Cores (13 tokens) | ✅ | `src/design-system/tokens.ts` |
| Tipografia Inter, 7 tamanhos, pesos 300–700 | ✅ | `tailwind.config.ts` |
| Espaçamentos 8/16/24/32/48/64 | ✅ | `tokens.ts` |
| Cantos 16/20/24/14 | ✅ | `tokens.ts` |
| Glassmorphism, blur 20–40px | ✅ | `.glass` em `globals.css` |
| Ícones Lucide, nunca emoji | ✅ | em todo o lado |
| Scrollbar fina azul | ✅ | `globals.css` |
| Cursor personalizado | ✅ | `components/shell/CustomCursor.tsx` |
| Wallpaper procedural | ✅ | `components/shell/Wallpaper.tsx` |
| Grid de 12 colunas | ✅ | `components/widgets/grid.ts` — 12 colunas fluidas, 4 no compacto |
| Loaders futuristas | ✅ | `components/ui/CoreLoader.tsx` — três anéis concêntricos, sem spinner comum |

---

## Parte 3 — Arquitetura

| Item | | Nota |
|---|:--:|---|
| Fluxo `Component → Hook → Service → API` | ✅ | Com `PlatformAdapter` entre o serviço e o nativo |
| Componentes de responsabilidade única | ✅ | |
| Serviços desacoplados | ✅ | 17 dos 17: System, AI, Voice, Storage, Theme, Notification, Workspace, Weather, Clock, Wallpaper, Calendar, News, Email, Music, Search, Device, Plugin. Cada um tem a sua classe de serviço pura (sem React/Zustand) e a sua store fina por cima. O `PluginService` (`services/plugin-service.ts`) lê o catálogo e fala com o armazenamento; a `usePluginStore` é só a camada reativa — estado + eventos + auditoria |
| Stores separadas | ✅ | 17 das 26. As 17 com serviço seguem o padrão (15 com subscrição direta na store, 2 por hook: `useAiSettings` → `aiService`, `useSystemMetrics` → `systemService`). Das 9 restantes, todas são estado local puro sem fonte externa (janelas, widgets, tarefas, sessão, aparência, temas custom, assistente, correção de voz, navegação pendente) — não precisam de serviço. `useDataService` já não tem consumidores |
| Sistema de janelas completo | ✅ | `stores/use-window-store.ts` |
| Nomenclatura | ✅ | |
| **Estrutura de pastas** | ⚠️ | Ver abaixo |
| **Stack: GSAP, Three.js, TanStack Query, IndexedDB, date-fns** | ⚠️ | Ver abaixo |
| Temas: Escuro, Claro, Azul, Grafite, Carbono, OLED | ⚠️ | Ver abaixo |

---

## Parte 4 — Boot

| Etapa | | |
|---|:--:|---|
| 1. Ponto azul, pulsação, onda circular | ✅ | `BootSpark` |
| 2. Transforma-se em 6–10 anéis | ✅ | `BootRings` — 8 anéis, velocidades e sentidos distintos |
| 3. Texto a digitar, fica verde com ícone | ✅ | `BootTypeLine` |
| 4. As 10 verificações | ✅ | `BootChecks` |
| 5. Gráficos CPU/RAM/GPU/Rede/Disco | ✅ | `BootGraphs` |
| 6. Núcleo JARVIS grande com radar | ✅ | Reutiliza o `AICore` em modo de análise |
| 7. Mensagem central | ✅ | `BootIdentity` |
| 8. Sistema fala | ✅ | `voiceService.speak` |
| 9. Scanner completo | ✅ | `.boot-scanline` |
| 10. Desktop em cascata | ✅ | `useEntranceCascade` |
| Arranque rápido com "Bem-vindo de volta" | ✅ | |
| Duração 6–10s | ✅ | ~9s |
| Efeitos sonoros | ✅ | A nota dizia "sem recursos de áudio na Fase 1" — já não é verdade desde que o `soundService` passou a sintetizar sem ficheiros (Bloco H). A categoria "sistema" já se descrevia como "arranque e leitura biométrica", e nenhum código lhe tocava: `scanner` ao formarem-se os anéis, um `click` por verificação, `success` na identidade final. O arranque rápido soa a `open`, não a `success` — não verificou nada, não merece a fanfarra. Com redução de movimento, silêncio: a saída é quase instantânea |
| Modo de erro simulado | ✅ | `sessionStorage.setItem('jarvis-debug.bootFailAt', '3')` — força a verificação de índice 3 a falhar (X vermelho, barra vermelha, som de erro), sem travar a sequência |
| Botão "Mostrar sequência completa" nas configurações | ✅ | Na janela de Personalização e na Command Palette; a ação vive no `useSessionStore`, sem duplicação |

---

## Parte 5 — Login

| Item | | |
|---|:--:|---|
| Cabeçalho com hora, data, fuso, clima, estado da IA | ✅ | |
| Cartão 520px, glassmorphism | ✅ | |
| Avatar 120px com rotação e glow no hover | ✅ | |
| Campo 56px, mostrar/ocultar | ✅ | |
| Indicador de CAPS LOCK | ✅ | |
| Indicador de força | ✅ | `password-strength.ts` |
| Biometria facial e digital | ✅ | Windows Hello a sério quando o dispositivo o tem configurado (`checkBiometricAvailability`/`requestBiometricVerification`, WinRT `UserConsentVerifier`); cai para a simulação original numa máquina sem sensor nem PIN. Ver nota abaixo |
| Teclado PIN | ✅ | `PinKeypad.tsx` |
| Erros: shake, glow vermelho, foco mantido | ✅ | |
| Mensagens da IA com digitação | ✅ | |
| Atalhos do rodapé | 🟡 | Presentes, mas informam que a gestão de energia é Fase 2 |
| IA cumprimenta por voz na transição | ✅ | |
| Windows Hello, chave física, sessão automática | ✅ | **Windows Hello e sessão automática**, 12/08/2026, com PC a sério — ver nota abaixo para o que se confirmou ao vivo e o que não deu. **Chave física (WebAuthn), 13/08/2026** — `services/webauthn-service.ts`: cerimónia real (`navigator.credentials.create`/`.get`), verificação criptográfica real da assinatura (ECDSA P-256/ES256, sem servidor — confiança de "fui eu que registei", não de uma autoridade externa), incluindo a conversão DER→raw que o `SubtleCrypto.verify` exige e que os autenticadores não dão de bandeja. Regista-se em Privacidade → Acesso, usa-se no login ao lado do Windows Hello e do PIN. Cofre de segredos: guarda a credencial, nunca a chave privada (essa nunca sai do autenticador — é assim que WebAuthn funciona). Só ES256 (-7); RS256 e outros ficam por fazer. `signCount` guardado como sinal de clonagem em melhor esforço, sem bloquear sozinho — muitos autenticadores de plataforma nunca o incrementam. 27 testes novos (`tests/services/webauthn-service.test.ts`, `tests/auth/login-screen.test.tsx`, `tests/diagnostics/privacy.test.tsx`), com chaves ECDSA geradas a sério em cada teste (zero fixas no código, mesmo padrão da Peça 5). **Não confirmado ao vivo** — feito nesta sessão remota, sem hardware Windows disponível: nem uma chave física real (YubiKey ou equivalente) nem o Windows Hello via WebAuthn foram testados fora de mocks. A matemática da verificação está confirmada a sério (assinatura de chave errada é recusada, DER→raw é exercitado de ponta a ponta) — o que falta é a cerimónia do próprio sistema operativo/hardware. **Falha de segurança real, apanhada e corrigida na revisão a sério do Lote 4 (13/08/2026, Sonnet)**: nem `registerSecurityKey` nem `verifySecurityKey` conferiam que o `challenge` gerado batia certo com o `clientDataJSON.challenge` da resposta — a verificação da assinatura provava que a resposta vinha da chave privada certa, mas nunca provava que era a resposta ao pedido concreto que se acabou de enviar, deixando uma resposta antiga (repetida) matematicamente válida passar sem ninguém dar por isso. Corrigido: as duas funções decodificam `clientDataJSON`, conferem `type` (`webauthn.create`/`webauthn.get`) e `challenge` (codificado em base64url, o formato que o browser usa — diferente do base64 normal já usado para guardar a credencial) antes de aceitar qualquer coisa. 21 testes na suite depois da correção (era 19 antes; a maioria dos testes existentes teve de passar a construir o `clientDataJSON` com o `challenge` real de cada pedido, lido das opções que o próprio serviço passa a `navigator.credentials` — antes usavam um valor fixo, que nunca bateria certo com a verificação nova) |
| Avatar "viaja" até ao canto superior direito | ✅ | A transição usa `transform`/`opacity` — o avatar desliza do centro do ecrã de login (posição real por `getBoundingClientRect`) até ao canto do header |

**Nota sobre o Windows Hello (12/08/2026):** `UserConsentVerifier` (WinRT) por trás de `windows_hello_available`/`windows_hello_verify` (`src-tauri/src/windows_hello/`). Confirmado ao vivo nesta máquina: `checkBiometricAvailability()` devolve `true` (esta máquina tem PIN do Windows Hello configurado), e clicar em "Reconhecimento facial" dispara mesmo o diálogo nativo do Windows — `Segurança do Windows` / `CredentialUIBroker.exe` a sério, confirmado pelo processo a aparecer. **Não confirmado ao vivo**: o desfecho "verificado" — o diálogo corre no ambiente de trabalho seguro do Windows, isolado de propósito contra automação (nem `SendInput` sintético nem terminar o processo a partir de uma sessão não elevada conseguem tocar-lhe — `Acesso negado`, o que é o comportamento correto de segurança, não um bug). Fica documentado como esperado em vez de fingido; o próximo login real, feito à mão, confirma o resto. Sessão automática (`src/services/auto-login-service.ts`): token aleatório no cofre de segredos, válido 30 minutos, criado só depois de um "verified" real — nunca da palavra-passe nem do PIN simulado — e apagado no logout. **Revisão independente a sério (13/08/2026)**: nada de real a corrigir — token `crypto.randomUUID()` (não fixo nem derivável), validade de 30 minutos conferida a sério, sessão automática só depois de `outcome === 'verified'`, `VerificationOutcome` fecha por defeito (erro inesperado cai em `Denied`/`Unavailable`, nunca `Verified`), e o resultado vem só do Rust (o JS não consegue forçar "verified"). **Revisão a sério (item 15, DeepSeek, 14/08/2026): bug real corrigido** — `hasValidAutoLoginSession` só tratava JSON *inválido* como corrompido; um cofre com JSON válido mas que não é o objeto esperado (`"null"`) rebentava a ler `.expiresAt` (`TypeError`) em vez de invalidar a sessão. Agora valida a forma do que veio do cofre antes de ler o campo. 4 testes novos (formas não-objeto: `null`, `42`, `true`, `"texto"`).

---

## Parte 6.1 — Desktop

| Item | | |
|---|:--:|---|
| Header 72px, pesquisa 650px, CTRL+K | ✅ | |
| Sidebar 88/280 com expansão no hover | ✅ | |
| Dock com magnificação | ✅ | |
| Núcleo ao centro | ✅ | Primeiro no palco e sempre visível. Os widgets descem para baixo dele — nunca por cima |
| Menu contextual com os 8 itens | ✅ | |
| Camadas de profundidade | ✅ | |
| Sons | ✅ | `services/sound-service.ts` — sintetizados com Web Audio, sem um único ficheiro de áudio. Desligados por omissão |

---

## Parte 6.2 — Widgets, janelas e workspace

| Item | | |
|---|:--:|---|
| Janelas: arrastar, redimensionar, z-index, persistência | ✅ | **Revisão a sério (item 15, DeepSeek, 14/08/2026): bug real corrigido** — uma janela maximizada era guardada com `isMaximized: true` (tanto `persistLayout` como `captureWorkspace`), mas nenhum dos dois caminhos de restauro (`restoreSavedLayout` no arranque, `applyWorkspace` ao mudar de desktop/aplicar perfil) lia o flag de volta: a janela reabria sempre com o tamanho normal. Agora ambos repõem a maximização no ecrã atual (via `toggleMaximize` com `maximizedRect`), exceto no compacto, onde as janelas se empilham a largura toda. 4 testes novos |
| Encaixe: metades, quartos, ecrã inteiro | ✅ | `components/windows/snap.ts` |
| Minimizar com viagem até ao dock | ✅ | `.window-minimizing` |
| Command Palette | ✅ | Comandos **e conteúdo**: emails, notícias e notificações entram nos resultados |
| **Sistema de widgets** | ✅ | Grelha de 12 colunas, arrastar, encaixe, redimensionar e persistência. No compacto **empilham-se a largura toda**, com linhas mais baixas. `components/widgets/` e `widgets/` |
| Widgets previstos | ✅ | Doze: Relógio, CPU, RAM, Disco, Rede, Clima, Notícias, Email, Música, **Calendário**, **Tarefas** e **IA**. O de Tarefas mexe nas mesmas tarefas da janela, e o de Calendário lê a mesma agenda. **GPU não entra**: ver §5 |
| Múltiplos desktops (1 a 4) | ✅ | Cada um com janelas, widgets, tema e papel de parede próprios. Quatro marcas no header. Um desktop por estrear **herda** o que está no ecrã em vez de abrir um vazio |
| Painel lateral de notificações com agrupamento | ✅ | `components/notifications/NotificationPanel.tsx` — categorias, pesquisa, ações rápidas e histórico persistido |
| Layouts guardados (Produtividade, Programação…) | ✅ | Os seis da especificação, mais os que se guardarem. Cada um repõe janelas, widgets e onde estão, tema e papel de parede. Os do sistema vêm do código a cada arranque, para uma correção chegar a quem já os tinha |
| Janelas: Emails, Tarefas, Projetos, Arquivos | ✅ | Emails em cima do `mailService`, agora com "Nova mensagem" — anexar ficheiros (diálogo nativo, `platform/attachments.ts`, com queda para `<input type="file">` sem Tauri), nome/tamanho de cada um, e pré-visualização para imagens. Enviar continua fora de âmbito, tal como responder — exige provedor real, dito de frente. Tarefas com prioridade, prazo, subtarefas e persistência; Projetos em leitura; Arquivos com árvore **simulada por omissão, real desde 12/08/2026** — ver a linha seguinte |
| **Arquivos — sistema de ficheiros real** | ✅ **Feito**, 12/08/2026, lote 2 peça 7. Botão "Escolher pasta real…" abre o diálogo nativo (`@tauri-apps/plugin-dialog`); a pasta escolhida declara-se no Rust (`files_set_root`, `src-tauri/src/commands/files.rs`) e fica gravada como a única fronteira: `files_read_dir` recusa qualquer caminho fora dela, mesmo com `..` ou links simbólicos — a comparação é sobre caminhos já canonicalizados, no Rust, não confiada à interface. Sem capability `fs:*` nova: são comandos próprios da app com `std::fs`, não o plugin `fs` do Tauri — o mesmo padrão do Terminal. A raiz escolhida persiste (`storageSet`, chave `files.real-root-path`) e reabre-se sozinha no arranque seguinte; se a pasta tiver desaparecido entretanto, cai-se para a árvore simulada sem mostrar erro nenhum. Um botão "Árvore simulada" volta atrás e esquece a raiz. Tipo de ficheiro adivinhado pela extensão (`fileKindFromName`, `types/file-entry.ts`) — a árvore real não vem com um `kind` já atribuído como a simulada. O caminho pendente do assistente (`abrir_ficheiro`) continua a apontar só para a árvore simulada — se houver um pedido pendente na primeira leitura, a reabertura da raiz real espera pela próxima montagem em vez de o atropelar. 20 testes novos (`tests/apps/files-real.test.tsx`, `tests/platform/adapters.test.ts`). **Confirmado ao vivo** (`npm run tauri dev`): diálogo nativo a abrir mesmo sobre `Documentos`, escolha real de `WhirlwindFX`, listagem de subpastas e datas reais, descida a `Effects` a mostrar "Pasta vazia." (a pasta está mesmo vazia no disco), regresso à árvore simulada a limpar o estado. **Não confirmado ao vivo**: a reabertura automática da raiz no arranque seguinte (exigia reiniciar a app; a lógica é a mesma testada nos 20 testes) e uma tentativa a sério de escapar à raiz (coberta pelo desenho do comando e por não haver forma de a interface pedir um caminho fora do que já navegou, não por um teste ao vivo) |
| Janela: Automações | ✅ | Motor a sério — ver Parte 13 |
| Janelas: Centro de Programador e Privacidade | ✅ | Partes 16 e 14 |
| Janela: Terminal | ✅ | PTY a sério (`portable-pty`, `powershell.exe` no Windows) via `src-tauri/src/terminal/`; `xterm.js` do lado da interface — cores e redimensionamento reais, sem reimplementar o parser ANSI à mão. `SearchService`/`DeviceService` já tinham o precedente do padrão serviço+store; o Terminal soma-se ao invoke handler condicional (`#[cfg(desktop)]`) do `lib.rs`. Sem confirmação para comandos destrutivos — é a pessoa a escrever à mão, não o assistente a decidir; ver o comentário em `terminal/mod.rs`. Sem capability nova em `capabilities/*.json`: comandos da app (não de plugin) não passam pelo sistema de ACL deste projeto — o escopo estreito vem do próprio desenho do comando (só spawna o shell fixo, nunca um programa escolhido pela interface), não de uma allow-list. Confirmado ao vivo: `npm run tauri dev`, login, abrir a janela pela paleta, `echo` real a devolver a saída certa. **Não confirmado ao vivo**: o fecho da janela a matar o processo (o clique sintético via `SendInput` não chegou a nenhum botão de controlo da janela, nem sequer minimizar — parece uma limitação do automatismo usado para testar, não um bug; confirmado por outra via que não fica processo órfão nem num crash a sério, porque o `portable-pty` liga o filho a um Job Object do Windows) |
| **Plugin Manager** | 🟡 | Loja completa em interface — catálogo, categorias, pesquisa, permissões, instalar/ativar/remover, persistido. **Correção a uma nota antiga desta linha** (apanhada de forma independente duas vezes, 13/08/2026): já não é verdade que "não carrega código" — os catorze plugins de exemplo do catálogo correm código a sério num iframe restrito (`docs/spec/plugins-sandbox.md`), e a Peça 9 do Lote 2 (12/08/2026) trouxe instalação e execução de plugins externos de um ficheiro `.jarvis-plugin`, com assinatura Ed25519 obrigatória — ver Parte 11 e §2. O que continua por fazer, e é o motivo de ainda ser 🟡, é só a ligação a uma fonte remota real de terceiros (a aba "Marketplace" continua com dados inventados à mão) — decisão maior, ainda por tomar com o utilizador, ver `docs/spec/plugins-marketplace.md` |

---

## Parte 7.1 — Assistente JARVIS

| Item | | |
|---|:--:|---|
| Personalidade: elegante, objetiva, sem emojis | ✅ | `services/ai-service.ts` |
| Sem rosto — comunicação pelo núcleo | ✅ | Parte 8 |
| Cinco estados (ocioso, ouvindo, processando, respondendo, erro) | ✅ | `CORE_MODES` |
| Janela com histórico | ✅ | Conversas, não uma lista solta de mensagens: fixar, exportar em Markdown, favoritas, regenerar a última resposta e categorias por tempo (Fixadas, Hoje, Ontem, Últimos 7 dias, Mais antigas). **MSG_LIMIT = 200 por conversa (11/08/2026)** — a primeira mensagem nunca cai (é o título), as restantes mais antigas saem ao fim de 200. Impede crash com histórico muito grande (persistência, serialização e mapeamento de estado cresciam sem limite). **Revisto a sério (DeepSeek, 14/08/2026), um bug real corrigido**: três mutadores mexiam em estado que é gravado sem chamar `persist()` — `removeMessage`, `rewindToPrompt` e `selectConversation` — ao contrário de todos os outros. Resultado observável: a mensagem vazia que o `removeMessage` existe para tirar (uma linha em branco de uma ronda só-ferramentas) reaparecia ao reiniciar, e a app reabria na última conversa persistida em vez da escolhida. Corrigido com `persist()` nos três. 3 testes novos (`tests/assistant/assistant-store-persist.test.ts`), confirmados a falhar contra o código antigo. Resto confirmado limpo: título só do primeiro pedido do utilizador, `MSG_LIMIT` mantém a primeira mensagem, as fixadas e a ativa nunca caem do limite de conversas, `hydrate` assenta o cursor a piscar de respostas a meio e cai num `activeId` válido |
| Digitação letra a letra | ✅ | `use-typewriter.ts` |
| Comandos naturais compreendidos | ✅ | Com a DeepSeek ligada, **o modelo escolhe as ações** de um catálogo de 30 ferramentas, e encadeia-as: um pedido pode abrir uma janela, criar uma tarefa e mudar de tema de uma vez. Sem modelo, continua o interpretador de padrões |
| Fala por frase, à medida que a resposta chega | ✅ | **Bug real, reportado ao vivo pelo utilizador, 14/08/2026**: o pedido `ask` (voz → assistente) só chamava `speak()` depois de `aiService.send()` resolver por inteiro — o texto aparecia todo no ecrã antes de se ouvir uma palavra. `aiService.send()` ganhou um `onChunk` opcional, chamado em paralelo ao `appendToMessage` (incluindo nos três caminhos de recuperação de falha — troca de provedor, nota, queda para o local — para não regredir o que já se falava antes nesses casos). `services/voice/sentence-segmenter.ts` (`extractSentences`, função pura) corta o buffer acumulado em frases fechadas (`.`/`!`/`?`, uma ou repetidas, seguidas de espaço ou fim), sem partir abreviaturas comuns ("Sr.", "n.º", "etc."). `useVoice()` ganhou `speakQueued` — `voiceService.speak()` cancela qualquer fala em curso ao ser chamado (falas sobrepostas ficam impercetíveis), por isso uma fila local só passa a frase seguinte depois do `onEnd` da anterior, nunca em paralelo. 12 testes novos (9 do segmentador, 3 da fila via `renderHook`). **Revisto a sério (DeepSeek, 14/08/2026), dois bugs reais corrigidos**: (1) a meio do stream, pontuação mesmo no fim do bocado era tratada como fim de frase — `extractSentences` ganhou um flag `final` (o `ask` passa `false` até ao fim), para "3.14"/"14.30"/domínios cortados entre dois bocados não partirem a frase a meio; (2) a fila por frases nunca era esvaziada — `stopSpeaking()` (segundo plano) ou uma `speak()` avulsa calavam só a frase a tocar, e o `onEnd` dela avançava a fila, falando o resto já sem contexto (ou atropelando a fala avulsa). Novo `limparFilaDeFala`, chamado pelo `speak()`, ao ir para segundo plano e no arranque de um `ask` novo (que também numera os pedidos, para o fim de um streaming cancelado não falar frases atrasadas). 5 testes novos. **Pista deixada pelo utilizador, não seguida nesta peça**: `RealtimeTTS`/`RealtimeSTT` (mesma base `coqui-tts`/`whisper` que o `voice-clone-service/` já usa) podem dar para sintetizar por frase do lado do serviço Python em vez de só cortar do lado do TypeScript — vale a pena olhar depois. **Item 18 (reportado ao vivo, 14/08/2026): a resposta na janela normal do assistente nunca falava** — a fala por frase só estava ligada ao caminho dos comandos por voz (`ask`), não ao `sendWithTools`/`AssistantWindow.tsx`, onde acontece a maior parte da conversa. `sendWithTools` ganhou o mesmo `onChunk` opcional do `send` (enfiado nas rondas de ferramentas e nos caminhos de recuperação/queda), e `AssistantWindow` liga-o a `extractSentences`+`speakQueued`+`limparFilaDeFala` com contador de geração, igual ao `ask`. Decisão de desenho documentada: falar sempre que a resposta chega (a pessoa reportou o silêncio como problema, e é o mais parecido com conversa real); não há hoje um interruptor "falar respostas" separado — adicioná-lo saía fora deste item pequeno. 4 testes novos (2 ficheiros) |
| Memória local (preferências, últimos comandos) | ✅ | `services/assistant/memory-service.ts` — só guarda o que for dito por palavras ("trata-me por…", "moro em…"). Deduzir preferências do resto da conversa seria inventar sobre uma pessoa e depois usá-lo como verdade. **13/08/2026**: já não guarda o contrário do que foi dito ("não gosto de café" não vira "preferes café") nem arrasta o resto da frase para o valor ("moro no Porto desde 2019" guarda "Porto", e um segredo dito a seguir não fica na memória) |
| **Vault Obsidian — memória persistente a sério (Peça 17, 13/08/2026)** | ✅ | `services/knowledge/obsidian-service.ts` + `src-tauri/src/commands/obsidian.rs`. Ao lado da memória de preferências (acima) — aqui é a pessoa quem escreve, no seu próprio vault; o assistente procura, lê e (com confirmação) escreve. Padrão do Explorador/Música: pasta declarada, raiz própria (não acoplada às outras), nunca sai dela — mas com uma diferença: os caminhos que a interface recebe e envia são sempre **relativos** à raiz (`Diário/2026-08-13.md`, não o caminho absoluto do disco), rejeitados por componente (`..`, raiz absoluta) antes de qualquer chamada ao sistema de ficheiros, não só depois por `canonicalize`. Listagem recursiva (até 12 níveis, pastas ocultas do próprio Obsidian como `.obsidian` ignoradas) — ao contrário da música, que é uma pasta só. Três ferramentas novas no catálogo do assistente: `procurar_nota` (título, parcial, sem acentos), `ler_nota` (devolve o conteúdo — a própria resposta do modelo), `guardar_nota` (cria ou substitui, **pede confirmação** porque substituir apaga o que lá estava; o título vira o nome do ficheiro, sanitizado, sempre no topo do vault — subpastas só por quem organiza o vault à mão, não pela ferramenta). Cache de título+caminho em memória (nunca o conteúdo, nunca o vault inteiro de uma vez), relido ao escolher o vault e depois de cada escrita. Configuração em Personalização, sem chave nem conta — só um caminho, tal como a música. **Exigiu tornar `runTool`/`perform` assíncronos** (`tool-runner.ts`) — as 25 ferramentas anteriores eram todas síncronas por dentro; `ler_nota`/`guardar_nota` precisam de esperar mesmo por uma leitura/escrita no disco antes de responder ao modelo, o que um "disparar e não esperar" (o padrão que `controlar_musica` já usava) não serve quando o conteúdo lido **é** a resposta. Quatro pontos de chamada ajustados (`ai-service.ts`, `CommandConsole.tsx`, `AiWidget.tsx`) — mecânico, sem mudar o que as 25 ferramentas antigas fazem. **Bug real encontrado e corrigido de caminho**: `secretSet`/`secretDelete` (`tauri-adapter-base.ts`, usados pelo Cofre de segredos e pelo WebAuthn) comparavam o resultado do comando Rust contra `null` para saber se tinha corrido bem — mas um `Result<()>` do Rust serializa para `null` em JSON, o mesmo valor do `fallback` de erro; sucesso e falha eram indistinguíveis. Corrigido para distinguir por não ter lançado, não pelo valor devolvido. `tsc` limpo, `eslint` 0 erros, `cargo check`/`cargo clippy` limpos (Linux, sem hardware Windows — ver nota abaixo), suite completa com testes novos para o serviço, a store/UI e as três ferramentas. **Não confirmado ao vivo**: sessão sem hardware Windows — nunca correu contra um vault Obsidian real, nem contra o Rust em Windows especificamente (só compilado e testado no alvo Linux desta máquina, código sem nada específico de Windows). **Revisão de segurança a sério, 13/08/2026: bug real encontrado e corrigido** — `obsidian_write_note` só canonicalizava a pasta-mãe do alvo, nunca o ficheiro final; uma nota que já existisse como link simbólico a apontar para fora do vault era escrita através do link (`fs::write` segue links por omissão), sem a verificação de fronteira alguma vez dar por isso. Corrigido com `symlink_metadata` a recusar escrever num alvo que já é um link. `obsidian_read_note` já estava protegido (canonicaliza o próprio ficheiro). Nunca tinha havido um teste Rust dedicado a este ficheiro — 6 testes novos, com pastas temporárias a sério, incluindo os dois casos de link simbólico; confirmei que o teste do bug falha sem a correção e passa com ela. Ver `docs/log/historico-sessoes.md` |
| **Navegador controlado pelo assistente (Peça 19, 13/08/2026)** | ✅ | `services/knowledge/web-browser-service.ts` + `src-tauri/src/commands/browser.rs`. Categoria de risco diferente da meteorologia/notícias/email (fontes fixas, conhecidas): aqui é rede real a sítios arbitrários. **Desligado por omissão**, interruptor explícito em Privacidade → Acesso (mesmo padrão do Controlo Direto, Fase 3.1), com aviso persistente ao lado do interruptor e uma notificação de primeira ativação (gate por `sessionStorage`, mesmo padrão do modo conversa em `use-voice.ts`). Ferramenta `abrir_pagina(url)`: busca uma página `https` (comando Rust, `ureq` síncrono + `native-tls`, não `fetch()` da interface — a CSP é uma lista fechada de anfitriões conhecidos, nunca "qualquer sítio", e mesmo que fosse, CORS bloquearia a maioria dos sítios do lado do browser de qualquer forma), extrai o texto visível com `scraper` (script/style/noscript excluídos **antes** de qualquer texto ser lido, não só escondidos visualmente — testado com um caso dedicado), corta a 8000 carateres. O que volta à interface nunca é HTML, nunca é algo que corra — é sempre texto. O serviço embrulha esse texto num delimitador explícito ("--- CONTEÚDO EXTERNO, NÃO CONFIÁVEL … --- FIM DO CONTEÚDO EXTERNO ---") antes de o devolver ao modelo, reforçando a linha já acrescentada ao prompt de sistema para a Peça 18 (pesquisa web) — mesma decisão de fundo: resultados de pesquisa e texto de páginas são **dados**, nunca instruções, mesmo que o conteúdo pareça pedir algo diretamente ("ignora as instruções anteriores…"). Testado explicitamente: o texto continua lá dentro do delimitador (não se filtra o conteúdo, só se marca), nunca é interpretado como chamada de ferramenta. **Excluído desta peça, de propósito**: clicar, preencher formulários, navegar por conta própria, executar JavaScript da página — controlo direto sobre um agente autónomo na web é categoria de risco da Fase 3, não desta. Auditoria: cada página aberta (sucesso ou recusa) fica registada via `logService.audit`. `tsc` limpo, `eslint` 0 erros, `cargo check`/`cargo test` limpos (5 testes Rust dedicados: título/texto simples, exclusão de script/style/noscript, título por omissão, truncagem, `https` obrigatório), suite completa com testes novos para o serviço, a store, a ferramenta e a cobertura do catálogo. **Não confirmado ao vivo**: `cargo check`/`cargo test` correram mesmo em Windows nesta sessão, mas a aplicação Tauri não chegou a arrancar nem a abrir uma página `https` real — só testes automatizados (unitários Rust e `vitest` com o adaptador simulado). **Revisão de segurança a sério, 13/08/2026: SSRF real encontrado e corrigido** — o comando só confería o esquema (`https://`), nunca o anfitrião; `https://localhost/`, um IP privado (`192.168.x.x`), ou o endereço de metadados de nuvem (`169.254.169.254`) passavam como qualquer outro pedido, e um endereço público podia redirecionar (`3xx`) para dentro e contornar qualquer verificação futura no próprio endereço pedido. `is_blocked_host()` (crate `url`, já vinha transitivo do `ureq`) recusa `localhost`, loopback, redes privadas, link-local (IPv4 e IPv6, incluindo endereços IPv4 mapeados em IPv6), e o agente do `ureq` passou a `redirects(0)` — um `3xx` é recusado explicitamente. 8 testes Rust no total (eram 5), incluindo 18 casos de anfitriões bloqueados. Ver `docs/log/historico-sessoes.md` |
| Contexto (data, hora, clima, janelas abertas, notificações) | ✅ | `services/assistant/context.ts` — a data por extenso ("Hoje é terça-feira, 11 de agosto de 2026") passou a entrar no prompt do sistema (**11/08/2026**), para o modelo saber o dia sem adivinhar. O tema chegava por identificador (`oled`) em vez de nome (`OLED Black`), a mesma família de defeito das automações e da voz — corrigido com `lib/names.ts` em `App.tsx` |
| **Provedor de IA real** | ✅ | **DeepSeek ligada.** `deepseek-provider.ts` — API compatível com a da OpenAI, streaming pedaço a pedaço, cancelável. Trocar de provedor é uma linha; nenhum componente muda. A chave é escrita pelo utilizador na Personalização e fica no dispositivo |
| Anexos: imagens, PDF, áudio, vídeo | ✅ | Tipo `Attachment` partilhado, `AttachmentList`, diálogo nativo + browser. Emails (leitura + composição), Tarefas (adicionar/remover), Projetos (leitura). **Revisão a sério da camada de plataforma (`src/platform/`, ~1586 linhas), 14/08/2026 — um bug real, corrigido**: `pickAttachmentsNative` (`platform/attachments.ts`, o caminho nativo dos anexos do email) lia os bytes **inteiros** de qualquer imagem para a memória para construir a miniatura, sem teto de tamanho — ao contrário dos caminhos gémeos `readBrowserFile` e `attachViaNativeDialog`, que ambos cortam em 5 MB. Escolher uma fotografia de centenas de MB esgotava a memória só para uma miniatura de 32 px. Ganhou o mesmo teto de 5 MB (`MAX_PREVIEW_BYTES`); acima dele o anexo continua válido, só fica sem miniatura (o ícone de clipe), igual aos outros caminhos. 3 testes novos (`tests/platform/attachments.test.ts`, que até aqui não cobria `pickAttachmentsNative`), confirmados a falhar contra o código antigo. Resto da camada confirmado limpo: cofre de segredos (`secretSet`/`secretDelete` distinguem sucesso por não lançar; `secretGet` devolve `null` em erro como degradação de propósito — coberto por `tests/platform/secret-vault.test.ts`), `openExternal` com dupla barreira (lista de esquemas + capability Rust), ciclo de vida das blob URLs (criadas em `attachments.ts`, revogadas no composer — sem fuga), `getTopProcesses` com `limit` opcional (o Rust trata `Option`), storage a preservar falsos por `??`, e os consumidores WebAuthn a falhar para o lado seguro quando o cofre falha |

> **O `RuleProvider` responde a sério ao que sabe** — hora, data, meteorologia,
> janelas abertas, notificações por ler, estado, tema e memória. Ao que não
> sabe, diz que não tem modelo ligado em vez de improvisar uma frase que soe
> bem. O antigo `MockProvider`, que respondia sempre as mesmas quatro frases
> fossem quais fossem as perguntas, foi substituído por isto.
>
> **Exportar descarrega para a pasta de transferências.** Escolher o destino
> exige o plugin `dialog` — bloqueado, ver §2.

---

## Parte 7.2 — Voz, agentes e copiloto

| Item | | |
|---|:--:|---|
| Reconhecimento pela Web Speech API | ✅ | `services/voice-service.ts`. **Confirmado partido no WebView2** (09/08/2026, RTX 5070): não é só "falha silenciosamente" — o microfone liga (`onaudiostart` dispara), e depois nunca mais dá sinal nenhum, nem resultado, nem erro, nem sequer o fim do reconhecimento. Testado a sério por CDP (`webkitSpeechRecognition` isolado, `getUserMedia` a funcionar, permissão concedida) antes de se mexer em código nenhum — não é suposição. **O arranjo:** `voice-clone-service/` ganhou `POST /ouvir` (Whisper, mesmo `torch`+CUDA já instalado para o XTTS-v2) — `voice-service.ts` grava com `MediaRecorder` (isto funciona no WebView2) e manda transcrever, sempre que o serviço local estiver a correr; o nativo do motor fica como segunda opção, para quem não o tiver a correr (ou no browser/Android, onde pode servir). Testado ponta-a-ponta: um `.wav` com fala real em português voltou como texto correto. Um relógio de segurança (9s) força o fim do nativo caso ele fique preso — para nunca mais deixar o núcleo em "a ouvir" para sempre, mesmo sem o serviço local a correr. **Carregamento lazy do Whisper (11/08/2026)**: o modelo só carrega na primeira chamada a `/ouvir`, nunca no arranque do serviço — se a GPU não tiver memória para o Whisper e o XTTS-v2 ao mesmo tempo, a síntese continua a funcionar sozinha |
| Eco acústico — o microfone a ouvir a própria voz do JARVIS | ✅ | **Bug real, apanhado por um utilizador em uso real, 10/08/2026** — não reproduzido com um microfone falso (esse nunca ouve o que toca nas colunas), mas confirmado com áudio a sério e CDP: a meio de `speak()`/`speakClonada()` a gerar ou a tocar áudio, `toggleListening()` deixava ligar o microfone à mesma — havia uma janela (o pedido de rede à voz clonada, que pode demorar segundos) onde nada o impedia. `voice-service.ts` marca "a falar" já no início de `speak()` — antes de sequer se pedir o áudio ao serviço local, não só quando ele começa a tocar — e mantém o microfone bloqueado até `SPEAK_GUARD_MS` (900ms) depois de a voz acabar, para o eco na sala não ser ouvido como um pedido novo. `toggleListening()` recusa com o motivo `'a-falar'` nessa janela, em vez de deixar gravar por cima. Confirmado ao vivo: um clique no microfone a meio de "Testar" uma voz ficou mesmo por ligar. **Barge-in, 14/08/2026 (pedido ao vivo)**: o guard `'a-falar'` passou a valer só para o re-engate *automático* do modo conversa — carregar no microfone à mão agora interrompe a fala (`stopSpeaking`) e liga a escuta já, via `bargeIn()`, em vez de devolver o erro e obrigar a esperar a resposta acabar. `isSpeaking` (sem o período de guarda) distingue "a tocar" de "em guarda de eco". **Revisão a sério do `speak()` por SpeechSynthesis (DeepSeek, 14/08/2026): bug real corrigido** — o `speak()` promete "`callbacks.onEnd` dispara sempre", mas `stopSpeaking()` nunca o disparava: o `pause()` do áudio clonado não dispara `onended`, e o `cancel()` da síntese "nem sempre" dispara nada. Quem usa `onEnd` para mudar de estado (o núcleo do assistente, `use-voice.ts`) ficava preso em "a falar" para sempre ao interromper a fala a meio. O `speak()` embrulha agora o `onEnd` num fecho idempotente guardado em `activeSpeechEnd`, e o `stopSpeaking()` dispara-o; 3 testes novos |
| Escolha de voz de síntese | ✅ | `VoiceSettings.tsx` — lista as vozes portuguesas já instaladas no sistema (as "Natural" do Windows, por exemplo) e deixa escolher e testar cada uma. Não é clonagem nem API paga: só o que já existe na máquina |
| Voz clonada local (a própria voz, via XTTS-v2) | ✅ | `voice-clone-service/` — serviço Python à parte (a mesma relação que o Ollama tem com a app). **Confirmado a sério numa RTX 5070 (09/08/2026)**: `/falar` devolve áudio real com a voz gravada em `voices/referencia.wav`. Precisou de três correções só visíveis no Windows — FFmpeg fixado à versão 4–8 (o `winget` instala a mais recente, incompatível), `os.add_dll_directory` porque o Python 3.8+ deixou de usar a PATH para DLLs, e o PyTorch reinstalado contra `cu130` (a RTX 5070/Blackwell não tinha kernels no `cu126` inicial) — todas em `voice-clone-service/README.md`. `setup.ps1`/`run.ps1` automatizam o resto. Também traz `GET /vozes`, uma curadoria de 8 vozes já gravadas por atores que autorizaram o uso, distribuídas com o próprio XTTS-v2 — sem clonar ninguém, para quem só quer uma voz melhor sem gravar nada. Só a voz de quem usa o sistema, ou uma destas prontas — nunca a de terceiros sem autorização. **Ligado a `voice-service.ts`** (`VoiceSelection`, sub-fase 4.3): `VoiceSettings.tsx` (Personalização → Voz) mostra "A minha voz" e as vozes prontas ao lado das vozes do sistema, quando o serviço está a correr em `127.0.0.1:8090` — CSP do Tauri atualizado (`connect-src`, `media-src blob:`). **Gravação dentro da própria interface (sub-fase 4.2), confirmada 10/08/2026**: o botão "Gravar a minha voz", em Personalização → Voz, grava até 12s com `MediaRecorder` (a mesma técnica do reconhecimento local), com contagem decrescente e um "parar e enviar" para quem termina antes; manda para `POST /voz`, que agora aceita qualquer formato que o `ffmpeg` decodifique (o `.webm`/Opus do browser, não só o `.wav` à mão de antes) e converte sempre para PCM mono, o formato que o XTTS-v2 espera. Testado a sério, não só nos testes automatizados: gravei pela interface e `voices/referencia.wav` mudou na hora. **Arranque automático do serviço (sub-fase 4.4), confirmado 10/08/2026**: `src-tauri/src/voice_clone.rs` — a app tenta a porta 8090 no arranque, e só chama `.venv\Scripts\python.exe -m uvicorn` sozinha se não houver lá nada a ouvir já (nem outro correr à mão, nem outra instância). Mata o processo filho ao fechar a janela — confirmado com um fecho normal (não um "matar já"), o processo do Python saiu com a app. Sem `.venv` instalado nesta máquina, desiste em silêncio: nunca impede o arranque da app. Um bug real apanhado ao testar a sério, não hipotético: `os.add_dll_directory` do lado do Python recusa caminhos relativos (`WinError 87`) — a pasta do serviço tem de chegar já canonicalizada. Só desktop — não faz sentido em Android, onde não há `.venv` nenhum a instalar. Desenho em [`docs/spec/voz-clonada-local.md`](docs/spec/voz-clonada-local.md). **Revisão a sério do consentimento explícito (13/08/2026)**: gap real encontrado e corrigido — `server.py` tinha CORS aberto a qualquer origem (`allow_origins=["*"]`), o que deixava qualquer página aberta em qualquer separador do browser, nada a ver com o JARVIS, chamar `POST /voz` e substituir `referencia.wav` por um áudio à escolha dela, sem a pessoa dar por nada; a única barreira de consentimento vivia na convenção da interface (gravar pelo microfone), nunca aplicada no único sítio que decide o que fica guardado. Restrito por `allow_origin_regex` às origens reais do JARVIS — confirmado só contra a porta de desenvolvimento (`http://localhost:1420`), os esquemas de produção do WebView não foram confirmados contra uma build empacotada a sério. Resto do fluxo confirmado limpo: o único caminho que manda áudio para `/voz` é `recordVoiceSample` via `getUserMedia` (sem seletor de ficheiro em lado nenhum do projeto para esse fim), e nenhuma ferramenta do catálogo do assistente (`tools.ts`) consegue gravar ou clonar — só `ler_em_voz_alta` (falar um texto já sintetizado). **Revisão a sério da síntese e reprodução no lado cliente (DeepSeek, 14/08/2026)**: o `speakClonada` nunca tinha sido revisto (só o consentimento/CORS, item 12). Dois buracos reais no caminho de falha, corrigidos: se `audio.play()` recusasse (autoplay, áudio ilegível) a blob URL acabada de criar ficava órfã até a página fechar; e se o `fetch /falar` falhasse com uma fala anterior a tocar, essa fala continuava a soar já sem o microfone guardado (a `onSpeechEnd` já o libertara). O `catch` agora para o áudio anterior e revoga a sua URL. 2 testes novos (`tests/voice/voice-clone-synthesis.test.ts`) |
| Limpeza do texto antes de sintetizar | ✅ | **Bug real, confirmado 10/08/2026 com áudio a sério** (`/falar` → `/ouvir`, não só a ler código): um texto curto isolado como "Bom dia." sai do XTTS-v2 como "Bom dia. Ponto." em cerca de 1 em 4 gerações — o modelo, sem texto a seguir para lhe dar contexto, por vezes lê o ponto final à letra em vez de o tratar como fim de frase. `limparParaSintese` (`voice-service.ts`, chamado por `speak()` antes de escolher a voz — vale para a clonada e para a do sistema) tira o ponto final e troca reticências (`...`/`…`) por vírgula. **Alargado 14/08/2026 por pedido ao vivo ("deixe de ler os pontos")**: agora **todo** o ponto vira vírgula (pausa mantida, sem risco de ser vocalizado) — já não só o final; os pontos a meio de uma resposta com várias frases num só `speak` também arriscavam ser lidos. Confirmado o arranjo com 9 gerações seguidas sem "ponto" nenhum (contra 1 em 4 antes). **Achado à parte, não arranjado aqui**: o XTTS-v2 tem uma taxa de fundo de alucinação em texto mais longo — sílabas ou palavras soltas a mais, por vezes no fim do áudio — que acontece com ou sem o ponto final, e que uma limpeza de texto não resolve; é uma característica do modelo, não um bug de formatação |
| Indicador de estado no header | ✅ | |
| Wake word configurável | ⬜ | Exige escuta contínua — decisão de privacidade por tomar |
| Pipeline completo (ruído, silêncio, idioma, planeamento) | ✅ | Transcrição → intenção → execução → síntese, confirmado 10/08/2026. **Ruído**: `POST /ouvir` já não confia num texto sem mais nada — `no_speech_prob`, que o próprio Whisper devolve por segmento, filtra a alucinação conhecida do modelo em áudio só com ruído (ex.: inventar "Obrigado por assistir" do nada); testado a sério com 3s de silêncio puro, veio `texto: ""`. **Silêncio**: `vigiarSilencio` em `voice-service.ts` — um `AnalyserNode` da Web Audio API mede o volume a cada 100ms e para a gravação sozinha depois de fala a sério seguida de silêncio sustentado, em vez de esperar sempre o limite de segurança (12s); testado com temporizadores controlados, não só por olhar o código. **Idioma**: `/ouvir` aceita `idioma` como `/falar` já aceitava (por omissão "pt") — não há escolha de idioma na interface (é uma app só em português), é só simetria entre os dois endpoints. **Planeamento**: já coberto por peças que já existiam — os comandos compostos de `services/voice/intents.ts` (Parte 10) e o encadeamento de ferramentas da DeepSeek (Parte 7.1); nenhuma peça nova fazia falta aqui. De caminho, corrigido um bug real: parar a escuta à mão (voltar a carregar no botão) deixava de chamar `onEnd` — o núcleo ficava preso em "a ouvir" para sempre. Confirmado com `MediaRecorder` real através de CDP; a deteção de silêncio em si não se conseguiu cronometrar ao vivo — o `--use-file-for-fake-audio-capture` do Chromium repete o ficheiro em loop, nunca produz silêncio a sério — mas o resultado chegou correto à memória do assistente na mesma |
| Agentes especializados | ✅ | **Decidido 10/08/2026: não vale a pena, para já** — um só agente, com 30 ferramentas sobre o sistema inteiro (contagem corrigida de novo, 13/08/2026 — subiu para 30 com a Peça 19, navegador controlado; antes disso a nota já tinha passado de 21 para 23, 28 e 29). Razão numa frase: 30 ferramentas é pouco para um modelo de tool-calling lidar de uma vez (sem sinal nenhum de confusão nos testes existentes), o pedido típico já atravessa "domínios" à vontade — "abre as tarefas e cria uma para amanhã" mistura janelas e produtividade — e especializar exigia um encaminhador a decidir qual agente, mais orquestração entre agentes para repor o encadeamento que já funciona sozinho hoje (Parte 7.1 §Comandos naturais), tudo isso sem nenhum problema visível a resolver. Reabre-se se o catálogo crescer a sério (dezenas de ferramentas por integrações de plugins a sério, por exemplo) ou se aparecer confusão real entre ferramentas parecidas — nenhum dos dois é o caso hoje. **Revisão a sério do catálogo e do executor (DeepSeek, 14/08/2026)**: `tools.ts` + `tool-runner.ts` lidos como um todo, nunca revistos por ninguém de fora (só mudanças pontuais — prazo, SSRF, link simbólico). Um bug real, corrigido: `mudar_de_desktop` só validava o tipo (`number`), não o intervalo nem a integridade — um modelo a inventar "desktop 99" (ou 2.5) chegava a `switchTo`, que guarda `current` sem confirmar que o id existe, e corrompia o estado do ambiente (persistido). O parâmetro ganhou `minimum`/`maximum` (derivados de `DESKTOP_IDS`), a validação passou a recusar números fora do intervalo ou fracionários, e o esquema JSON agora diz ao modelo o intervalo. 4 testes novos. O resto confirmado limpo: as 30 ferramentas têm execução, a validação de tipos/opções trava tudo antes do executor, as 5 destrutivas pedem confirmação, e a auditoria regista o que corre e o que falha |
| AI Orchestrator | ✅ | Seleção automática de modelo (dentro da DeepSeek), regras de fallback, e agora **cadeia entre provedores** — DeepSeek, Claude e Ollama, cada um com a sua chave/endereço na Personalização, escolha automática do próximo quando o ativo fica sem saldo, sem chave ou de rastos, sempre com aviso. Verificado num Chromium real: guardar duas chaves mostra "Se o DeepSeek falhar… tenta sozinho o próximo provedor". **Ferramentas, Peça 12 do Lote 3 (13/08/2026): já não são só da DeepSeek.** `sendWithTools` (`ai-service.ts`) aceita agora a Ollama também — `isToolCapable()` deixa passar a DeepSeek sempre, e a Ollama quando `OllamaProvider.supportsToolCalling()` disser que sim (o nome do modelo bate com uma família conhecida por suportar `tools`: qwen, llama3.1+, mistral/mixtral, firefunction, command-r — ver a lista e o aviso de que é um palpite informado, não uma garantia, em `ollama-provider.ts`). `OllamaProvider` ganhou um `run()` igual em espírito ao da DeepSeek, reaproveitando o `collect()` já existente (mesmo protocolo compatível com a OpenAI) em vez de duplicar o parser. **Confirmado a sério** contra um Ollama real nesta máquina (`qwen3:8b`): um pedido cru por `Invoke-RestMethod` devolveu `tool_calls` corretos para a ferramenta `notificar`; em modo `stream:true`, confirmou-se que o "pensamento" do qwen3 chega em `delta.reasoning` (não `delta.content`) e por isso nunca aparece na resposta — o mesmo filtro que já existia para o `reasoning_content` da DeepSeek, sem precisar de mudança nenhuma. 30 testes novos (`tests/assistant/ollama-provider.test.ts`, `tests/assistant/send-with-tools-ollama.test.ts`), incluindo o caso de um modelo sem ferramentas conhecidas (`llama2`) nunca mandar o campo `tools` e cair para um envio normal. O tecto de 60s antes de desistir e cair para o próximo da cadeia (ver a confirmação de 10/08/2026 já aqui) é herdado sem mudança — `run()` usa o mesmo `TIMEOUT_MS`. Ver Parte 12 e [`docs/spec/orquestrador-multi-provedor.md`](docs/spec/orquestrador-multi-provedor.md). **Ollama ligado à janela de definições, confirmado 10/08/2026**: `AiSettings.tsx` já tinha o endereço base editável; faltava escolher o modelo — agora tem um campo para o nome do modelo e um botão "Detetar" que pergunta a `GET {endereço}/api/tags` que modelos já estão instalados e mostra-os como chips clicáveis, sem obrigar a decorar o nome exato. Testado a sério com o Ollama a correr na máquina (`qwen3:8b`): a app manda pedidos reais para `http://localhost:11434/v1/chat/completions`; a primeira resposta (modelo ainda frio, a carregar pela primeira vez) excedeu os 60s e a cadeia caiu corretamente para o próximo provedor, com aviso; com o modelo já quente (`ollama run` prévio), a mesma pergunta pela interface teve resposta certa do Ollama dentro do tempo. Dois comentários no código (`ollama-provider.ts`, `claude-provider.ts`) diziam "não ligado à janela de definições" — já estava desatualizado, ambos corrigidos. **Revisão independente a sério (13/08/2026)**: linha a linha, as cinco perguntas de revisão respondidas — os testes chamam funções reais (não reinventam o parser do `collect()`); o `startsWith()` dos prefixos é seguro na prática (acrescentar separador partiria a família `qwen`, e o único caso marginal, `mistral-embed`, não é um modelo de conversa); o `recover()` a usar sempre `stream()` (nunca `run()`) é pré-existente, confirmado por `git show`; o `collect()` reaproveitado não tem nenhum pressuposto específico da DeepSeek que não bata com a Ollama (lê só `delta.content`/`delta.tool_calls`, acumula por índice, interpreta o JSON no fim); e nenhum caminho deixa um pedido pendurado (o tecto de 60s cobre tudo). **Nada de funcional a corrigir** — só um comentário desatualizado no `catch` do `sendWithTools` (dizia "o provedor é a DeepSeek", agora também é a Ollama), corrigido. **Ferramentas para o Claude, Peça 20 (13/08/2026)**: última peça pendente do orquestrador — `ClaudeProvider.run()`, o mesmo contrato que a DeepSeek e a Ollama já tinham, agora também capaz de pedir ferramentas (`isToolCapable()` deixa passar sempre). O formato da Anthropic não tem equivalente direto ao `tool_calls`/`role:'tool'` da OpenAI — um pedido de ferramenta é um bloco `tool_use` dentro da própria mensagem `assistant`, a resposta é um bloco `tool_result` dentro da mensagem `user` seguinte, e os argumentos chegam espalhados por vários eventos `input_json_delta` — por isso `toAnthropicMessages()` traduz o formato genérico que `ai-service.ts` usa para qualquer provedor, e `collectClaudeStream()` acumula os blocos por índice antes de interpretar o JSON, a mesma disciplina do `collect()` da DeepSeek. `toolsAsAnthropicSchema()` gera o catálogo `{name, description, input_schema}` a partir da mesma lista `TOOLS`, sem segunda cópia a divergir. 9 testes novos: 5 unitários em `collectClaudeStream` (incluindo dois `tool_use` em paralelo sem se misturarem, e JSON que nunca fecha a perder-se em vez de rebentar), 1 no esquema Anthropic, 3 num ciclo completo de `sendWithTools` (`tests/assistant/send-with-tools-claude.test.ts`). Suite completa: 120 ficheiros, 1621 testes. Ver `docs/spec/orquestrador-multi-provedor.md` §6. **Não confirmado ao vivo** — sem chave da Anthropic disponível nesta sessão remota para testar contra o servidor real. **Mensagem específica para modelo Ollama não instalado (13/08/2026)**: um novo `AiFailureKind` (`'modelo'`) distingue um 404 por modelo em falta (`{"error":{"type":"not_found_error"}}`, a forma real que o Ollama devolve — confirmado ao vivo contra um servidor a correr nesta máquina) do genérico de servidor; qualquer outro 404 continua a cair no genérico. `ollama-provider.ts` ganhou `ollamaFailure()`, chamada nos dois pontos (`run`/`stream`) que antes usavam sempre `failureFromStatus`. 3 testes novos (o caso novo, um 404 de outra forma, e um corpo sem JSON válido que não rebenta). **Reordenar a cadeia (13/08/2026):** a ordem deixou de ser fixa — `AiSettings.providerOrder` guarda a preferência, editável em Personalização → Assistente (lista numerada com setas para cima/baixo), e `applyAiSettings` lê essa ordem em vez da antiga constante `CHAIN_ORDER`, que desapareceu. Sem preferência guardada, cai na ordem por omissão (DeepSeek, Claude, Ollama). 4 testes novos. **Revisto a sério como um todo (DeepSeek, 14/08/2026), um bug real corrigido**: o fim de um `send()`/`sendWithTools()` cancelado corria por cima do pedido novo — repunha o modo a "idle" e fazia `this.controller = null` já depois de o pedido novo ter tomado o controller (o prólogo do pedido novo é síncrono; a limpeza do cancelado é um microtask). Resultado observável: um terceiro pedido deixava de conseguir cancelar o segundo, e duas respostas passavam a escrever na conversa ao mesmo tempo. Corrigido com um guarda por identidade do controller (`this.controller === controller`) em cada ponto de limpeza (`send`, `sendWithTools` — rede bloqueada, `catch` e fim — e na troca de provedor do `recover`), preservando a reposição a "idle" do cancel a solo (controller a `null`). 1 teste novo (`tests/assistant/abort-race.test.ts`), confirmado a falhar contra o código antigo. Resto confirmado limpo: `TOOL_ROUNDS` limita o ciclo, mensagens vazias de rondas só-ferramenta são removidas, a máquina de modos não tem transição ilegal, e o `recover` nunca cai para o local em silêncio. **Revista a sério a camada de provedores em si (`src/services/ai-providers/`, 1512 linhas) como um todo (DeepSeek, 14/08/2026) — nada de funcional a corrigir.** Confirmado limpo: a cadeia (`provider-chain.ts`) só contém provedores configurados com nomes estáveis e únicos (por isso `nextStep` nunca procura um nome ausente); a escolha de modelo (`model-choice.ts`) trata acentos, blocos de código, prompts longos e os dois sentidos de mudança; cada provedor tem teto de 60s, aborto e erro tipado; os parsers de streaming acumulam argumentos de ferramenta por índice e deixam cair JSON malformado em vez de o executar a meio. **14/08/2026 (pedido ao vivo)**: o teto do Ollama desceu de 60s para 20s — uma falha de rede do Ollama é imediata, e quem chegava ao timeout era o Ollama *preso*, em que ficar 60s calado antes de cair para a DeepSeek era o sintoma de "não funciona e não diz nada". O único caminho sem teste — `collect()` (a acumulação de ferramentas da DeepSeek) — ganhou 5 testes novos (`tests/assistant/deepseek.test.ts`). Duas observações que não chegam a bug, anotadas para não se reverem: `firstInChain` está exportado e testado mas nunca é chamado em produção (`setChain` usa o equivalente `chain[0]`); e depois de uma exaustão completa o provedor ativo não volta ao primeiro (comportamento em `ai-service.ts`, já revisto como item 15 — pode ser intencional). Detalhe em `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: a cadeia de provedores de IA") |
| Modo copiloto (sugestões discretas) | ✅ | `services/assistant/copilot.ts`, no widget de IA. **Cada sugestão parte de uma contagem e propõe uma ferramenta que já existe** — tarefas fora do prazo, tarefas de hoje, janelas a mais. Nenhuma é uma frase de encorajamento, e um teste percorre-as a exigir que o facto tenha um número e que a ferramenta aceite os argumentos. O ficheiro lista o que ficou de fora e porquê: notificações por ler (já está no ecrã), estado pela carga do processador (no browser a métrica é simulada), hora tardia (não há ação a propor). Dispensa-se, e não volta na mesma sessão |
| Log de ações | ✅ | `services/log-service.ts`, visível no Centro de Programador e na aba de auditoria da Privacidade |
| Permissões por plugin | ✅ | Declaradas, mostradas e **recusáveis** na janela de Privacidade, com a decisão persistida. **A recusa impede a sério, 10/08/2026**, nos dois pontos onde havia uma chamada real por trás do "plugin": a permissão de rede do "Assistente JARVIS" (`core-assistant`) — recusada, `ai-service.ts` nunca chega a chamar `provider.stream()` num provedor remoto (DeepSeek, Claude), nem à primeira nem na cadeia, e cai direto no `RuleProvider` com o motivo dito; e a de notificações do "Motor de automações" (`automations`) — recusada, a ação `notificar` de uma automação não chega a `notificationService`. Confirmado com 5 testes que provam a chamada **nunca acontece** (não só "a resposta veio de outro sítio"), e ao vivo na app: o interruptor "Rede" muda para "Recusada" e persiste. Continua sem impedir nada além disto — nenhum plugin executa código próprio, e não há mais nenhuma chamada real por trás de nenhuma das outras permissões declaradas |
| **MCP** | 🚫 | Excluído da Fase 1 pelo próprio prompt original |

---

## Parte 8 — AI Core

| Camada | | |
|---|:--:|---|
| 1. Halo externo | ✅ | |
| 2. Anel principal, 3°/s | ✅ | Velocidade exata |
| 3. Anel secundário inverso, 7°/s | ✅ | Velocidade exata |
| 4. Anel interno irregular | ✅ | Com oscilação |
| 5. Radar, 360° em 4s | ✅ | |
| 6. Scanner de linhas horizontais | ✅ | Só no estado de análise |
| 7. ~300 partículas orbitais | ✅ | 120 em ecrãs pequenos |
| 8. Núcleo energético com respiração | ✅ | 100→103% em 5s |
| 9. Ondas sonoras | ✅ | 44 barras |
| 10. Logo JARVIS | ⚠️ | Retirado do centro do núcleo por decisão do utilizador — a identidade fica no header. Ver §Divergências |

| Estado | | |
|---|:--:|---|
| Ocioso · Escutando · Processando · Respondendo · Erro | ✅ | |
| **Sucesso** | ✅ | Glow verde, pulso e explosão de partículas |

| Outro | | |
|---|:--:|---|
| Dimensões 420/360/280/220 | ✅ | `core-size.ts` |
| Reduz a 75% com janelas abertas | ✅ | É a **única** redução prevista. Não é esbatido por haver widgets — `tests/shell/stage.test.tsx` guarda isso |
| Inclinação máx. 6° com o cursor | ✅ | |
| Ligações temporárias entre partículas | ✅ | |
| WebGL / Three.js / shaders | ⚠️ | Canvas 2D + SVG. Ver abaixo |

---

## Parte 9 — Animações

| Item | | |
|---|:--:|---|
| Durações (hover 120 … tema 500, ecrã 600) | ✅ | `tokens.ts` |
| Curvas ease-out / ease-in-out | ✅ | |
| Nunca `linear` fora de radar e scanner | ✅ | |
| 60 FPS, `requestAnimationFrame`, GPU | ✅ | Movimento normalizado a 60 FPS |
| Pausar em segundo plano | ✅ | `useAnimationFrame`. **Revisto a sério (DeepSeek, 14/08/2026), dois bugs reais corrigidos no laço**: (1) ao voltar do segundo plano o `elapsed` recomeçava em 0 — o `AICore`, que calcula o delta entre frames, via então um salto negativo de centenas de frames num só (partículas a andar para trás, ondas a ganhar brilho), porque o `Math.min(delta, 3)` só corta o limite de cima; o `start` passou para uma ref, e o tempo continua a crescer. (2) Com movimento reduzido o frame estático era desenhado uma única vez no arranque — mudar de modo ou de cor não o redesenhava, e o núcleo ficava preso no estado inicial; o frame estático passou para um efeito próprio dependente da callback. 2 testes novos (`tests/ai-core/use-animation-frame.test.tsx`), confirmados a falhar contra o código antigo |
| **Nunca animar `width`/`height`/`top`/`left`** | ⚠️ | Ver abaixo |
| Partículas sem trajetórias repetitivas | ✅ | |
| Sons | ✅ | `services/sound-service.ts` — sintetizados com Web Audio, sem um único ficheiro de áudio. Desligados por omissão |
| Estados do sistema (Normal, Foco, Apresentação, Economia, Performance) | ✅ | `types/system-state.ts` — cada um muda partículas, avisos e ritmo de sondagem. Nenhum é só uma etiqueta |

---

## Parte 10 — Comandos de voz

| Item | | |
|---|:--:|---|
| Ativação manual pelo botão | ✅ | |
| Síntese de voz com o núcleo a reagir | ✅ | |
| Comandos de sistema, aplicações, produtividade, pesquisa, multimédia e desktop | ✅ | `services/voice/intents.ts` — as seis famílias da spec. **Revisão a sério (DeepSeek, 14/08/2026)**: um bug real, corrigido — o casamento de verbos de tarefa usa `startsWith` sem espaço, e `anota` vinha antes de `anotar` (um é prefixo do outro); "Anotar comprar leite" casava no `anota` e o título ficava "r comprar leite". Reordenado `anotar` antes de `anota`, com teste a provar. O resto confirmado limpo (seis famílias, comandos compostos, cortesia, música, estados/temas/widgets) |
| Comandos compostos | ✅ | "Abre os emails, mostra os projetos e pausa" dá três ações. Só divide se todos os pedaços derem comando, senão um "e" dentro de um título partia a frase |
| Confirmação obrigatória em ações críticas | ✅ | Fechar as janelas e reiniciar a interface. O critério: dá para desfazer? |
| Correção de erros (mostrar o que foi reconhecido) | ✅ | A frase ouvida aparece numa notificação com um botão **Corrigir**, que abre uma caixa com o texto emendável. O que vai acontecer aparece **enquanto se escreve** — `components/voice/VoiceCorrection.tsx`. Também está na confirmação dos comandos que não se desfazem: se o que se ouviu nem era o que se pediu, a saída deixa de ser só ignorar e repetir em voz alta |
| Não decorar comandos exatos | ✅ | Várias formas de dizer o mesmo, sem acentos nem pontuação. Não há modelo de linguagem — e o ficheiro diz isso. **Alargado 10/08/2026**: `stripPoliteness` tira os prefixos de cortesia mais comuns ("podes", "por favor", "consegues", em cadeia — "podes por favor…") antes de se procurar o verbo, o que vale para todos os comandos de uma vez, não só um; mais verbos por família (abrir: "entra em", "inicia", "quero abrir"; esconder: "remove", "ocultar"; pesquisar: "busca"; tarefa: "anota"; música: "continua"/"retoma"); e "fecha tudo" e "reinicia a app"/"reinicia o jarvis" como variantes que faltavam. 52 testes, incluindo os novos |
| Contexto ("amanhã", "esse ficheiro") | ✅ | **`criar_tarefa` ganhou `prazo`, 10-11/08/2026** — o modelo resolve a data (já sabe "hoje é terça-feira, 11 de agosto" pelo `system prompt`) e devolve AAAA-MM-DD; `tool-runner.ts` só valida a forma, nunca interpreta "amanhã" por regras próprias. Confirmado por 6 testes (`tests/assistant/tools.test.ts`, `tests/stores/task-store.test.ts`) — data válida vira o timestamp certo, ausente ou malformada fica sem prazo em vez de inventar um. **"Esse ficheiro" feito** (`procurar_ficheiro`/`abrir_ficheiro`, commit `53864a9`) — `abrir_ficheiro` resolve a referência a partir do nome já dito antes na conversa e abre o Explorador na pasta certa; a própria descrição da ferramenta diz isto ao modelo. Testado (`tests/assistant/tools.test.ts`) e ligado a sério em `App.tsx` (`seedFiles`/`searchFiles`). **Correção a uma nota antiga desta linha**: já não é verdade que "ferramentas só correm com a DeepSeek" — a Peça 12 do Lote 3 (13/08/2026) estendeu `sendWithTools` também à Ollama, quando o modelo suportar `tools` (ver Parte 12). **Revisão a sério, 13/08/2026: corrigida a validação do prazo** — `new Date` rebatia silenciosamente datas que não existem no calendário ("2026-06-31" virava 1 de julho), o que era exatamente um prazo inventado; a validação agora confirma que os componentes redondam ao que se escreveu. 2 testes novos |
| Modos de escuta (manual, wake word, conversa, contínuo) | 🟡 | Manual e **modo conversa** (11/08/2026) — o microfone liga-se automaticamente após cada resposta, com timeout de inatividade (3 tentativas seguidas sem fala desligam-no). Botão `MessagesSquare` no header, com aviso na primeira ativação. A wake word e o contínuo continuam por fazer — decisão de privacidade por tomar. **Revisto a sério (DeepSeek, 14/08/2026), dois bugs reais corrigidos**: (1) os erros transientes do reconhecimento (`no-speech`, o silêncio de rotina; `a-falar`, o guarda de eco a segurar o microfone enquanto a voz ainda soa) passavam pelo caminho de erro a sério — `setMode('error')` + registo de erro — antes de se decidir que eram transientes; um silêncio piscava "erro" no ecrã e, no limiar da 3.ª tentativa sem fala, o núcleo ficava **preso em "erro"** (o `onEnd` só repõe a "idle" se o modo for "listening"). Agora os transientes tratam-se primeiro, sem tocar no modo nem no registo. (2) Ao voltar do segundo plano o ciclo nunca retomava — o efeito de visibilidade só agia quando a janela perdia o foco, apesar de o histórico prometer "retoma-se ao voltar"; agora o ramo de foreground re-engata quando o modo conversa continua ativo. 5 testes novos (`tests/voice/conversation-mode.test.ts`) |
| Histórico de voz pesquisável | ✅ | Cada comando reconhecido vira uma notificação com o transcrito e a categoria "assistente" (`use-voice.ts`); a pesquisa do painel filtra por título e descrição, sem acentos. 4 testes em `notification-panel.test.tsx` (pesquisa por transcrito, sem acentos, por categoria, sem resultados) |

---

## Parte 11 — Plugins e ecossistema

| Item | | |
|---|:--:|---|
| Plugin Manager com loja, categorias e pesquisa | ✅ | `apps/plugin-manager/` |
| Permissões declaradas e visíveis antes de instalar | ✅ | |
| Instalar, ativar, remover, persistido | ✅ | |
| Manifesto e contratos | ✅ | `plugins/plugin.ts` |
| **Carregar e executar um plugin** | 🟡 | **Confirmado a sério 10-11/08/2026** — `plugins/runtime/`: `<iframe sandbox="allow-scripts">` sem `allow-same-origin`, protocolo tipado por `postMessage`, permissão real verificada por `handlePluginMessage()` antes de qualquer serviço — desde 13/08/2026 em dois degraus (declarada no manifesto **e** não recusada), e com caminhos absolutos recusados na fronteira de ficheiros. Catorze plugins de exemplo correm código isolado de verdade — notificações, ficheiros, rede, janelas, comandos, eventos, armazenamento, atalhos, widgets, menus, definições, serviços e painéis. Desenho completo em [`docs/spec/plugins-sandbox.md`](docs/spec/plugins-sandbox.md) |
| **Assinatura de plugins — Ed25519** | ✅ | **Peça 5, Lote 2 (12/08/2026)** — `plugins/signature.ts`: geração de pares Ed25519, assinatura e verificação via `crypto.subtle` (SubtleCrypto), representação canónica do manifesto (chaves ordenadas), lista de revogação local. Interface mostra estado visível: assinado e válido / sem assinatura / assinatura inválida / chave revogada. Testes reais com pares gerados no próprio teste — sem chaves fixas no código. Infraestrutura para plugins do catálogo e para a peça futura de instalar-de-ficheiro-local. Confirmado: Ed25519 funciona no Node 24.19 e no WebView2 do Windows 11. **Revisão independente a sério (13/08/2026)**: dois problemas reais apanhados e corrigidos. (1) `canonicalManifestBytes` construía o objeto canónico com `{}`, por isso um campo `__proto__` no manifesto mexia no protótipo em vez de criar uma propriedade própria e era descartado em silêncio pelo `JSON.stringify` — a assinatura deixava de cobrir o manifesto inteiro; passou a `Object.create(null)`. (2) `verifyAndInstallPlugin` (`use-plugin-store.ts`) instalava sem verificar quando `signature`+`signerPublicKey` vinham presentes mas o manifesto não se resolvia (nem passado, nem no catálogo) — fail-open; agora recusa com `assinatura-invalida`. 2 testes novos (um por problema, provando cada um antes e passando depois). Suite completa: 111 ficheiros, 1537 testes |
| **Instalar plugin de ficheiro local** | ✅ | **Peça 9, Lote 2 (12/08/2026)** — `plugins/install-from-file.ts`: diálogo nativo (.jarvis-plugin), comando Rust `read_plugin_file`, validação do pacote em três camadas (JSON → manifesto → assinatura), integração com a verificação Ed25519 da Peça 5. Formato decidido e documentado: JSON simples com `manifest` + `signature` + `signerPublicKey` + `code`. Recusas específicas (manifesto malformado, sem assinatura, assinatura inválida, chave revogada) — a pessoa vê exatamente porque não foi aceite. Runtime dinâmico: plugins de ficheiro registam-se no `registry.ts` ao instalar e desregistam-se ao remover. Armazenamento externo (`external-storage.ts`) guarda manifesto + código em localStorage para sobreviver a recarregar. 29 testes novos. **Revisão independente (Sonnet, 12/08/2026)**: dois `describe` inteiros (`validatePackage`, `validateManifest`) não chamavam as funções reais — reimplementavam a lógica à mão nos testes, ou apontavam para um método `_validatePackage` que nunca existiu. Corrigido: as duas funções passaram a exportadas e os testes chamam-nas a sério. **Confirmado ao vivo**: `npm run tauri dev`, gerado um `.jarvis-plugin` real (chave Ed25519 a sério, assinado pelo código de produção), instalado pelo diálogo nativo — Instalados subiu de 9 para 10, cartão mostrou "Assinado e verificado por Sonnet (verificação ao vivo)", removido a seguir sem deixar rasto. **Correção ao que a DeepSeek escreveu no histórico**: a peça terminou a dizer "Lote 2 fechado — as cinco peças concluídas", mas a lista que deu (Terminal, Cofre, Windows Hello, Assinatura, Instalar de ficheiro) confunde peças do Lote 1 com o Lote 2 — as cinco peças reais do Lote 2, do pedido original do utilizador, são: 5) Assinatura de plugins ✅, 6) ferramenta "esse ficheiro" ✅ (já estava feita antes deste lote começar), 7) sistema de ficheiros real ✅, 8) provedores de rede reais (clima, notícias, email, música) — **por fazer**, 9) instalar de ficheiro ✅. O Lote 2 não está fechado — falta a peça 8. **Revista a sério a verificação de assinatura (`src/plugins/signature.ts` + `verifyAndInstallPlugin`) como um todo (DeepSeek, 14/08/2026) — a criptografia e o fluxo estão corretos e falham para o lado seguro**: canonicalização ordenada com proteção de `__proto__`, `permissions`/`platforms` ordenados, base64 inválido/assinatura de tamanho errado/chave errada → recusado, chave revogada bloqueada, externo sem assinatura → recusado, sem manifesto para verificar → recusado. **Um achado real, que fica à espera de decisão da pessoa (não foi construído):** a assinatura cobre só o `manifest`, nunca o `code` — trocar o código por outro JavaScript qualquer não invalida a verificação, e a interface diz "Assinatura verificada" como se o plugin inteiro estivesse autenticado. A justificação documentada em `plugin.ts` ("code não é serializado de forma canónica") está tecnicamente errada. Registado em `docs/log/perguntas-para-o-utilizador.md` (pergunta 1). Ver `docs/log/historico-sessoes.md` (14/08/2026, "Revisão a sério: a verificação de assinatura de plugins") |
| Isolamento entre plugins | ✅ | Cada `<iframe>` tem origem opaca própria — sem acesso a `localStorage`, cookies, nem ao `window` de outro plugin ou do Core, a não ser pelo que `postMessage` entregar de propósito |
| Event Bus global | ✅ | `services/event-bus.ts` — nove eventos tipados. Emitido por temas, estados, notificações, plugins, janelas, email e tarefas |
| API do Core para plugins | 🟡 | **10 de 13 capacidades do original (12/08/2026)**: Criar Notificações, Criar Janelas, Adicionar Comandos, Adicionar Atalhos, Registar Eventos (lote anterior) e agora **Criar Widgets** (`core.widget.create` — só título e texto, nunca código nem markup), **Adicionar Menus** (`core.menu.add` — item real no menu de contexto do ambiente, clique entregue ao plugin), **Adicionar Configurações** (`core.setting.register` — schema declarado pelo plugin, valor editável na própria Loja), **Criar Serviços** (`core.service.register` — "tick" empurrado a um intervalo, mínimo 5s) e **Adicionar Painéis** (`core.panel.add` — bloco de texto expansível). Mais quatro fora do original — ficheiros, rede, automações, armazenamento isolado. **Por decisão explícita, por autorizar**: Executar Voz, Ler Memória, Guardar Preferências — mexem em microfone e dados do utilizador. Nove plugins de exemplo novos provam as cinco capacidades de hoje mais duas que já existiam sem exemplo nenhum (`guarda-preferencias`, `regista-atalho`, agora ligados no `registry.ts` — estavam escritos mas nunca instaláveis, um buraco real encontrado ao continuar este trabalho). **Bug real corrigido de caminho**: `core.shortcut.triggered` nunca chegava ao plugin — `window.postMessage` no `window` do Core não entra num iframe filho sozinho. `registerPluginSender`/`pushToPlugin` (`plugin-bridge.ts`) resolvem isto a sério, confirmado ao vivo com o menu de contexto real. **Revisto a sério 14/08/2026: bug real corrigido** — `core.command.register` só registava o comando para aparecer na paleta; executá-lo abria a Loja de plugins em vez de invocar o plugin, porque o caminho de invocação nunca foi construído (ao contrário dos atalhos e menus, gémeos exatos desta capacidade). Agora a paleta empurra `core.command.triggered` ao plugin (`runPluginCommand` no `command-registry.ts`, ligado a `pushToPlugin` no `App.tsx`), e o `command.register` da SDK aceita um `callback` como os irmãos `menu.add`/`shortcut.register`. Desenho completo em [`docs/spec/plugins-sandbox.md`](docs/spec/plugins-sandbox.md) |
| SDK mínimo para autores de plugins | ✅ | **Confirmado 10-11/08/2026** — `plugins/sdk/jarvis-plugin-sdk.js`, injetado automaticamente no `srcDoc` do iframe: `window.core.notify()`, `.fs.{read,write,list}()`, `.fetch()`, `.automation.run()`, cada um devolvendo uma `Promise` sobre o protocolo real. `.d.ts` para referência de tipo |
| Esboço do Marketplace | 🟡 | **Confirmado 11/08/2026** — terceira aba na Loja (`MarketplaceTab.tsx`), seis entradas de exemplo escritas à mão (`marketplace-sample-data.ts`), "Instalar" sempre desativado. Só desenho, nenhuma origem remota real. O que falta decidir antes disso — registo próprio vs. formato aberto sobre Git, assinatura, atualizações, rollback, moderação, dinheiro — em [`docs/spec/plugins-marketplace.md`](docs/spec/plugins-marketplace.md) |
| Ligar a uma fonte real, atualizações, rollback | ⬜ | Fora de âmbito por decisão, 10/08/2026 — maior do que vale a pena decidir sozinho; ver o esboço acima e `docs/spec/plugins-marketplace.md` para o que falta decidir primeiro |

---

## Parte 12 — AI Orchestrator

| Item | | |
|---|:--:|---|
| Um provedor por módulo, trocável | ✅ | O padrão já está em `services/*/providers/` |
| Seleção automática de modelo por tarefa | ✅ | `services/ai-providers/model-choice.ts`. Código, pedidos que peçam raciocínio e textos longos vão ao Reasoner; o resto vai ao Chat, que é mais rápido e mais barato — e **também desce** de modelo, não só sobe. **Não é um classificador aprendido**, e o ficheiro di-lo: é a mesma regra de palavras dos comandos de voz. Por isso erra, e por isso cada resposta mostra que modelo respondeu e porquê. Desligado por omissão: quem escolheu um modelo escolheu-o |
| Regras de fallback | ✅ | `types/ai-failure.ts`. Quando o remoto falha, responde o provedor local — e **nunca em silêncio**: a nota diz o motivo e, quando há arranjo, diz qual. Se a resposta já tinha começado não se troca a meio: fica o que chegou, mais uma linha a dizer que se perdeu. Cancelar não é falha. Já no local, não há para onde cair, e diz-se |
| **Ligação a OpenAI, Claude, Gemini, Ollama…** | 🚫 | Rede real — ver §2 |

---

## Parte 13 — Motor de automações

| Item | | |
|---|:--:|---|
| Gatilho → Condições → Ações | ✅ | `services/automation-service.ts` |
| Gatilhos por hora, intervalo, evento e manual | ✅ | O relógio guarda marcas de disparo — uma regra das 08:00 corre uma vez, não três. **Revisão a sério (item 15, 14/08/2026): bug real corrigido** — uma regra por evento criada ou editada depois do `start()` ficava à espera de um evento ao qual ninguém estava subscrito e só corria depois de a aplicação reiniciar; as subscrições agora refazem-se em `add`/`update`/`remove`/`hydrate` |
| Condições: dia da semana, faixa horária, estado do sistema | ✅ | Funções puras, testadas à parte. A faixa que atravessa a meia-noite também |
| Ações: abrir janela, notificar, tema, estado, widget, voz | ✅ | Cumpridas por um executor injetado — o motor não conhece o WindowManager. As frases que as descrevem mostravam identificadores crus (`oled`, `economia`, `news`) até se partilhar `lib/names.ts` com os comandos de voz, que já tinham tido o mesmo defeito. Sem teste nenhum sobre o ficheiro, ninguém tinha reparado |
| Histórico com resultado, duração e motivo | ✅ | 60 execuções, persistido |
| Janela com ligar/desligar, executar e apagar | ✅ | `apps/automations/` |
| Templates | ✅ | Cinco exemplos, **todos** desligados por omissão, sem exceção — **reavaliado 10/08/2026**: mantido de propósito. Havia um comentário a dizer que a do arranque era exceção; nunca foi, no código nem no teste que já garantia isto (`automation-service.test.ts`). Corrigido o comentário, não o código: abrir duas janelas e falar sozinho no primeiro arranque, antes de a pessoa saber que automações existem, seria pior do que ligar à mão uma vez |
| Editor visual em blocos | ✅ | **Implementado 11/08/2026** — `apps/automations/AutomationEditor.tsx`. Três colunas fixas (QUANDO/SE/ENTÃO) com drag-and-drop da paleta de blocos. Usa o motor que já existe (`AutomationTrigger → AutomationCondition[] → AutomationAction[]`), sem inventar capacidades novas. Guardar cria/atualiza a automação no `automationService`. Editar uma regra existente carrega-a nos blocos. O escopo é deliberadamente contido: a spec original pedia um canvas de nós completo com loops, variáveis e ramos — isso exigiria um modelo de dados em grafo e capacidades que ainda não existem (Plugin, rede real). Este editor resolve o que o motor de hoje oferece, sem interface a fingir. **Revisão a sério (item 10 da fila noturna, 13/08/2026)**: "atualizar" era literal `remove` + `add` — uma correção trivial ao nome ou à descrição dava um `id` novo à automação e apagava `createdAt`/`lastRunAt`/`runCount`; uma regra com histórico voltava a mostrar "nunca correu" só por se lhe ter editado o texto. Corrigido com um `update()` novo em `automationService` que substitui o conteúdo mantendo a identidade. 4 testes novos (2 no serviço, 2 no editor, incluindo o caminho real de "editar e guardar" através da interface, não só a chamada direta ao serviço) |
| Criação por linguagem natural | ✅ | **Implementado 11/08/2026** — botão "Interpretar" no editor visual. Envia a frase ao `aiService` com um prompt que lista os tipos de bloco e os IDs reais (apps, temas, widgets, estados). Extrai o JSON da resposta, preenche os blocos, nome e descrição. O utilizador revê e confirma antes de guardar |
| Execução em segundo plano com a interface fechada | ✅ | `on_window_event` → `prevent_close()` + `window.hide()`. A janela esconde-se na bandeja em vez de fechar — o WebView continua vivo e os temporizadores do motor de automações continuam a correr. Sair a sério só pelo menu da bandeja ("Sair") |
| **Gatilhos do sistema** (ficheiros, USB, bateria, rede) | 🟡 | Ficheiros ✅ (`notify` crate, `watch_folder`/`unwatch_folder`), USB ✅ (`windows` crate, poll 5s a `SetupDiGetClassDevsW`), Bateria ✅ (`battery` crate, poll 30s). Rede 🚫 — sem API para eventos de conectividade no Windows. Três comandos Rust: `watch_folder`, `unwatch_folder`, `get_battery_status`. Três capacidades novas no `PlatformAdapter`: `fileWatcher`, `usbMonitor`, `batteryMonitor`. Editor visual com blocos novos (Alteração de ficheiro, Dispositivo USB, Nível da bateria). Eventos emitem `automation://file-changed`, `automation://usb-changed`, `automation://battery-changed`; `checkNativeTriggers()` no `automationService` casa-os contra as regras ativas e regista no histórico de 60 execuções. **Revisto 13/08/2026** (revisão independente): corrigida uma fuga em `unwatch_folder` (a thread do observador nunca parava) e o cruzamento de limiar da bateria para mais do que uma regra ao mesmo tempo |

---

## Parte 14 — Segurança e privacidade

| Item | | |
|---|:--:|---|
| Menor privilégio nas capabilities do Tauri | ✅ | `src-tauri/capabilities/` — uma por plataforma |
| Nunca abrir a shell a comandos da interface | ✅ | `url-policy.ts` só aceita `https:` e `mailto:`, e a capability impõe o mesmo |
| Erros tratados com `Result`, sem `unwrap()` | ✅ | `src-tauri/src/error.rs` |
| Autenticação com bloqueio e sessão | ✅ | Bloqueio por inatividade de 1 a 60 minutos, ou desligado, na janela de Privacidade. Conta em relógio de parede: um portátil suspenso não continua a contar em segundo plano. **Revisão a sério (item 15, DeepSeek, 14/08/2026): bug real corrigido** — `use-idle-lock.ts` disparava `onLock` de 15 em 15 segundos depois de o tempo esgotar: a verificação periódica voltava a chamar enquanto ninguém mexesse no rato, em vez de bloquear uma só vez. Hoje o `logout` síncrono mascarava o defeito (desligava o desktop logo no primeiro disparo e o efeito limpava o intervalo), mas a repetição correria o logout de novo e encheria o registo de auditoria de entradas se algo atrasasse a mudança de fase. Um guarda `locked` pára a verificação depois do primeiro bloqueio. 1 teste novo |
| Painel de privacidade e permissões | ✅ | `apps/privacy/` — três abas: permissões por plugin, auditoria e o que cada capacidade da plataforma vê de facto. **Revisão a sério (item 15, DeepSeek, 14/08/2026): bug real corrigido** — `use-plugin-store.uninstall()` removia o plugin de `installed` mas deixava as permissões que lhe tinham sido recusadas em `deniedPermissions`; a entrada órfã ficava gravada em disco a cada `persist`, e se o plugin voltasse a ser instalado herdava em silêncio as recusas da instalação antiga em vez de recomeçar com as permissões do manifesto. Agora o `uninstall` limpa também as recusas do plugin removido. 3 testes novos |
| Auditoria de ações | ✅ | `logService.audit()`. Regista temas, estados do sistema, comandos de voz, automações e decisões de permissões — venham da paleta, da voz ou de uma regra |
| Cofre de segredos, criptografia, WebAuthn, 2FA | 🟡 | **Cofre de segredos ✅ confirmado 12/08/2026** — crate `keyring` v2, comandos Rust `secret_set`/`secret_get`/`secret_delete`, integração com o Windows Credential Manager (`SERVICE_NAME = "jarvis-ai-os"`). As chaves da API (DeepSeek e Claude) saíram do armazenamento local e passaram para o cofre do sistema. Migração automática na primeira abertura depois da atualização. `PlatformAdapter` com `secretVault` nas capabilities — desktop usa, browser e Android mantêm o comportamento de sempre. 6 testes de integração Rust ao vivo no Credential Manager desta máquina. **Revisão independente a sério (13/08/2026)**: o Rust já estava certo, mas a interface tinha dois bugs reais, corrigidos. (1) `TauriAdapterBase.secretSet/secretDelete` decidiam o sucesso com `result !== null`, mas `Ok(())` serializa para `null` — devolviam `false` sempre no desktop e recusariam o registo da chave física com "sem cofre"; passaram a `try`/`catch` sobre `invoke`. (2) A migração apagava o texto simples mesmo se a escrita no cofre falhasse; agora só limpa o storage e marca `jarvis-migrated` depois de a cópia confirmar — se falhar, a chave fica onde estava. 9 testes novos (`tests/platform/secret-vault.test.ts`, `tests/stores/ai-settings-store.test.ts`), cada um a provar o comportamento errado antes e a passar depois. Suite completa: 113 ficheiros, 1546 testes. **WebAuthn ✅, 13/08/2026** — ver Parte 5 acima para o detalhe; a credencial vive neste mesmo cofre. **2FA ✅, 13/08/2026** — interruptor "Exigir segundo fator" em Privacidade → Acesso, só visível/ativável com uma chave física já registada. Ligado, a palavra-passe e o PIN deixam de bastar sozinhos: depois de aceites, o login mostra um passo 2 de 2 ("Usar chave física") e só concede acesso depois de `verifySecurityKey()` confirmar a assinatura a sério — nunca só porque o primeiro fator passou. Biometria (Windows Hello/simulada) e a chave física usada diretamente continuam a bastar-se a si mesmas, por já serem, cada uma, um fator forte — pedir a chave como segundo fator de si própria não faria sentido. Removida a chave, o 2FA desliga-se sozinho, para o interruptor nunca ficar ligado a apontar para nada. Enquanto o segundo fator está pendente, os atalhos de biometria/PIN/chave-física-direta ficam escondidos — nenhum deles pode contornar o que se acabou de exigir. **Revisão a sério (item 15, 13/08/2026): bug real corrigido** — `completeFirstFactor` concedia acesso só com a palavra-passe/PIN quando o 2FA estava ligado mas a chave tinha desaparecido (ex.: restauro de uma cópia, que guarda `twoFactorEnabled` no armazenamento mas não a credencial WebAuthn do cofre, ou um cofre do sistema limpo), apesar de o contrato dizer "nunca só porque o primeiro fator passou". Agora nega nesse estado, com mensagem e auditoria — fail-closed, não fail-open. Criptografia mais ampla (para além do cofre do sistema) continua por fazer, sem necessidade concreta identificada ainda. **Revisão a sério da store de definições de IA (`use-ai-settings-store.ts`, DeepSeek, 14/08/2026): bug real corrigido** — a revisão de 13/08 tinha protegido a *migração* (apagar o texto simples só depois de o cofre confirmar), mas o `persist()` (o caminho de todas as escritas seguintes) tinha o mesmo buraco e não o tinha apanhado: escrevia as definições *sem* as chaves no storage primeiro e só depois mandava as chaves ao cofre, **ignorando** o booleano que o `secretSet` devolve (`false` quando o cofre falha). Uma escrita falhada no cofre deixava a chave em lado nenhum — nem storage nem cofre — e um reinício a apagava de vez. Agora as chaves vão primeiro ao cofre e só se a escrita correr mesmo bem é que se tiram do storage; se falhar, o storage mantém-nas como cópia de segurança, e o `hydrate()` volta a lê-las do storage quando o cofre não as tem. 3 testes novos |
| Backups e restauro | ✅ | Aba **Cópias** na janela de Privacidade. Descarrega um JSON legível com tudo o que está no armazenamento local, e repõe-no com confirmação e a lista do que vai substituir. **A chave da API nunca entra na cópia** — o campo é apagado, não posto a vazio, para quem repõe ver que falta em vez de julgar que está definida. Repor só escreve as chaves que a cópia traz: uma cópia antiga é um passo atrás, não um recomeço. A reposição volta a hidratar as stores, e por isso vê-se na hora, sem recarregar. **Revisão a sério (item 15, 13/08/2026): bug real corrigido** — a validação só conferia a estrutura exterior (formato, versão, chaves), nunca os valores: uma cópia adulterada com uma secção na forma errada (ex.: `tasks` como string) era escrita no armazenamento e rebentava a store ao lê-la, já com o estado corrompido. Agora cada secção conhecida é recusada à entrada se a forma não bater certo, e uma falha na aplicação mostra erro em vez de ficar presa na confirmação. **Revisto a sério (item 15, 14/08/2026):** a única secção que a reposição *não* re-hidrata na hora é o `windowLayout` — grava-se em `window-layout`, mas reabrir as janelas nas posições guardadas é uma operação com efeitos (abre janelas a sério), feita pelo `restoreSavedLayout` só no arranque; o layout reposto aplica-se no arranque seguinte, de propósito (reabrir tudo a meio de uma sessão seria pior). As outras chaves fora do `hydrateAll` estão seguras ou mortas: `newsMarks` lê-se à vontade, `booted` só interessa ao arranque, `lastUser`/`reducedMotion` não têm leitor |

> **A auditoria vive em memória, e é de propósito.** Escrever num ficheiro exige
> o plugin `fs` — bloqueado. E um registo de auditoria em `localStorage`, onde
> qualquer script da página o pode reescrever, seria pior do que não haver
> registo nenhum: dava a aparência de prova sem a ser. Fica na sessão até haver
> escrita nativa.

---

## Parte 15 — Personalização completa

| Item | | |
|---|:--:|---|
| Temas do utilizador | ✅ | Guardados, aplicáveis, apagáveis, e presentes na Command Palette ao lado dos oficiais. Vivem em variáveis escritas no `<html>`, porque não existiam quando o `themes.css` foi escrito — é a única diferença; o resto do sistema não os distingue |
| Temas oficiais | ✅ | **Os dez.** Classic, OLED, Titanium, Emerald, Solar, Midnight Blue, Cyber Red, Graphite, Aurora e Arctic White — este último claro |
| Superfícies vindas dos tokens | ✅ | `tint`, `glass` e `glass-deep` em canais RGB, para o Tailwind lhes dar a opacidade. Um teste impede novos `bg-white/[…]` escritos à mão |
| Troca em tempo real, sem reiniciar | ✅ | |
| Sons por categoria | ✅ | Três categorias — Interface, Avisos, Sistema — cada uma com o seu volume, que multiplica o geral. Largar o cursor toca um som da própria categoria |
| Perfis de animação | ✅ | Os estados do sistema (Parte 9) já cobrem o ritmo de sondagem e os avisos. **Completado 10/08/2026**: Minimal, Suave, Equilibrado, Cinemático e Performance — Personalização → Aparência, logo acima do "Núcleo". Decisão registada em `types/appearance.ts`: não é uma dimensão nova, é um atalho sobre as três que já existiam (partículas, velocidade, anéis) — duplicar o ritmo/avisos que os estados do sistema já fazem só criava duas fontes de verdade a poder discordar. "Glow" e "duração das transições" globais, que a spec original também pedia, ficam de fora: não há hoje nenhum dial para nenhum dos dois, e inventar um só para preencher a lista era personalização a fingir. "Personalizado" nunca se guarda — é o que aparece sozinho quando a combinação atual não bate com nenhum perfil (`detectAnimationProfile`), para nunca haver dois sítios a poder discordar sobre o que está ativo. Confirmado ao vivo por CDP: escolher "Minimal" tirou os anéis e ficou marcado como ativo |
| Centro de Personalização | ✅ | Temas, aparência, estado do sistema, som e arranque numa janela só |
| Papéis de parede escolhíveis | ✅ | Quatro variantes — Nebulosa, Grelha, Partículas, Liso — com intensidade |
| Núcleo personalizável | ✅ | Contagem de partículas (multiplica-se com o estado do sistema), **cor** e **velocidade dos anéis**, verificadas visualmente num browser real — a cor aplica-se aos anéis SVG, ao brilho, às partículas do canvas e à waveform, todos ao mesmo tempo, exceto nos modos com cor própria (analisar, responder, falha), que continuam a ignorá-la de propósito. **Decidido e feito 10/08/2026**: sim, compensa esconder os anéis — `coreRingsVisible` (Personalização → Aparência → "Mostrar os anéis"), por omissão ligado. Desligado, `CoreRings.tsx` deixa de desenhar os cinco anéis e as cruzetas, e fica só o brilho central; as partículas orbitais vivem num canvas à parte e continuam sempre. Confirmado ao vivo por CDP: 7 grupos SVG a desaparecer e a voltar ao ligar/desligar o interruptor, sem recarregar nada. Entra no ambiente de um perfil, como a cor e a velocidade já entravam |
| Escala, arredondamento e cursor | ✅ | `types/appearance.ts` — três estilos de cursor, três de arredondamento, escala de 90% a 130% |
| Acessibilidade (alto contraste, reduzir transparência) | ✅ | Mais a correção de daltonismo. A redução de movimento vem do sistema operativo e já era respeitada |
| Editor de temas personalizados | ✅ | Três escolhas — acento, fundo e base clara ou escura — e os outros doze tokens derivam daí, com as proporções dos temas oficiais. Um formulário com os quinze daria combinações ilegíveis. Avisa quando o contraste não chega, sem impedir |
| Tipografia (família e pesos à escolha) | ✅ | Três famílias — Inter, Space Grotesk, IBM Plex Sans —, todas fontes variáveis (300–700) **vendorizadas localmente**, pela mesma regra do Inter: zero pedidos a servidores de fontes, cobertas pelo casco do service worker. Cada opção mostra-se já na sua própria fonte antes de se escolher. Faz parte do ambiente — viaja com os perfis: "Programação" traz o IBM Plex Sans |
| Perfis completos (Trabalho, Gaming, Noite…) | ✅ | Um perfil guarda janelas, widgets, tema, **ambiente** (papel de parede e intensidade, partículas do núcleo, cursor, arredondamento, família tipográfica), **som** (geral e por categoria) e que **plugins** estavam ativos. Não guarda a acessibilidade — ver a divergência assumida em baixo. Os seis do sistema trazem som a sério: "Estudos" é silêncio completo, "Programação" cala os cliques e mantém os avisos |
| Daltonismo | ✅ | Protanopia, deuteranopia e tritanopia, por `feColorMatrix` no `<html>`. **Corrige, não simula**, e alcança também os `<canvas>` do núcleo e dos gráficos — o que uma solução só de variáveis CSS não faria |
| Sincronização entre dispositivos | 🚫 | Rede |

---

## Parte 16 — Painel de desenvolvedor

| Item | | |
|---|:--:|---|
| Logs em tempo real, pesquisáveis | ✅ | `apps/developer-center/` — filtros por nível e por origem, pesquisa que também entra no detalhe |
| Diagnóstico do sistema | ✅ | `services/diagnostics.ts` — plataforma, adapter e capacidades, além do Monitor de recursos |
| Inspetor de eventos | ✅ | `logService.watchEventBus()` escuta o Event Bus inteiro e mostra o nome e a carga de cada evento |
| Desempenho (memória, tempo de arranque, FPS) | ✅ | Arranque, `performance.memory` e agora **FPS a sério**, por `requestAnimationFrame` (`services/fps-meter.ts`) — não um número simulado. **A memória só existe no Chromium** — noutros browsers mostra-se ausente em vez de um número inventado. O medidor de FPS segue a mesma regra do som: só corre enquanto a aba Estado está aberta, e mostra "a medir…" no primeiro segundo em vez de um zero ou de um valor congelado de antes |
| Estado dos serviços e dos adapters | ✅ | Plataforma, métricas, automações, som e registo, cada um com o que está mesmo a fazer |
| Consola de comandos | ✅ | Aba **Consola** no Centro de Programador. `ferramenta chave=valor` corre pelo mesmo `runTool` que o assistente usa — o catálogo inteiro de 29 ferramentas, incluindo as que a voz e a paleta nunca alcançam (`guardar_layout`, `ligar_automacao`, as destrutivas…). `ajuda` lista o catálogo, `ajuda <nome>` detalha parâmetros, `limpar` esvazia. As destrutivas pedem confirmação em linha, como no assistente — não correm sozinhas mesmo escritas à mão |

---

## Parte 17 — Roadmap

A Fase 1 do roadmap — Boot, Login, Desktop, AI Core, Chat, temas, configurações —
está entregue, incluindo os "widgets principais" (relógio, CPU, RAM, clima,
notícias, email, música), que entraram com o sistema de widgets.

Da Fase 2, entraram as peças que não precisam do nativo: pesquisa global na
paleta, painel de notificações com categorias e a interface do Plugin Manager.
Entraram depois o motor de automações e o **Centro de Programador**, ambos
reavaliados: nenhum precisava de nativo. Ficam de fora, por dependerem de
coisas ainda não validadas: execução de plugins, MCP, múltiplos desktops e
layouts guardados.

### Fase 3 — Controlo direto 🟡 (3.1 e 3.2 implementadas, 3.3–3.5 só desenho)

Pedido à parte do resto da spec: o JARVIS a mexer no rato e no teclado como
uma pessoa, com uma palavra-passe falada como portão de presença (sessão de
30 minutos, sem câmara) e visão do ecrã para saber onde estão as coisas.
Desenho completo — camadas de presença, perceção, ação e auditoria; travão
de mão; classificação de risco; faseamento interno 3.1–3.5 — em
[`docs/spec/fase-3-controlo-direto.md`](docs/spec/fase-3-controlo-direto.md).
A sub-fase 3.1 (overlay de confirmação e auditoria, com ações simuladas) não
precisa do nativo; a 3.2 (abrir aplicações e ficheiros por caminho) já precisa
— um comando Rust (`open_path`, via `open::that`) que entrega o caminho ao
abridor predefinido do sistema, o equivalente a um duplo-clique, não a
execução arbitrária. Depende de dois pré-requisitos: a Fase 1 validada no PC
real, e a ativação explícita e desligada por omissão na janela de Privacidade.

**Revisão de segurança a sério, 13/08/2026 — dois achados na peça de maior
risco do projeto, que nunca tinha tido revisão independente nem um teste
sequer.** (1) `executeStep()` nunca conferia se havia uma sessão de
presença ativa antes de executar a sério — a spec exige isto ("sem isto,
nada corre"), mas a verificação vivia só em quem chamasse a função, não
na própria função; corrigido para o serviço se defender sozinho,
independentemente de quem o chamar. (2) **O que está construído nunca
chega a ligar-se a um fluxo alcançável pela pessoa**: `<ControlOverlay>`
nunca é montado em lado nenhum da árvore de componentes, e nada no
código de produção chama `startSession()`, `verify()` ou `executeStep()`
— o reconhecimento de voz nunca foi ligado à verificação da
palavra-passe. Na prática, hoje, a Fase 3.1 é um painel de configuração
inerte (liga o interruptor, define a palavra-passe, vê um histórico
sempre vazio) — não uma funcionalidade utilizável, apesar de "3.1
implementada" sugerir o contrário. Não é um risco de segurança em si
(nada corre porque nada chama o caminho que executaria), mas é uma
lacuna real entre o que a spec e o SPEC.md davam a entender e o que
existe. 13 testes novos (`tests/services/direct-control-service.test.ts`,
zero antes) — confirmei que os dois testes da porta de presença falham
sem a correção e passam com ela. Ligar isto a um fluxo real de propósito
fica para quando a sub-fase 3.2+ começar a sério, não decidido aqui.

**Fase 3.2 implementada — 15/08/2026.** A lacuna da revisão de 13/08 foi
fechada na sub-fase seguinte: o comando nativo `open_path` (Rust,
`open::that` — o abridor do SO, não um shell), a capacidade `directControl`
nos adapters, a porta de presença no próprio serviço
(`requestStep`/`confirm`/`cancel`, com o passo pendente a alimentar o
`ControlOverlay` agora montado no `DirectControlHost`), a abertura manual de
sessão por palavra escrita na Privacidade (o caminho "escrita" da spec §6), e
a ferramenta de assistente `abrir_aplicacao` (parâmetro `caminho`, risco
médio). O rato/teclado (3.4) e a visão do ecrã (3.3/3.5) continuam por fazer.

## Divergências assumidas

Sete pontos em que o código não segue a spec à letra. Todos deliberados.

### 1. Estrutura de pastas — resolvida como híbrido

A Parte 3 pede `src/{app,components/{layouts,pages,widgets,assistant,system},contexts,store,api,utils,constants,assets,animations,workers,data}`.

**Decisão:** acrescentar as pastas em falta sem mover nada do que já existe.

Criadas: `constants/`, `utils/`, `animations/`, `workers/`, `assets/`. Cada uma
com um `README.md` que define o que lhe pertence — e, tão importante, o que
continua noutro sítio e não deve ser arrumado para lá.

Mantidas as pastas por domínio (`platform/`, `services/`, `stores/`,
`components/{shell,ai-core,windows,boot,auth,…}/`, `apps/`, `design-system/`).
Continuam a divergir dos nomes da Parte 3.

**Porquê não renomear:** mover ~60 ficheiros e reescrever os imports é churn
puro num código que passa em 133 testes, e apagaria o histórico de `git blame`
de tudo. A vantagem seria cosmética. As pastas por domínio também dizem mais:
`components/ai-core/` diz o que lá está, `components/assistant/` não distingue o
núcleo da janela de conversa.

Pastas da Parte 3 ainda não criadas, por não terem para onde ir: `app/`,
`contexts/` (o estado é Zustand, sem Context), `api/` (sem rede na Fase 1),
`data/`, `components/{layouts,pages,widgets}`. Entram quando tiverem conteúdo.

### 2. Stack

Faltam GSAP, Three.js, TanStack Query, IndexedDB, date-fns e next-themes.

- **GSAP e Three.js** — o AI Core cumpre a Parte 8 inteira em Canvas 2D e SVG, a 60 FPS e com o peso do bundle em 99 kB comprimido. Acrescentar WebGL na Fase 1 seria custo sem retorno visível.
- **TanStack Query** — não há chamadas de rede na Fase 1. Entra quando entrarem os provedores de IA reais.
- **IndexedDB** — o `StorageService` usa o plugin `store` do Tauri, que é a escolha certa em desktop e Android. O IndexedDB só faria falta ao alvo web.
- **date-fns** — o `Intl` nativo chega para o que a Fase 1 formata, sem 20 kB extra.
- **next-themes** — o tema resolve-se com `data-theme`, em duas linhas.

### 3. Nomes dos temas

A Parte 3 pede *Escuro, Claro, Azul, Grafite, Carbono, OLED*. O protótipo e o
teu prompt pedem *Classic, OLED, Titanium, Emerald, Solar*.

Implementados os do protótipo, que é a fonte de verdade visual, e são os que o
seletor de temas do protótipo mostra. Trocar é editar `THEMES` em `tokens.ts`.

### 4. Animar `width`

A Parte 9 diz para nunca animar `width`. O rail anima-o na expansão (88 → 280px),
e as barras de progresso animam a largura do preenchimento.

No rail é intencional: a expansão empurra o palco, e fazê-la por `transform`
deixaria o conteúdo a flutuar por cima em vez de o reposicionar. É uma transição
por elemento, no hover, sem custo mensurável.

Se quiseres a regra cumprida à letra, dá-se ao rail largura fixa de 280px com
`transform: translateX()` e compensa-se o palco — mas o resultado é pior.

---

### 5. Sem a palavra "JARVIS" no centro do núcleo

O protótipo tem `#coreLogo` — a palavra "JARVIS" sobre a luz central, camada 10
da Parte 8. **Retirada por decisão do utilizador.**

O centro fica só com a luz. A identidade continua no header, e o núcleo lê-se
melhor sem uma legenda a competir com o brilho. Nada mais da camada 10 mudou:
o núcleo energético, a respiração e o halo continuam como estavam.

### 6. Um perfil não leva a acessibilidade

A Parte 15 pede perfis completos, e a leitura literal seria guardar a
aparência inteira — incluindo alto contraste, transparência reduzida, correção
de daltonismo, escala da interface e bloqueio por inatividade.

**Decisão:** um perfil guarda o **ambiente** e não a acessibilidade. A lista
está em `AMBIENCE_KEYS` (`types/appearance.ts`), e o tipo `Ambience` torna a
regra impossível de contornar por distração: o que não está lá não chega ao
serviço que repõe.

**Porquê:** quem precisa de correção de daltonismo precisa dela em todos os
perfis. Um perfil "Jogos" que a desligasse ao ser aplicado era o sistema a
tirar à pessoa aquilo de que ela depende para o ver. O bloqueio por
inatividade fica de fora pela mesma ordem de razões — é uma decisão de
segurança (Parte 14), não de decoração.

Pela mesma lógica, **saltar de desktop não repõe som nem plugins**: mudar de
espaço não é mudar de definições. Só um perfil guardado com um nome, aplicado
de propósito, o faz. A distinção é o `WorkspaceScope`.

### 7. Layout do núcleo — mantido como está

Foram desenhadas e mostradas três propostas para reorganizar o núcleo no
palco (A · estado numa linha, B · a caixa encolhe com o núcleo, C · estado ao
lado), com medidas reais lado a lado com "como está hoje". **O utilizador
escolheu manter como está.** `AICore.tsx`, `CoreRings.tsx`, `core-size.ts` e
`Stage.tsx` continuam sem alteração — decisão fechada, não fica em aberto.
