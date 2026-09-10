# JARVIS AI OS — Especificação (Partes em falta)

Partes 2, 3, 4, 5, 6.1, 6.2, 8, 9 e 17.

---

# PARTE 2 — DESIGN SYSTEM

## Filosofia
A interface deve transmitir a sensação de uma inteligência artificial viva. O objetivo não é parecer um painel administrativo nem um website. O utilizador deve sentir que está a operar um sistema operacional futurista, onde cada elemento responde de forma elegante às suas ações.

Palavras-chave: Elegância, Tecnologia, Precisão, Minimalismo, Sofisticação, Velocidade, Inteligência, Fluidez, Organização.

Evitar qualquer elemento visual infantil, chamativo em excesso ou desorganizado.

## Princípios
Simplicidade, Clareza, Hierarquia visual, Consistência, Legibilidade, Feedback imediato, Performance, Acessibilidade.

Nenhum componente deve existir apenas por decoração. Tudo deve possuir uma função.

## Cores
| Uso | Valor |
|---|---|
| Fundo principal (nunca preto puro) | `#05070A` |
| Fundo secundário (sidebar, header, dock, painéis) | `#0B1118` |
| Cards | `#101922` |
| Cards hover | `#162434` |
| Bordas (nunca fortes) | `rgba(255,255,255,0.06)` |
| Texto principal | `#FFFFFF` |
| Texto secundário | `#C5D1DF` |
| Texto terciário | `#7E91A8` |
| Azul principal (cor oficial, IA ativa) | `#00CFFF` |
| Azul neon (apenas brilhos) | `#00A2FF` |
| Verde (online, concluído, sucesso) | `#22C55E` |
| Amarelo (avisos) | `#FBBF24` |
| Vermelho (erros, perigo) | `#EF4444` |

## Tipografia
Inter. Fallback: SF Pro Display, depois `system-ui`. Nunca fontes futuristas difíceis de ler.

Tamanhos: Título principal 48px · Título de página 36px · Título de widget 22px · Subtítulo 18px · Texto 16px · Descrição 14px · Legenda 12px.

Pesos: 300, 400, 500, 600, 700. Jamais Black.

## Grid e espaçamento
Sistema de 12 colunas. Espaçamentos: 8, 16, 24, 32, 48, 64px. Nunca medidas aleatórias.

## Cantos
Botões 16px · Cards 20px · Modais 24px · Inputs 14px. Nunca cantos quadrados.

## Sombras
Cards: muito suaves, blur elevado, baixa opacidade. Hover: a sombra aumenta lentamente. Jamais parecer a flutuar exageradamente.

## Glassmorphism
Todo painel principal: background translúcido, blur entre 20 e 40px, leve brilho, reflexo superior, borda extremamente discreta.

## Ícones
Obrigatório Lucide React. Todos SVG. Nunca PNG, nunca emoji, nunca imagens. Todos com o mesmo tamanho, peso, alinhamento e estilo.

Tamanhos: Sidebar 22px · Header 20px · Widgets 24px · Botões 18px · Menus 18px.

## Botões
- **Primário:** fundo azul, texto branco, glow discreto. Hover: escala 1.02, sombra azul. Transição 200ms.
- **Secundário:** vidro, borda, hover suave.
- **Fantasma:** sem fundo, hover translúcido.

## Inputs
Altura 52px. Glassmorphism. Placeholder cinza. Borda discreta. Focus: glow azul.

## Scrollbar
Muito fina, azul translúcido. Hover: azul neon.

## Cursor
Animações suaves. Cursor pointer em componentes clicáveis. Opcionalmente cursor personalizado futurista.

## Animações
Todas entre 150ms e 350ms. Jamais ultrapassar 600ms.

Tipos obrigatórios: Fade, Scale, Glow, Slide, Ripple, Pulse, Scanner, Radar, Float, Blur, Shimmer, Morph, Typing, Wave. Todas com aceleração por GPU.

## Hover
Todo elemento interativo responde. Cards: leve elevação, glow, borda mais clara. Botões: escala, brilho. Ícones: mudança suave de cor.

## Loading
Nunca spinner comum. Loaders futuristas: scanner, radar, linhas, anéis, partículas.

## Microinterações
Todo clique gera feedback. Toda mudança é animada. Todo botão responde. Toda janela abre suavemente. Toda notificação desliza. Todo widget reage ao rato.

## Papel de parede
Background exclusivo, misturando nebulosa, grid, linhas luminosas, partículas, gradientes escuros, leve parallax. Nunca imagens prontas — tudo procedural via CSS e Canvas.

## Qualidade final
O resultado deve parecer um software comercial premium. Nenhum elemento deve parecer retirado de um template. A identidade visual deve ser consistente em todas as telas. O utilizador deve reconhecer o sistema apenas pelo visual, mesmo sem ver o nome JARVIS.

---

# PARTE 3 — ARQUITETURA DO PROJETO

## Missão
Software comercial de nível empresarial. A arquitetura deve suportar milhares de componentes, dezenas de módulos e futuras integrações sem reestruturação.

