# Orquestrador multi-provedor (extensão à Parte 12)

> Pedido do utilizador: em vez de um provedor de IA fixo, uma **cadeia** —
> escolhe-se o melhor sozinho, e quando um fica sem saldo (ou sem chave, ou de
> rastos), avisa e salta para o seguinte automaticamente, sem ninguém ter de
> ir mudar nada a meio de uma conversa.
>
> **Estado:** os blocos que pensam já existem e estão testados — dois
> provedores novos e a lógica da cadeia. **Nada disto está ligado à
> interface.** Ver §4.

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

## 4. O que falta para isto aparecer na interface

Nada do que existe hoje mexe em `AiProviderId`, em `AI_PROVIDERS`, nem na
janela de Personalização — de propósito. A lista de provedores da
Personalização (`AiSettings.tsx`) já percorre `Object.keys(AI_PROVIDERS)`
para desenhar os botões: juntar `'claude'` e `'ollama'` aí sem o resto
pronto criava um botão que parece funcionar e não faz nada — exatamente o
"half-finished" que este projeto evita desde o primeiro dia.

Falta, para a próxima etapa:

1. Estender `AiProviderId` e `AI_PROVIDERS`, com as respetivas entradas de
   configuração (chave da Claude, endereço do Ollama).
2. Um campo novo em `AiSettings` para a ordem da cadeia.
3. A `AiSettings.tsx` ganhar os painéis de configuração do Claude e do
   Ollama, ao lado do que já existe para a DeepSeek.
4. O `AIService` construir a cadeia a partir do que está configurado, e usar
   `provider-chain.ts` no `catch` de `send()`/`sendWithTools()` em vez de
   cair direto no `RuleProvider`.
5. O CSP do Tauri (`connect-src`) ganhar `https://api.anthropic.com` e o
   endereço do Ollama.
6. Excluir as chaves novas do backup, pela mesma regra que já existe para a
   da DeepSeek (Parte 14).

Nenhum destes seis pontos precisa de nativo — é tudo browser e configuração,
o mesmo tipo de trabalho que já pôs a DeepSeek a funcionar. E mesmo que
precisasse, a Fase 1 já está validada no PC real desde 08/08/2026 (`SPEC.md`
§1.1) — o portão que faltava para qualquer trabalho nativo está aberto.
