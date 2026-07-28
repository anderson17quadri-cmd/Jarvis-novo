# JARVIS AI OS — Especificação Completa (Partes 1 a 17)

Documento único, sem cortes, para contexto completo permanente.

---

# PARTE 1 — PROMPT DE UI/UX DESIGNER + VISÃO GERAL

## Missão
UI/UX Designer Senior, Product Designer, Front-end Engineer Senior, especialista em interfaces futuristas. Missão: criar **JARVIS AI Desktop**, sistema operacional de IA inspirado no Homem de Ferro, com identidade própria, profissional, elegante, realista. NÃO deve parecer um site — deve parecer um sistema operacional completo.

## Qualidade obrigatória
Qualidade AAA, nível Apple/Tesla/Microsoft/Linear/Framer/Arc Browser/Notion. Transmitir: Tecnologia, Luxo, Inteligência, Minimalismo, Precisão, Fluidez, Elegância. Jamais infantil, genérico, ou componentes simples.

## Não utilizar
Nunca emojis, nunca ícones em formato emoji. Só SVG profissionais (Lucide, Heroicons, Tabler, Phosphor).

## Paleta original
`#05070A` fundo · `#0B1118` fundo secundário · `#101922` cards · `#152434` cards hover · `rgba(255,255,255,.08)` bordas · `#FFFFFF` texto principal · `#B4C2D3` texto secundário · `#728197` texto terciário · `#00CFFF` azul principal · `#00A2FF` azul neon · `#22C55E` verde · `#F59E0B` laranja · `#EF4444` vermelho.

## Tipografia
Inter ou SF Pro Display, pesos 300–700, hierarquia perfeita.

## Layout geral
Sidebar fixa, header fixo, painéis arrastáveis, widgets organizados, grid inteligente, espaçamentos consistentes, responsivo.

**Sidebar:** Dashboard, Assistente IA, Arquivos, Agenda, Calendário, Emails, Mensagens, Tarefas, Projetos, Automações, Pesquisa, Notificações, Dispositivos, Downloads, Configurações, Perfil. Hover elegante, glow azul, linha lateral ativa.

**Header:** logo, pesquisa global, microfone, notificações, perfil, hora, data, status online, uso de IA, temperatura.

**Centro:** núcleo holográfico (reator ARC) — anéis, rotação, glow, scanner, radar, ondas, partículas, reflexos, blur, vidro. Reage à voz: pulsa, expande, ondas.

**Assistente IA:** campo grande, botão de voz, botão enviar, histórico, resposta digitando. Indicadores "Pensando…", "Ouvindo…", "Falando…". Avatar holográfico. Speech Synthesis/Recognition.

**Painel direito:** clima, calendário, agenda, próximos compromissos, modo foco, CPU, RAM, GPU, rede, disco, temperatura, bateria.

**Painel esquerdo:** atalhos rápidos, projetos recentes, arquivos recentes, últimos comandos, favoritos.

**Widgets:** glassmorphism, hover, glow, título, ícone SVG, descrição, valor, gráfico, botões, menu, movíveis.

**Gráficos:** elegantes, linhas suaves, glow, animações, tooltip.

**Notificações:** sistema próprio, animação lateral, ícone, título, descrição, hora, fechar.

**Animações (60 FPS):** fade, slide, scale, rotate, glow, ripple, pulse, radar, scanner, floating, blur, parallax, glass, shimmer, loading, typing, morph.

**Microinterações:** hover e clique em tudo, feedback visual, ripple, glow, transições suaves.

**Fundo:** grid futurista, partículas, nebulosa, linhas luminosas, radar, canvas, contínuo.

**Efeitos:** glassmorphism, backdrop blur, glow, reflexo, sombra, ruído, gradientes, camadas, luzes.

**Responsividade:** desktop, notebook, tablet, celular, ultrawide. **Acessibilidade:** ARIA, contraste, teclado, focus.

**Código:** organizado, modular, sem duplicação, funções reutilizáveis, boas práticas, performance máxima.

**Resultado:** o usuário deve sentir que usa um verdadeiro SO de IA do futuro, nível de filme de ficção científica mas funcional no mundo real. Nenhum componente genérico. Zero emojis.

---

## VISÃO GERAL — JARVIS AI OS Versão 1.0 (Codinome Project ARC)

**Objetivo:** SO baseado em IA inspirado no JARVIS do Homem de Ferro, totalmente original. Não é website, não é dashboard comum — é o computador do futuro. Produtividade, velocidade, elegância, inteligência. Cada pixel desenhado manualmente. Zero templates prontos, zero cópia de interfaces existentes.

**Personalidade da IA — JARVIS:** Inteligente, Elegante, Objetiva, Educada, Rápida, Precisa, Tecnológica. Nunca infantil, nunca emojis, nunca efeitos exagerados.

**Experiência:** impacto visual imediato na primeira abertura. Interface viva, nada estático, tudo responde, cada clique gera feedback, tudo parece conectado.

**Objetivos funcionais:** IA pessoal que centraliza produtividade, arquivos, calendário, tarefas, e-mails, dispositivos, notícias, automações, pesquisa, comandos.

**Tecnologias (visão inicial):** React, TypeScript, Vite, Tailwind, shadcn/ui, Framer Motion, GSAP, React Query, Zustand, React Router, Recharts, Motion One, React Hook Form, Zod, Lucide Icons, Three.js, Canvas API, Web Speech API, Speech Synthesis API, Web Audio API, LocalStorage, IndexedDB. *(Adaptado depois para Tauri v2 — ver SPEC.md do projeto.)*

**Padrão de código:** TypeScript Strict, nunca `any`, componentes pequenos e reutilizáveis, hooks reutilizáveis, separação UI/lógica, Clean Architecture, SOLID, DRY, KISS.

**Qualidade:** todo componente com estados hover/focus/active/disabled/loading/error/success/empty/skeleton, transitions, animações suaves, responsividade, acessibilidade.

**Meta visual:** Iron Man, JARVIS, Apple Vision Pro, Nothing OS, Tesla, Arc Browser, Linear, Framer, Microsoft Fluent, Material 3, Cyberpunk elegante, HUD futurista — minimalista, nunca exagerado.

**Objetivo final:** qualquer pessoa deve acreditar que usa um verdadeiro SO de IA do futuro, digno de keynote da Apple/Microsoft/NVIDIA.

---

# PARTE 2 — DESIGN SYSTEM

**Filosofia:** IA viva, não painel administrativo nem website. Elegância, Tecnologia, Precisão, Minimalismo, Sofisticação, Velocidade, Inteligência, Fluidez, Organização. Zero infantilidade ou desorganização.

**Princípios:** Simplicidade, Clareza, Hierarquia visual, Consistência, Legibilidade, Feedback imediato, Performance, Acessibilidade. Nada decorativo sem função.

**Cores:** fundo `#05070A` (nunca preto puro) · secundário `#0B1118` · cards `#101922` · cards hover `#162434` · bordas `rgba(255,255,255,0.06)` · texto `#FFFFFF`/`#C5D1DF`/`#7E91A8` · azul principal `#00CFFF` · azul neon `#00A2FF` (só brilhos) · verde `#22C55E` · amarelo `#FBBF24` · vermelho `#EF4444`.

**Tipografia:** Inter → SF Pro Display → system-ui. Tamanhos: título 48px, página 36px, widget 22px, subtítulo 18px, texto 16px, descrição 14px, legenda 12px. Pesos 300–700, nunca Black.

**Grid:** 12 colunas. Espaçamento: 8/16/24/32/48/64px, nunca aleatório.

**Cantos:** botões 16px, cards 20px, modais 24px, inputs 14px — nunca quadrados.

**Sombras:** cards suaves, blur elevado, baixa opacidade; hover aumenta lentamente, nunca flutuar exagerado.

**Glassmorphism:** todo painel principal — translúcido, blur 20–40px, brilho leve, reflexo superior, borda discreta.

**Ícones:** Lucide React, só SVG, nunca PNG/emoji/imagem, mesmo tamanho/peso/alinhamento/estilo. Tamanhos: sidebar 22px, header 20px, widgets 24px, botões 18px, menus 18px.

**Botões:** primário (fundo azul, glow discreto, hover escala 1.02, 200ms), secundário (vidro, borda, hover suave), fantasma (sem fundo, hover translúcido).

**Inputs:** altura 52px, glassmorphism, placeholder cinza, borda discreta, focus glow azul.