Nunca desenvolver tudo em arquivos gigantes. Nunca misturar lógica com interface. Nunca criar componentes reutilizáveis apenas parcialmente. Toda funcionalidade deve ser desacoplada.

## Stack obrigatória
React 19 · TypeScript (Strict) · Vite · Tailwind CSS · shadcn/ui · Lucide React · Framer Motion · GSAP · Recharts · HTML5 Canvas · Three.js · Zustand · TanStack Query · Zod · React Hook Form · LocalStorage + IndexedDB · React Router · date-fns · next-themes (ou equivalente para Vite).

## Estrutura de pastas
```
src/
  app/
  components/
    layouts/
    pages/
    widgets/
    assistant/
    system/
  hooks/
  contexts/
  store/
  services/
  api/
  utils/
  lib/
  constants/
  types/
  styles/
  assets/
    icons/
    fonts/
    sounds/
    videos/
  animations/
  workers/
  config/
  data/
  tests/
```

## Componentes
Cada componente com uma só responsabilidade: Button, Card, Input, Dialog, Modal, Sidebar, Dock, Window, SearchBar, Widget, Graph, Notification, Tooltip, Avatar, Badge, Progress, CommandPalette, QuickAction, VoiceButton, AIOrb, Radar, Waveform, ParticleCanvas.

Nunca criar componentes gigantes.

## Widgets
Cada widget totalmente independente, com: Header, Body, Footer, Settings, Loading, Empty, Error, Skeleton. Cada widget pode ser movido, redimensionado, ocultado e restaurado.

## Assistente IA — módulos
Speech Recognition · Speech Synthesis · Conversation · Commands · Context · History · Memory · Voice · Animations · Audio · Prompt Engine · Plugin Manager · Future AI Providers.

## Serviços (todos desacoplados)
WeatherService · CalendarService · NewsService · EmailService · NotificationService · StorageService · VoiceService · AIService · SearchService · DeviceService · ClockService · ThemeService · WallpaperService · PluginService.

## API
Nunca chamar APIs diretamente nos componentes.

Fluxo obrigatório: `Component → Hook → Service → API → Response`

## Estado global (Zustand)
Stores separadas: Theme, Assistant, Notifications, Widgets, Settings, User, Calendar, Tasks, Music, Weather, Devices, Voice, Windows, Dock, Workspace.

## Sistema de janelas
Cada janela: ID único, posição, largura, altura, minimizado, maximizado, fechado, z-index, persistência, animações, arrastar, redimensionar, snap nas bordas.

## Sistema de widgets
Cada widget: ID, nome, ícone SVG, descrição, categoria, permissões, posição, tamanho, estado, preferências, persistência.

## Sistema de temas
Escuro, Claro, Azul, Grafite, Carbono, OLED. Cada tema altera cores, glow, sombras, plano de fundo, widgets, botões, inputs, gráficos, scrollbar, cursores.

## Performance
60 FPS constante · carregamento inferior a 2s · Lighthouse acima de 95 · lazy loading em módulos pesados · code splitting · memoização · virtualização de listas · Web Workers para tarefas pesadas · canvas otimizado · animações aceleradas por GPU.

## Segurança
Sanitização de entradas, proteção contra XSS, validação de dados, tratamento global de erros, logs centralizados, fallbacks.

## Padrão de nomes
Componentes `PascalCase` · Hooks `useNome` · Funções `camelCase` · Constantes `UPPER_CASE` · Tipos e Interfaces `PascalCase` · Ficheiros `kebab-case`.

## Documentação
README para: Projeto, Instalação, Execução, Deploy, Arquitetura, Componentes, Widgets, IA, Comandos, Temas, Plugins.

## Qualidade final
O projeto deve parecer desenvolvido por uma equipa sénior. Código limpo, modular, reutilizável, escalável, preparado para receber novas funcionalidades durante anos sem refatoração estrutural. Nenhum componente deve depender diretamente de outro quando essa dependência puder ser abstraída por serviços, hooks ou interfaces.

---

# PARTE 4 — TELA DE BOOT

## Objetivo
Impacto imediato. O utilizador deve sentir que iniciou um sistema operacional de IA extremamente avançado. Duração total entre 6 e 10 segundos, reduzida nas inicializações seguintes. Nunca vídeos — tudo em HTML, CSS, Canvas, SVG e JavaScript, a 60 FPS.

## Fundo
`#05070A` com nebulosa discreta, partículas lentas, grid tecnológico, linhas holográficas, ruído digital muito leve, gradientes escuros animados e vinheta nas bordas. Nada completamente parado.

