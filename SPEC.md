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
| Vitest | 684 testes |
| `vite build` | produz |
| `cargo check` | limpo em desktop **e** em `aarch64-linux-android` |
| `npm run dev` | arranca sem avisos; consola do browser limpa |
| **PWA instalável** | manifesto, ícones 192/512 + `maskable` e service worker ativo. O Chromium reportou **zero erros de instalabilidade** em `Page.getInstallabilityErrors`. Verificado com a rede cortada: a aplicação abre, e **a tipografia Inter carrega**, porque deixou de vir do Google Fonts |
| **Zero pedidos para fora** | Medido em Chromium: nenhum pedido sai do `localhost`. Era falso até a fonte passar a local |
| Interface via `WebAdapter` | arranque, login, shell responsivo, AI Core, janelas, encaixe, paleta, temas, menu contextual, grelha de widgets com arrastar e persistência, pesquisa global na paleta, painel de notificações, loja de plugins, Emails, Tarefas, Projetos e Arquivos, **widgets de Disco e Rede**, **estados do sistema**, **sons sintetizados**, **comandos de voz**, **Centro de Programador**, **Privacidade**, **assistente com histórico, memória e contexto**, **quatro desktops com layouts guardados**, os **widgets de Calendário, Tarefas e IA**, o **daltonismo**, o **volume por categoria** e o **bloqueio por inatividade** |

O utilizador confirmou também no Termux, em browser, via `WebAdapter`.

## 2. Por confirmar — só com Tauri nativo

**Nada disto foi alguma vez executado.** O código compila para estes alvos, mas
compilar não é correr. Fica por verificar até haver um PC com Windows e um
dispositivo Android.

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
| **Rede real** — meteorologia, notícias, email | `services/{weather,news,mail}/providers/` | 🚫 bloqueado |
| **Reprodução de áudio** — música | `services/music/providers/` | 🚫 bloqueado |
| **Carregamento real de plugins** — sandbox, assinatura, ficheiros | `apps/plugin-manager/`, `plugins/plugin.ts` | 🚫 bloqueado |
| **Leitura real do disco** — explorador de ficheiros | `apps/files/`, `data/files.ts` | 🚫 bloqueado |
| Métricas reais do `sysinfo` (CPU, RAM, disco, rede) | `src-tauri/src/system/` | ⚠️ por testar |
| Lista de processos | `src-tauri/src/commands/system.rs` | ⚠️ por testar |
| Ícone na bandeja e respetivo menu | `src-tauri/src/tray.rs` | ⚠️ por testar |
| Atalho global `CTRL+ALT+J` | `src-tauri/src/shortcuts.rs` | ⚠️ por testar |
| Notificações nativas do sistema | plugin `notification` | ⚠️ por testar |
| Persistência via plugin `store` | `services/storage-service.ts` | ⚠️ por testar |
| Diálogos nativos de ficheiro | plugin `dialog` | ⚠️ por testar |
| Build Windows (MSI e NSIS) | `npm run tauri build` | ⚠️ por testar |
| Build Android (APK e AAB) | `npm run android:build` | ⚠️ por testar |
| Instalação como aplicação nativa | Tauri | ⚠️ por testar — **a PWA já cobre isto** no telemóvel |

> No browser, tudo isto está desligado nas capacidades do `WebAdapter` e
> substituído por simulação ou por vazio. Ver [PLATFORM.md](PLATFORM.md).

## 3. Regra em vigor a partir daqui

A **Fase 2 avançou sem essa confirmação, por decisão do utilizador**, e apenas
na parte que não toca no nativo — o sistema de widgets, testável em browser via
`WebAdapter`.

**Fica bloqueado até a Fase 1 correr num PC a sério:**

- Comandos Rust novos
- Qualquer integração nativa adicional (bandeja, atalhos, ficheiros, energia)
- Builds Windows e Android
- **Chamadas de rede reais.** Os serviços de meteorologia, notícias e email têm
  provedor e interface prontos, mas só a implementação simulada. Ligar um
  provedor HTTP é escrever uma classe e registá-la — nenhum componente muda