**Scrollbar:** fina, azul translúcido, hover azul neon.

**Cursor:** animações suaves, pointer em clicáveis, opcionalmente cursor futurista.

**Animações:** 150–350ms, nunca >600ms. Tipos: Fade, Scale, Glow, Slide, Ripple, Pulse, Scanner, Radar, Float, Blur, Shimmer, Morph, Typing, Wave — todas com GPU.

**Hover:** cards elevam+glow+borda clara; botões escala+brilho; ícones mudam de cor suavemente.

**Loading:** nunca spinner comum — scanner, radar, linhas, anéis, partículas.

**Microinterações:** todo clique/mudança/botão/janela/notificação/widget gera feedback animado.

**Papel de parede:** procedural (CSS+Canvas), nunca imagem pronta — nebulosa, grid, linhas luminosas, partículas, gradientes escuros, leve parallax.

**Qualidade final:** software comercial premium, nada de template, identidade consistente em todas as telas — reconhecível só pelo visual, mesmo sem o nome JARVIS.

---

# PARTE 3 — ARQUITETURA DO PROJETO

**Missão:** nível empresarial, milhares de componentes, dezenas de módulos, integrações futuras sem reestruturação. Nunca arquivos gigantes, nunca lógica misturada com interface, tudo desacoplado.

**Stack obrigatória:** React 19, TypeScript Strict, Vite, Tailwind CSS, shadcn/ui, Lucide React, Framer Motion, GSAP, Recharts, HTML5 Canvas, Three.js, Zustand, TanStack Query, Zod, React Hook Form, LocalStorage+IndexedDB, React Router, date-fns, next-themes (ou equivalente Vite).

**Estrutura de pastas:**
```
src/
  app/  components/{layouts,pages,widgets,assistant,system}/
  hooks/  contexts/  store/  services/  api/  utils/  lib/
  constants/  types/  styles/  assets/{icons,fonts,sounds,videos}/
  animations/  workers/  config/  data/  tests/
```

**Componentes:** uma responsabilidade cada — Button, Card, Input, Dialog, Modal, Sidebar, Dock, Window, SearchBar, Widget, Graph, Notification, Tooltip, Avatar, Badge, Progress, CommandPalette, QuickAction, VoiceButton, AIOrb, Radar, Waveform, ParticleCanvas. Nunca gigantes.

**Widgets:** independentes — Header, Body, Footer, Settings, Loading, Empty, Error, Skeleton. Movíveis, redimensionáveis, ocultáveis, restauráveis.

**Assistente IA — módulos:** Speech Recognition, Speech Synthesis, Conversation, Commands, Context, History, Memory, Voice, Animations, Audio, Prompt Engine, Plugin Manager, Future AI Providers.

**Serviços (desacoplados):** WeatherService, CalendarService, NewsService, EmailService, NotificationService, StorageService, VoiceService, AIService, SearchService, DeviceService, ClockService, ThemeService, WallpaperService, PluginService.

**API:** nunca chamada direta nos componentes. Fluxo: `Component → Hook → Service → API → Response`.

**Estado global (Zustand):** stores separadas — Theme, Assistant, Notifications, Widgets, Settings, User, Calendar, Tasks, Music, Weather, Devices, Voice, Windows, Dock, Workspace.

**Janelas:** ID, posição, largura, altura, minimizado/maximizado/fechado, z-index, persistência, animações, arrastar, redimensionar, snap.

**Widgets — atributos:** ID, nome, ícone SVG, descrição, categoria, permissões, posição, tamanho, estado, preferências, persistência.

**Temas:** Escuro, Claro, Azul, Grafite, Carbono, OLED — cada um altera cores, glow, sombras, fundo, widgets, botões, inputs, gráficos, scrollbar, cursores.

**Performance:** 60 FPS, <2s carregamento, Lighthouse >95, lazy loading, code splitting, memoização, virtualização, Web Workers, canvas otimizado, GPU.

**Segurança:** sanitização, proteção XSS, validação, tratamento global de erros, logs centralizados, fallbacks.

**Nomenclatura:** Componentes `PascalCase`, Hooks `useNome`, Funções `camelCase`, Constantes `UPPER_CASE`, Tipos/Interfaces `PascalCase`, Ficheiros `kebab-case`.

**Documentação:** README para Projeto, Instalação, Execução, Deploy, Arquitetura, Componentes, Widgets, IA, Comandos, Temas, Plugins.

**Qualidade final:** equipa sénior, código limpo/modular/reutilizável/escalável, sem refatoração estrutural por anos.

---

# PARTE 4 — TELA DE BOOT

**Objetivo:** impacto imediato, SO de IA extremamente avançado. Duração 6–10s, reduzida depois. Nunca vídeos — HTML/CSS/Canvas/SVG/JS a 60 FPS.

**Fundo:** `#05070A`, nebulosa discreta, partículas lentas, grid tecnológico, linhas holográficas, ruído digital leve, gradientes animados, vinheta.

**Etapas:**
1. Tela escura → após 300ms ponto azul `#00CFFF` pulsante, onda circular, som de energia.
2. Ponto vira 6–10 anéis, velocidades diferentes, glow, blur, linhas técnicas, marcadores — nenhum igual.
3. Texto digitando: `Initializing Artificial Intelligence Core...` letra a letra, cursor a piscar. Concluído → linha verde + ícone SVG.
4. Verificações: Checking Memory, Checking Neural Engine, Loading Voice Engine, Loading Graphics Engine, Initializing Security, Loading Modules, Loading Interface, Synchronizing Clock, Loading Plugins, Preparing Desktop. Ícone SVG + status + barra + tempo por linha. Ícone verde ao concluir. Nunca emojis.
5. Gráficos técnicos simulados: CPU, RAM, GPU, Rede, Disco — animados, glow.
6. Núcleo JARVIS ~400px: radar, scanner, ondas, glow, partículas, rotação, reflexos, linhas orbitais, holográfico. Partículas ligam-se ao fundo.
7. Mensagem central: `JARVIS AI` / `Artificial Intelligence Operating System` / `Version 1.0` / `Project ARC`.
8. Sistema fala (SpeechSynthesis): "Bom dia. Todos os sistemas foram inicializados com sucesso." Núcleo pulsa, ondas, partículas acompanham.
9. Scanner completo: linha azul percorre a tela, revela painéis/widgets/sidebar/header/dock sincronizados.
10. Desktop carregado: fade, blur reduz, widgets deslizam, sidebar expande, header aparece, dock sobe, assistente ativo.

**Sons:** inicialização, energia, scanner, confirmação, erro, notificação — discretos.

**Transições:** opacity, scale, translate, blur, glow, rotation, ripple, wave, morph — nunca bruscas.

**Performance:** `requestAnimationFrame`, `transform`, `opacity`, GPU; evitar reflow.

**Pular boot:** LocalStorage após 1ª execução; depois só logo+núcleo+"Bem-vindo de volta" em <2s. Botão "Mostrar sequência completa" nas configurações.

**Modo de erro simulado:** opcional, erro vermelho, falha no módulo, recuperação, reinicialização — nunca bloqueia, só demonstração.

**Resultado:** cinematográfico, elegante, digno de Apple/Microsoft/NVIDIA.

---

# PARTE 5 — TELA DE LOGIN

**Objetivo:** segurança, sofisticação, inteligência — desbloquear computador de última geração. Fluxo: `Boot → Login → Desktop`, contínuo, nunca abrupto.

**Fundo:** igual ao sistema — nebulosa, grid, linhas, partículas, ruído, parallax pelo rato.

**Cabeçalho:** logo JARVIS + subtítulo. Data, hora, fuso, previsão do tempo, estado da IA — tudo automático.

**Perfil:** cartão glassmorphism ~520px, bordas 20px, blur 40px, reflexo superior, glow discreto.

**Avatar:** circular 120px, foto ou gerado. Hover: rotação leve, glow, escala 102%.

**Informações:** nome, cargo opcional, último acesso, estado, dispositivo, rede — só ícones SVG, nunca emoji.

**Métodos de login:** senha, PIN, facial (simulado), digital (simulado), Windows Hello (simulado), chave física (simulada), sessão automática — cada um com ícone SVG.

**Campo de senha:** glassmorphism, 56px, mostrar/ocultar, CAPS LOCK, força, feedback em tempo real.