## Etapas
1. **Tela escura.** Após 300ms surge um ponto azul `#00CFFF` no centro. Pulsa lentamente, o brilho aumenta, uma onda circular expande-se. Som suave de energia.
2. **Anéis.** O ponto transforma-se em 6 a 10 anéis. Cada um gira a velocidade diferente, com glow, blur, linhas técnicas, marcadores e detalhes vetoriais. Nenhum anel igual a outro.
3. **Texto a digitar.** Ex.: `Initializing Artificial Intelligence Core...` — letra por letra, cursor a piscar, velocidade variável. Ao concluir, a linha fica verde e aparece um ícone SVG de confirmação.
4. **Verificações.** Checking Memory, Checking Neural Engine, Loading Voice Engine, Loading Graphics Engine, Initializing Security, Loading Modules, Loading Interface, Synchronizing Clock, Loading Plugins, Preparing Desktop. Cada linha com ícone SVG, status, barra de progresso, tempo e animação. Concluído: ícone verde. Nunca emojis.
5. **Gráficos técnicos.** CPU, RAM, GPU, Rede, Disco — simulados, animados, linhas suaves, glow.
6. **Núcleo JARVIS.** Agora muito maior, cerca de 400px. Radar, scanner, ondas, glow, partículas, rotação, reflexos, linhas orbitais, efeito holográfico. Ao fundo, pequenas partículas ligam-se ao núcleo.
7. **Mensagem central.** `JARVIS AI` / `Artificial Intelligence Operating System` / `Version 1.0` / `Project ARC`. Fonte elegante, fade suave, glow discreto.
8. **Sistema fala.** Via SpeechSynthesis: "Bom dia. Todos os sistemas foram inicializados com sucesso." Enquanto fala: o núcleo pulsa, aparecem ondas de voz, partículas acompanham.
9. **Scanner completo.** Uma linha azul percorre a tela. Ao passar, aparecem painéis, widgets, sidebar, header e dock — tudo sincronizado.
10. **Desktop carregado.** Fade, blur a reduzir, widgets a deslizar, sidebar a expandir, header a aparecer, dock a subir, assistente a ficar ativo.

## Efeitos sonoros
Inicialização, energia, scanner, confirmação, erro, notificação. Todos discretos, nunca exagerados nem irritantes, inspirados em computadores futuristas.

## Transições
Opacity, scale, translate, blur, glow, rotation, ripple, wave, morph. Nunca transições bruscas.

## Performance
`requestAnimationFrame`, `transform`, `opacity`, aceleração por GPU. Evitar propriedades que causem reflow.

## Pular boot
Após a primeira execução, guardar no LocalStorage. Nas seguintes mostrar apenas logo, núcleo e "Bem-vindo de volta", em menos de 2 segundos. Botão "Mostrar sequência completa" nas configurações.

## Modo de erro (simulado)
Opcional. Mostra erro em vermelho, falha no módulo, tentativa de recuperação e reinicialização. Nunca bloqueia o sistema — serve só para demonstração.

## Resultado esperado
Experiência cinematográfica, elegante e altamente tecnológica, digna de apresentações da Apple, Microsoft ou NVIDIA. Ao terminar, o utilizador deve sentir que entrou num ambiente computacional avançado e totalmente funcional, e não numa simples aplicação web.

---

# PARTE 5 — TELA DE LOGIN

## Objetivo
Transmitir segurança, sofisticação e inteligência. A sensação deve ser a de desbloquear um computador de última geração. Toda a interface parece viva; nada está completamente parado.

Fluxo: `Boot Sequence → Tela de Login → Desktop`. A transição deve ser contínua, nunca abrupta.

## Plano de fundo
O mesmo do sistema, com nebulosa escura, grid tecnológico, linhas luminosas, partículas lentas, ruído discreto e leve parallax conforme o movimento do rato.

## Cabeçalho
Centro superior: logo JARVIS e subtítulo "Artificial Intelligence Operating System". Abaixo: data completa, hora em tempo real, fuso horário, previsão do tempo, estado da IA. Todos atualizados automaticamente.

## Perfil
Cartão em glassmorphism ao centro. Largura ~520px, bordas 20px, blur 40px, reflexo superior, glow azul muito discreto.

## Avatar
Circular, 120px. Com fotografia se existir; caso contrário, avatar minimalista gerado. Ao aproximar o cursor: pequena rotação, glow, escala 102%.

## Informações
Nome, cargo (opcional), último acesso, estado, dispositivo, rede. Todos alinhados. Nunca emojis — apenas ícones SVG.

## Métodos de login
Senha, PIN, reconhecimento facial (simulado), impressão digital (simulada), Windows Hello (simulado), chave física (simulada), sessão automática. Cada um com o seu ícone SVG.

## Campo de senha
Glassmorphism, altura 56px, placeholder elegante, mostrar/ocultar senha, indicador de CAPS LOCK, indicador de força, feedback em tempo real.

## Botão
Texto "Entrar" com ícone SVG. Hover: glow azul, leve aumento, ripple. Active: redução de escala. Focus: borda azul.

## Biometria
- **Facial:** scanner holográfico, linhas percorrem o avatar, pontos ligam-se, mensagem "Analisando biometria…". Após ~2s: acesso autorizado, som suave, glow verde.
- **Digital:** impressão digital vetorial. Ao manter pressionado, scanner azul com percentagem de leitura, concluído em ~2s, mensagem "Identidade confirmada."
- **PIN:** teclado numérico elegante, botões circulares, hover, ripple, glow, feedback tátil visual.

