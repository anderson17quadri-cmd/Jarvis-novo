# Voz clonada local (extensão à Parte 7.1)

> Pedido do utilizador: uma voz mais humana do que as vozes clássicas do
> Windows, sem pagar por uma API como a ElevenLabs — a própria voz do
> utilizador, clonada e a correr inteiramente no seu PC (RTX 5070,
> confirmada capaz).
>
> **Não clona ninguém sem autorização.** É a voz de quem usa o sistema,
> gravada pela própria pessoa, para o próprio sistema. Nenhuma voz de
> terceiros, de atores, ou de personagens entra aqui — essa linha mantém-se,
> como já ficou dito nesta conversa.
>
> **Estado: sub-fase 4.1 construída.** `voice-clone-service/server.py` — a
> lógica das rotas está testada (`/health`, `/voz`, `/falar`, os erros por
> ordem certa), mas **sem GPU nenhuma disponível neste ambiente**, o modelo
> XTTS-v2 a sério nunca correu. É o próximo passo — só se confirma no PC com
> a RTX 5070. Ver `voice-clone-service/README.md` para os passos de
> instalação e o smoke test por terminal.

---

## 0. O que é, tecnicamente

**XTTS-v2**, da Coqui — um modelo open-source de clonagem de voz "zero-shot":
dá-se-lhe uma amostra curta de alguém a falar (a especificação original do
modelo fala em poucos segundos, mas mais amostra costuma dar melhor
resultado — isto confirma-se na prática, não é um número fixo) e ele passa a
sintetizar qualquer texto novo com essa voz.

**Corre localmente**, num serviço Python à parte — não é algo que caiba
dentro do Tauri/browser diretamente, como o `RuleProvider` ou o
`DeepSeekProvider`. É a mesma categoria de coisa que o Ollama: um servidor a
correr no `localhost`, que o JARVIS contacta por HTTP.

## 1. Arquitetura

```
┌──────────────────────┐        HTTP local        ┌───────────────────────┐
│   JARVIS (Tauri)      │ ───────────────────────► │  Serviço de voz local  │
│   voice-service.ts     │  POST /falar {texto}     │  Python + XTTS-v2      │
│                        │ ◄─────────────────────── │  (usa a GPU, RTX 5070) │
└──────────────────────┘        áudio (wav)         └───────────────────────┘
```

- O serviço **não é gerido pelo Tauri** nesta primeira versão — corre à
  parte, como o Ollama, arrancado pelo utilizador. Automatizar o arranque
  (Tauri a lançá-lo sozinho) fica para depois de confirmar que o resto
  funciona.
- `voice-service.ts` ganha uma segunda via de síntese, ao lado da atual
  (`speechSynthesis`, já com o seletor de vozes do sistema): "voz clonada",
  que fala com este serviço em vez de pedir ao navegador.
- O CSP do Tauri precisa de um endereço novo em `connect-src` —
  `http://localhost:<porta>`, a decidir.

## 2. O que precisa de existir no PC, antes de qualquer código

1. **Python 3** instalado.
2. **PyTorch com CUDA** — a versão tem de suportar a arquitetura Blackwell
   da RTX 5070. Isto muda com frequência; confirma-se no momento da
   instalação, não se fixa aqui um número que pode já estar desatualizado.
3. **`coqui-tts`** (o pacote Python que traz o XTTS-v2).
4. Um pequeno serviço FastAPI — a escrever, mais simples do que o exemplo
   que se viu (não precisa de Docker, de GPU partilhada entre vários
   utilizadores, nem de um domínio próprio; é só para uma pessoa, numa
   máquina).

## 3. O fluxo, do ponto de vista de quem usa

1. Na Personalização → Voz, um botão novo: **"Clonar a minha voz"**.
2. Grava-se uma amostra — a lermos um texto simples que aparece no ecrã,
   uns segundos a um minuto. Fica só no dispositivo.
3. O serviço local prepara essa amostra (limpa ruído, corta silêncios —
   o mesmo tipo de preparação que se viu no ficheiro inspecionado,
   `prep_reference.py`, é trabalho já resolvido pela comunidade, não
   inventado de raiz).
4. A partir daí, "A minha voz" aparece como mais uma opção no seletor que já
   existe (`VoiceSettings.tsx`), ao lado das vozes do sistema — mesma
   interface, sem uma janela nova a aprender.

## 4. Faseamento

| Sub-fase | O quê |
|---|---|
| 4.1 | Serviço Python local, sozinho, testado por terminal (`curl` — o mesmo espírito do `scripts/testar-provedores.mjs`) |
| 4.2 | Gravação da amostra de voz na interface do JARVIS |
| 4.3 | `voice-service.ts` a falar com o serviço local, CSP atualizado |
| 4.4 | Aparece no seletor de vozes já existente, com "testar" como as outras |

## 5. O que fica decidido já, e o que fica em aberto

**Decidido:** só a voz de quem usa o sistema. Sem exceções, sem "só desta
vez", independentemente do que outro repositório qualquer fizer.

**Em aberto:**
1. A porta do serviço local (proposta: `8090`, para não colidir com o
   Ollama em `11434`).
2. Se o Tauri chega a gerir o arranque do serviço sozinho, ou se fica sempre
   manual (`python server.py`, como o Ollama fica para o utilizador ligar).
3. Quanto tempo de amostra pedir na gravação — decide-se ao testar a
   qualidade a sério, não antes.