**Botão "Entrar":** ícone SVG, hover glow+escala+ripple, active reduz escala, focus borda azul.

**Facial:** scanner holográfico, linhas no avatar, pontos ligados, "Analisando biometria…" ~2s → "Acesso autorizado", som, glow verde.

**Digital:** impressão vetorial, scanner azul com %, ~2s, "Identidade confirmada."

**PIN:** teclado numérico circular, hover, ripple, glow, feedback tátil.

**Erros:** cartão balança, glow vermelho, mensagem discreta, som suave. Campo continua focado, nunca recarrega a página.

**Mensagens da IA:** com efeito de digitação — "Bom dia.", "Tudo pronto para começar.", "Os sistemas estão operacionais.", "Agenda disponível.", "Você possui três compromissos hoje."

**Notificações discretas:** clima, agenda, notícias, rede, atualizações — opcionais, nunca poluem.

**Atalhos:** desligar, reiniciar, suspender, acessibilidade, idioma, rede — SVG. **Rodapé:** versão, licença, dispositivo, IP simulado, memória simulada.

**Animações:** fade/slide/blur/scale/glow/typing/scanner/ripple/wave/pulse, 150–300ms, 60 FPS.

**Acessibilidade:** teclado, ARIA, contraste AA, leitor de ecrã, foco definido.

**Responsividade:** desktop→ultrawide, sem perda de funcionalidade.

**Personalização:** imagem, fundo, tema, idioma, método preferido — persistido localmente.

**Transição para desktop:** cartão dissolve, avatar "viaja" para o canto superior direito, header desliza do topo, sidebar surge da esquerda, dock sobe, widgets em cascata, núcleo acende ao centro, IA fala "Bem-vindo. Todos os sistemas estão prontos." Só então interativo.

---

# PARTE 6.1 — DESKTOP PRINCIPAL (WORKSPACE)

**Objetivo:** elemento mais impressionante — não Windows/macOS/Linux, não website. Sala de controlo de nave futurista. Tudo vivo, tudo reage.

**Resolução:** projetar 2560×1440 → adaptar 1920×1080/1600×900/1366×768/tablet/mobile/ultrawide. Nunca só redimensionar — **reposicionar**.

**Fundo:** wallpaper procedural — nebulosa, gradientes, grid, linhas holográficas, ruído, partículas, radar, luz volumétrica, pontos luminosos. Movimento quase impercetível.

**Profundidade (9 camadas):** Wallpaper, Nebulosa, Grid, Partículas, Linhas holográficas, Widgets, Janelas, Menus, Cursores.

**Header:** fixo, 72px, glassmorphism, blur 30px, borda inferior discreta, nunca opaco.
- Esquerda: logo, estado da IA, nome, versão, indicador online.
- Centro: pesquisa global ~650px, "O que deseja fazer?", CTRL+K, glow ao focar.
- Direita: microfone, notificações, clima, hora, data, temperatura, perfil — hover/glow/tooltip/ripple.

**Sidebar:** fixa, 88px recolhida / 280px expandida, glassmorphism, blur, glow.
Itens: Dashboard, Assistente, Pesquisa, Arquivos, Projetos, Calendário, Agenda, Emails, Mensagens, Notas, Downloads, Automações, Dispositivos, IA, Analytics, Configurações, Perfil, Logout.
Comportamento: hover expande, texto aparece, ícones animam, brilho aumenta, linha azul acompanha o ativo. Item ativo: glow, indicador lateral, texto branco, ícone azul, leve escala.

**Dock:** inferior centralizado, estilo macOS mas futurista, glassmorphism, blur 40px, reflexos, glow.
Itens: Explorador, Terminal, Assistente, Browser, Email, Música, Calendário, Projetos, Configurações, IA.

**Núcleo da IA:** centro, 380px. 10 anéis independentes (velocidade/glow/espessura/rotação próprios, marcas, traços, nós, conexões). Centro: logo JARVIS. Ao redor: radar, scanner, ondas, reflexos, energia, partículas.
- Idle: rotação lenta, glow suave, respiração.
- Ao mover o rato: acompanha até 5°.
- Ao clicar: pulso, ondas, som.
- Ao falar: ondas sonoras, brilho, partículas aceleram.
- Ao responder: frequência, oscilações, glow aumenta.

**Painéis:** sempre glassmorphism+blur+borda+glow+sombra+animação, nunca cartões simples. Grid inteligente com drag-and-drop, snap, persistência.

**Cursor:** substituído por círculo tecnológico com glow; expande e muda de cor sobre elementos.

**Menu contextual:** próprio (nunca o do navegador) — Novo Widget, Nova Nota, Novo Projeto, Alterar Tema, Personalizar Desktop, Atualizar, Configurações, Ajuda.

**Som/iluminação:** cliques, abrir, fechar, mover, notificação, erro, confirmação discretos; iluminação indireta, glow nunca exagerado.

**Qualidade:** nada desalinhado, nada brusco. Desktop deve impressionar antes de qualquer interação; pequenas animações contínuas transmitem IA sempre ativa.

---

# PARTE 6.2 — WIDGETS, JANELAS E WORKSPACE

**Filosofia:** modular — mover, redimensionar, fixar, ocultar, duplicar, agrupar, salvar/restaurar layout. Só Header e Sidebar têm posição fixa.

**Widget — atributos:** ID, nome, descrição, ícone SVG, categoria, permissões, estado, tema, cor, posição, largura, altura, configurações, persistência, última atualização.
**Estrutura:** Header (ícone, título, descrição, menu de ações, minimizar, fechar), conteúdo, rodapé (atualização, status).
**Interações:** hover → glow+eleva 4px+sombra+botões aparecem; clique → ripple; arrastar → opacidade 95%+guias+snap; redimensionar → suave, nunca corta conteúdo.

**Widgets previstos:**
- **Clima:** cidade, temperatura, sensação, humidade, vento, pressão, nascer/pôr do sol, previsão 7 dias, ícone conforme condição, fundo muda discretamente.
- **Relógio:** digital + analógico opcional, segundos suaves, data completa, fuso, calendário rápido.
- **CPU:** gráfico tempo real, uso%, temperatura, clock, núcleos, consumo.
- **RAM:** uso, livre, cache, histórico, gráfico.
- **GPU:** uso, temperatura, VRAM, clock, FPS estimado.
- **Rede:** download, upload, latência, IP, status, pacotes.
- **Disco:** espaço livre/usado, leitura, gravação, saúde SSD.
- **Calendário:** vista mensal/semanal/diária, eventos, compromissos, lembretes, integração futura Google Calendar.
- **Tarefas:** lista, filtros, prioridade, etiquetas, data limite, subtarefas, progresso, arrastar.
- **Notícias:** atualização automática, categorias, favoritos, pesquisa, painel lateral.
- **Email:** caixa de entrada, não lidos, favoritos, pesquisa, resposta rápida, anexos.
- **Música:** capa, nome, artista, progresso, play/pause/próxima/anterior, volume, integração futura Spotify.
- **IA:** resumo do dia, sugestões, comandos recentes, FAQ, estado da IA, consumo.

**Janelas:** barra superior (ícone, título, minimizar, maximizar, fechar, menu, estado). Movimentação livre + snap (metades, quartos, tela inteira). Camadas: z-index, sempre para a frente ao clicar, histórico. Minimizar → viaja para dock; maximizar → suave; fechar → fade+escala, persiste se configurado.

**Múltiplos desktops:** 1–4, cada um com widgets/janelas/wallpaper/tema próprios.

**Command Palette:** CTRL+K, pesquisa global (arquivos, config, widgets, comandos, notas, projetos, emails, calendário, IA) em tempo real.

**Pesquisa:** instantânea, resultados agrupados, ícones SVG, filtros, atalhos, histórico, sugestões.

**Notificações:** painel lateral, agrupamento, categorias, ícone, título, descrição, hora, ações rápidas, persistência, pesquisa.

**Layouts salvos:** Produtividade, Programação, Design, Estudos, Streaming, Jogos — cada um restaura widgets/posições/tema/janelas/atalhos.

**Auto-save:** posição dos widgets, tema, desktop ativo, preferências, janelas abertas, última sessão.

**Plugins:** arquitetura preparada — cada plugin pode adicionar widget/janela/comando/tema/serviço/integração sem tocar no núcleo.

**Resultado:** ecossistema coeso, personalizável sem perder consistência.

---

# PARTE 7.1 — ASSISTENTE JARVIS (INTELIGÊNCIA ARTIFICIAL)

