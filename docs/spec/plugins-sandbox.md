# Sandbox de plugins

Desenho da primeira execução real de código de um plugin, confirmado
10-11/08/2026. Substitui o estado anterior descrito em `SPEC.md` Parte 11
("Carregar e executar um plugin — 🚫") na parte que já está feita: três
capacidades (notificações, ficheiros, rede) e um SDK mínimo para escrever
mais.

## O buraco que isto fecha

Até aqui, "instalar" um plugin escrevia uma entrada num `Record` do
`use-plugin-store.ts` e mais nada — nenhum código descarregado, nenhum
código executado, `selectPermissionDenied` existia mas nada o chamava a
sério a não ser as duas funcionalidades do próprio sistema tratadas como
"plugins" (`core-assistant`, `automations`). Um plugin de terceiros nunca
corria uma linha.

## A escolha: iframe sandboxed, sem `allow-same-origin`

```html
<iframe sandbox="allow-scripts" srcDoc="..." />
```

Considerado e posto de lado:

- **Web Worker.** Mais leve, mas sem `postMessage` estruturado para pedir UI
  nem forma nenhuma de um plugin alguma vez desenhar algo — e alguns dos
  treze itens da API do Core avaliada (Widgets, Janelas, Painéis) exigem DOM.
  Um worker fecharia essa porta cedo demais.
- **Processo nativo separado (Rust, `Command::new`).** É o desenho certo
  para um `Terminal` a sério, mas pede o mesmo comando Rust novo e a mesma
  sandbox do sistema operativo que o `SPEC.md` já lista como bloqueado sem
  decisão própria. Plugins em JavaScript não precisam de sair do processo
  para ficar isolados — só de sair do contexto de JavaScript com acesso.
- **`eval()`/`new Function()` no mesmo contexto.** Zero isolamento — um
  plugin malicioso ou só com um bug leria `localStorage`, tokens, o estado
  Zustand inteiro. Nunca foi opção a sério.

O iframe sandboxed ganhou por já vir do browser (funciona igual no WebView2
e em qualquer `WebAdapter`, sem comando Rust novo), e por `sandbox="allow-scripts"`
sem `allow-same-origin` dar exatamente a garantia que interessa: o
documento carregado fica com **origem opaca** — nunca `app://` nem
`http://localhost:*` — por isso não consegue ler `document.cookie`,
`localStorage`, `sessionStorage` nem nada do `window.parent` a não ser o
que `postMessage` lhe entregar de propósito. Não navega a janela de fora
(sem `allow-top-navigation`), não abre popups (sem `allow-popups`), não
submete formulários para fora do próprio documento.

### Uma consequência da origem opaca: validar por `event.source`, não por `event.origin`

`event.origin` de um iframe sem `allow-same-origin` é sempre a string
`"null"` — indistinguível de qualquer outro iframe opaco na mesma página.
A validação certa é `event.source === iframeRef.current.contentWindow`:
só é verdadeira para mensagens que vêm mesmo desta janela exata, mesmo que
o `origin` não sirva para nada. Ver `PluginRuntime.tsx`.

## O protocolo

Um tipo de mensagem por capacidade, cada um ligado a uma permissão do
manifesto (`plugin-catalog.ts`, `PluginPermissions`) — `protocol.ts`. Nada
de uma chamada genérica tipo `core.call(metodo, args)`: cada capacidade
nova é um tipo novo, verificável em tempo de compilação, e visível de
propósito em vez de escondida atrás de uma string.

| Mensagem (plugin → Core) | Permissão | O que faz |
|---|---|---|
| `core.notify` | `notifications` | Mostra uma notificação a sério (`notificationService`) |
| `core.fs.read` | `filesystem` | Lê um ficheiro dentro da pasta declarada (`filesystemRoot`) |
| `core.fs.write` | `filesystem` | Escreve um ficheiro, idem |
| `core.fs.list` | `filesystem` | Lista ficheiros e pastas, idem |
| `core.fetch` | `network` | Um pedido HTTP a um domínio da lista (`allowedDomains`) |
| `core.automation.run` | `notifications` | Dispara (nunca cria) uma automação já existente pelo nome |

`handlePluginMessage()` (`plugin-bridge.ts`) verifica a permissão — a
mesma `selectPermissionDenied` que já protegia automações (`App.tsx`) e a
chamada de rede da IA (`ai-service.ts`), agora a sério para plugins
também — antes de tocar em qualquer serviço real. Recusada, devolve
`ok: false` e não chama nada. Fica auditado nos dois casos
(`logService.audit`), como o resto do sistema.

Separar `handlePluginMessage` do componente React (`PluginRuntime.tsx`) foi
deliberado: a decisão de permissão não precisa de DOM nenhum para se testar
— `tests/plugins/plugin-bridge.test.ts` chama-a diretamente, com
`@tauri-apps/plugin-fs` e `@tauri-apps/api/path` mockados (fora do Tauri,
como em `jsdom`, essas chamadas não existem a sério).