## Erros
Senha incorreta: balançar o cartão, glow vermelho, mensagem discreta, som de erro suave. Após o erro o campo continua focado. Nunca recarregar a página.

## Mensagens da IA
Surgem com efeito de digitação: "Bom dia.", "Tudo pronto para começar.", "Os sistemas estão operacionais.", "Agenda disponível.", "Você possui três compromissos hoje."

## Notificações
Mostrar discretamente clima, agenda, notícias, estado da rede, atualizações. Sempre opcionais, nunca poluir a tela.

## Atalhos e rodapé
Canto inferior: desligar, reiniciar, suspender, acessibilidade, idioma, rede — cada um com ícone SVG. Rodapé: versão do sistema, estado da licença, nome do dispositivo, IP simulado, consumo de memória simulado.

## Animações
Fade, slide, blur, scale, glow, typing, scanner, ripple, wave, pulse. Todas entre 150ms e 300ms, a 60 FPS.

## Acessibilidade
Navegação por teclado, ARIA labels, contraste AA, leitor de ecrã, estados de foco bem definidos.

## Responsividade
Desktop, notebook, tablet, telemóvel, ultrawide. Em ecrãs pequenos o cartão adapta-se, o avatar reduz e os botões reorganizam-se, sem perda de funcionalidade.

## Personalização
Permitir alterar imagem do utilizador, plano de fundo, tema, idioma e método de login preferido. Persistir tudo no armazenamento local.

## Transição para o desktop
Após autenticação: o cartão dissolve-se lentamente; o avatar transforma-se num pequeno círculo que "viaja" até ao canto superior direito, tornando-se a foto de perfil; a barra superior desliza do topo; a sidebar surge da esquerda; a dock sobe de baixo; os widgets aparecem em cascata; o núcleo holográfico acende-se ao centro; a IA cumprimenta por voz: "Bem-vindo. Todos os sistemas estão prontos." Só então o ambiente fica totalmente interativo.

---

# PARTE 6.1 — DESKTOP PRINCIPAL (WORKSPACE)

## Objetivo
O elemento mais impressionante do sistema. Não deve lembrar Windows, macOS ou Linux, nem parecer um website. A sensação deve ser a de entrar na sala de controlo de uma nave futurista. Todo elemento parece vivo; nada está completamente parado; tudo reage ao utilizador.

## Resolução
Projetar para 2560×1440, depois adaptar para 1920×1080, 1600×900, 1366×768, tablet, mobile e ultrawide. Nunca apenas redimensionar — **reposicionar componentes.**

## Fundo
Wallpaper procedural, jamais imagem pronta. Misturar nebulosa, gradientes, grid tecnológico, linhas holográficas, ruído digital, partículas, radar, luz volumétrica e pequenos pontos luminosos. Movimento extremamente lento, quase impercetível.

## Profundidade (9 camadas)
1. Wallpaper · 2. Nebulosa · 3. Grid · 4. Partículas · 5. Linhas holográficas · 6. Widgets · 7. Janelas · 8. Menus · 9. Cursores. Cada camada com profundidade diferente.

## Header
Fixo, altura 72px, glassmorphism, blur 30px, borda inferior extremamente discreta, nunca totalmente opaco.

- **Esquerda:** logo JARVIS, estado da IA, nome do sistema, versão, indicador online.
- **Centro:** pesquisa global, largura ~650px, placeholder "O que deseja fazer?", ícone SVG, atalho CTRL+K, animação e glow azul ao focar.
- **Direita:** microfone, notificações, clima, hora, data, temperatura, perfil. Cada botão com hover, glow, tooltip e ripple.

## Sidebar
Fixa. 88px recolhida, 280px expandida. Glassmorphism, blur, glow discreto.

Itens: Dashboard, Assistente, Pesquisa, Arquivos, Projetos, Calendário, Agenda, Emails, Mensagens, Notas, Downloads, Automações, Dispositivos, IA, Analytics, Configurações, Perfil, Logout. Todos com ícones SVG Lucide.

**Comportamento:** ao passar o rato expande automaticamente, mostra texto, anima ícones, aumenta o brilho, e uma linha azul acompanha o item ativo.

**Item ativo:** glow, indicador lateral, texto branco, ícone azul, leve escala.

## Dock
Inferior, centralizado. Inspirado no macOS mas totalmente futurista. Glassmorphism, blur 40px, reflexos, glow.

Itens: Explorador, Terminal, Assistente, Browser, Email, Música, Calendário, Projetos, Configurações, IA. Com animação ao abrir.

## Núcleo da IA
Elemento principal, centro da tela, diâmetro 380px.

10 anéis independentes, cada um com velocidade, glow, espessura e rotação próprias, com pequenos detalhes técnicos, marcas, traços, nós e conexões. Centro: logo JARVIS. Ao redor: radar, scanner, ondas, reflexos, energia, pequenas partículas.