**Missão:** não é chatbot, não é janela de conversa, não é widget — IA residente em todo o sistema, sempre ativa, sempre disponível. O utilizador nunca "procura" a IA; ela acompanha-o em todas as áreas.

**Personalidade:** Elegância, Inteligência, Calma, Objetividade, Educação, Rapidez, Confiança, Precisão. Nunca emojis, piadas infantis, memes, informalidade exagerada, respostas longas desnecessárias. Fala como assistente executivo extremamente competente.

**Voz:** natural, calma, segura, grave, fluida, sem pausas robóticas. Melhor voz disponível no navegador; troca de voz nas configurações.

**Aparência:** sem rosto — nunca personagem humano, robô ou avatar anime. Representação: núcleo holográfico, anéis, ondas, radar, partículas, luz, energia. Toda comunicação parte do núcleo.

**Estados (cor/glow/velocidade/partículas/som/animação mudam):**
- **Ocioso:** glow azul suave, rotação lenta, poucas partículas, respiração.
- **Ouvindo:** anéis aceleram, ondas sonoras, partículas convergem, glow aumenta. "Ouvindo…"
- **Processando:** rotação e scanner aumentam, linhas orbitais, pontos luminosos. "Analisando…"
- **Respondendo:** ondas sincronizadas com voz, brilho pulsante, partículas expandem, radar ativo.
- **Erro:** glow vermelho, rotação reduz, mensagem elegante, nunca assusta.

**Comunicação:** janela dedicada com histórico, pesquisa, fixar mensagens, exportar, favoritos, copiar resposta, regenerar, interromper geração, apagar conversa, nova conversa, categorias.

**Caixa de mensagem:** campo grande, altura automática, suporta texto/código/imagens/PDF/áudio/vídeo, arrastar ficheiros, colar imagens/capturas.

**Botões:** microfone, enviar, parar resposta, nova conversa, anexar, capturar ecrã — só SVG.

**Digitação:** resposta letra a letra, cursor a piscar, velocidade variável — nunca instantânea.

**Comandos naturais compreendidos:** abrir calendário, criar tarefa, pesquisar ficheiro, mostrar temperatura, abrir navegador, criar nota, enviar email, lembrar-me amanhã, mostrar CPU, silenciar notificações, alterar tema, fechar janelas, mostrar agenda, pesquisar na Internet.

**Memória local:** preferências, nome, idiomas, temas favoritos, widgets favoritos, últimos comandos, histórico, conversas recentes. Nunca apaga automaticamente sem autorização.

**Contexto compreendido:** hora, data, clima, dispositivo, estado do sistema, janelas/aplicações abertas, projetos, compromissos, notificações — sempre usado para responder melhor.

**Automações em linguagem natural:** "Todos os dias às 08:00 abre a agenda.", "Às sextas mostra o relatório semanal.", "Quando eu ligar o computador abre o Spotify.", "Quando chegar um email importante avisa-me."

**Pesquisa antes de responder:** arquivos, projetos, notas, emails, calendário, widgets, histórico.

**Plugins:** toda funcionalidade avançada via plugin — Clima, Spotify, Gmail, Outlook, GitHub, Google Calendar, WhatsApp, Telegram, Discord, Home Assistant, Philips Hue, OpenAI, Ollama, LM Studio, MCP. Instalável/removível sem mexer no núcleo.

**Qualidade:** o utilizador deve sentir que fala com o próprio SO, não com um chatbot isolado — o JARVIS coordena informação, executa ações, assiste de forma elegante, rápida e consistente.

---

# PARTE 7.2 — JARVIS AI (VOZ, AGENTES E COPILOTO)

**Filosofia:** JARVIS compreende contexto, observa padrões, antecipa necessidades, sugere ações, lembra compromissos, deteta oportunidades de produtividade — sempre respeitando privacidade, nunca executando ações críticas sem confirmação.

**Wake word:** configurável (Jarvis, Computer, Assistant, Friday, Athena, Nova, ou personalizada). Deteção contínua quando ativada. Indicador no Header: desligado/escutando/processando/falando/erro — só SVG.

**Reconhecimento de voz:** Web Speech API por padrão; arquitetura preparada para Whisper, Vosk, Deepgram, Google Speech, Azure Speech, OpenAI Speech, modelos locais — troca de motor sem alterar a interface.

**Pipeline de voz:** Wake Word → Captura → Cancelamento de ruído → Transcrição → Deteção de intenção → Análise de contexto → Planeamento → Execução → Resposta → Síntese de voz → Histórico. Cada etapa com tratamento de erros.

**Modo Copiloto:** acompanha discretamente ações no sistema, sugere organizar janelas, criar lembretes, abrir aplicações, responder mensagens, mover widgets, mostrar documentação, pesquisar, detetar tarefas repetitivas. Nunca interrompe — sugestões discretas.

**Agentes especializados (internos, só o JARVIS fala com o utilizador):**
- **Produtividade:** tarefas, agenda, projetos, tempo, metas.
- **Pesquisa:** Internet, arquivos, documentos, emails, histórico.
- **Sistema:** widgets, temas, notificações, desktop, janelas, configurações.
- **Automação:** rotinas, fluxos, agendamento de ações, integrações.
- **Programação:** ajuda com código, explica erros, analisa projetos, pesquisa técnica.
- **Multimédia:** música, vídeos, volume, microfone, câmara.

**AI Orchestrator:** decide qual agente usar, quantos, em que ordem, como combinar resultados.

**Planeamento antes de executar:** ex. "Criar reunião amanhã" → interpretar → identificar data → verificar agenda → escolher horário → criar evento → confirmar → executar.

**Execução:** sempre gera feedback visual, feedback sonoro opcional, histórico, log, possibilidade de desfazer.

**Modo offline:** calendário local, notas, projetos, widgets, comandos internos, pesquisa local, automações, temas, desktop.

**Modo online:** pesquisa web, IA na nuvem, clima, notícias, emails, calendários online, GitHub, Spotify, WhatsApp, Telegram, Discord, Google Drive, OneDrive, Dropbox.

**Permissões por plugin:** Internet, Microfone, Localização, Arquivos, Calendário, Emails, Notificações, Câmara, Bluetooth, USB, Dispositivos — concedidas/revogadas individualmente.

**Memória inteligente:** preferências, projetos, forma de responder, idiomas, rotinas, comandos frequentes, apps/widgets/temas favoritos, dispositivos — organizada por categorias, nunca misturada.

**Modo raciocínio:** entender → pesquisar contexto → consultar memória → consultar plugins → planear → executar → validar → responder. Nunca responde sem analisar contexto.

**Log de ações:** data, hora, origem, plugin, tempo de execução, resultado, status — pesquisável e filtrável.

**API de IA:** arquitetura para alternar entre OpenAI, Claude, Gemini, Mistral, DeepSeek, Grok, Ollama, LM Studio, vLLM, modelos próprios — troca só por configuração.

**MCP:** descoberta automática de servidores/ferramentas/documentos/bases de dados/APIs/repositórios/dispositivos.

**Qualidade:** o utilizador nunca sente que "abriu um chatbot" — sente que conversa com o próprio sistema operacional.

---

# PARTE 8 — AI CORE (NÚCLEO HOLOGRÁFICO)

**Objetivo:** coração visual do sistema, presença da IA — não logotipo, não loader, não decoração. Permanece ativo durante toda a utilização, mesmo sem interação.

**Localização:** centro exato da tela. Ao abrir janelas, reduz para ~75%, nunca desaparece.

**Tecnologias:** Canvas API, SVG, WebGL, Three.js, shaders GLSL quando necessário. Nunca GIF/vídeo — tudo procedural.

**Dimensões:** Desktop 420px, Notebook 360px, Tablet 280px, Mobile 220px — escalonamento proporcional.

**Estrutura — 10 camadas:**
1. Halo externo — glow suave, rotação extremamente lenta.
2. Anel principal — grande, espesso, marcas, divisões técnicas.
3. Anel secundário — rotação inversa, velocidade diferente.
4. Anel interno — mais fino, glow intenso.
5. Radar — varredura contínua.
6. Scanner — linhas horizontais, opacidade variável.
7. Partículas orbitais — centenas, velocidade própria cada.
8. Núcleo energético — centro luminoso, respiração.
9. Ondas sonoras — só durante a voz.
10. Logo JARVIS — minimalista, branco, sem exageros.

