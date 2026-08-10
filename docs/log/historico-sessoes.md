# Histórico de sessões

Diário de trabalho do projeto JARVIS AI OS — Project ARC, em português.
Cada sessão de trabalho (com o Claude Code, local ou não) acrescenta uma
entrada no fim deste ficheiro, com data e um resumo curto do que mudou e
porquê. Não substitui os commits do git (que continuam a ser a fonte
exata de "o quê"); isto é o "porquê", em prosa, para quem voltar ao
projeto dali a semanas não ter de reconstruir o raciocínio a partir dos
diffs.

Formato de cada entrada:

```
## AAAA-MM-DD — título curto

O que se pediu, o que se decidiu, o que ficou feito. Duas ou três frases
chegam a maior parte das vezes. Liga a commits/ficheiros quando ajudar.
```

Mais antigo primeiro, mais recente no fim.

---

## 2026-08-09 — Voz clonada local: vozes prontas, ligação à app, núcleo personalizável

Sessão longa, em duas partes.

Primeiro, a voz: depois de confirmar a clonagem a sério na RTX 5070
(commit `e4bb43d`), descobriu-se que a amostra de referência usada afinal
era uma gravação de outro serviço de IA, não a voz do próprio
utilizador — recusado pelo mesmo princípio de consentimento já assente
nesta conversa. Em vez disso, expôs-se as vozes prontas do XTTS-v2
(gravadas por atores que autorizaram o uso), primeiro uma curadoria de 8
(`f38481d`), depois a lista real e completa que o modelo trouxer —
mais de 40 — depois de o utilizador pedir para testar mais do que as 8
(`5d42e02`). Ligou-se tudo isto a `voice-service.ts` e a
`VoiceSettings.tsx` (sub-fase 4.3, `f99d05f`), para a escolha ficar em
Personalização → Voz, ao lado das vozes do sistema. Corrigiu-se ainda um
bug real, descoberto pelo utilizador ao testar: nomes com acentos ou
letras nórdicas (ex. "Camilla Holmström") chegavam trocados pela Windows
PowerShell 5.1, por o FastAPI não declarar `charset=utf-8` explícito
(`d80d289`). E corrigiu-se o CUDA por omissão do `setup.ps1`, que ainda
apontava para a versão que sabíamos falhar na RTX 5070 (`5c1cf4e`).

Depois, aparência: o núcleo (AICore) ganhou cor e velocidade
personalizáveis, que já estavam desenhadas como "para depois" no
`SPEC.md`. A parte que exigia mais cuidado foi perceber que os anéis em
`CoreRings.tsx` liam `var(--accent)` direto do CSS, por isso escolher uma
cor customizada não lhes mexia nada — só às partículas do canvas.
Passaram a receber a cor já resolvida por prop. Verificado num browser
real com Playwright antes de se dar como funcional (`f5da343`).

O utilizador começou também a configurar o Claude Code localmente
(instalador nativo, VS Code, `PATH` do Windows que não atualizava em
janelas já abertas) para deixar de depender de copiar/colar comandos
nesta conversa. Testou as 58 vozes prontas e escolheu "Alison Dietlinde".

Por fim, memória entre sessões e entre modelos: `CLAUDE.md` (lido sozinho
pelo Claude Code no arranque, aponta para este ficheiro e para
`docs/estilo-de-codigo.md`) e `docs/estilo-de-codigo.md` (as regras do
projeto — língua, comentários, design, verificação, ética — escritas para
qualquer modelo, não só o Claude). O pedido era "todo modelo que vou usar
usar a inteligência já adquirida" — por isso `ollama/Modelfile` traz um
resumo do mesmo ficheiro como prompt de sistema, para criar um modelo
Ollama local (`ollama create jarvis-dev -f Modelfile`) já com as
convenções do projeto, sem depender de as colar a cada conversa. Os dois
ficheiros de regras (`docs/estilo-de-codigo.md` e `ollama/Modelfile`) não
se sincronizam sozinhos — o formato do Ollama não inclui outros
ficheiros — por isso mudar um exige lembrar do outro.

## 2026-08-09 — O microfone estava mesmo partido: reconhecimento local via Whisper

Depois de escolher "Alison Dietlinde" e ligar a voz por omissão a ela (em
vez da escolha automática do sistema), o utilizador pediu para deixar o
microfone a funcionar de verdade, com autonomia total para trabalhar
diretamente no PC. Testado por CDP antes de mexer em código (não por
suposição): o reconhecimento nativo do WebView2 liga o microfone
(`onaudiostart` dispara) e nunca mais dá sinal nenhum — nem resultado, nem
erro, nem fim. Preso para sempre, sem pista nenhuma para quem usa a app.

O arranjo: `voice-clone-service/server.py` ganhou `POST /ouvir`, com
Whisper sobre o mesmo `torch`+CUDA já instalado para o XTTS-v2 — nenhuma
dependência nova de GPU. `voice-service.ts` passou a gravar com
`MediaRecorder` (isto funciona no WebView2, ao contrário da Web Speech
API) e mandar transcrever ali, sempre que o serviço local estiver a
correr; o reconhecimento nativo do motor fica como segunda opção, com um
relógio de segurança de 9s para nunca mais ficar preso. Confirmado
ponta-a-ponta: um `.wav` com fala real em português voltou como texto
correto (`dba49ab`).

