# Conformidade com a especificação

Mapa entre as partes do documento e o código. Serve para a Fase 2 saber onde
continuar, e para não se perder de vista o que ficou deliberadamente por fazer.

Legenda: ✅ implementado · 🟡 parcial · ⬜ Fase 2+ · ⚠️ divergência assumida

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
| Grid de 12 colunas | ⬜ | O layout usa flex e grid próprios; o sistema de 12 colunas só faz sentido com o sistema de widgets |
| Loaders futuristas | 🟡 | O arranque tem-nos; o `Suspense` das janelas usa texto |

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
| Botão "Mostrar sequência completa" nas configurações | 🟡 | Está na Command Palette, não na janela de Personalização |

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
| Núcleo ao centro | ✅ | |
| Menu contextual com os 8 itens | ✅ | |
| Camadas de profundidade | ✅ | |
| Sons | ⬜ | |

---

## Parte 6.2 — Widgets, janelas e workspace

| Item | | |
|---|:--:|---|
| Janelas: arrastar, redimensionar, z-index, persistência | ✅ | |
| Encaixe: metades, quartos, ecrã inteiro | ✅ | `components/windows/snap.ts` |
| Minimizar com viagem até ao dock | ✅ | `.window-minimizing` |
| Command Palette | ✅ | |
| **Sistema de widgets** | ⬜ | Fase 2 — interfaces em `src/plugins/` |
| Múltiplos desktops (1 a 4) | ⬜ | Excluído do âmbito da Fase 1 |
| Painel lateral de notificações com agrupamento | ⬜ | A Fase 1 tem toasts |
| Layouts guardados (Produtividade, Programação…) | ⬜ | O layout das janelas persiste; os perfis são Fase 2 |

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
| 10. Logo JARVIS | ✅ | |

| Estado | | |
|---|:--:|---|
| Ocioso · Escutando · Processando · Respondendo · Erro | ✅ | |
| **Sucesso** | ✅ | Glow verde, pulso e explosão de partículas |

| Outro | | |
|---|:--:|---|
| Dimensões 420/360/280/220 | ✅ | `core-size.ts` |
| Reduz a 75% com janelas abertas | ✅ | |
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
| Sons | ⬜ | |
| Estados do sistema (Foco, Apresentação…) | ⬜ | Fase 2 |

---

## Parte 17 — Roadmap

A Fase 1 do roadmap — Boot, Login, Desktop, AI Core, Chat, temas, configurações —
está entregue, menos os "widgets principais", que dependem do sistema de widgets
da Fase 2.

---

## Divergências assumidas

Quatro pontos em que o código não segue a spec à letra. Todos deliberados.

### 1. Estrutura de pastas

A Parte 3 pede `src/{app,components/{layouts,pages,widgets,assistant,system},contexts,store,api,utils,constants,assets,animations,workers,data}`.

O que existe é a árvore aprovada no arranque desta sessão, organizada por
domínio (`platform/`, `services/`, `stores/`, `components/{shell,ai-core,windows,boot,auth}/`, `apps/`) em vez de por tipo de ficheiro.

Reorganizar é mecânico mas toca em 144 ficheiros. **Fica por decidir.**

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