**Anel principal:** divisões, traços, marcas angulares, linhas técnicas. Rotação 3°/s, nunca para.
**Anel secundário:** rotação inversa 7°/s, leve blur.
**Anel interno:** movimento irregular, pequenas acelerações/desacelerações — nunca constante.

**Radar:** volta completa a cada 4s; ao encontrar partículas, pequeno brilho.

**Partículas:** ~300, cada uma com tamanho/velocidade/brilho/opacidade/direção/vida própria. Nunca repetem movimento — ruído procedural. **Conexões:** entre partículas próximas, linha temporária que desaparece suavemente — nunca malha completa.

**Pulsação:** escala 100%↔103%, ciclo 5s, muito discreto.

**Estados:**
- **Ocioso:** glow azul, poucas partículas, lento, radar ativo, respiração.
- **Escutando:** anéis aceleram, glow aumenta, partículas convergem, ondas, linha de áudio, "Ouvindo…"
- **Processando:** rotação acelera, scanner inicia, radar duplica, partículas mais rápidas, flashes, "Analisando…"
- **Respondendo:** ondas acompanham exatamente a fala (amplitude/brilho/escala/velocidade).
- **Erro:** glow vermelho, rotação desacelera, radar interrompe, elegante — nunca exagerado.
- **Sucesso:** glow verde, pulso único, pequena explosão de partículas, volta ao normal.

**Reações:** ao cursor — acompanha até 6°, nunca segue exatamente; ao clique — pulso+ripple+som+glow 400ms; à IA — sincronização perfeita entre voz/glow/ondas/partículas/radar, como uma única entidade.

**Efeitos visuais:** glow multicamada, bloom, blur, reflexos, gradientes radiais, sombras suaves, ruído digital, refração, luz volumétrica — nunca exagerado.

**Desempenho:** 60 FPS, `requestAnimationFrame`, canvas otimizado, instanced rendering, pausar quando em segundo plano.

**Qualidade final:** assinatura visual do sistema — reconhecível mesmo sem o nome "JARVIS". Organismo digital vivo, não animação repetitiva.

---

# PARTE 9 — ANIMAÇÕES E MICROINTERAÇÕES

**Objetivo:** toda animação comunica estado/intenção/hierarquia/feedback. Nunca "o botão funcionou?" sem resposta visual. Nunca exagero, nunca sacrificar desempenho. Nível Apple/Tesla/Linear.

**Princípios:** Naturalidade, Suavidade, Consistência, Precisão, Elegância, Fluidez, Resposta imediata, Aceleração física, Desaceleração natural.

**Frame rate:** 60 FPS constante, 120 FPS quando possível. `requestAnimationFrame`, `transform`, `opacity`, `scale`, `translate3d`, GPU. **Nunca animar** `width`/`height`/`top`/`left`/`margin`.

**Durações:** Hover 120ms · Clique 150ms · Abrir widget 220ms · Fechar widget 180ms · Abrir janela 280ms · Fechar janela 220ms · Notificação 250ms · Tema 500ms · Transição de tela 600ms · Boot 6000–10000ms.

**Curvas:** `ease-out`/`ease-in-out`/spring physics — nunca `linear`, exceto radar/relógio/scanner.

**Estados obrigatórios:** hover, focus, active, disabled, loading, error, success, empty, selecionado, a arrastar.

**Comportamentos específicos:**
- Botões: hover escala 1.02+glow+sombra+ícone desloca 2px; clique escala 0.98+ripple.
- Inputs: focar → glow+borda+placeholder sobe+cursor suave.
- Cards: hover eleva 4px+glow+reflexo segue cursor; clique pulso leve.
- Sidebar: expandir → largura aumenta+texto fade+slide+ícones deslocam+linha azul desliza.
- Dock: ícones aumentam ao aproximar (vizinhos também, discretamente); abrir app → ícone pulsa+glow+indicador acende.
- Janelas: abrir 95%→100%+fade+blur reduz; fechar inverso; minimizar → viaja para dock; maximizar → suave sem cortes.
- Notificações: entram pela direita com fade+slide+blur; saem deslizando, nunca instantâneo.
- Scroll: extremamente suave, inércia, desaceleração, barra minimalista.
- Troca de tema: cores transformam gradualmente, glow muda, fundo adapta, widgets atualizam — nunca instantâneo.
- Troca de desktop: fundo desloca, widgets desaparecem em cascata, novo ambiente entra suave, IA sempre visível.

**Núcleo da IA:** nunca repete movimento exato — variações aleatórias discretas de velocidade/brilho/partículas/rotação/respiração.

**Luz e partículas:** glow multicamada, bloom, reflexos, halo, luz indireta — nunca excesso. Partículas nunca repetem trajetória — ruído procedural.

**Rato:** influencia glow de widgets, reflexos, AI Core, dock, botões, cards — sensação de profundidade.

**Som:** clique, abrir, fechar, erro, confirmação, scanner, notificação — todos discretos, nunca competem com música.

**Estados do sistema:** Normal, Economia, Foco, Apresentação, Performance — cada um altera discretamente animações/glow/transições/consumo.

**Qualidade final:** nenhuma animação "template". O utilizador descobre detalhes mesmo após semanas — variações no AI Core, respostas contextuais, transições naturais.

---

# PARTE 10 — SISTEMA DE COMANDOS DE VOZ

**Objetivo:** voz como principal método de interação. Compreensão natural, contextual, contínua. Nunca decorar comandos exatos. Ex.: "Jarvis, abre o calendário." → "Mostra os meus compromissos." → "E os de amanhã?" (a IA entende a referência ao calendário já aberto).

**Wake word:** configurável (Jarvis, Computer, Assistant, Friday, Nova, Athena, Echo). Indicador permanente: desligado/ativo/escutando/processando/respondendo/erro — só SVG.

**Pipeline completo:** Wake Word → Captura → Redução de ruído → Deteção de silêncio → Transcrição → Deteção de idioma → Interpretação de intenção → Consulta de contexto → Consulta de memória → Consulta de plugins → Planeamento → Execução → Resposta → Síntese de voz → Registo no histórico. Cada etapa com timeout, tratamento de erros e cancelamento.

**Modos de escuta:** Manual (botão), Wake Word (só a palavra), Conversa (continua a escutar breves segundos após responder), Contínuo (sempre ligado), Privacidade (reconhecimento só local quando possível).

**Tipos de comandos:**
- Sistema: "Abre as configurações.", "Fecha todas as janelas.", "Ativa o modo foco.", "Reinicia a interface."
- Aplicações: "Abre o calendário.", "Abre o navegador.", "Mostra os emails.", "Abre o gestor de tarefas."
- Produtividade: "Cria uma tarefa.", "Lembra-me às 15 horas.", "Agenda uma reunião.", "Mostra o meu dia."
- Pesquisa: "Procura o ficheiro orçamento.", "Pesquisa notas sobre marketing.", "Encontra conversas sobre IA."
- Internet: "Pesquisa as notícias de hoje.", "Quem ganhou o jogo?", "Qual a previsão do tempo?"
- Multimédia: "Aumenta o volume.", "Reproduz música.", "Pausa.", "Próxima faixa."
- Desktop: "Altera para o tema OLED.", "Mostra o Desktop dois.", "Esconde os widgets.", "Organiza as janelas."

**Comandos compostos:** múltiplos passos numa frase. Ex.: "Abre o calendário, cria uma reunião para amanhã às 10 horas e envia um convite para a equipa." → abrir calendário → criar evento → adicionar horário → selecionar participantes → confirmar → enviar convites.

**Confirmações obrigatórias** para ações críticas: eliminar ficheiros, apagar notas, fechar aplicações importantes, enviar emails, executar automações perigosas. Resposta: "Tem a certeza que deseja continuar?"

**Correção de erros:** mostrar texto reconhecido, destacar parte duvidosa, permitir edição manual — nunca executar ações incertas automaticamente.

**Contexto compreendido:** "Amanhã", "Depois", "Aquele projeto", "Esse ficheiro", "A reunião", "O último email" — sempre via histórico e estado atual.

**Idiomas:** múltiplos, troca automática quando suportado, configuração manual disponível.

**Latência:** resposta inicial <500ms; confirmação visual imediata ao detetar fala; animação no AI Core durante processamento.

**Síntese de voz:** ondas sonoras, pulsação, glow sincronizado, partículas reagem ao volume. Ajustável: velocidade, tom, volume, idioma, voz preferida.