- **Reprodução de áudio.** O widget de música controla e mostra o estado; tocar
  som exigiria ficheiros locais ou integração com o Spotify
- **Leitura do disco.** O explorador tem navegação, migalhas e ordenação
  prontas e testadas, sobre uma árvore inventada. Ler o disco a sério exige o
  plugin `fs` e diálogos nativos
- **Execução de plugins.** A loja está feita — catálogo, categorias, pesquisa,
  permissões à vista, instalar, ativar, remover, tudo persistido. Instalar
  escreve num `Record` e nada mais: **nenhum código é descarregado nem
  executado**. Carregar um plugin a sério exige sandbox, verificação de
  assinatura e acesso ao sistema de ficheiros
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
| **Terminal** | Um terminal que não executa nada é estrutura a fingir. Precisa de um comando Rust e de sandbox |
| **Motor de automações** | ✅ **Feito.** A avaliação inicial estava errada: gatilhos por hora e por evento interno são reais dentro do browser. Só os do sistema — ficheiros, USB, bateria — é que exigem nativo |
| **Widget de GPU** | O `sysinfo` não lê a GPU. Mostrar um número inventado é pior do que não mostrar nada, e é a mesma razão pela qual o Monitor de recursos também não tem cartão de GPU |

O Terminal entra quando houver PC. O widget de GPU entra se e quando houver uma
forma honesta de ler a GPU.

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
| Serviços desacoplados | 🟡 | 6 dos 14: System, AI, Voice, Storage, Theme, Notification. Os restantes (Weather, Calendar, News, Email, Search, Device, Clock, Wallpaper, Plugin) são Fase 2 |
| Stores separadas | 🟡 | 6 das 15, pelo mesmo motivo |
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
| Efeitos sonoros | ⬜ | Sem recursos de áudio na Fase 1 |
| Modo de erro simulado | ⬜ | Marcado como opcional na spec |
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
| Biometria facial e digital | ✅ | Simuladas |
| Teclado PIN | ✅ | `PinKeypad.tsx` |
| Erros: shake, glow vermelho, foco mantido | ✅ | |
| Mensagens da IA com digitação | ✅ | |
| Atalhos do rodapé | 🟡 | Presentes, mas informam que a gestão de energia é Fase 2 |
| IA cumprimenta por voz na transição | ✅ | |
| Windows Hello, chave física, sessão automática | ⬜ | Exigem integração nativa |
| Avatar "viaja" até ao canto superior direito | ⬜ | A transição é fade + scale |

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
| Janelas: arrastar, redimensionar, z-index, persistência | ✅ | |
| Encaixe: metades, quartos, ecrã inteiro | ✅ | `components/windows/snap.ts` |
| Minimizar com viagem até ao dock | ✅ | `.window-minimizing` |
| Command Palette | ✅ | Comandos **e conteúdo**: emails, notícias e notificações entram nos resultados |
| **Sistema de widgets** | ✅ | Grelha de 12 colunas, arrastar, encaixe, redimensionar e persistência. No compacto **empilham-se a largura toda**, com linhas mais baixas. `components/widgets/` e `widgets/` |
| Widgets previstos | ✅ | Doze: Relógio, CPU, RAM, Disco, Rede, Clima, Notícias, Email, Música, **Calendário**, **Tarefas** e **IA**. O de Tarefas mexe nas mesmas tarefas da janela, e o de Calendário lê a mesma agenda. **GPU não entra**: ver §5 |
| Múltiplos desktops (1 a 4) | ✅ | Cada um com janelas, widgets, tema e papel de parede próprios. Quatro marcas no header. Um desktop por estrear **herda** o que está no ecrã em vez de abrir um vazio |
| Painel lateral de notificações com agrupamento | ✅ | `components/notifications/NotificationPanel.tsx` — categorias, pesquisa, ações rápidas e histórico persistido |
| Layouts guardados (Produtividade, Programação…) | ✅ | Os seis da especificação, mais os que se guardarem. Cada um repõe janelas, widgets e onde estão, tema e papel de parede. Os do sistema vêm do código a cada arranque, para uma correção chegar a quem já os tinha |
| Janelas: Emails, Tarefas, Projetos, Arquivos | ✅ | Emails em cima do `mailService`; Tarefas com prioridade, prazo, subtarefas e persistência; Projetos em leitura; Arquivos com árvore **simulada** |
| Janela: Automações | ✅ | Motor a sério — ver Parte 13 |
| Janelas: Centro de Programador e Privacidade | ✅ | Partes 16 e 14 |
| Janela: Terminal | ⬜ | Fora de âmbito por decisão — ver §5 |
| **Plugin Manager** | 🟡 | Loja completa em interface — catálogo, categorias, pesquisa, permissões, instalar/ativar/remover, persistido. **Não carrega código**: ver §2 |

