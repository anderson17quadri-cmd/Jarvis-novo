# `animations/`

Variantes e sequências de animação partilhadas (Partes 3 e 9).

## O que entra aqui

Definições de movimento reutilizadas por mais do que um componente — sobretudo
variantes do Framer Motion, que está instalado e ainda por usar.

```ts
// animations/window.ts
import { DURATION_MS, EASING } from '@/design-system/tokens';

export const windowVariants = {
  hidden: { opacity: 0, scale: 0.95, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: DURATION_MS.window / 1000, ease: EASING.out },
  },
};
```

**As durações e as curvas vêm sempre de `design-system/tokens.ts`.** Aqui
compõem-se movimentos com esses valores; nunca se escrevem números novos. Um
`0.28` à mão neste diretório é um bug à espera de acontecer quando a Parte 9
mudar.

## O que **não** entra

| | Onde vive | Porquê |
|---|---|---|
| Durações, curvas, keyframes do Tailwind | `design-system/tokens.ts` e `tailwind.config.ts` | São tokens, não composições |
| `@keyframes` de um só componente | `styles/boot.css`, `styles/windows.css`, … | Ficam junto do que animam |
| Loops de canvas | `hooks/use-animation-frame.ts` e os campos de partículas | São motor, não declaração |

## Regra prática

Se a animação é declarativa e serve dois ou mais componentes, entra aqui. Se é
imperativa (canvas, `requestAnimationFrame`) ou exclusiva de um componente,
fica onde está.