**Comportamento:**
- *Idle:* rotação lenta, glow suave, partículas, respiração.
- *Ao mover o rato:* o núcleo acompanha discretamente, até 5 graus.
- *Ao clicar:* pulso, ondas, som.
- *Ao falar:* mostra ondas sonoras, aumenta o brilho, partículas aceleram.
- *Ao responder:* mostra frequência, oscilações, glow aumenta.

## Painéis e grid
Todo painel usa glassmorphism, blur, borda suave, glow, sombra discreta e animações. Nunca cartões simples. Widgets encaixam automaticamente, com drag and drop, snap e persistência.

## Cursor
Cursor padrão substituído por um cursor tecnológico: pequeno círculo com glow. Ao passar sobre elementos: expande, muda de cor, mostra feedback.

## Menu contextual
Clique direito abre menu elegante — nunca o menu padrão do navegador. Opções: Novo Widget, Nova Nota, Novo Projeto, Alterar Tema, Personalizar Desktop, Atualizar, Configurações, Ajuda. Cada item com ícone SVG.

## Som e iluminação
Pequenos sons: clique, abrir, fechar, mover, notificação, erro, confirmação — todos discretos. Sempre criar sensação de iluminação indireta; glow nunca exagerado; reflexos discretos; luzes suaves.

## Qualidade
Nenhum canto desalinhado, nenhum texto desalinhado, nenhuma animação brusca, nenhuma sombra exagerada. O desktop deve impressionar mesmo antes de qualquer interação. Ao observar durante alguns segundos, o utilizador deve perceber pequenas animações contínuas, transmitindo que a IA está permanentemente ativa e a monitorizar o ambiente.

---

# PARTE 6.2 — WIDGETS, JANELAS E WORKSPACE

## Filosofia
O Desktop é modular. Tudo pode ser movido, redimensionado, fixado, ocultado, duplicado, agrupado, desagrupado, com layout salvo e restaurado. Cada utilizador cria o seu ambiente. Nada tem posição fixa, exceto Header e Sidebar.

## Sistema de widgets
Cada widget possui: ID único, nome, descrição, ícone SVG, categoria, permissões, estado, tema, cor, posição, largura, altura, configurações, persistência, última atualização.

**Estrutura:** Header (ícone SVG, título, descrição, menu de ações, minimizar, fechar), área de conteúdo, rodapé (indicador de atualização, status).

**Interações:**
- *Hover:* borda recebe glow azul, o widget eleva ~4px, a sombra aumenta suavemente, os botões aparecem.
- *Clique:* ripple discreto, feedback visual.
- *Arrastar:* opacidade a 95%, linhas-guia, áreas válidas para encaixe, snap inteligente.
- *Redimensionar:* animação suave, conteúdo adapta-se, jamais cortar informação.

## Widgets previstos
- **Clima:** cidade, temperatura, sensação térmica, humidade, vento, pressão, nascer e pôr do sol, previsão a 7 dias, ícone SVG conforme a condição, background muda discretamente com o clima.
- **Relógio:** digital e analógico opcional, segundos suaves, data completa, fuso horário, calendário rápido.
- **CPU:** gráfico em tempo real, uso percentual, temperatura, clock, núcleos, consumo. Visual inspirado em centros de monitorização.
- **RAM:** uso, livre, cache, histórico, gráfico animado.
- **GPU:** uso, temperatura, VRAM, clock, FPS estimado.
- **Rede:** download, upload, latência, IP, status, pacotes.
- **Disco:** espaço livre e utilizado, leitura, gravação, saúde do SSD.
- **Calendário:** vista mensal, semanal, diária, eventos, compromissos, lembretes, integração futura com Google Calendar.
- **Tarefas:** lista organizada, filtros, prioridade, etiquetas, data limite, subtarefas, progresso, arrastar para reorganizar.
- **Notícias:** atualização automática, categorias, favoritos, pesquisa, leitura rápida, abrir em painel lateral.
- **Email:** caixa de entrada, não lidos, favoritos, pesquisa, resposta rápida, indicador de anexos.
- **Música:** capa, nome, artista, barra de progresso, play, pause, próxima, anterior, volume, integração futura com Spotify.
- **IA:** resumo do dia, sugestões, comandos recentes, perguntas frequentes, estado da IA, consumo de processamento.

## Sistema de janelas
Cada aplicação abre em janela com barra superior, ícone, título, minimizar, maximizar, fechar, menu e estado.

**Movimentação:** arrastar livremente, snap automático, encaixe em metade esquerda, metade direita, quartos da tela e tela inteira.

**Camadas:** gestão de profundidade, sempre trazer para a frente ao clicar, manter histórico.

**Minimizar:** animação para a dock, escala a reduzir, fade. **Maximizar:** expansão suave, sem salto visual. **Fechar:** fade, escala reduzida, persistir estado se configurado.

## Múltiplos desktops
Desktop 1 a 4. Cada um com widgets, janelas, wallpaper e tema próprios.

## Command Palette
Atalho CTRL+K. Pesquisa global em arquivos, configurações, widgets, comandos, notas, projetos, emails, calendário e IA. Tudo em tempo real.

## Sistema de pesquisa
Pesquisa instantânea, resultados agrupados, ícones SVG, filtros, atalhos, histórico, sugestões inteligentes.

