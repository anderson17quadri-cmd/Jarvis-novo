# Orquestrador multi-provedor (extensão à Parte 12)

> Pedido do utilizador: em vez de um provedor de IA fixo, uma **cadeia** —
> escolhe-se o melhor sozinho, e quando um fica sem saldo (ou sem chave, ou de
> rastos), avisa e salta para o seguinte automaticamente, sem ninguém ter de
> ir mudar nada a meio de uma conversa.
>
> **Estado: ligado e verificado.** Claude e Ollama entraram em
> `AiProviderId`/`AI_PROVIDERS`, a Personalização ganhou os painéis dos dois,
> `use-ai-settings-store.ts` constrói a cadeia a partir do que estiver
> configurado, e o `AIService` tenta-a sozinho no `recover()`. Verificado num
> Chromium real: guardar a chave da Claude e depois a da DeepSeek mostra a
> nota "Se o DeepSeek falhar… tenta sozinho o próximo provedor" na própria
> janela. **Ferramentas para o Ollama e para o Claude, feitas** — ver Peça 20
> abaixo. Falta só o que o §4 já dizia que ia ficar de fora nesta leva — uma
> interface para reordenar a cadeia.

---

## 0. Porque é que isto não é um pedido novo, é uma continuação

A Parte 12 já tem uma linha no `SPEC.md`, antes desta extensão: *"Seleção
automática de modelo e regras de fallback, os dois ✅. Só a ligação a outros
provedores fica de fora."* A escolha automática já existe — só escolhe entre
os dois modelos da DeepSeek (`chat`/`reasoner`). O fallback já existe — só
cai num sítio, o `RuleProvider` local. Isto é literalmente ligar mais
provedores a um sistema que já foi desenhado para os ter.

## 1. Os dois provedores novos

### Claude (`services/ai-providers/claude-provider.ts`)

API da Anthropic, formato próprio (não é compatível com a OpenAI, ao
contrário da DeepSeek): `content_block_delta` em vez de `choices[0].delta`, a
chave vai no cabeçalho `x-api-key`, e o "prompt de sistema" é um campo à
parte em vez de uma mensagem com `role: 'system'`.

Dois modelos, pela mesma lógica da DeepSeek: **Sonnet 5** para o dia a dia,
**Opus 5** para raciocínio a sério — mas, nesta primeira versão, sem escolha
automática entre os dois (isso fica para quando a cadeia estiver ligada e for
claro que vale a pena duplicar a lógica de `chooseModel`, em vez de a
inventar já a adivinhar).

**Sem saldo é um caso especial.** A Anthropic não tem um código HTTP só para
"conta sem crédito", ao contrário da DeepSeek (402). Chega como 400 com uma
mensagem de erro que fala em saldo — por isso `claudeFailureFromResponse`
abre o corpo da resposta antes de decidir, em vez de confiar só no código.

**Pede ferramentas, desde a Peça 20.** `run()`, o mesmo método à parte de
`stream()` que a DeepSeek já tinha — o formato de ferramentas da Anthropic é
mesmo diferente (blocos `tool_use` dentro da própria mensagem `assistant`,
`tool_result` dentro da `user` seguinte, argumentos por `input_json_delta`
espalhados por vários eventos), por isso `claude-provider.ts` ganhou
`toAnthropicMessages()` — só ali é que a diferença de formato importa,
traduzindo o genérico (estilo OpenAI) que `ai-service.ts` já usa para
qualquer provedor. Ver §6 abaixo para o detalhe.

### Ollama (`services/ai-providers/ollama-provider.ts`)

Local, `http://localhost:11434` por omissão — endereço configurável, porque
quem instala o Ollama escolhe a porta. **Sem chave nenhuma**: `isConfigured()`
só verifica se há um nome de modelo, não uma credencial — não há ninguém do
outro lado a cobrar.

O ponto de entrada `/v1/chat/completions` do Ollama é compatível com a
OpenAI de propósito, por isso reaproveita `readStream` e `buildMessages` da
DeepSeek em vez de reescrever o mesmo parser — a mesma disciplina de não
duplicar lógica que já se aplicou este projeto todo a nomes e a nomes de
tema.

**Não sabe que modelo tens instalado.** Isso é uma decisão tua (`ollama
pull llama3.1`, ou outro) — o código não pode adivinhar, e um modelo em
falta chega como um erro de servidor genérico em vez de uma mensagem
específica. Se vier a valer a pena distinguir isso, é uma extensão pequena.

## 2. A cadeia (`services/ai-providers/provider-chain.ts`)

Pura lógica, sem rede, sem `fetch` — só decide, com base no que já
aconteceu:

- **`firstInChain`** — o primeiro provedor configurado. Um sem chave nem
  entra na corrida.
- **`nextStep`** — recebe quem acabou de falhar e a falha (`AiFailure`, já
  existente — `chave`, `saldo`, `limite`, `servidor`, `rede`, `demora`,
  `vazio`) e devolve: para quem saltar a seguir, e a frase pronta para a
  notificação. Um cancelamento do utilizador não gera aviso nenhum — quem
  cancelou já sabe.
- Quando a cadeia se esgota, a resposta cai no `RuleProvider`, exatamente
  como já acontece hoje com um só provedor remoto — não se inventou um
  comportamento novo para esse caso, reaproveitou-se o que já existia.

