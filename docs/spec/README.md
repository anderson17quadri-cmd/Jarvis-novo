# Especificação — arquivo

O que o projeto **quer ser**. Guardado aqui para não depender de nada fora do
repositório.

| Ficheiro | O que é |
|---|---|
| [`jarvis-spec-completo.md`](jarvis-spec-completo.md) | A especificação inteira, Partes 1 a 17, tal como foi escrita. **Fonte de verdade da visão.** |
| [`design-reference/jarvis-ai-os.html`](design-reference/jarvis-ai-os.html) | O protótipo visual. Fonte de verdade do aspeto: cores, espaçamentos, animações e comportamento das camadas |
| [`spec-partes-2-3-4-5-6-8-9-17.md`](spec-partes-2-3-4-5-6-8-9-17.md) | Versão anterior, só com as partes que faltavam na altura. Fica pelo histórico; o ficheiro completo substitui-a |
| [`fase-3-controlo-direto.md`](fase-3-controlo-direto.md) | Extensão: controlo direto (rato, teclado, visão de ecrã, presença). Desenho completo, implementação por sub-fases |
| [`orquestrador-multi-provedor.md`](orquestrador-multi-provedor.md) | Extensão: cadeia de provedores de IA (DeepSeek → Claude → Ollama → Regras) com fallback automático |
| [`voz-clonada-local.md`](voz-clonada-local.md) | Extensão: clonagem de voz local com XTTS-v2 e reconhecimento com Whisper, via Python FastAPI |
| [`plugins-sandbox.md`](plugins-sandbox.md) | Extensão: sistema de plugins em sandbox (iframe sem `allow-same-origin`), permissões e ciclo de vida |

## Isto não é o SPEC.md

Dois documentos, dois papéis, e vale a pena não os confundir:

| | Onde | Responde a |
|---|---|---|
| **Visão** | `docs/spec/jarvis-spec-completo.md` | O que o JARVIS há de ser, por inteiro |
| **Estado** | [`../../SPEC.md`](../../SPEC.md) | O que está feito, o que está por confirmar, o que ficou de fora e porquê |

A visão não se edita para acompanhar o código. Quando o código diverge dela de
propósito, a divergência é registada no `SPEC.md` §*Divergências assumidas* — o
documento de origem fica como está.

## Nota sobre os tokens

Os valores em `src/design-system/tokens.ts` saíram do bloco `:root` do
protótipo. Se algum dia divergirem, é o protótipo que manda, e o teste
`tests/design-system/themes.test.ts` só garante que o TypeScript e o CSS
concordam entre si — não que concordam com o HTML.
