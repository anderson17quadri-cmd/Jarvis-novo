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
> janela. Falta só o que o §4 já dizia que ia ficar de fora nesta leva —
> ferramentas para o Claude e o Ollama, e uma interface para reordenar a
> cadeia.

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

**Não pede ferramentas ainda.** A DeepSeek pede-as através de `run()`, um
método à parte de `stream()`, porque o formato de ferramentas da Anthropic é
outra peça (blocos `tool_use`, argumentos por `input_json_delta`) — maior do
que cabia nesta primeira versão. Sem isto, ligar o Claude à cadeia dá
conversa, mas não `abrir_janela` nem `criar_tarefa`. Registado, não
escondido.

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
2. **Ferramentas para o Claude e o Ollama.** Só a DeepSeek pede ferramentas
   hoje. Estender isso é o maior bloco de trabalho que falta.
3. **Se o Ollama entra à frente ou atrás do Claude por omissão.** Grátis e
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

- **Ferramentas para o Claude e o Ollama.** Só a DeepSeek pede ferramentas —
  a Claude e o Ollama respondem em conversa, e a interface di-lo.
- **Reordenar a cadeia.** Hoje é sempre "o escolhido, depois DeepSeek, Claude,
  Ollama pela ordem fixa" — não há arrastar nem preferência guardada por
  posição.