**Histórico:** áudio (opcional), transcrição, intenção, resposta, tempo, plugins usados, resultado — pesquisável.

**Privacidade:** utilizador controla quando o microfone está ativo, quais comandos ficam guardados, gravação ou não, processamento local vs online. Indicador claro sempre que escuta.

**Qualidade final:** experiência de trabalhar longos períodos só por voz, alternando naturalmente entre tarefas — voz, interface e AI Core como um único sistema integrado.

---

# PARTE 11 — SISTEMA DE PLUGINS E ECOSSISTEMA

**Visão geral:** JARVIS AI OS não é fechado — é plataforma. Quase toda funcionalidade avançada via plugins. Núcleo pequeno, estável, desacoplado. Instalar/atualizar/desativar/remover sem tocar no núcleo.

**Filosofia:** Core fornece só Interface, Motor de IA, Sistema de janelas, Sistema de widgets, Gestor de plugins, Sistema de voz, Sistema de memória, Segurança. O resto vem de plugins.

**Plugin Manager:** aplicação própria — pesquisar, instalar, atualizar, remover, desativar, ver permissões/consumo/versão/desenvolvedor/changelog/avaliações/compatibilidade.

**Tela:** semelhante a loja de aplicações — ícone SVG, nome, descrição, categoria, versão, autor, tamanho, estado, botões Instalar/Atualizar/Remover/Configurar, indicador de compatibilidade.

**Categorias:** Produtividade, IA, Automações, Desenvolvimento, Música, Vídeo, Email, Calendário, Cloud, Armazenamento, Segurança, Casa Inteligente, Redes Sociais, Financeiro, Saúde, Educação, Jogos, Sistema.

**Estrutura do plugin:** Manifesto (nome, ID único, versão, autor, descrição, categoria, dependências, permissões, configurações, ícones, comandos, widgets, serviços, eventos, hooks, documentação).

**Permissões declaradas:** Internet, Microfone, Câmara, Sistema de ficheiros, Calendário, Emails, Notificações, Bluetooth, USB, Localização, Clipboard, Dispositivos — concedidas/revogadas individualmente.

**Isolamento:** plugins nunca acedem diretamente a outros plugins — só via APIs públicas do sistema. Nenhum plugin altera o Core nem a memória de outro plugin sem autorização.

**API do Core:** Criar Widgets, Criar Janelas, Adicionar Menus, Adicionar Comandos, Adicionar Atalhos, Criar Notificações, Adicionar Configurações, Criar Serviços, Executar Voz, Ler Memória, Guardar Preferências, Adicionar Painéis, Registrar Eventos.

**Event Bus global:** Sistema iniciado, Login concluído, Desktop carregado, Tema alterado, Plugin instalado/removido, Nova notificação/email/tarefa/mensagem, Mudança de rede/dispositivo — plugins podem escutar eventos autorizados.

**Plugins oficiais previstos:** OpenAI, Claude, Gemini, Ollama, LM Studio, GitHub, GitLab, Google Calendar, Outlook, Gmail, Spotify, Apple Music, WhatsApp, Telegram, Discord, Slack, OneDrive, Google Drive, Dropbox, Notion, Obsidian, Home Assistant, Philips Hue, Docker, Kubernetes, VS Code.

**Plugins de IA:** cada provedor é plugin independente — modelo padrão/secundário/local/online, regras de fallback, troca automática quando indisponível.

**Plugins de widgets:** qualquer plugin pode criar widgets — Monitor de Bolsa, Criptomoedas, GitHub, Temperatura da CPU, Servidor Local, Banco de Dados, Docker, Kubernetes, Chat, Agenda, Música — todos seguindo o mesmo Design System.

**Marketplace:** arquitetura para pesquisar, instalar, atualizar, avaliar, favoritar, coleções, recomendados, populares, novidades.

**Segurança:** validar assinatura, compatibilidade, permissões, dependências, versão mínima, integridade — avisar claramente se houver risco.

**Desempenho por plugin:** tempo de inicialização, consumo de memória/CPU, número de eventos/chamadas, logs — desativável se degradar o sistema.

**Atualizações:** independentes, rollback, atualização automática opcional, histórico completo.

**SDK para desenvolvedores:** CLI, templates, exemplos, boas práticas, API Reference, eventos, hooks, widgets, comandos, temas, permissões, guia de publicação.

**Qualidade final:** ecossistema preparado para crescer anos, mantendo estabilidade/segurança/desempenho/consistência visual independentemente do número de plugins.

---

# PARTE 12 — INTEGRAÇÃO UNIVERSAL COM IA (AI ORCHESTRATOR)

**Visão geral:** nunca dependente de um único provedor. AI Orchestrator seleciona automaticamente o melhor modelo por tarefa. O utilizador só fala com o JARVIS; ele decide qual modelo usar (configurável).

**Filosofia:** o utilizador nunca pensa "qual IA usar?" — decisão do JARVIS, com base em tipo de tarefa, velocidade, precisão, privacidade, custo, disponibilidade, latência, capacidade do modelo, contexto.

**Arquitetura:**
```
Utilizador → JARVIS → AI Orchestrator → Analisador de Intenção
→ Planeador → Selecionador de Modelo → Plugins de IA
→ Resposta → Validação → Memória → Interface
```

**Provedores suportados (todos como plugins):** OpenAI, Claude, Gemini, Mistral, DeepSeek, Grok, Cohere, OpenRouter, Ollama, LM Studio, vLLM, Llama.cpp, modelos próprios.

**Modelos locais:** compatibilidade com Ollama, LM Studio, vLLM, Llama.cpp, GGUF, safetensors. Escolha por: padrão, programação, escrita, pesquisa, tradução, offline.

**Seleção automática — exemplos:** Programação → modelo de código; Escrita → modelo de linguagem; Pesquisa → modelo com acesso à Internet; Resumo → modelo rápido; Análise complexa → modelo mais poderoso.

**Fallback automático:** Modelo Principal → Secundário → Local → Resposta ao utilizador. Nunca interrompe a experiência.

**Execução paralela:** o Orchestrator pode consultar vários modelos ao mesmo tempo (ex.: A analisa código, B pesquisa documentação, C resume) e combina numa única resposta.

**Memória compartilhada:** independente do modelo usado — preferências, projetos, conversas, notas, objetivos, contexto, rotinas — nunca perde contexto ao trocar de modelo.

**Janela de conversa avançada:** mostra modelo utilizado, tempo de resposta, plugins/ferramentas usados, consumo estimado, tokens, latência — ocultável pelo utilizador.

**Ferramentas por modelo:** Calendário, Email, Pesquisa, Arquivos, Notas, Sistema, Terminal, GitHub, Docker, Banco de Dados, Internet — cada uso registado no histórico.

**MCP:** descoberta automática de servidores/ferramentas/recursos/documentos/bases de dados/repositórios — aparecem no Plugin Manager, controlados pelo utilizador (instalar/ativar/desativar/permissões).

**Planeamento de tarefas complexas:** ex. "Criar uma apresentação sobre IA." → Pesquisar → Criar estrutura → Gerar conteúdo → Criar slides → Adicionar imagens → Revisar → Apresentar. Cada etapa pode usar modelo diferente.

**Cancelamento:** o utilizador pode interromper qualquer geração — para processamento, guarda histórico parcial, liberta recursos, volta ao ocioso.

**Segurança:** antes de agir, valida permissões, plugin, origem, confiança, risco. Ações críticas exigem confirmação.

**Privacidade:** o utilizador escolhe só local, só online, ou híbrido — nunca envia dados online sem autorização quando exigido privacidade.

**Painel de IA:** modelos instalados/online/locais, estado, uso, velocidade, latência, memória, GPU (local), versão, atualizações.

**Qualidade final:** o utilizador conversa com uma única entidade; internamente múltiplos modelos, seleção automática, ferramentas integradas, contexto preservado, planos complexos executados sem expor complexidade.

---

# PARTE 13 — SISTEMA DE AUTOMAÇÕES (JARVIS AUTOMATION ENGINE)

**Visão geral:** motor nativo de automações — fluxos simples ou complexos, linguagem natural, editor visual ou editor avançado. Sem programação obrigatória.

**Estrutura de uma automação:** `Gatilho → Condições → Ações → Resultado`.

