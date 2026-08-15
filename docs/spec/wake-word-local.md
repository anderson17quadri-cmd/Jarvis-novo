# Wake word — deteção local, nunca por um serviço de fala na nuvem

> Este documento é o desenho do item 24 da `docs/log/fila-de-trabalho.md`, e
> segue o formato dos outros desenhos a sério do projeto (como
> [`fase-3-controlo-direto.md`](fase-3-controlo-direto.md) e
> [`voz-clonada-local.md`](voz-clonada-local.md)). Não faz parte da spec
> original (`jarvis-spec-completo.md`, Partes 1–17) — é a resolução da linha
> "Wake word configurável" da Parte 7.2, que a spec deixou **por decidir**
> por causa da escuta contínua.
>
> **Estado: só desenho. Nenhuma linha de código escrita.** A decisão de
> privacidade que travava a linha já está tomada (ver §0) — falta construir.

---

## 0. A decisão de privacidade — tomada, não por tomar

A spec (Parte 7.2, "Wake word configurável") dizia "exige escuta contínua —
decisão de privacidade por tomar". Essa decisão **já está tomada** e fica
assim, para não se reabrir:

1. **Opção (a), e só a (a): motor local.** Um motor de deteção de palavra a
   correr só na máquina — Vosk, ou outro motor pequeno e offline com um modelo
   em português. A opção (b) — escuta contínua pela Web Speech API, que manda
   áudio para fora 24h/dia — está **explicitamente recusada**. Um pedido
   pontual (a transcrição de um comando, quando a pessoa já carregou no
   botão) é uma categoria de exposição completamente diferente de um microfone
   permanentemente aberto a enviar para a nuvem. Aqui não há microfone
   permanentemente aberto a enviar para lado nenhum: o que ouve, ouve-se só
   na máquina, e só a palavra escolhida passa a barreira.
2. **Continua desligado por omissão.** Mesmo depois de construído, a deteção
   começa desligada — ativação explícita na janela de Privacidade, a mesma
   disciplina das permissões de plugin (Parte 14) e do Controlo Direto
   (Fase 3.1): declarada, visível, recusável, e a decisão persiste.

Nenhuma secção abaixo é implementada sem este §0 estar inteiro.

---

## 1. O princípio — a wake word é um portão, não um ouvido novo

A wake word **não é** um segundo sistema de reconhecimento de voz. É só uma
resposta à pergunta "já posso ligar o reconhecimento de verdade?" — a pergunta
que hoje o botão do microfone responde. O pipeline de sempre
(`voice-service.ts`, Parte 7.2) continua exatamente o mesmo: transcrição →
intenção → execução → síntese. A wake word substitui o **toque no botão**, não
substitui nada do que vem a seguir.

```
┌─────────────────────────────────────────────────────────────────┐
│  WAKE WORD       só ouve UMA palavra, na máquina, até a ouvir     │
│  (Vosk, local)     → sem isto, o resto continua desligado          │
├─────────────────────────────────────────────────────────────────┤
│  TRANSCRIÇÃO     o pipeline de sempre (POST /ouvir, Whisper)      │
│  (o que já há)     → só arranca depois de a palavra ser ouvida     │
├─────────────────────────────────────────────────────────────────┤
│  EXECUÇÃO + SÍNTESE   intenção, ferramenta, voz — inalterado      │
└─────────────────────────────────────────────────────────────────┘
```

**A barreira é física no desenho, não uma convenção:** enquanto a palavra não
for detetada, o caminho de transcrição nem é chamado. Não há nenhum ponto em
que áudio cru saia da máquina antes da deteção, porque a deteção é o único
componente a tocar no microfone nessa fase, e ela é local de raiz.

### 1.1 O que a wake word faz, exatamente

- Escuta **continuamente**, só na máquina, à procura de uma palavra ou frase
  curta configurável ("Jarvis", "Olá Jarvis" — a escolher, ver §6).
- Quando a deteta, **acorda o reconhecimento real**: chama o mesmo arranque
  que o botão do microfone já dispara hoje (`voiceService`), que passa a ouvir
  o comando a sério.
- Depois da transcrição do comando, a escuta contínua volta ao sítio dela —
  ou continua durante uma janela curta, conforme a preferência do modo
  conversa que já existe (ver §5, fase 24.2).

### 1.2 Dois avisos honestos, antes de construir

1. **A palavra é dita em voz alta, e quem estiver por perto ouve-a** — a
   mesma ressalva que o Controlo Direto já faz sobre a palavra-passe falada.
   A wake word não é autenticação (qualquer pessoa que diga "Jarvis" a acorda);
   é só conveniência. Se a pessoa quiser *provar* que é ela, isso já existe e
   é outra coisa: a palavra-passe do Controlo Direto (Fase 3.1 §1.1).