**Exemplo de aviso**, tal como sai da função: *"DeepSeek: a conta não tem
saldo — a passar para Claude."* Nunca silencioso — a mesma regra que já
existe no `planFallback` de hoje: *"Um fallback silencioso é pior do que uma
falha."*

## 3. O que isto ainda não decide

1. **A ordem da cadeia.** Hoje é só uma lista que se passa à função — quem a
   escreve escolhe a ordem. Um ecrã de configurações para reordenar
   (arrastar, ou uma lista numerada) é trabalho de interface, não de lógica.
2. **Se o Ollama entra à frente ou atrás do Claude por omissão.** Grátis e
   local versus melhor e pago — não é uma decisão técnica, é tua.

## 4. O que ficou ligado

Os seis pontos que este documento listava como pendentes estão todos feitos:

1. ✅ `AiProviderId` e `AI_PROVIDERS` estendidos, com as entradas de
   configuração de cada um.
2. ✅ `AiSettings` ganhou `claudeApiKey`, `claudeModel`, `ollamaModel`,
   `ollamaBaseUrl`. A ordem da cadeia ficou fixa em código
   (`CHAIN_ORDER` — DeepSeek, Claude, Ollama), não configurável ainda: ver §3,
   que continua em aberto.
3. ✅ `AiSettings.tsx` ganhou os painéis do Claude e do Ollama, com a mesma
   disciplina de aviso do que sai do dispositivo que a DeepSeek já tinha.
4. ✅ `AIService.setChain()` e o `recover()` tentam a cadeia sozinhos antes
   de caírem no `RuleProvider` — testado com falhas encadeadas
   (`provider-chain-service.test.ts`) e verificado num Chromium real.
5. ✅ CSP com `https://api.anthropic.com` e `http://localhost:11434`. A
   porta do Ollama é fixa no CSP — mudar a porta na Personalização sem mudar
   também o CSP deixa o pedido bloqueado, e a própria interface avisa disto.
6. ✅ `claudeApiKey` excluída do backup, ao lado de `apiKey`.

## 5. O que fica mesmo de fora, por agora

- **Reordenar a cadeia.** Hoje é sempre "o escolhido, depois DeepSeek, Claude,
  Ollama pela ordem fixa" — não há arrastar nem preferência guardada por
  posição.

## 6. Peça 20 — ferramentas para o Claude (13/08/2026)

Última peça pendente deste documento: `ClaudeProvider.run()`, o mesmo
contrato que `DeepSeekProvider.run()` — texto e `ToolCall[]` numa só
passagem, para `AIService.sendWithTools` tratar os três provedores capazes de
ferramentas (DeepSeek, Claude, Ollama-com-modelo-capaz) da mesma forma, sem
saber qual está por trás.

**O que muda de propósito, por o formato da Anthropic não ter equivalente
direto**:

- Um pedido de ferramenta é um bloco `tool_use` **dentro** da mensagem
  `assistant` (`content: [{type: 'text', ...}, {type: 'tool_use', id, name,
  input}]`), nunca um campo `tool_calls` à parte como na OpenAI/DeepSeek.
- A resposta de uma ferramenta é um bloco `tool_result` dentro da mensagem
  `user` **seguinte** (`content: [{type: 'tool_result', tool_use_id,
  content}]`), nunca uma mensagem com `role: 'tool'` própria. Como
  `ai-service.ts` continua a empurrar uma mensagem `tool` por chamada
  (formato genérico, o mesmo para qualquer provedor), `toAnthropicMessages()`
  junta mensagens `tool` consecutivas num único bloco `user` com vários
  `tool_result` — é o que a Anthropic exige quando um turno pede mais do que
  uma ferramenta de uma vez.
- Os argumentos de um `tool_use` chegam por eventos `input_json_delta`
  espalhados (`partial_json`), só interpretáveis depois de completos —
  `collectClaudeStream` acumula por índice de bloco, a mesma disciplina que
  já existia no `collect()` da DeepSeek para o campo equivalente.

**O que não mudou**: `toolsAsAnthropicSchema()` (`services/assistant/tools.ts`)
gera o catálogo no formato `{name, description, input_schema}` a partir da
mesma definição `TOOLS` que já alimentava `toolsAsJsonSchema()` — sem
segunda cópia da lista de ferramentas a divergir.

**Verificação**: 9 testes novos — 5 unitários em `collectClaudeStream`
(texto e ferramenta juntos, argumentos partidos por vários eventos, dois
`tool_use` em paralelo sem se misturarem, JSON que nunca fecha não rebenta,
sem ferramenta nenhuma a lista vem vazia), 1 no esquema Anthropic
(`toolsAsAnthropicSchema`), 3 num ciclo completo de `sendWithTools` com o
Claude (`tests/assistant/send-with-tools-claude.test.ts`, o mesmo padrão do
ficheiro já existente para a Ollama). Suite completa depois desta peça: 120
ficheiros, 1621 testes. `tsc` limpo, `eslint` 0 erros. **Não confirmado ao
vivo** — feito nesta sessão remota, sem chave da Anthropic disponível para
testar contra o servidor real; a tradução de formato está confirmada a sério
por teste (inclusive o caso de dois `tool_use` em paralelo, que só um teste
apanha — não dá para ver isso "a olho" numa conversa normal).
