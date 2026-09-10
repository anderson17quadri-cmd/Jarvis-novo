# `constants/`

Constantes partilhadas por mais do que um módulo (Parte 3).

## O que entra aqui

Valores `UPPER_CASE` que **vários** domínios consomem e que não pertencem a
nenhum deles em particular: códigos de erro, limites globais, chaves de eventos,
identificadores de protocolo.

```ts
// constants/events.ts
export const SYSTEM_EVENTS = {
  themeChanged: 'jarvis://theme-changed',
  pluginInstalled: 'jarvis://plugin-installed',
} as const;
```

## O que **não** entra

**Constantes de um só módulo ficam junto do módulo.** Uma constante usada num
sítio só é mais legível ao lado do código que a usa do que num ficheiro
central que obriga a saltar de ficheiro para a ler.

Estas ficam onde estão, e não devem ser movidas para cá:

| Constante | Onde vive | Porquê |
|---|---|---|
| `RAIL_ITEMS`, `DOCK_ITEMS` | `config/navigation.ts` | São configuração da navegação, não constantes soltas |
| `BOOT_TIMING`, `BOOT_STEPS` | `components/boot/boot-steps.ts` | Só o arranque as usa |
| `CORE_MODES`, `PARTICLE_COUNTS` | `components/ai-core/` | Só o núcleo as usa |
| `STORAGE_KEYS` | `services/storage-service.ts` | São a interface do próprio serviço |
| `COLORS`, `RADIUS`, `DURATION` | `design-system/tokens.ts` | São o design system, com teste de coerência próprio |

## Regra prática

Se a constante é usada em **um** módulo, fica lá. Ao ser precisa num **segundo**,
muda-se para aqui — e só nessa altura.