De caminho, confirmaram-se a sério no Windows nativo (não só "por
testar"): a bandeja do sistema, o atalho global `CTRL+ALT+J` (janela
minimizada à força voltou sozinha ao primeiro plano), e a persistência
via plugin `store` (ficheiro real em `%APPDATA%`). Ficou por ligar: os
diálogos nativos de ficheiro (o plugin está registado no Rust, mas
nenhum sítio da interface o chama ainda — a cópia de segurança usa
`<a download>`/`<input type="file">` normais), a lista de processos (o
comando existe, mas nenhum widget o pede), e o build Android (bloqueado
nesta máquina por falta do SDK). O build Windows (MSI/NSIS) também
confirmou — `npm run tauri build` produziu os dois instaladores sem erro
(`src-tauri/target/release/bundle/`), ainda não corridos.

Nota para quem continuar: a instância de `npm run tauri dev` fechou-se
sozinha várias vezes durante os testes automatizados por CDP, sem erro
nenhum no terminal — suspeita-se de pressão de memória (XTTS-v2 e Whisper
carregados ao mesmo tempo no `voice-clone-service`) ou de algo ligado ao
`--remote-debugging-port` usado para testar por fora. Não visto em uso
normal, sem essa flag.

## 2026-08-10 — Voz clonada local: gravar pela interface, e a app arranca o serviço sozinha

Pedido em modo de autonomia total (`--dangerously-skip-permissions`),
por blocos, com verificação a sério (`tsc`, `eslint`, `vitest`, e
confirmação em browser real para peças de interface) e commits pequenos
por peça. Primeiro bloco: as duas sub-fases que faltavam em §Voz clonada
local.

**4.2 — gravar a amostra na interface.** `VoiceSettings.tsx` ganha
"Gravar a minha voz": grava até 12s com `MediaRecorder` (a mesma técnica
já usada no reconhecimento local), com contagem decrescente e um botão
para terminar mais cedo, e manda para `POST /voz`. Esse endpoint deixou
de exigir um `.wav` — passou a converter com `ffmpeg` qualquer formato
que o browser grave (`.webm`/Opus), sempre para PCM mono. Confirmado a
sério: gravei pela interface a correr, e `voices/referencia.wav` mudou
na hora, sem nada a rebentar (`e41581e`).

**4.4 — a app arranca o serviço sozinha.** `src-tauri/src/voice_clone.rs`
novo: tenta a porta 8090 no arranque, só chama `uvicorn` se não houver lá
nada a ouvir, e mata o processo filho ao fechar a janela — confirmado com
um fecho normal, não um "matar já" (`taskkill` sem `/F`), que o Python
saiu junto. Sem `.venv` instalado, desiste em silêncio, nunca impede o
arranque da app. Ao testar a sério (não só o `cargo check`), apanhou-se
um bug verdadeiro: `os.add_dll_directory`, do lado do Python, recusa
caminhos relativos (`WinError 87`, "o parâmetro está incorreto") — a
pasta do serviço tinha de chegar já canonicalizada. Só haveria sinal
disto a testar a sério, num PC a sério — exatamente a razão de tudo isto
não ter avançado antes da Fase 1 confirmar em `§1.1`.

**Bloco 2 — Pipeline de reconhecimento completo.** As três etapas que
faltavam entre transcrição e execução: **ruído** — `POST /ouvir` passou a
descartar a alucinação conhecida do Whisper em áudio só com ruído
(`no_speech_prob` por segmento, testado a sério com 3s de silêncio puro);
**silêncio** — `vigiarSilencio`, novo em `voice-service.ts`, mede o volume
por um `AnalyserNode` a cada 100ms e para a gravação sozinha depois de
fala seguida de silêncio, em vez de esperar sempre os 12s do limite de
segurança; **idioma** — `/ouvir` ganhou o mesmo parâmetro que `/falar` já
tinha, só por simetria (a app continua só em português). "Planeamento"
ficou por implementar de propósito: já está coberto pelos comandos
compostos (Parte 10) e pelo encadeamento de ferramentas da DeepSeek
(Parte 7.1).

De caminho, a testar a sério (não só a ler o código), apanhou-se outro
bug real: parar a escuta à mão — voltar a carregar no botão do microfone
a meio de uma gravação — deixava de chamar `onEnd`, e o núcleo ficava
preso em "a ouvir" para sempre. Corrigido para tratar as três formas de
acabar a escuta (limite de segurança, silêncio, botão) da mesma maneira.
Confirmado ao vivo por CDP com um microfone falso do Chromium a "ouvir" a
própria voz do XTTS-v2: a transcrição chegou à memória do assistente, e o
botão voltou sozinho ao estado inativo. A deteção de silêncio em si não
se deixou cronometrar ao vivo — o `--use-file-for-fake-audio-capture` do
Chromium repete o ficheiro em loop, nunca produz silêncio a sério — por
isso essa parte ficou confirmada só por testes com temporizadores
controlados, não pelo browser real.
