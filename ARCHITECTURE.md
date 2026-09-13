# Arquitetura

Como estender o JARVIS AI OS. As fases seguintes dependem destes quatro fluxos.

---

## O princípio

```
Componente  →  Hook  →  Service  →  PlatformAdapter  →  invoke()  →  Rust
```

Cada camada só conhece a seguinte:

| Camada | Responsabilidade | Nunca faz |
|---|---|---|
| **Componente** | Desenhar. Reagir a eventos. | Chamar `invoke`, tocar em `localStorage`, saber a plataforma |
| **Hook** | Ligar componentes a serviços, gerir ciclo de vida | Lógica de negócio |
| **Service** | Lógica de negócio, estado partilhado | Importar de `@tauri-apps/*` |
| **PlatformAdapter** | Falar com o sistema operativo | Saber o que a interface faz com o resultado |
| **Rust** | Acesso nativo | Formatar para apresentação |

### As duas regras que não se quebram

**1. Nenhum componente sabe em que plataforma corre.**

```tsx
// ❌ Errado — a abstração está partida
if (platform === 'android') return null;

// ✅ Certo — pergunta-se à capacidade
const { systemTray } = useCapabilities();
if (!systemTray) return null;
```

Se um componente precisar de um `if (platform === …)`, falta uma capacidade em `PlatformCapabilities`. Acrescente-a e responda-a nos três adapters.

**2. Uma funcionalidade em falta degrada, não rebenta.**

Um método que a plataforma não suporta devolve `null`, lista vazia ou uma função vazia. Nunca lança. O teste `tests/platform/adapters.test.ts` verifica isto para os três adapters.

---

## Adicionar uma nova janela

Três passos.

### 1. O componente

`src/apps/notas/NotasWindow.tsx`:

```tsx
export default function NotasWindow(): React.JSX.Element {
  return <div className="text-desc text-t2">As suas notas.</div>;
}
```

Exportação **default** — o `lazy()` do registo precisa dela.

### 2. O identificador

Em `src/types/app.ts`, junte à união `AppId`:

```ts
export type AppId = 'assistant' | 'calendar' | /* … */ | 'notas';
```

O TypeScript passa a apontar todos os sítios que precisam de saber da nova janela.

### 3. O registo

Em `src/apps/registry.ts`:

```ts
notas: {
  id: 'notas',
  title: 'Notas',
  icon: StickyNote,             // Lucide. Nunca emojis.
  defaultSize: { width: 420, height: 360 },
  component: lazy(() => import('./notas/NotasWindow')),
  implemented: true,
},
```

**Acabou.** A janela aparece na Command Palette, pode ser aberta pelo dock ou pelo rail, arrasta-se, redimensiona-se, encaixa nas bordas e o layout persiste — sem ter tocado em nenhum desses componentes.

Para a pôr no dock ou no rail, junte uma entrada em `src/config/navigation.ts`.

---

## Adicionar um widget

Um widget é um componente que vive dentro de uma janela ou do palco. Não tem registo próprio na Fase 1 — o sistema de widgets chega na Fase 2, com o Plugin Manager.

Por agora, o padrão é:

```tsx
// src/components/widgets/RelogioWidget.tsx
import { useClock } from '@/hooks/use-clock';
import { formatTime } from '@/lib/format';

export function RelogioWidget(): React.JSX.Element {
  const now = useClock();
  return <div className="mono text-h3">{formatTime(now)}</div>;
}
```

Regras:

- **Sem lógica no componente.** Se precisar de dados, crie um hook (`use-…`) que fale com um serviço.
- **Sem valores mágicos.** Cores, raios e durações vêm do tema do Tailwind, que vem de `tokens.ts`.
- **Anime só `transform` e `opacity`.** Nunca `width`, `top` ou `left` — forçam layout a cada frame.
- **Canvas pausa em segundo plano.** Use `useAnimationFrame`, que já trata disso e do `prefers-reduced-motion`.

---

## Adicionar um comando Rust

Quatro passos, um por camada.

### 1. O comando (Rust)

`src-tauri/src/commands/bateria.rs`:

```rust
use crate::error::Result;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstadoBateria {
    pub percentagem: f32,
    pub a_carregar: bool,
}

#[tauri::command]
pub fn get_estado_bateria() -> Result<EstadoBateria> {
    // Sem unwrap(). Tudo o que pode falhar devolve Result.
    Ok(EstadoBateria { percentagem: 82.0, a_carregar: false })
}
```

