# JARVIS AI OS — Project ARC

Sistema operativo de Inteligência Artificial, construído em **Tauri v2**. Compila para **Windows e Android a partir do mesmo código**.

Fase 1 (MVP): shell completo, núcleo de IA, sequência de arranque, autenticação, gestor de janelas, paleta de comandos, voz e métricas reais do sistema.

---

## Requisitos

| | Versão | Notas |
|---|---|---|
| Node.js | 20+ | |
| Rust | 1.77.2+ | via [rustup](https://rustup.rs) |
| Windows | 10/11 | + [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (já vem no Windows 11) |
| Visual Studio Build Tools | 2022 | com a carga "Desenvolvimento para ambiente de trabalho com C++" |

Para o Android, adicionalmente:

| | Notas |
|---|---|
| JDK | 17+ |
| Android Studio | com SDK Platform 34 e **NDK** |
| `ANDROID_HOME` | a apontar para o SDK |
| `NDK_HOME` | a apontar para `.../ndk/<versão>` |

---

## Instalação

```bash
npm install
```

O primeiro `npm run tauri dev` compila o Rust de raiz e demora vários minutos. Os seguintes são incrementais.

---

## Executar

### Desktop

```bash
npm run tauri dev
```

Abre a janela nativa com hot reload na interface.

### Browser (sem compilar o Rust)

```bash
npm run dev
```

Serve em `http://localhost:1420`. Usa o `WebAdapter`, com métricas simuladas — serve para trabalhar na interface sem esperar pelo `cargo`.

### Android

```bash
# Uma vez, para gerar o projeto Gradle em src-tauri/gen/android
npm run android:init

# Com um dispositivo ligado por USB (com depuração USB ativa) ou um emulador
npm run android:dev
```

> Se o dispositivo não conseguir alcançar o servidor de desenvolvimento, defina `TAURI_DEV_HOST` com o IP da sua máquina na rede local:
> ```bash
> TAURI_DEV_HOST=192.168.1.42 npm run android:dev
> ```

---

## Compilar

```bash
# Windows: instalador MSI e NSIS em src-tauri/target/release/bundle/
npm run tauri build

# Android: APK e AAB em src-tauri/gen/android/app/build/outputs/
npm run android:build
```

---

## Verificações

```bash
npm run typecheck   # TypeScript em strict total
npm run test        # Vitest
npm run lint        # ESLint

cd src-tauri
cargo check                                    # desktop
cargo check --target aarch64-linux-android     # Android
```

---

## Atalhos

| Atalho | Ação |
|---|---|
| `CTRL + K` | Paleta de comandos |
| `CTRL + ALT + J` | Invocar o JARVIS de qualquer aplicação (global, só desktop) |
| `Escape` | Fechar paleta, gaveta ou menu contextual |
| Clique direito | Menu contextual do ambiente de trabalho |

---

## Mapa da arquitetura

A regra de ouro: **a interface nunca chama o Rust diretamente**.

```
Componente  →  Hook  →  Service  →  PlatformAdapter  →  invoke()  →  Rust
```

Nenhum ficheiro fora de `src/platform/` importa `@tauri-apps/api`. Nenhum componente sabe em que plataforma corre — pergunta às capacidades do adapter.

```
src/
├── design-system/    tokens.ts — fonte única de cores, raios, durações e curvas
├── platform/         PlatformAdapter + Desktop, Android e Web
├── services/         SystemService, AIService, VoiceService, Storage, Theme, Notification
├── stores/           Zustand: system, assistant, window, theme, notification, session
├── hooks/            a ponte entre componentes e serviços
├── components/
│   ├── shell/        AppShell, Header, Rail, Dock, Stage, Wallpaper, CustomCursor
│   ├── ai-core/      AICore — canvas de partículas, anéis SVG, waveform
│   ├── windows/      WindowManager, Window, encaixe às bordas
│   ├── boot/         BootSequence
│   ├── auth/         LoginScreen
│   ├── command-palette/
│   ├── notifications/
│   └── context-menu/
├── apps/             as janelas · registry.ts é a fonte única
├── types/            contratos partilhados
│
├── plugins/          ┐
├── mcp/              │ Fase 2+ — pastas e interfaces preparadas,
├── automation/       │ sem implementação
└── developer-center/ ┘

src-tauri/
├── src/
│   ├── commands/     comandos expostos ao IPC
│   ├── system/       métricas com sysinfo
│   ├── tray.rs       ┐ #[cfg(desktop)]
│   └── shortcuts.rs  ┘
└── capabilities/     permissões, separadas por plataforma
```

Mais detalhe:

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — como adicionar um widget, uma janela, um comando Rust e um provedor de IA
- **[PLATFORM.md](PLATFORM.md)** — o que existe em cada plataforma e como o adapter trata o que falta
- **[SPEC.md](SPEC.md)** — mapa entre as partes da especificação e o código, incluindo as divergências assumidas

---

## Design system

O visual vem do protótipo em [`design-reference/jarvis-ai-os.html`](design-reference/jarvis-ai-os.html), preservado no repositório como referência.

Os tokens vivem em `src/design-system/tokens.ts` e entram no `tailwind.config.ts` como tema. Não há cores nem durações escritas à mão pelo código: as classes apontam para variáveis CSS, e é por isso que trocar de tema é instantâneo.

Cinco temas, aplicados por `data-theme` no `<html>`: **JARVIS Classic**, **OLED Black**, **Titanium**, **Emerald**, **Solar**.

> O teste `tests/design-system/themes.test.ts` falha se `themes.css` divergir de `tokens.ts` — é o que mantém o token único apesar de o CSS não poder importar TypeScript.

---

## Estado da Fase 1

| | |
|---|---|
| ✅ | Andaime Tauri v2, Windows e Android |
| ✅ | Design system completo e os 5 temas |
| ✅ | PlatformAdapter com as três implementações |
| ✅ | Métricas reais do sistema via `sysinfo` |
| ✅ | Sequência de arranque com arranque rápido |
| ✅ | Autenticação com biometria simulada |
| ✅ | AppShell responsivo desde o início |
| ✅ | AI Core com cinco modos |
| ✅ | WindowManager com encaixe e persistência |
| ✅ | Paleta de comandos e notificações |
| ✅ | Bandeja e atalho global no desktop |
| ✅ | Quatro janelas de exemplo |
| ⬜ | Plugins, MCP, automações, Developer Center — Fase 2+ |

---

## Aviso sobre a verificação

O código foi escrito e verificado num contentor Linux: `tsc --noEmit`, `vitest`, `cargo check` para desktop **e** para `aarch64-linux-android`, e a interface foi conduzida em Chromium com Playwright (arranque, login, janelas, encaixe, paleta, temas).

**O que não foi verificado aqui**, por não haver Windows nem SDK do Android no ambiente: `npm run tauri dev` e `npm run tauri build` no Windows, e `npm run android:dev` num dispositivo. Essa confirmação fica do seu lado.
