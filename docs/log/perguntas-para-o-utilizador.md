# Perguntas para o utilizador

Decisões que não podem ser tomadas por um modelo sozinho — cada uma é uma
pergunta concreta, com o contexto e as opções, para a pessoa decidir. Nada
aqui foi construído; é só a pergunta.

---

## 1. A assinatura de um plugin cobre o manifesto, não o código — queres alargá-la?

**Contexto (achado na revisão a sério de 14/08/2026).** O ficheiro
`.jarvis-plugin` tem quatro partes: o `manifest` (nome, versão, permissões…),
a `signature`, a `signerPublicKey` e o `code` (o JavaScript que corre). A
assinatura Ed25519 cobre **só o `manifest`** — o `code` não é autenticado.
Está documentado assim em `src/plugins/plugin.ts`, com uma justificação que a
revisão achou **tecnicamente errada**: diz que o `code` "não é serializado na
forma canónica (pode conter caracteres que o `JSON.stringify` escape de forma
diferente entre engines)". Não é verdade — o `JSON.stringify` de uma string é
determinístico entre engines, e o próprio código já assina outros campos de
texto (`name`, `description`, `author`) sem problema nenhum.

**O que isto significa na prática.** Quem tiver um `.jarvis-plugin` assinado
por um autor legítimo pode trocar o `code` por outro JavaScript qualquer, e a
verificação continua a passar — porque só o manifesto é conferido. A
interface diz "Assinatura verificada", o que dá a entender que o plugin
inteiro (código incluído) vem do autor. A rede de segurança é o sandbox: o
código trocado corre no `<iframe sandbox="allow-scripts">` e só pode usar as
permissões que o manifesto assinado declara — não pode pedir mais do que isso.

**As opções:**

- **(a) Alargar a assinatura ao `code`** (assinar `manifest` + `code` em
  conjunto, ou assinar um hash do `code`). Autentica o plugin inteiro, como
  se espera de uma assinatura. Custo: é uma mudança **quebradora** no formato
  `.jarvis-plugin` — os pacotes já assinados deixam de verificar, e a
  ferramenta de assinar tem de mudar junto. Como ainda não há plugins
  externos em circulação real, o custo é baixo.
- **(b) Manter como está** — a assinatura prova a identidade do autor e as
  permissões; o código corre confinado ao sandbox. Mais simples, mas "código
  assinado" é um exagero, e a mensagem da interface devia dizer a verdade
  ("manifesto assinado", não "plugin assinado").

**Pergunta:** queres que a assinatura passe a cobrir também o `code` (opção a),
ou preferes manter só o manifesto e ajustar a mensagem da interface para não
prometer mais do que verifica (opção b)?