## Sistema de notificações
Painel lateral com agrupamento, categorias, ícone, título, descrição, hora, ações rápidas, persistência e pesquisa.

## Layouts e auto-save
Permitir salvar layouts: Produtividade, Programação, Design, Estudos, Streaming, Jogos. Cada layout restaura widgets, posições, tema, janelas e atalhos.

Guardar automaticamente: posição dos widgets, tema, desktop ativo, preferências, janelas abertas, última sessão.

## Sistema de plugins
Arquitetura preparada para instalar novos widgets futuramente. Cada plugin pode adicionar widget, janela, comando, tema, serviço e integração, sem modificar o núcleo.

## Resultado esperado
O Desktop deve transmitir um verdadeiro sistema operacional inteligente. O utilizador deve conseguir personalizar completamente o ambiente sem perder consistência visual. Todas as interações fluidas, previsíveis e elegantes. O ambiente inteiro funciona como um ecossistema coeso, preparado para crescer através de novos módulos e plugins.

---

# PARTE 8 — AI CORE (NÚCLEO HOLOGRÁFICO)

## Objetivo
O coração visual do sistema. Representa a presença da IA. Não é um logotipo, nem um loader, nem uma animação decorativa. O utilizador deve sentir que existe uma entidade viva dentro do sistema.

O AI Core permanece ativo durante toda a utilização. Mesmo sem interação, pequenas animações indicam que a IA continua a funcionar.

## Localização
Centro exato da tela, elemento principal do Desktop. Quando janelas forem abertas, o núcleo reduz discretamente para ~75%. Nunca desaparece completamente.

## Tecnologias
Canvas API, SVG, WebGL, Three.js, shaders GLSL quando necessário. Nunca GIF, nunca vídeo. Toda animação procedural.

## Dimensões
Desktop 420px · Notebook 360px · Tablet 280px · Mobile 220px. Escalonamento proporcional.

## Estrutura — 10 camadas
1. **Halo externo** — glow muito suave, rotação extremamente lenta.
2. **Anel principal** — grande, espesso, detalhes técnicos, marcas, divisões.
3. **Anel secundário** — rotação inversa, velocidade diferente.
4. **Anel interno** — mais fino, glow intenso.
5. **Radar** — varredura contínua, linha luminosa.
6. **Scanner** — linhas horizontais, opacidade variável.
7. **Partículas orbitais** — centenas, cada uma com velocidade própria.
8. **Núcleo energético** — centro luminoso, respiração.
9. **Ondas sonoras** — aparecem apenas durante a voz.
10. **Logo JARVIS** — minimalista, branco, sem efeitos exagerados.

## Anéis
- **Principal:** divisões, pequenos traços, marcas angulares, indicadores, linhas técnicas. Rotação 3°/s. Nunca parar.
- **Secundário:** rotação inversa a 7°/s, leve blur.
- **Interno:** movimento irregular, pequenas acelerações e desacelerações. Nunca perfeitamente constante.

## Radar
Linha luminosa que percorre 360°, uma volta a cada 4 segundos. Ao encontrar partículas, pequeno brilho.

## Partículas
Cerca de 300. Cada uma com tamanho, velocidade, brilho, opacidade, direção e vida útil próprios. Nunca repetem exatamente o mesmo movimento — usar ruído procedural para criar naturalidade.

**Conexões:** quando duas partículas se aproximam, criar uma linha luminosa temporária que desaparece suavemente. Nunca criar uma malha completamente conectada.

## Pulsação
O núcleo "respira": a escala varia entre 100% e 103%, em ciclos de 5 segundos. Muito discreto.

## Estados
- **Ocioso:** glow azul, poucas partículas, movimentos lentos, radar ativo, respiração.
- **Escutando:** anéis aceleram, glow aumenta, partículas convergem para o centro, aparecem ondas e linha de áudio. Texto "Ouvindo…".
- **Processando:** rotação acelera, scanner inicia, radar duplica a velocidade, partículas mais rápidas, pequenos flashes. Texto "Analisando…".
- **Respondendo:** as ondas acompanham exatamente a fala. A intensidade da voz altera amplitude, brilho, escala e velocidade das ondas.
- **Erro:** glow vermelho, rotação desacelera, radar interrompe, mensagem elegante. Nunca efeitos de falha exagerados.
- **Sucesso:** glow verde, pulso único, pequena explosão de partículas, depois regressa ao normal.

## Reações
- **Ao cursor:** o núcleo acompanha discretamente, limite máximo 6 graus. Nunca seguir exatamente o cursor — apenas sugerir atenção.
- **Ao clique:** pulso, ripple circular, som suave, glow aumenta durante 400ms.
- **À IA:** quando responde, sincronização perfeita entre voz, glow, ondas, partículas e radar. Toda a animação deve parecer uma única entidade.

## Efeitos visuais
Glow multicamada, bloom, blur, reflexos, gradientes radiais, sombras suaves, ruído digital, refração, luz volumétrica. Nunca exagerar.