2. **Um motor offline pequeno é pior que o Whisper, e pior que a nuvem.**
   Haverá falsos positivos (acorda sem ninguém ter dito nada) e falsos
   negativos (não acorda quando devia), sobretudo com ruído de fundo. Isto é
   uma troca honesta: paga-se em precisão o que se ganha em "nada sai da
   máquina". O desenho trata os falsos positivos como o caso a testar mais a
   sério (§4), porque acordar sozinho é o pior dos dois — começa a gravar um
   comando sem ninguém ter pedido.

---

## 2. Um pedido, passo a passo

> "Jarvis, abre as tarefas."

1. **Wake word ligada** (Privacidade) e **a ouvir** (indicador visível, §4).
   O motor local ouve, na máquina, à procura da palavra. Nada sai da máquina.
2. O motor deteta "Jarvis" e **emite o evento local** "palavra ouvida" à app.
3. A app **liga o reconhecimento real** — o mesmo `voiceService` de sempre.
4. "abre as tarefas" é transcrito (local, `POST /ouvir`), interpretado e
   executado — inalterado.
5. A escuta contínua da wake word **suspende-se enquanto o JARVIS fala**
   (para não ouvir a própria voz pelas colunas — o mesmo guard de eco que já
   existe em `voice-service.ts`, reusado, não duplicado) e retoma depois.

Se em qualquer ponto a wake word for desligada, ou a app fechar: a escuta
contínua para no instante, sem terminar um comando a meio.

---

## 3. Limites explícitos — o que isto continua a não ser

- **Não escuta por um serviço na nuvem.** Nem antes, nem depois da palavra. A
  deteção é 100% local; a transcrição que vem a seguir já era o pipeline
  existente (local primeiro, e a nuvem só como o fallback *pré-existente* de
  quem não tem o serviço local a correr — ver a ressalva em §4).
- **Não grava nem guarda áudio.** A deteção trabalha o áudio em memória, em
  streaming, e descarta-o; não entra em disco, não entra no backup.
- **Não corre em segundo plano.** Só enquanto o JARVIS estiver aberto —
  a mesma regra das automações e do Controlo Direto (§3 do desenho dele).
- **Não é autenticação.** Ouvir a palavra não prova *quem* a disse. Ver §1.2.
- **Não corre sem o interruptor ligado** na Privacidade, desligado por
  omissão — e o indicador de "a ouvir" é permanente, nunca escondido.

---

## 4. Plano técnico (para quando o §0 estiver cumprido)

Regra de ouro do projeto mantida: o frontend nunca fala diretamente com o
sistema operativo. A captura contínua do microfone vive **nativa**, não no
browser — o WebView2 é exatamente onde o microfone já se provou frágil
(Web Speech API partido, §1 do `voice-service.ts`), e um loop contínuo de
`getUserMedia` não é o sítio para uma coisa que não pode deixar cair áudio.

**O motor — candidato principal: Vosk.** Pequeno, offline, CPU-only (não
compete pela GPU com o XTTS-v2/Whisper), com modelos em português publicados
(candidato: `vosk-model-small-pt-0.6`, na casa das dezenas de MB). Alternativas
a confirmar antes de fixar (ver §6): `openWakeWord` (onnxruntime) ou
`Porcupine` — mas nenhuma bate o Vosk em "pequeno + offline + português sem
dependência comercial".

**Onde corre — um serviço local à parte, como o `voice-clone-service` já é.**
A wake word é o terceiro componente de voz com um modelo por trás (depois do
XTTS-v2 e do Whisper), e o projeto já resolveu este problema da melhor forma:
serviço Python à parte, HTTP no `localhost`, nada sai da máquina, gerido pelo
Rust (`voice_clone.rs`: arranque, health-check, mata o órfão, limpa ao fechar).
Dois caminhos, a escolher na fase 24.1:

| Caminho | O quê | Prós | Contras |
|---|---|---|---|
| **A. Irmão do serviço de voz** | um `wake-word-service` pequeno (ou um processo novo no mesmo repo Python) com `vosk` + `sounddevice`, a correr o loop e a avisar a app por um endpoint (SSE/WebSocket) | reusa o runtime Python, a disciplina `run.ps1`/`setup.ps1`, e a gestão de ciclo de vida que o Rust já sabe fazer | mais um processo para o Rust gerir |
| **B. Thread nativa no Rust** | `vosk-rs` + `cpal` numa thread do lado Tauri, a emitir um evento Tauri `wake-word` | um só processo, `emit()` direto ao frontend, ciclo de vida = ligar/desligar a thread | crate nova (`vosk-rs`) e o loop do microfone passa a viver dentro do processo da app |

