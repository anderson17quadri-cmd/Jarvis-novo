# `utils/`

Funções puras, sem dependências (Parte 3).

## O que entra aqui

Funções que recebem valores e devolvem valores. Sem estado, sem DOM, sem rede,
sem React. Testáveis sem montar nada.

```ts
// utils/clamp.ts
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

## O que já cá vive

| Ficheiro | Porquê aqui |
|---|---|
| `text.ts` | `normalizeSearch` — tira acentos e caixa. Função pura, e usada por três módulos: Command Palette, painel de notificações e loja de plugins |

## `utils/` ou `lib/`?

A fronteira é a dependência externa:

| | `utils/` | `lib/` |
|---|---|---|
| Depende de biblioteca de terceiros | não | sim |
| Toca no DOM ou em APIs do browser | não | pode |
| Exemplo | `clamp`, `chunk`, `slugify` | `cn.ts` (envolve `clsx` e `tailwind-merge`) |

Em resumo: `lib/` é onde se envolve o que é dos outros; `utils/` é o que é
inteiramente nosso e não depende de nada.

## O que **não** entra

**Nada é movido para cá nesta ronda.** O que já existe fica onde está:

| Ficheiro | Onde vive | Porquê fica |
|---|---|---|
| `lib/format.ts` | `lib/` | Usa `Intl`, uma API do browser |
| `lib/id.ts` | `lib/` | Usa `crypto.randomUUID` |
| `lib/cn.ts` | `lib/` | Envolve duas bibliotecas de terceiros |

Estão testados e a passar. Movê-los seria churn sem ganho.