---

## Parte 7.1 — Assistente JARVIS

| Item | | |
|---|:--:|---|
| Personalidade: elegante, objetiva, sem emojis | ✅ | `services/ai-service.ts` |
| Sem rosto — comunicação pelo núcleo | ✅ | Parte 8 |
| Cinco estados (ocioso, ouvindo, processando, respondendo, erro) | ✅ | `CORE_MODES` |
| Janela com histórico | ✅ | Conversas, não uma lista solta de mensagens: fixar, exportar em Markdown, favoritas, regenerar a última resposta e categorias por tempo (Fixadas, Hoje, Ontem, Últimos 7 dias, Mais antigas) |
| Digitação letra a letra | ✅ | `use-typewriter.ts` |
| Comandos naturais compreendidos | 🟡 | Abrir janelas, temas, widgets. A lista completa da spec é a Parte 10 |
| Memória local (preferências, últimos comandos) | ✅ | `services/assistant/memory-service.ts` — só guarda o que for dito por palavras ("trata-me por…", "moro em…"). Deduzir preferências do resto da conversa seria inventar sobre uma pessoa e depois usá-lo como verdade |
| Contexto (hora, clima, janelas abertas, notificações) | ✅ | `services/assistant/context.ts`. A fonte é injetada pela `App`, como o executor das automações — o serviço não conhece store nenhuma |
| **Provedor de IA real** | 🚫 | `AiProvider` está escrito e o serviço já o consome. Sem rede, só há o `RuleProvider` — ver §2 |
| Anexos: imagens, PDF, áudio, vídeo | ⬜ | Precisa de sistema de ficheiros |

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
| Reconhecimento pela Web Speech API | ✅ | `services/voice-service.ts` |
| Indicador de estado no header | ✅ | |
| Wake word configurável | ⬜ | Exige escuta contínua — decisão de privacidade por tomar |
| Pipeline completo (ruído, silêncio, idioma, planeamento) | 🟡 | Transcrição → intenção → execução → síntese. Faltam as etapas do meio |
| Agentes especializados | ⬜ | |
| AI Orchestrator | ⬜ | Parte 12 |
| Modo copiloto (sugestões discretas) | ⬜ | |
| Log de ações | ✅ | `services/log-service.ts`, visível no Centro de Programador e na aba de auditoria da Privacidade |
| Permissões por plugin | 🟡 | Declaradas, mostradas e **recusáveis** na janela de Privacidade, com a decisão persistida. Recusar ainda não impede nada, porque nenhum plugin executa código — e a interface di-lo por escrito |
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
| Pausar em segundo plano | ✅ | `useAnimationFrame` |
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
| Comandos de sistema, aplicações, produtividade, pesquisa, multimédia e desktop | ✅ | `services/voice/intents.ts` — as seis famílias da spec |
| Comandos compostos | ✅ | "Abre os emails, mostra os projetos e pausa" dá três ações. Só divide se todos os pedaços derem comando, senão um "e" dentro de um título partia a frase |
| Confirmação obrigatória em ações críticas | ✅ | Fechar as janelas e reiniciar a interface. O critério: dá para desfazer? |
| Correção de erros (mostrar o que foi reconhecido) | 🟡 | A frase ouvida e o que se percebeu dela aparecem numa notificação. Falta poder editar e voltar a executar |
| Não decorar comandos exatos | 🟡 | Várias formas de dizer o mesmo, sem acentos nem pontuação. Não há modelo de linguagem — e o ficheiro diz isso |
| Contexto ("amanhã", "esse ficheiro") | ⬜ | Depende do provedor de IA |
| Modos de escuta (manual, wake word, conversa, contínuo) | 🟡 | Só o manual. A escuta contínua é uma decisão de privacidade por tomar |
| Histórico de voz pesquisável | 🟡 | Fica no painel de notificações, na categoria do assistente |