**Formas de criação:** linguagem natural, editor visual, templates prontos, importação, código (modo avançado).

**Exemplos:** "Todos os dias às 08:00 abrir a agenda.", "Quando receber um email do chefe emitir um alerta.", "Quando ligar o computador abrir VS Code, Spotify e Calendário.", "Às sextas criar um relatório semanal.", "Quando terminar uma reunião criar automaticamente uma nota."

**Editor visual em blocos:** Evento, Condição, Ação, Loop, Espera, Variável, IA, Plugin, Notificação, Fim — ligados visualmente. Zoom, pan, seleção múltipla, copiar/colar, agrupar/desagrupar.

**Gatilhos:** hora, data, inicialização, login, logout, mudança de tema, nova notificação/email/ficheiro, alteração de pasta, nova mensagem, calendário, estado da bateria, USB, Bluetooth, rede, Wi-Fi, localização, comando de voz, botão personalizado, webhook, API, plugin, evento MCP.

**Condições:** hora, dia da semana, utilizador, localização, rede, bateria, aplicação aberta, CPU/RAM/GPU, Internet, tempo, clima, dispositivo, plugin instalado, texto, expressões, resultado de IA.

**Ações:** abrir/fechar aplicação, executar comando, enviar email, criar tarefa/nota, executar pesquisa, alterar tema, mover widgets, mostrar notificação, executar plugin/script/API/MCP/IA, falar por voz, guardar ficheiro, enviar mensagem, criar evento, controlar dispositivos inteligentes.

**Variáveis:** texto, número, booleano, lista, objeto, data, hora, resultado de IA/Plugin, resposta HTTP, globais/locais.

**IA dentro das automações:** ex. Ler email → Resumir → Classificar prioridade → Criar tarefa → Sugerir resposta. Ou: Receber PDF → Extrair texto → Resumir → Guardar em notas.

**Múltiplos caminhos (decisões):** ex. Se prioridade alta → notificação urgente; caso contrário → só histórico.

**Execução:** estado, tempo de execução, última/próxima execução, número de falhas/sucessos, tempo médio.

**Histórico:** data, hora, gatilho, condições, ações, resultado, tempo, erros, logs — pesquisável e filtrável.

**Depuração:** modo Debug, execução passo a passo, mostrar variáveis/estado/fluxo/resultado/tempo.

**Templates oficiais:** rotina matinal, planeamento diário, resumo semanal, backup automático, organização do desktop, monitorização de servidores, gestão de emails, relatórios automáticos, integração GitHub/Google Calendar.

**Segurança:** automações críticas (eliminar ficheiros, enviar emails em massa, comandos do sistema, config sensíveis) exigem confirmação. Limites de permissões configuráveis por automação.

**Exportação/importação:** exportar, importar, partilhar, coleções, versionamento, backup automático.

**Execução em segundo plano:** funciona mesmo com interface minimizada — serviço dedicado monitoriza eventos, executa fluxos, regista logs, gere filas, recupera de falhas.

**Qualidade final:** centro de produtividade real, integrando IA, plugins, voz, widgets, APIs, MCP e apps externas num ecossistema unificado.

---

# PARTE 14 — SEGURANÇA, PRIVACIDADE E PERMISSÕES

**Visão geral:** Security by Design e Privacy by Design — não é módulo adicional, é parte de toda a arquitetura. Toda ação verificada antes de executar. Permissões sempre transparentes.

**Princípios:** Menor privilégio, Permissões explícitas, Consentimento do utilizador, Transparência, Proteção dos dados, Isolamento entre módulos, Auditoria completa.

**Autenticação:** palavra-passe, PIN, biometria, Windows Hello, WebAuthn/Passkeys, 2FA, sessão temporária/permanente, bloqueio automático por inatividade.

**Gestão de sessões:** sessão atual, dispositivo, SO, IP, último acesso. Permitir encerrar sessão específica ou todas; alerta de novo acesso.

**Criptografia:** tokens, chaves API, credenciais, histórico protegido, configurações críticas — sempre protegidos. Nunca palavras-passe em texto simples.

**Cofre de segredos ("Vault"):** API Keys, tokens OAuth, segredos, credenciais, certificados. Acesso exige autenticação.

**Permissões por plugin:** Internet, Microfone, Câmara, Sistema de ficheiros, Calendário, Emails, Bluetooth, USB, Clipboard, Localização, Notificações, IA. Cada uma: Permitida / Negada / Permitida uma vez / Permitida durante a sessão.

**Painel de privacidade:** permissões concedidas/recusadas, últimos acessos, histórico de utilização, plugins ativos/bloqueados, consumo de dados.

**Processamento local:** totalmente local / híbrido / cloud. Em modo local, nenhum dado sai sem autorização.

**Auditoria:** data, hora, utilizador, origem, plugin, ação, resultado, tempo de execução — filtrável e pesquisável.

**Proteção contra erros:** plugin com comportamento anormal → isolar automaticamente, suspender, informar o utilizador, gerar relatório — nunca compromete a estabilidade global.

**Backups:** manual, automático, restauro completo/parcial, exportação de configuração, sincronização opcional cloud.

**Modo privacidade:** desativa telemetria opcional, oculta notificações sensíveis, bloqueia histórico de voz, suspende sincronizações externas, mostra indicador discreto ativo.

**Segurança da IA:** antes de qualquer ação, verifica permissões, verifica origem, confirma ações destrutivas, regista no histórico, explica ao utilizador o que vai ser executado.

**Qualidade final:** o utilizador controla completamente o sistema — nada acontece sem autorização em dados pessoais ou ações críticas, equilibrando automação, conveniência, privacidade e segurança.

---

# PARTE 15 — PERSONALIZAÇÃO COMPLETA DO SISTEMA

**Visão geral:** totalmente personalizável sem código, alterações em tempo real, nunca exige reinicialização.

**Centro de Personalização:** app dedicada reunindo Temas, Papéis de parede, Cores, Ícones, Animações, Widgets, Layout, Tipografia, Cursor, Sons, AI Core, Perfis, Acessibilidade.

**Temas oficiais:** JARVIS Classic, OLED Black, Midnight Blue, Arctic White, Emerald, Cyber Red, Titanium, Graphite, Aurora, Solar. Cada tema altera paleta, glassmorphism, glow, sombras, reflexos, gradientes, animações, ícones, cursores, AI Core.

**Editor de temas personalizados:** cor principal/secundária/destaque, glow, transparência, blur, bordas, sombras, tipografia, animações — com pré-visualização instantânea.

**Papel de parede:** imagem, vídeo, canvas animado, Three.js, shader procedural, nebulosa, espaço, cidade futurista, partículas, gradientes vivos — ou wallpapers gerados proceduralmente.

**AI Core personalizável:** cor, velocidade, quantidade de partículas, número de anéis, brilho, scanner, radar, halo, respiração, reflexos, modo minimalista/avançado — pré-visualização em tempo real.

**Pacotes de ícones:** Lucide, Material Symbols, Heroicons, Phosphor, Remix Icons, Bootstrap Icons, pacotes personalizados — sempre SVG.

**Tipografia:** fonte principal, títulos, monoespaçada, peso, espaçamento, altura de linha, escala global — pré-visualização imediata.

**Cursor:** estilos Minimal, Holográfico, Neon, Clássico, Futurista — tamanho, glow, cor, animação, rastro, efeito ao clicar.

**Perfis de animação:** Minimal, Suave, Equilibrado, Cinemático, Performance, Personalizado — cada um altera velocidade/duração/glow/partículas/transições.

**Layout:** posição/tamanho da sidebar, posição da dock, widgets padrão, espaçamento, arredondamento, margens, cabeçalho, painéis, grid.

**Perfis completos guardados:** Trabalho, Programação, Gaming, Streaming, Apresentação, Viagem, Noite, Estudo — cada um guarda tema/widgets/wallpaper/IA/volume/animações/layout/plugins ativos.

**Alteração automática de perfil:** à noite tema OLED, horário de trabalho perfil Profissional, início de reunião modo Apresentação, monitor externo ligado reorganiza widgets.

**Sons personalizáveis:** clique, erro, sucesso, scanner, notificação, inicialização, desligamento, resposta da IA — volume independente por categoria.

**Widgets:** definir padrão, posições, tamanho, ordem, visibilidade, agrupamentos — por perfil.

**Acessibilidade:** alto contraste, escala de interface, redução de animações, redução de transparência, modo daltónico, leitor de ecrã, navegação por teclado.