Registe em `commands/mod.rs` e no `invoke_handler` de `lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::system::get_system_snapshot,
    commands::bateria::get_estado_bateria,   // ← novo
])
```

> Se o comando só existir no desktop, ponha `#[cfg(desktop)]` e forneça uma versão `#[cfg(mobile)]` que devolva `Error::Unsupported`. Ver `commands/system.rs` — é exatamente esse o padrão.

### 2. Os tipos (TypeScript)

`src/types/system.ts` — espelho exato do que o Rust serializa:

```ts
export interface EstadoBateria {
  readonly percentagem: number;
  readonly aCarregar: boolean;
}
```

> `#[serde(rename_all = "camelCase")]` no Rust é o que faz `a_carregar` chegar como `aCarregar`.

### 3. O adapter

O contrato, em `src/platform/platform-adapter.ts`:

```ts
/** `null` onde a plataforma não sabe responder. */
getEstadoBateria(): Promise<EstadoBateria | null>;
```

A implementação partilhada, em `tauri-adapter-base.ts`:

```ts
async getEstadoBateria(): Promise<EstadoBateria | null> {
  if (!this.capabilities.bateria) return null;
  return this.tryInvoke<EstadoBateria>('get_estado_bateria', null);
}
```

E no `web-adapter.ts`, um valor simulado — para se poder desenvolver a interface no browser:

```ts
async getEstadoBateria(): Promise<EstadoBateria | null> {
  return { percentagem: 82, aCarregar: false };
}
```

Não se esqueça de acrescentar `bateria: boolean` a `PlatformCapabilities` e de a responder nos três adapters. O TypeScript obriga.

### 4. Serviço, hook e permissão

Um serviço se houver estado ou sondagem (ver `SystemService`); um hook se um componente precisar. E, se o comando usar um plugin do Tauri, declare a permissão em `src-tauri/capabilities/` — **ao mínimo necessário**.

> O `shell` nunca é aberto a comandos arbitrários. A única coisa que a interface pode pedir é abrir um URL, e só `https:` e `mailto:` — filtrado duas vezes, em `src/platform/url-policy.ts` e na capability.

---

## Adicionar um provedor de IA

O `AIService` já está desenhado para isto. Nenhum componente muda.

### 1. Implementar a interface

`src/services/ai-providers/openai-provider.ts`:

```ts
import type { AiProvider, AiRequest } from '@/types/assistant';

export class OpenAiProvider implements AiProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  constructor(private readonly apiKey: string) {}

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async *stream(request: AiRequest): AsyncIterable<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: request.signal,          // o cancelamento tem de chegar à rede
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: '…',
        stream: true,
        messages: [
          ...request.history.map((m) => ({
            role: m.author === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          { role: 'user', content: request.prompt },
        ],
      }),
    });

    // Ler o corpo e emitir cada pedaço com `yield`.
  }
}
```

### 2. Ligar

```ts
aiService.setProvider(new OpenAiProvider(chave));
```

`setProvider` cancela o pedido em curso antes de trocar.

### O que já está tratado

| | |
|---|---|
| Streaming | O `AIService` escreve cada pedaço no store à medida que chega |
| Modos do núcleo | `thinking` no envio, `speaking` no primeiro pedaço, `idle` no fim |
| Cancelamento | Um pedido novo aborta o anterior |
| Erros | Passa a `error` e escreve uma mensagem legível, sem rebentar |
| Voz | O `useVoice` lê a resposta em voz alta se tiver vindo do microfone |

### Onde guardar a chave

**Nunca no código nem no `localStorage`.** Use o `StorageService`, que no desktop e no Android escreve pelo plugin `store` do Tauri:

```ts
await storageService.set('openai-key', chave);
```

Acrescente a chave a `STORAGE_KEYS` em `storage-service.ts`, para não haver strings soltas.

Numa fase seguinte, o mais correto é a chamada sair do lado Rust: assim a chave nunca chega ao WebView.

---

## Onde pôr um ficheiro novo

A estrutura tem duas gerações. As pastas por domínio (`platform/`, `services/`,
`stores/`, `components/…`, `apps/`) vêm da árvore original. As pastas da Parte 3
(`constants/`, `utils/`, `animations/`, `workers/`, `assets/`) foram
acrescentadas depois, e é para lá que o código novo desse tipo vai.

**Nada foi movido.** Um ficheiro que já existe e passa nos testes fica onde está;
a convenção aplica-se ao que se escreve a partir de agora. Cada uma das cinco
pastas tem um `README.md` que define a fronteira exata — incluindo o que
*continua* noutro sítio e não deve ser arrumado para lá.