---

## Parte 11 — Plugins e ecossistema

| Item | | |
|---|:--:|---|
| Plugin Manager com loja, categorias e pesquisa | ✅ | `apps/plugin-manager/` |
| Permissões declaradas e visíveis antes de instalar | ✅ | |
| Instalar, ativar, remover, persistido | ✅ | |
| Manifesto e contratos | ✅ | `plugins/plugin.ts` |
| **Carregar e executar um plugin** | 🚫 | Sandbox, assinatura e ficheiros — ver §2 |
| Isolamento entre plugins | 🚫 | Depende do carregamento |
| Event Bus global | ✅ | `services/event-bus.ts` — nove eventos tipados. Emitido por temas, estados, notificações, plugins, janelas, email e tarefas |
| API do Core para plugins | ⬜ | |
| Marketplace, SDK, atualizações, rollback | ⬜ | |

---

## Parte 12 — AI Orchestrator

| Item | | |
|---|:--:|---|
| Um provedor por módulo, trocável | ✅ | O padrão já está em `services/*/providers/` |
| Seleção automática de modelo por tarefa | ⬜ | |
| Regras de fallback | ⬜ | |
| **Ligação a OpenAI, Claude, Gemini, Ollama…** | 🚫 | Rede real — ver §2 |

---

## Parte 13 — Motor de automações

| Item | | |
|---|:--:|---|
| Gatilho → Condições → Ações | ✅ | `services/automation-service.ts` |
| Gatilhos por hora, intervalo, evento e manual | ✅ | O relógio guarda marcas de disparo — uma regra das 08:00 corre uma vez, não três |
| Condições: dia da semana, faixa horária, estado do sistema | ✅ | Funções puras, testadas à parte. A faixa que atravessa a meia-noite também |
| Ações: abrir janela, notificar, tema, estado, widget, voz | ✅ | Cumpridas por um executor injetado — o motor não conhece o WindowManager |
| Histórico com resultado, duração e motivo | ✅ | 60 execuções, persistido |
| Janela com ligar/desligar, executar e apagar | ✅ | `apps/automations/` |
| Templates | 🟡 | Cinco exemplos, todos desligados por omissão |
| Editor visual em blocos | ⬜ | |
| Criação por linguagem natural | ⬜ | Depende do provedor de IA |
| Execução em segundo plano com a interface fechada | 🚫 | Exige serviço nativo — hoje corre enquanto o JARVIS estiver aberto |
| **Gatilhos do sistema** (ficheiros, USB, bateria, rede) | 🚫 | Nativo |

---

## Parte 14 — Segurança e privacidade

| Item | | |
|---|:--:|---|
| Menor privilégio nas capabilities do Tauri | ✅ | `src-tauri/capabilities/` — uma por plataforma |
| Nunca abrir a shell a comandos da interface | ✅ | `url-policy.ts` só aceita `https:` e `mailto:`, e a capability impõe o mesmo |
| Erros tratados com `Result`, sem `unwrap()` | ✅ | `src-tauri/src/error.rs` |
| Autenticação com bloqueio e sessão | ✅ | Bloqueio por inatividade de 1 a 60 minutos, ou desligado, na janela de Privacidade. Conta em relógio de parede: um portátil suspenso não continua a contar em segundo plano |
| Painel de privacidade e permissões | ✅ | `apps/privacy/` — três abas: permissões por plugin, auditoria e o que cada capacidade da plataforma vê de facto |
| Auditoria de ações | ✅ | `logService.audit()`. Regista temas, estados do sistema, comandos de voz, automações e decisões de permissões — venham da paleta, da voz ou de uma regra |
| Cofre de segredos, criptografia, WebAuthn, 2FA | 🚫 | Nativo |
| Backups e restauro | ⬜ | |