**Recomendação: A.** É o precedente já provado do projeto (serviço à parte,
como o Ollama e a voz clonada), e mantém todo o código de modelos de voz no
mesmo runtime. A decisão final é §6.1 — mas qualquer um dos dois cumpre o §0
de igual forma.

**A app:** um serviço novo `services/wake-word-service.ts` (fronteira) + um
hook `use-wake-word.ts`, que assina o evento "palavra ouvida" e chama
`voiceService` para arrancar a transcrição — o mesmo arranque do botão. O
guard de eco já existente (`isSpeakingOrGuarded`, em `voice-service.ts`) é o
que suspende a deteção enquanto o JARVIS fala; não se escreve um segundo.

**Comandos Rust novos** (`src-tauri/src/commands/`): arrancar/parar o serviço
de wake word e ler o seu estado — o mesmo padrão `Result`-based de
`voice_clone.rs`, incluindo **health-check a sério** (provar que o motor
responde, não só que a porta está aberta — a lição do item 19). A capability
Tauri nova é mínima e desligada por omissão: `wake-word`.

**Interruptor e indicador:** um separador novo (ou uma secção no "Controlo"
existente) na `PrivacyWindow.tsx`, desligado por omissão, com persistência da
mesma forma que as permissões de plugin. Enquanto ligado, um indicador
permanente no header — "a ouvir a wake word", nunca escondido, o equivalente
do "Controlo direto ativo · 18 min".

**A ressalva da transcrição pós-wake:** o comando que vem *depois* da palavra
é transcrito pelo pipeline existente, que é local primeiro (`POST /ouvir`) e
cai para a Web Speech API (nuvem) quando o serviço local não está a correr.
Isto é pré-existente, não é introduzido pela wake word — mas o desenho toma
nota: ligar a wake word devia tratar o serviço de voz local como obrigatório,
em vez de deixar a transcrição cair para a nuvem à calada. Fica como §6.2.

---

## 5. Faseamento — não entra tudo de uma vez

| Sub-fase | O quê | Precisa de nativo? |
|---|:--:|:--:|
| 24.1 | Motor local (Vosk + modelo PT) a correr à parte, a emitir "palavra ouvida" — provado com áudio real e com **falsos positivos testados a sério** (silêncio, ruído, a palavra dentro de outra frase) | Sim |
| 24.2 | Ligar ao `voiceService` (wake → transcrição), interruptor na Privacidade, indicador permanente, guard de eco reusado | Sim |
| 24.3 | Palavra configurável + persistência + registo em auditoria (cada acordar fica no `logService`, como um comando de voz) | Não |

24.3 é a única sem nada nativo — e é a que decide a experiência final (a
palavra e o registo). 24.1 vem primeiro porque é o risco maior: se o motor não
distinguir a palavra do ruído, não há feature que valha.

---

## 6. Decisões que ainda faltam, e que não são minhas para tomar sozinho

1. **Motor e runtime.** Vosk é o candidato; falta fixar o modelo exato
   (`vosk-model-small-pt` vs. o `-0.6` mais recente, e o tamanho) e o caminho
   A vs. B de §4. Confirma-se na fase 24.1, não antes.
2. **A palavra por omissão** — "Jarvis" é a proposta óbvia, mas é escolha de
   quem usa; e se há uma frase mínima ("Olá Jarvis") para cortar os falsos
   positivos de uma palavra curta.
3. **Transcrição pós-wake nunca cair para a nuvem.** Tratar a wake word como
   "o serviço local de voz é obrigatório", ou manter o fallback pré-existente
   com aviso? O §0 obriga a deteção a ser local; a transcrição a seguir é o
   pipeline de sempre, e esta é a única fronteira que lhe toca.
4. **Sensibilidade.** O limiar de deteção do Vosk (quantos "acertos" por
   segundo confirmam a palavra) — a troca entre falsos positivos e falsos
   negativos de §1.2. Uma configuração avançada, ou um valor só?
5. **Janela pós-acordar.** Quanto tempo a escuta contínua fica suspensa depois
   de um comando (ou se simplesmente retoma quando a fala do JARVIS acaba) —
   liga-se ao modo conversa já existente, não se inventa um terceiro modo.

Estas ficam para quando cada sub-fase começar a sério, não antes.