### Ficheiros: nunca o disco inteiro

`filesystemRoot` no catálogo é só o **nome** de uma subpasta (ex.:
`"ola-ficheiro"`) — nunca um caminho absoluto. É resolvido sempre dentro de
`$APPDATA/plugins-data/<nome>`, o único sítio para onde `fs:allow-read-dir`,
`fs:allow-mkdir`, `fs:allow-read-text-file` e `fs:allow-write-text-file` dão
licença (`src-tauri/capabilities/default.json`, escopo `$APPDATA/**`). Um
plugin nunca vê nem escolhe o caminho absoluto — só o que está *dentro* da
sua própria pasta. Um caminho pedido com `..` é recusado antes de tocar no
disco (`resolveWithinRoot`) — sem isto, `core.fs.read({ caminho:
"../outra-pasta/segredo.txt" })` escaparia da pasta declarada apesar do
manifesto dizer o contrário.

### Rede: domínio exato, decidido pelo Core, nunca pelo plugin

`allowedDomains` no catálogo é uma lista de nomes de domínio exatos (ex.:
`"jsonplaceholder.typicode.com"`). `handlePluginFetch` extrai o
`hostname` do URL pedido e compara com a lista **antes** de qualquer
`fetch` a sério — um plugin que peça outro domínio, mesmo por engano ou de
propósito, nunca chega a gerar tráfego (`tests/plugins/plugin-bridge.test.ts`
prova isto com um `vi.fn()` de `fetch` que nunca é chamado).

## O SDK (`plugins/sdk/`)

`jarvis-plugin-sdk.js` — injetado automaticamente pelo `PluginRuntime` no
`srcDoc`, antes do código do plugin, sem o plugin precisar de o importar
(o sandbox sem `allow-same-origin` não suporta `<script type="module">`).
Expõe `window.core.notify()`, `window.core.fs.{read,write,list}()`,
`window.core.fetch()` e `window.core.automation.run()` — cada um devolve
uma `Promise` que resolve ou rejeita a partir do `core.ack` real, poupando
a quem escreve um plugin de reimplementar a correlação por `requestId` à
mão. `jarvis-plugin-sdk.d.ts` é só para referência e verificação de tipo
ao escrever — o iframe não importa módulos, por isso não é `import`ável a
sério.

Um plugin pode ignorar a SDK e falar `postMessage` diretamente (os três
primeiros exemplos fazem-no, de propósito, para o protocolo em si ficar
claro); `dispara-automacao` usa a SDK, para mostrar o padrão mais simples
que a maioria dos plugins reais vai querer.

## Os plugins de exemplo

Todos em `src/plugins/examples/`, JavaScript simples, importados com
`?raw` (Vite) e injetados num `srcDoc`. Não fazem nada de útil: existem só
para provar, com código a sério e isolado, que pedir e recusar cada
capacidade funciona de ponta a ponta.

| Plugin | Capacidade | Fica à espera de |
|---|---|---|
| `ola-notificacao` | `core.notify` | `core.run` |
| `ola-ficheiro` | `core.fs.write` → `core.fs.read` (encadeado pelo `core.ack`) | `core.run` |
| `ola-rede` | `core.fetch` a `jsonplaceholder.typicode.com` | `core.run` |
| `dispara-automacao` | `core.automation.run` (via SDK) | `core.run` |

Todos ficam à espera de `core.run` (o botão na Loja de plugins) em vez de
disparar sozinhos ao carregar — o mesmo plugin corre várias vezes na mesma
sessão sem recarregar o iframe, essencial para testar recusar e depois
permitir sem reiniciar nada.

**Confirmado a sério, com a app a correr** (10-11/08/2026), não só nos
testes automatizados: instalar cada plugin pela Loja, recusar a permissão
em Privacidade → Permissões e confirmar que o pedido não se cumpre
("Permissão recusada." no cartão), depois permitir e confirmar que se
cumpre a sério — incluindo `nota.txt` a aparecer mesmo em
`%APPDATA%\com.projectarc.jarvis\plugins-data\ola-ficheiro\` e um pedido
real a `jsonplaceholder.typicode.com` (confirmado por CDP, Network
domain).

## O que ainda falta

- **Verificação de assinatura.** Continua bloqueada — não há ainda uma
  fonte de plugins de terceiros a sério, só o catálogo local. Ver
  `docs/spec/plugins-marketplace.md` para o que falta decidir antes disso
  fazer sentido.
- **As restantes onze capacidades da API do Core** avaliadas em
  10/08/2026 (Widgets, Janelas, Menus, Comandos, Atalhos, Configurações,
  Serviços, Voz, Memória, Preferências, Eventos) — cada uma pede o mesmo
  desenho (tipo de mensagem + permissão + `handlePluginMessage`), mas
  nenhuma tem plugin real a pedi-la ainda. Entram quando um caso de uso a
  sério precisar, não antes.
