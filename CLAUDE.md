# JARVIS AI OS — Project ARC

Tauri v2 + React 19 + TypeScript strict. Português de Portugal em tudo —
código, comentários, mensagens de commit, e a conversa contigo.

## Antes de começar

Lê, por esta ordem:

1. **`docs/log/historico-sessoes.md`** — o que já se decidiu e porquê, sessão
   a sessão. É a memória entre conversas: uma sessão nova (local ou não) não
   tem acesso à conversa anterior, só a isto e ao que está commitado.
2. **`SPEC.md`** — o que está feito, parcial, ou por fazer, por parte da
   especificação.
3. **`docs/spec/jarvis-spec-completo.md`** — a especificação original.

## Ao acabar um bocado de trabalho com significado

Acrescenta uma entrada no fim do `docs/log/historico-sessoes.md`, no mesmo
formato das que já lá estão — data, título curto, duas ou três frases sobre
o que se pediu e o que ficou feito. "Com significado" quer dizer uma
funcionalidade, uma correção, uma decisão — não cada ficheiro isolado, nem
cada commit a seu tempo (os commits já são a fonte exata do "o quê"; isto é
só o "porquê", em prosa).

## Regras que já ficaram assentes nesta conversa

- **Voz clonada, só com consentimento.** Nunca clonar a voz de uma
  personagem, de um ator sem autorização, ou reaproveitar áudio sintético de
  outro serviço de IA como se fosse uma amostra real. Só a voz de quem usa o
  sistema, ou de alguém que autorizou explicitamente — ver
  `docs/spec/voz-clonada-local.md`.
- Verificar sempre antes de dar como feito: `npx tsc --noEmit`, `npx eslint`,
  `npx vitest run`. Para mudanças visuais, confirmar num browser real antes
  de reportar sucesso.
