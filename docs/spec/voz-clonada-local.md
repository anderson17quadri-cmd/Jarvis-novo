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
> **Estado: sub-fases 4.1 e 4.3 feitas (09/08/2026).**
> `voice-clone-service/server.py` corre na RTX 5070 do utilizador — `/falar`
> devolve áudio real, com a voz gravada. Custou três correções que só o
> Windows revela: FFmpeg preso à versão 4–8 (`winget` instala a mais
> recente, que o `torchcodec` ainda não suporta), `os.add_dll_directory`
> porque o Windows deixou de usar a PATH para DLLs de bibliotecas Python
> desde o Python 3.8, e o PyTorch reinstalado contra `cu130` (a RTX
> 5070/Blackwell não tinha kernels compilados no `cu126` inicial). Tudo em
> `voice-clone-service/README.md`, com o erro exato de cada uma para quem
> passar pelo mesmo.
>
> Depois disto, a amostra de referência que se estava a usar revelou-se (via
> `ffprobe`) uma gravação de ecrã de uma voz sintética de outro serviço, não
> a do utilizador — recusado pela mesma razão que a voz do filme original
> tinha sido: não é uma voz com autorização de quem a usa. Em vez disso, o
> XTTS-v2 já traz cerca de 40 vozes gravadas por atores que autorizaram o
> uso, distribuídas com o próprio modelo — `GET /vozes` expõe uma curadoria
> de 8, sem clonagem nenhuma, como alternativa imediata.
>
> A sub-fase 4.3 está feita: `voice-service.ts` fala com o serviço local
> (`VoiceSelection` com `kind: 'clonada'`), e `VoiceSettings.tsx`
> (Personalização → Voz) lista as vozes prontas e "A minha voz" (quando há
> uma amostra gravada) ao lado das vozes do sistema, no mesmo seletor — só
> aparecem se o serviço estiver a correr em `127.0.0.1:8090`. O CSP do Tauri
> já inclui esse endereço em `connect-src`, e `media-src 'self' blob:` para
> tocar o áudio devolvido.
>
> **Nota (13/08/2026): esta secção estava desatualizada.** As sub-fases 4.2
> e 4.4 já estavam feitas (confirmadas 10/08/2026, ver `SPEC.md`) mas a nota
> de estado aqui em cima nunca foi corrigida — descoberto numa revisão a
> sério do consentimento explícito. 4.2: `use-voice-sample-recorder.ts` +
> o botão "Gravar a minha voz" em `VoiceSettings.tsx` gravam pelo
> microfone, dentro da própria interface, sem ficheiro nenhum colocado à
> mão. 4.4: `src-tauri/src/voice_clone.rs` arranca o serviço sozinho, se
> ainda não estiver a correr. Ver `docs/log/historico-sessoes.md`,
> entrada "Revisão a sério: voz clonada, consentimento explícito" — essa
> mesma revisão encontrou e corrigiu um problema real: o CORS do serviço
> estava aberto a qualquer origem, o que deixava a barreira de
> consentimento (viver só na convenção da interface) ser contornada por
> qualquer página aberta noutro separador do browser.

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
| 4.1 | ✅ Serviço Python local, sozinho, testado por terminal (`curl` — o mesmo espírito do `scripts/testar-provedores.mjs`) |
| 4.2 | ✅ Gravação da amostra de voz na interface do JARVIS (confirmado 10/08/2026) |
| 4.3 | ✅ `voice-service.ts` a falar com o serviço local, CSP atualizado |
| 4.4 | ✅ Arranque automático do serviço pelo Tauri (confirmado 10/08/2026) |

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
