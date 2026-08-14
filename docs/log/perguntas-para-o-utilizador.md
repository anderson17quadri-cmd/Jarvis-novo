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

---

## 2. Wake word configurável — o microfone fica a ouvir sem carregar em nada?

**Contexto.** A spec original promete uma wake word configurável
(`jarvis-spec-completo.md` §"Wake word": "Jarvis, Computer, Assistant, Friday,
Athena, Nova… Deteção contínua quando ativada"). Isso significa o microfone
**sempre ligado**, à escuta da palavra, sem a pessoa tocar em nada antes.
Hoje a app só ouve depois de um gatilho explícito: carregar para falar, ou o
modo conversa (que volta a ligar o microfone depois de cada resposta). A
escuta contínua foi deixada de fora de propósito — mesma categoria de risco do
navegador controlado (Peça 19) e do Controlo Direto (Fase 3.1), que só
avançaram depois de a pessoa escolher o âmbito.

**O que está em jogo.** Com o microfone sempre ligado, há uma decisão que não
é técnica, é de privacidade: **para onde vai o áudio**. O reconhecimento por
omissão é a Web Speech API, que em vários navegadores/sistemas envia o áudio
para o serviço de fala do navegador (na nuvem) — não fica só na máquina. Uma
wake word "local" (um motor pequeno a correr na máquina, sem sair áudio
nenhum) é possível mas é trabalho a mais e com outra qualidade de deteção.

**As opções:**

- **(a) Wake word local, sem áudio a sair da máquina.** Um motor de deteção
  a correr cá dentro (ex.: Vosk/snowboy ou semelhante) que só "acorda" a
  transcrição depois de ouvir a palavra. Privacidade máxima; mais trabalho e
  deteção menos robusta.
- **(b) Wake word por Web Speech API contínua.** Mais simples de pôr a
  funcionar, mas o áudio pode ir ao serviço de fala do navegador/OS.
- **(c) Não por agora.** Manter o carregar-para-falar e o modo conversa; a
  pessoa decide quando o microfone abre.

**Pergunta:** queres a escuta contínua da wake word — e, se sim, aceitas que
o áudio passe pela Web Speech API (opção b) ou exiges que fique só na máquina
(opção a)? Ou preferes deixar como está (opção c)?

---

## 3. Capacidades de plugin que mexem em voz e dados — quais autorizar?

**Contexto.** A API do Core para plugins promete 13 capacidades
(`jarvis-spec-completo.md:568`). Dez já estão construídas com permissão,
tipo de mensagem e exemplo a sério (widgets, janelas, menus, comandos,
atalhos, notificações, configurações, serviços, painéis, eventos). **Três
ficaram de fora de propósito**, à espera de autorização: **Executar Voz**
(o plugin manda o assistente falar), **Ler Memória** (o plugin lê a memória
que o assistente guardou sobre a pessoa) e **Guardar Preferências** (o plugin
escreve no armazenamento partilhado). Não é falta de tempo — é que mexem em
microfone e em dados guardados.

**O que está em jogo, capacidade a capacidade:**

- **Executar Voz** é a mais barata de construir (já existe `voiceService.speak`),
  mas a decisão é *quem* pode fazer o JARVIS falar sem a pessoa ter dito nada
  — um plugin a disparar voz por conta própria é uma intrusão.
- **Ler Memória** expõe as preferências pessoais que o assistente aprendeu
  ("não gosto de café", "moro no Porto") a código de terceiros.
- **Guardar Preferências** tem um risco que as outras não têm: **isolamento de
  dados**. O `storageService` guarda tudo num só ficheiro
  (`jarvis.store.json`) sem namespace por plugin — tal como está, um plugin
  malicioso podia ler ou escrever por cima da chave de outro. Autorizar isto
  obriga a desenhar primeiro o isolamento (`plugins:<id>:` por chave, ou
  parecido), não só a permissão.

**As opções:**

- **(a) Autorizar as três**, com o isolamento de dados desenhado primeiro
  (namespace por plugin no armazenamento, e permissão/gate para voz e memória).
- **(b) Autorizar só uma ou duas** — dizer quais (ex.: só Executar Voz, e
  deixar Ler Memória/Guardar Preferências por causa dos dados).
- **(c) Nenhuma por agora** — manter as dez que já existem.

**Pergunta:** destas três capacidades (Executar Voz, Ler Memória, Guardar
Preferências), quais queres autorizar — e, para Guardar Preferências, aceitas
que se construa primeiro o isolamento por plugin antes de a expor?