> **A auditoria vive em memória, e é de propósito.** Escrever num ficheiro exige
> o plugin `fs` — bloqueado. E um registo de auditoria em `localStorage`, onde
> qualquer script da página o pode reescrever, seria pior do que não haver
> registo nenhum: dava a aparência de prova sem a ser. Fica na sessão até haver
> escrita nativa.

---

## Parte 15 — Personalização completa

| Item | | |
|---|:--:|---|
| Temas oficiais | ✅ | **Os dez.** Classic, OLED, Titanium, Emerald, Solar, Midnight Blue, Cyber Red, Graphite, Aurora e Arctic White — este último claro |
| Superfícies vindas dos tokens | ✅ | `tint`, `glass` e `glass-deep` em canais RGB, para o Tailwind lhes dar a opacidade. Um teste impede novos `bg-white/[…]` escritos à mão |
| Troca em tempo real, sem reiniciar | ✅ | |
| Sons por categoria | ✅ | Três categorias — Interface, Avisos, Sistema — cada uma com o seu volume, que multiplica o geral. Largar o cursor toca um som da própria categoria |
| Perfis de animação | 🟡 | Os estados do sistema fazem parte disto |
| Centro de Personalização | ✅ | Temas, aparência, estado do sistema, som e arranque numa janela só |
| Papéis de parede escolhíveis | ✅ | Quatro variantes — Nebulosa, Grelha, Partículas, Liso — com intensidade |
| Núcleo personalizável | 🟡 | Contagem de partículas, que se multiplica com o estado do sistema. Cor, anéis e velocidade ficam para depois |
| Escala, arredondamento e cursor | ✅ | `types/appearance.ts` — três estilos de cursor, três de arredondamento, escala de 90% a 130% |
| Acessibilidade (alto contraste, reduzir transparência) | ✅ | Mais a correção de daltonismo. A redução de movimento vem do sistema operativo e já era respeitada |
| Editor de temas personalizados | ⬜ | **Construível sem nativo** |
| Tipografia (família e pesos à escolha) | ⬜ | A escala já existe; falta trocar de fonte |
| Perfis completos (Trabalho, Gaming, Noite…) | 🟡 | Os layouts guardam janelas, widgets, tema e papel de parede. Faltam volume, animações e plugins ativos |
| Daltonismo | ✅ | Protanopia, deuteranopia e tritanopia, por `feColorMatrix` no `<html>`. **Corrige, não simula**, e alcança também os `<canvas>` do núcleo e dos gráficos — o que uma solução só de variáveis CSS não faria |
| Sincronização entre dispositivos | 🚫 | Rede |

---

## Parte 16 — Painel de desenvolvedor

| Item | | |
|---|:--:|---|
| Logs em tempo real, pesquisáveis | ✅ | `apps/developer-center/` — filtros por nível e por origem, pesquisa que também entra no detalhe |
| Diagnóstico do sistema | ✅ | `services/diagnostics.ts` — plataforma, adapter e capacidades, além do Monitor de recursos |
| Inspetor de eventos | ✅ | `logService.watchEventBus()` escuta o Event Bus inteiro e mostra o nome e a carga de cada evento |
| Desempenho (memória, tempo de arranque) | 🟡 | Arranque e `performance.memory`. **A memória só existe no Chromium** — noutros browsers mostra-se ausente em vez de um número inventado. FPS fica para depois |
| Estado dos serviços e dos adapters | ✅ | Plataforma, métricas, automações, som e registo, cada um com o que está mesmo a fazer |
| Consola de comandos | ⬜ | A Command Palette já executa; falta a consola livre |

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

---

## Divergências assumidas

Cinco pontos em que o código não segue a spec à letra. Todos deliberados.

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
