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

## 6. Decisões — tomadas em 19/08/2026

O utilizador delegou estas decisões ("tome a melhor decisão", mesmo padrão de
14/08/2026). **Não voltar a perguntar — está decidido, falta construir.** Cada
uma com a razão, para se poder discordar com fundamento em vez de as reabrir
por hábito.

1. **Motor e runtime: Vosk + `vosk-model-small-pt-0.3`, caminho A** (serviço
   Python à parte, irmão do `voice-clone-service`). Duas razões, e a segunda
   pesa mais do que parece: é o precedente já provado do projeto (o Rust já
   sabe arrancar, provar a saúde, matar o órfão e limpar ao fechar — tudo
   escrito em `voice_clone.rs`), e **mantém o loop contínuo do microfone fora
   do processo da app**. O processo da app é precisamente o que tem morrido
   sozinho (item 20: TDR do driver NVIDIA a derrubar o WebView2); pôr lá
   dentro uma thread que não pode deixar cair áudio seria acoplar a escuta ao
   componente mais frágil do sistema. O caminho B fica documentado como
   alternativa, não como plano.

2. **A palavra por omissão — corrigida em 19/08/2026, depois de a construção
   provar que a decisão original era impossível.**

   A decisão dizia "Jarvis", pela razão óbvia de ser o nome do produto. A
   sessão que começou a 24.1 descobriu que **o `vosk-model-small-pt-0.3` tem
   vocabulário fechado e "Jarvis" não está lá dentro** — confirmado por dois
   caminhos independentes: a descodificação livre ouve "já vi", e a
   descodificação com gramática regista explicitamente `Ignoring word missing
   in vocabulary: 'jarvis'`. Não é afinação de sensibilidade nem de pronúncia:
   com este motor, a palavra **nunca** pode ser detetada. Palavras do
   vocabulário ("sentinela", "computador", "assistente") são detetadas na
   mesma — a arquitetura está certa, é só esta palavra que não existe para o
   motor.

   **De caminho, corrige-se um erro deste documento**: a versão `-0.6` escrita
   na decisão 1 não existe; o único modelo pequeno de português é o `-0.3`.
   Foi escrita sem se confirmar que existia.

   **O que fazer, por esta ordem:**

   a) **Primeiro, provar o modelo grande.** O `vosk-model-pt-fb-v0.1.1-pruned`
      (1,6 GB) já está descarregado e ficou por testar num erro de caminho.
      Se reconhecer "Jarvis", é ele — a palavra fica como estava e o custo é
      só disco e RAM, que nesta máquina há. É o desfecho preferível e é
      barato de verificar.

   b) **Se o modelo grande também não a tiver**, a palavra por omissão passa a
      **"Sentinela"**. Está no vocabulário (confirmado), e tem uma propriedade
      que a torna melhor do que as outras candidatas para esta função:
      quase nunca aparece em conversa normal. "Computador" e "assistente"
      dizem-se a toda a hora — como palavra de acordar seriam uma fábrica de
      falsos positivos. O nome do produto continua a ser JARVIS; a palavra de
      acordar é outra coisa, e a 24.3 deixa quem quiser trocá-la.

   **O que não fazer, e fica dito para ninguém tentar mais tarde:** aproveitar
   o facto de o motor ouvir "já vi" quando se diz "Jarvis" e casar com *isso*.
   Tecnicamente funcionaria; na prática "já vi" é uma frase comuníssima em
   português, e o resultado seria o JARVIS a acordar sozinho a meio de
   conversas. Trocar um falso negativo garantido por falsos positivos
   constantes não é um negócio melhor.

   **Uma alternativa que vale a pena verificar antes de fixar (b)**: o
   `openWakeWord`, já listado no §4 como alternativa, existe precisamente para
   palavras de acordar arbitrárias, e distribui modelos pré-treinados. Não
   confirmo de memória se há um para "jarvis" — se houver, resolve isto por
   inteiro e sem os 1,6 GB. Verificar custa minutos; se não houver, segue (b)
   sem mais demora.

3. **Ligar a wake word torna o serviço local de voz obrigatório.** Sem ele a
   correr, a wake word **recusa armar-se** e diz porquê — não arma e deixa a
   transcrição cair para a nuvem à calada. Esta é a decisão menos negociável
   das cinco: a §0 recusou escuta contínua por um serviço de nuvem, e uma wake
   word que acorda e depois manda o comando para fora entrega exatamente aquilo
   que a §0 recusou, só com um passo pelo meio. Seria também a repetição de uma
   falha que este projeto já cometeu duas vezes — um texto de consentimento a
   descrever menos do que o interruptor faz (ver `historico-sessoes.md`,
   14 e 15/08). O aviso ao ligar tem de dizer isto por palavras.

4. **Um valor de sensibilidade só, afinado na 24.1** — sem configuração
   avançada para já. A regra de design do projeto é não acrescentar o que não
   foi pedido, e um cursor de sensibilidade antes de alguém ter sentido o
   problema é adivinhação com interface. A 24.1 exige falsos positivos testados
   a sério (silêncio, ruído, a palavra dentro de outra frase); se desse teste
   sair que nenhum valor único serve, então — e só então — a configuração entra.

5. **Não se inventa um terceiro modo de escuta.** Depois da palavra ouvida, o
   fluxo é exatamente o do botão do microfone a ser premido, e o guard de eco
   que já existe (`isSpeakingOrGuarded`) é o que suspende a deteção enquanto o
   JARVIS fala. Quando ele acaba, a deteção retoma. Sem temporizador novo, sem
   janela nova: o modo conversa já resolveu este problema e a wake word é um
   portão para ele, não um concorrente.