## Desempenho
60 FPS. `requestAnimationFrame`, canvas otimizado, instanced rendering quando possível, evitar cálculos desnecessários, pausar animações complexas quando a aba estiver em segundo plano.

## Qualidade final
O AI Core deve ser a assinatura visual do sistema. Mesmo sem ler o nome "JARVIS", qualquer pessoa deve reconhecer esse elemento como o centro da IA. Não deve parecer uma animação repetitiva — deve parecer um organismo digital vivo, a reagir em tempo real ao utilizador, à voz, às notificações e ao estado do sistema.

---

# PARTE 9 — ANIMAÇÕES E MICROINTERAÇÕES

## Objetivo
As animações não existem apenas para estética. Toda animação comunica estado, intenção, hierarquia e feedback. O utilizador nunca deve perguntar "o botão funcionou?". Toda ação gera resposta visual.

Nunca animações exageradas. Nunca sacrificar desempenho por efeitos. A meta é parecer software de uma equipa de UX ao nível da Apple, Tesla ou Linear.

## Princípios
Naturalidade, suavidade, consistência, precisão, elegância, fluidez, resposta imediata, aceleração física, desaceleração natural.

## Frame rate
60 FPS constante; 120 FPS em monitores compatíveis. Usar `requestAnimationFrame`, `transform`, `opacity`, `scale`, `translate3d`, aceleração por GPU.

**Nunca animar:** `width`, `height`, `top`, `left`, `margin`.

## Durações
Hover 120ms · Clique 150ms · Abrir widget 220ms · Fechar widget 180ms · Abrir janela 280ms · Fechar janela 220ms · Notificação 250ms · Mudança de tema 500ms · Transição entre telas 600ms · Boot 6000–10000ms.

## Curvas
Preferir `ease-out`, `ease-in-out`, spring physics. Nunca `linear` para elementos da interface — apenas para radar, relógio e scanner.

## Estados obrigatórios
Todos os componentes interativos: hover, focus, active, disabled, loading, error, success, empty, selecionado, a arrastar.

## Comportamentos
- **Botões.** Hover: escala 1.02, glow azul, sombra aumenta, ícone desloca 2px. Clique: escala 0.98, ripple circular, feedback imediato.
- **Inputs.** Ao focar: glow azul, borda ilumina, placeholder move ligeiramente para cima, cursor aparece suavemente.
- **Cards.** Hover: elevação 4px, glow discreto, reflexo acompanha a posição do cursor. Clique: pulso muito leve.
- **Sidebar.** Ao expandir: largura aumenta, texto aparece com fade + slide, ícones deslocam, linha azul desliza. Nunca surgir instantaneamente.
- **Dock.** Ícones aumentam conforme o cursor se aproxima; os vizinhos também aumentam discretamente. Inspirado no macOS, mas com comportamento próprio. Ao abrir aplicação: ícone pulsa, glow, indicador inferior acende.
- **Janelas.** Abrir: escala 95%→100%, fade, blur reduz. Fechar: escala 100%→95%, fade, blur aumenta. Minimizar: a janela "viaja" até à dock. Maximizar: expansão suave, sem cortes bruscos.
- **Notificações.** Entram pela lateral direita com fade, slide e blur. Ao desaparecer: opacidade reduz e deslizam para fora. Nunca desaparecer instantaneamente.
- **Scroll.** Extremamente suave, com inércia, pequena desaceleração e barra minimalista.
- **Troca de tema.** As cores transformam-se gradualmente; glow muda; plano de fundo adapta-se; widgets atualizam. Nunca trocar instantaneamente.
- **Troca de desktop.** O plano de fundo desloca-se; widgets desaparecem em cascata; o novo ambiente entra suavemente. A IA permanece sempre visível.

## Núcleo da IA
Nunca repetir exatamente o mesmo movimento. Criar pequenas variações aleatórias de velocidade, brilho, partículas, rotação e respiração — sempre dentro de limites discretos.

## Efeitos de luz e partículas
Glow multicamada, bloom, reflexos, halo, luz indireta. Nunca brilho excessivo.

Partículas nunca seguem trajetórias repetitivas. Cada uma com velocidade, direção, vida útil, opacidade, escala e cor ligeiramente diferentes. Usar ruído procedural para evitar padrões.

## Rato
O cursor influencia o glow dos widgets, reflexos, AI Core, dock, botões e cards, criando sensação de profundidade.

## Som
Cada som tem propósito: clique, abrir, fechar, erro, confirmação, scanner, notificação. Todos discretos, nunca a competir com música.

## Estados do sistema
Normal, Economia, Foco, Apresentação, Performance. Cada modo altera discretamente animações, glow, transições e consumo de recursos.

## Qualidade final
Nenhuma animação deve parecer "template". Cada movimento transmite um sistema operacional premium e inteligente. O utilizador deve continuar a descobrir pequenos detalhes mesmo após semanas de uso — variações subtis no AI Core, respostas contextuais, transições naturais entre estados. A interface deve parecer viva, elegante e tecnologicamente avançada, mantendo sempre a prioridade na usabilidade, acessibilidade e desempenho.