| Vais escrever | Vai para |
|---|---|
| Componente do shell | `components/shell/` |
| Componente do núcleo | `components/ai-core/` |
| Janela nova | `apps/<nome>/` + entrada em `apps/registry.ts` |
| Hook | `hooks/use-nome.ts` |
| Serviço | `services/nome-service.ts` |
| Store | `stores/use-nome-store.ts` |
| Função pura, sem dependências | `utils/` |
| Envolver biblioteca de terceiros | `lib/` |
| Constante usada por 2+ módulos | `constants/` |
| Constante de um só módulo | junto do módulo |
| Variante Framer Motion partilhada | `animations/` |
| `@keyframes` de um só componente | `styles/<componente>.css` |
| Token de cor, raio, duração, curva | `design-system/tokens.ts` |
| Trabalho pesado fora da thread principal | `workers/` |
| Som, tipo de letra, imagem importada | `assets/` |
| Comando nativo | `src-tauri/src/commands/` + método no adapter |

---

## Convenções

| | |
|---|---|
| Ficheiros | `kebab-case.ts` |
| Componentes | `PascalCase.tsx`, um por ficheiro |
| Hooks | `use-nome.ts`, exportando `useNome` |
| Constantes | `UPPER_CASE` |
| Ícones | Lucide React. **Nunca emojis, em lado nenhum.** |
| `any` | Proibido. `strict` total, incluindo `noUncheckedIndexedAccess` |
| Rust | Comandos pequenos e tipados. `Result`, nunca `unwrap()` |

### Acessibilidade

Não é uma camada final — é parte de cada componente:

- Todo o elemento interativo tem nome acessível
- Foco visível em toda a parte (`:focus-visible` global)
- Navegação por teclado nos diálogos: setas, `Enter`, `Escape`
- Alvos de toque ≥ 44px em `pointer: coarse`
- `prefers-reduced-motion` respeitado a sério: além do CSS, os canvas reduzem partículas e o arranque salta a encenação

### Performance

- Só `transform` e `opacity` se animam
- `useAnimationFrame` pausa em segundo plano e normaliza a 60 FPS
- Contagem de partículas escala com o ecrã
- Janelas em `lazy()`
- Seletores do Zustand que derivam arrays **precisam** de `useShallow` — sem isso, entram em ciclo de renderização

---

## Serviços Python

O JARVIS integra dois serviços Python locais para funcionalidades de voz:

### Voice Clone Service (Porta 8090)

**Função:** Síntese e reconhecimento de voz local usando XTTS-v2 e Whisper.

**Tecnologia:**
- FastAPI para API REST
- Coqui TTS (XTTS-v2) para síntese com clonagem de voz
- OpenAI Whisper para transcrição
- FFmpeg para processamento de áudio

**Endpoints:**
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Status básico do serviço |
| `/health/detailed` | GET | Status detalhado com uso de recursos |
| `/vozes` | GET | Lista vozes disponíveis do modelo |
| `/voz` | POST | Registra amostra de voz para clonagem |
| `/falar` | POST | Sintetiza texto em áudio |
| `/ouvir` | POST | Transcreve áudio para texto |

**Segurança:**
- CORS restrito a origens do JARVIS (`localhost:1420`, `tauri.localhost`)
- Validação de tipo MIME para uploads de áudio
- Limites de tamanho (10MB) e duração (1-300s)
- Sanitização de paths de arquivos temporários

**Arquivos Principais:**
- `voice-clone-service/server.py` - Servidor principal
- `voice-clone-service/voices/referencia.wav` - Amostra de voz clonada
- `voice-clone-service/tests/test_validacao.py` - Testes de validação

### Wake Word Service (Porta 8080)

**Função:** Detecção local de palavra de ativação ("Hey Jarvis").

**Tecnologia:**
- FastAPI para API REST
- Porcupine ou OpenWakeWord para detecção

**Endpoints:**
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Status do serviço |
| `/detect` | POST | Processa áudio para detecção de wake word |

**Integração:** Ambos os serviços rodam independentemente do processo principal do Tauri, comunicando via HTTP localhost. O JARVIS pode funcionar sem eles (com funcionalidade reduzida), seguindo o princípio de degradação graciosa.

Ver [docs/PORTS_AND_FLOWS.md](docs/PORTS_AND_FLOWS.md) para detalhes de comunicação entre serviços.