**Sincronização:** temas, perfis, wallpapers, widgets, configurações, layouts entre dispositivos — sempre opcional.

**Importação/exportação:** tema, perfil, partilha, biblioteca pessoal.

**Galeria oficial:** pesquisar, filtrar, pré-visualizar, instalar, avaliar, favoritar, atualizar temas.

**Qualidade final:** personalização profunda e consistente — mesmo temas da comunidade mantêm aparência profissional, moderna, harmoniosa.

---

# PARTE 16 — PAINEL DE DESENVOLVEDOR, LOGS E DIAGNÓSTICO

**Visão geral:** ambiente profissional para desenvolvimento, monitorização, depuração e análise — útil também a utilizadores avançados, não só programadores. Informação clara, pesquisável, em tempo real.

**Dev Center:** app dedicada, categorias: Logs, Performance, Plugins, Eventos, IA, Rede, Armazenamento, Automações, MCP, API, Debug, Segurança, Diagnóstico.

**Painel de performance (tempo real):** CPU, GPU, RAM, VRAM, Disco (leitura/gravação), Rede (download/upload/latência), FPS da interface, tempo de renderização, número de widgets/janelas/plugins, eventos por segundo — tudo em gráficos ao vivo.

**Painel de IA:** modelo ativo/secundário/local/online, tempo médio de resposta, latência, tokens usados, número de pedidos, tempo de processamento, ferramentas/plugins usados, memória ocupada, fila de execução, estado do AI Orchestrator.

**Logs estruturados:** data, hora, categoria, origem, plugin, nível, mensagem, tempo, stack trace, ID único — pesquisável, filtrável, exportável, copiável, agrupável.

**Níveis de log:** Trace, Debug, Info, Warning, Error, Critical — cada um com cor e ícone SVG próprios.

**Monitor do Event Bus:** evento, origem, destino, tempo, resultado, número de ouvintes, estado — tempo real.

**Debugger:** breakpoints, inspeção de variáveis, passo a passo, executar novamente, simular eventos, capturar exceções, visualizar estado do sistema.

**Monitor de plugins:** estado, versão, autor, tempo de carregamento, CPU/RAM, número de chamadas, eventos processados, última atualização, permissões, dependências.

**Monitor MCP:** servidores ativos, ferramentas disponíveis, estado da ligação, latência, número de chamadas, último acesso, permissões, falhas.

**Monitor de API:** pedidos, respostas, tempo, código HTTP, payload, headers, origem, destino, erros, fila, taxa de utilização.

**Monitor de automações:** ativas, fila, execuções, tempo médio, última/próxima execução, falhas, histórico, logs.

**Diagnóstico automático:** verifica plugins, configurações, memória, rede, IA, eventos, widgets, temas, drivers, dependências, permissões — gera relatório completo.

**Relatórios exportáveis:** PDF, JSON, CSV, HTML, Markdown — com resumo, problemas encontrados, sugestões, gráficos, estatísticas.

**Modo desenvolvedor:** mostra FPS, grid, limites dos componentes, áreas de clique, consumo de memória, eventos em tempo real, render time, IDs dos componentes.

**Ferramentas internas:** Console do Sistema, Inspector de Componentes, Editor de Configurações, Visualizador de Eventos/Memória/Estado Global/Plugins/Widgets.

**Command Palette de administrador:** Recarregar plugins, Reconstruir cache, Limpar logs, Reiniciar IA/Event Bus, Executar diagnóstico, Exportar estado, Reindexar pesquisa.

**Painel de segurança:** sessões, permissões, tentativas de acesso, plugins bloqueados, ações críticas, eventos suspeitos, integridade do sistema, estado do Vault.

**Alertas inteligentes:** RAM/CPU acima do limite, plugin instável, modelo de IA indisponível, servidor MCP offline, erro crítico, atualização disponível, tentativa de acesso suspeita.

**Qualidade final:** centro de controlo profissional — tudo organizado, pesquisável, em tempo real, para manutenção, otimização, depuração e evolução contínuas.

---

# PARTE 17 — ARQUITETURA FINAL, TECNOLOGIAS E ROADMAP

**Visão geral:** plataforma modular, escalável, preparada para crescer anos sem reescrever. Alta performance, organização, manutenibilidade.

**Arquitetura em camadas:**
```
Interface (UI) → Design System → Gestor de Estado → Core do Sistema
→ AI Orchestrator → Plugin Manager → Serviços → Banco de Dados
→ Modelos de IA → Serviços Externos
```
Comunicação só por APIs internas bem definidas entre camadas.

**Stack:**
- Frontend: React, TypeScript, Vite, Tailwind CSS, Framer Motion, Three.js, React Three Fiber, Canvas API, WebGL, SVG.
- Backend: Node.js, NestJS, Fastify, WebSocket, REST API, GraphQL opcional.
- BD: SQLite (local), PostgreSQL (servidor), Redis (cache), Vector Database (RAG/memória semântica).
- Armazenamento: IndexedDB, LocalStorage, sistema de ficheiros, cloud sync opcional.
- IA: OpenAI, Claude, Gemini, DeepSeek, Mistral, Ollama, LM Studio, vLLM, Llama.cpp, MCP Servers — via AI Orchestrator.

**Estrutura de pastas (visão de longo prazo):**
```
/core /ui /components /widgets /windows /plugins /themes /icons
/assets /animations /audio /services /api /database /models /memory
/automation /voice /ai /orchestrator /mcp /security /settings
/localization /utils /tests /docs /scripts
```

**Design System unificado:** Botões, Inputs, Cards, Modais, Menus, Sidebar, Dock, Header, Widgets, Janelas, Notificações, Tooltips, Diálogos — reutilizando cores/espaçamentos/tipografia/ícones/animações/sombras/glassmorphism comuns.

**Gestão de estado (Zustand):** módulos independentes — Sistema, Utilizador, IA, Plugins, Widgets, Janelas, Automações, Notificações, Temas, Sessão.

**Event Bus central:** login realizado, tema alterado, plugin instalado, nova mensagem, resposta da IA, automação executada, desktop alterado, servidor MCP conectado.

**Sincronização multi-dispositivo:** configurações, perfis, widgets, conversas, temas, automações, plugins, layouts, histórico.

**Versões da plataforma:** JARVIS Web, JARVIS Desktop (Windows/macOS/Linux), JARVIS Mobile (Android/iOS), JARVIS Server (empresas).

**Modo offline:** notas, projetos, widgets locais, pesquisa local, modelos locais, automações, conversas locais.
**Modo online:** pesquisa web, serviços cloud, emails, calendários, sincronização, modelos na nuvem, notícias, meteorologia.

**Testes:** Unitários, Integração, End-to-end, Visuais, Performance, Segurança, Acessibilidade — automatizados no CI/CD.

**CI/CD:** build, lint, testes, análise de código, empacotamento, publicação, changelog, versionamento.

**Roadmap:**
- **Fase 1 — MVP:** Boot, Login, Desktop, AI Core, Chat, widgets principais, sistema de temas, configurações.
- **Fase 2 — Beta:** Plugins, Automações, Command Palette, sistema de voz, Marketplace, Perfis, Layouts.
- **Fase 3 — v1.0:** AI Orchestrator, MCP, modelos locais, Cloud Sync, SDK, Developer Center.
- **Fase 4 — Pro:** Agentes especializados, colaboração, multiutilizador, workspaces, partilha de automações, marketplace oficial.
- **Fase 5 — Enterprise:** SSO, LDAP, Azure AD, Google Workspace, Microsoft 365, auditoria avançada, gestão centralizada, painéis administrativos, alta disponibilidade.

**Objetivos de desempenho:** inicialização <3s, 60 FPS constante, memória reduzida, carregamento progressivo, lazy loading, code splitting, cache inteligente, renderização otimizada.

**Objetivos de experiência:** sentir que usa um SO de IA nativo — nada parece "plugin colado". Contínua, elegante, rápida, consistente.

**Visão de longo prazo:** plataforma completa de computação assistida por IA — a IA como ponto central entre utilizador, dados, aplicações, dispositivos e serviços, evoluindo com novos modelos e interfaces sem perder compatibilidade, estabilidade ou identidade visual.

**Missão final:** não é criar um dashboard — é criar um novo paradigma de interação humano-computador, onde a IA deixa de ser aplicação separada e passa a ser o próprio sistema operacional.
