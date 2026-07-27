# Plataformas

O que existe em cada plataforma, e o que acontece ao que falta.

---

## Os três adapters

| | Quando é escolhido | Para quê |
|---|---|---|
| `DesktopAdapter` | Tauri, sem Android no user agent | Windows. A experiência principal |
| `AndroidAdapter` | Tauri, com Android no user agent | Telemóvel. Subconjunto adaptado |
| `WebAdapter` | Sem Tauri | Desenvolver a interface no browser, com dados simulados |

A deteção corre uma vez, em `src/platform/detect-platform.ts`. Nenhum outro sítio a repete.

---

## Tabela de capacidades

| Capacidade | Windows | Android | Browser | O que acontece onde falta |
|---|:---:|:---:|:---:|---|
| `systemMetrics` | ✅ real | ✅ real | 🟡 simulado | O Monitor de recursos diz que a plataforma não as expõe |
| `processList` | ✅ | ❌ | ❌ | O painel não aparece e a janela explica porquê |
| `systemTray` | ✅ | ❌ | ❌ | Sem ícone na bandeja. Nada na interface muda |
| `globalShortcut` | ✅ | ❌ | ❌ | `onGlobalInvoke` devolve uma função vazia. O `CTRL+K` interno continua |
| `windowManagement` | ✅ | ❌ | ❌ | Métodos sem efeito. As janelas do JARVIS continuam a funcionar |
| `nativeNotifications` | ✅ | ✅ | ❌ | Fica só o toast interno. O utilizador não perde nada |
| `shellOpen` | ✅ | ✅ | ✅ | — |
| `fileDialogs` | ✅ | ✅ | ❌ | Botões de ficheiro escondidos |
| `nativeStorage` | ✅ store | ✅ store | 🟡 localStorage | Idêntico para quem chama |
| `voice` | ✅ | ✅ | 🟡 depende | O microfone desaparece da interface |
| `biometrics` | ❌ | ❌ | ❌ | Simulada no login. Windows Hello fica para depois |

✅ nativo · 🟡 simulado ou parcial · ❌ indisponível

---

## Comportamento da interface

### Windows

Rail que expande ao passar o rato · dock com magnificação · janelas arrastáveis, redimensionáveis e com encaixe às bordas · cursor personalizado · parallax do wallpaper · ícone na bandeja · `CTRL+ALT+J` global · métricas reais.

### Android

Não é a versão de desktop encolhida. É outro comportamento:

| Elemento | Como fica |
|---|---|
| Rail | Gaveta com scrim, aberta pelo botão do header, fechável por `Escape` ou toque fora |
| Janelas | Largura toda, empilhadas, sem arrastar nem redimensionar |
| Dock | Faixa ancorada às margens, com scroll horizontal |
| Cursor personalizado | Não se monta em `pointer: coarse` |
| Tooltips do dock | Não se desenham — num ecrã de toque nunca apareceriam de forma útil |
| Menu contextual | Desligado; o clique longo pertence ao sistema |
| Alvos de toque | Mínimo de 44px, imposto globalmente |
| Partículas | 120 no núcleo em vez de 300, e menos no wallpaper |
| `safe-area-inset` | Respeitado no header, no rail, no dock e nos toasts |
| Pesquisa do header | Colapsa em botão de ícone, para o avatar não sair do ecrã |

O ponto de quebra é 820px, o mesmo do protótipo. Os componentes lêem-no por `useIsCompact()`, não por deteção de plataforma — um Windows numa janela estreita comporta-se da mesma maneira, o que é o correto.

### Browser

Tudo o que não precisa do sistema operativo funciona. As métricas são simuladas com oscilação suave, para os gráficos se parecerem com dados reais e os bugs de animação aparecerem durante o desenvolvimento.

---

## Métricas: o que é real

Do `sysinfo`, em Rust:

| | Windows | Android |
|---|:---:|:---:|
| CPU: uso global, por núcleo, frequência | ✅ | ✅ |
| Memória: total, usada, disponível, swap | ✅ | ✅ |
| Disco: total, usado, por volume | ✅ | ✅ |
| Rede: recebido, enviado, ritmo | ✅ | ✅ |
| Processos | ✅ | ❌ |
| **GPU** | ❌ | ❌ |

**A GPU não é lida em plataforma nenhuma.** O `sysinfo` não a expõe. O campo existe na estrutura e vem sempre `null` — o Monitor de recursos não desenha o cartão em vez de mostrar `0%`.

É deliberado: `null` quer dizer *"não é possível saber"*, e zero quer dizer *"medi e deu zero"*. Confundir os dois seria mentir ao utilizador. Ligar leitura de GPU exige `nvml-wrapper` (NVIDIA) ou DXGI (Windows) — fica para uma fase seguinte.

---

## Permissões

Declaradas ao mínimo, separadas por plataforma:

| Ficheiro | Plataformas | Contém |
|---|---|---|
| `capabilities/default.json` | todas | Núcleo, `os`, `store`, notificações, diálogos, `fs` limitado a `$APPDATA`/`$APPCONFIG`, `shell` limitado a `https:` e `mailto:` |
| `capabilities/desktop.json` | Windows, Linux, macOS | Atalho global, reinício do processo, controlo da janela |
| `capabilities/android.json` | Android | Só notificações |

### O `shell` nunca fica aberto

A interface **não consegue** mandar executar um comando arbitrário. A única coisa que pode pedir é abrir um endereço, e só nos dois esquemas permitidos. Filtrado duas vezes:

1. `src/platform/url-policy.ts`, no lado da interface — recusa cedo, com erro claro
2. A `allow` da capability, no lado Rust — recusa por segurança, mesmo que a primeira barreira falhe

---

## Como testar cada plataforma

| | |
|---|---|
| Browser | `npm run dev` |
| Windows | `npm run tauri dev` |
| Android | `npm run android:dev` |
| Layout compacto sem telemóvel | Estreite a janela abaixo de 820px, ou use a emulação de dispositivo do DevTools |

Para simular a ausência de uma capacidade sem mudar de plataforma, ponha-a a `false` no adapter e confirme que a interface a esconde em vez de rebentar. É exatamente isso que `tests/platform/adapters.test.ts` verifica automaticamente para os três.