---

# PARTE 17 — ARQUITETURA FINAL E ROADMAP

## Visão geral
Plataforma modular, escalável e preparada para crescer durante muitos anos. A arquitetura deve permitir adicionar funcionalidades sem reescrever o sistema, mantendo performance, organização e facilidade de manutenção.

## Arquitetura em camadas
```
Interface (UI)
  ↓
Design System
  ↓
Gestor de Estado
  ↓
Core do Sistema
  ↓
AI Orchestrator
  ↓
Plugin Manager
  ↓
Serviços
  ↓
Banco de Dados
  ↓
Modelos de IA
  ↓
Serviços Externos
```
Cada camada comunica apenas através de APIs internas bem definidas.

## Stack
**Frontend:** React, TypeScript, Vite, Tailwind CSS, Framer Motion, Three.js, React Three Fiber, Canvas API, WebGL, SVG.

**Backend:** Node.js, NestJS, Fastify, WebSocket, REST API, GraphQL (opcional).

**Base de dados:** SQLite (local), PostgreSQL (servidor), Redis (cache), Vector Database (RAG e memória semântica).

**Armazenamento:** IndexedDB, LocalStorage, sistema de ficheiros, cloud sync opcional.

**IA:** OpenAI, Claude, Gemini, DeepSeek, Mistral, Ollama, LM Studio, vLLM, Llama.cpp, servidores MCP — todos integrados através do AI Orchestrator.

## Estrutura de pastas
```
/core  /ui  /components  /widgets  /windows  /plugins  /themes
/icons  /assets  /animations  /audio  /services  /api  /database
/models  /memory  /automation  /voice  /ai  /orchestrator  /mcp
/security  /settings  /localization  /utils  /tests  /docs  /scripts
```
Cada diretório com responsabilidades claras.

## Design System
Sistema unificado: Botões, Inputs, Cards, Modais, Menus, Sidebar, Dock, Header, Widgets, Janelas, Notificações, Tooltips, Diálogos. Todos reutilizam o mesmo conjunto de cores, espaçamentos, tipografia, ícones, animações, sombras e glassmorphism.

## Gestão de estado
Estado dividido em módulos independentes: Sistema, Utilizador, IA, Plugins, Widgets, Janelas, Automações, Notificações, Temas, Sessão.

## Sistema de eventos
Event Bus central. Todos os módulos comunicam através de eventos: login realizado, tema alterado, plugin instalado, nova mensagem, resposta da IA, automação executada, desktop alterado, servidor MCP conectado.

## Sincronização
Permitir sincronizar configurações, perfis, widgets, conversas, temas, automações, plugins, layouts e histórico entre múltiplos dispositivos.

## Versões da plataforma
JARVIS Web (navegador) · JARVIS Desktop (Windows, macOS, Linux) · JARVIS Mobile (Android, iOS) · JARVIS Server (empresas).

## Modo offline / online
**Offline:** notas, projetos, widgets locais, pesquisa local, modelos locais, automações, conversas locais.

**Online:** pesquisa web, serviços cloud, emails, calendários, sincronização, modelos na nuvem, notícias, meteorologia.

## Testes
Unitários, de integração, end-to-end, visuais, de performance, de segurança e de acessibilidade. Executados automaticamente no pipeline de CI/CD.

## CI/CD
Automatizar build, lint, testes, análise de código, empacotamento, publicação, geração de changelog e versionamento.

## Roadmap
- **Fase 1 — MVP:** Boot, Login, Desktop, AI Core, Chat, widgets principais, sistema de temas, configurações.
- **Fase 2 — Beta:** Plugins, Automações, Command Palette, sistema de voz, Marketplace, Perfis, Layouts.
- **Fase 3 — v1.0:** AI Orchestrator, MCP, modelos locais, Cloud Sync, SDK, Developer Center.
- **Fase 4 — Pro:** Agentes especializados, colaboração, multiutilizador, workspaces, partilha de automações, marketplace oficial.
- **Fase 5 — Enterprise:** SSO, LDAP, Azure AD, Google Workspace, Microsoft 365, auditoria avançada, gestão centralizada, alta disponibilidade.

## Objetivos de desempenho
Inicialização inferior a 3 segundos · 60 FPS constante · uso reduzido de memória · carregamento progressivo · lazy loading · code splitting · cache inteligente · renderização otimizada.

## Objetivos de experiência
O utilizador deve sentir que está a utilizar um sistema operacional de IA nativo. Todas as funcionalidades devem parecer integradas. Nenhum módulo deve transmitir a sensação de ser um "plugin colado". A experiência deve ser contínua, elegante, rápida e consistente.

## Missão final
O objetivo não é criar apenas um dashboard. É criar um novo paradigma de interação entre humanos e computadores — um ambiente onde a Inteligência Artificial deixa de ser uma aplicação separada e passa a ser o próprio sistema operacional, acompanhando o utilizador em todas as tarefas, aprendendo continuamente, automatizando processos, organizando informações e tornando a experiência computacional mais natural, eficiente e inteligente.
