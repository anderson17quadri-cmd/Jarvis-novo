# Voz clonada local

Serviço à parte do JARVIS — a mesma relação que o Ollama já tem com a app:
corre no teu PC, o JARVIS fala com ele por HTTP no `localhost`, nada sai da
máquina. Ver o desenho completo em
[`docs/spec/voz-clonada-local.md`](../docs/spec/voz-clonada-local.md).

**Confirmado a funcionar numa RTX 5070 (09/08/2026).** Os passos abaixo
incluem as três correções que só apareceram a sério no Windows.

**Duas formas de escolher a voz, sem clonar ninguém sem autorização:**
- **Uma voz pronta do próprio modelo** (`GET /vozes`) — todas as que o
  XTTS-v2 trouxer (mais de 40), gravadas por atores que autorizaram o uso.
  Não precisa de gravação nenhuma.
- **A tua voz, ou a de alguém que autorizou explicitamente** — grava-se em
  `voices/referencia.wav` (`POST /voz`), e o serviço clona-a.

`POST /falar` usa a voz pronta se mandares `"voz": "Ana Florence"` no
pedido (qualquer nome que `GET /vozes` liste); sem isso, usa a gravação
clonada.

## Caminho rápido — um script faz quase tudo

```powershell
cd voice-clone-service
.\setup.ps1
```

Confirma o Python, cria o ambiente virtual, instala o PyTorch com CUDA e o
resto das dependências, e no fim diz-te se a GPU foi encontrada. Se a
versão de CUDA por omissão não bater certo com o que a tua placa precisa,
o próprio script diz o que fazer — normalmente é correr outra vez com
`.\setup.ps1 -Cuda cuXXX`, com a versão que o pytorch.org indicar.

Depois de gravares a tua voz em `voices\referencia.wav` (passo 5 abaixo,
esse continua manual — é a tua voz, não há como automatizar isso):

```powershell
.\run.ps1
```

Arranca o serviço e avisa se ainda não houver gravação nenhuma.

**Os passos abaixo são o que estes dois scripts fazem por dentro** — útil
se algo falhar e precisares de perceber onde, ou se preferires correr à
mão.

## 1. Python

Precisas de Python 3.10, 3.11 ou 3.12 — o `coqui-tts` ainda não costuma
suportar a versão mais recente do Python no dia em que ela sai. Confirma a
tua versão:
```powershell
python --version
```

## 2. Um ambiente virtual, para não misturar com outra coisa

```powershell
cd voice-clone-service
python -m venv .venv
.venv\Scripts\activate
```

## 3. PyTorch com CUDA — a parte que precisa de atenção

**Não uses `pip install torch` sozinho** — isso costuma trazer a versão sem
GPU. A RTX 5070 usa a arquitetura Blackwell, que precisa de uma versão do
PyTorch recente o suficiente para a suportar; qual exatamente, muda com
frequência a mais para fixar aqui um número que não fique desatualizado.

Vai a **pytorch.org** → "Get Started" → escolhe *Stable*, *Windows*, *Pip*,
*Python*, e a versão do **CUDA** mais recente que aparecer na lista. O site
dá-te o comando exato a copiar — algo como:
```powershell
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu126
```
(o número depois de `cu` é que muda; usa o que o site te disser — mas o
`torchaudio` tem de vir sempre do mesmo comando que o `torch`, nunca à
parte, senão as versões desalinham-se e o XTTS-v2 não arranca)

**Confirma que a GPU foi encontrada** antes de continuares:
```powershell
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```
Tem de imprimir `True` e o nome da tua placa. Se disser `False`, o problema
está aqui, antes de tocares em mais nada — normalmente é a versão do CUDA
que não bate certo com a que o PyTorch instalado espera.

## 4. O resto das dependências

```powershell
pip install -r requirements.txt
```

A primeira vez que o serviço arrancar, o modelo XTTS-v2 é descarregado
sozinho (mais de 1 GB) — demora, só acontece uma vez.

## 5. Gravar a tua voz

Grava-te uns segundos a falar (o telemóvel serve, exporta como `.wav`) e
guarda o ficheiro como `voices/referencia.wav` nesta pasta. Mais amostra
costuma dar melhor resultado, mas não há um número exato — testa e ajusta.

## 6. Arrancar

```powershell
uvicorn server:app --host 127.0.0.1 --port 8090
```

## 7. Testar por terminal, sem abrir o JARVIS

```powershell
curl http://127.0.0.1:8090/health

curl -X POST http://127.0.0.1:8090/falar `
  -H "Content-Type: application/json" `
  -d '{\"texto\": \"Boa tarde. Isto sou eu, a falar através do JARVIS.\"}' `
  --output teste.wav
```

Se `teste.wav` tocar com a tua voz, está a funcionar. Já está ligado ao
`voice-service.ts` da app (sub-fase 4.3 do desenho) — em Personalização →
Voz, a "A minha voz" e as vozes prontas aparecem sozinhas quando este
serviço está a correr.

**Para experimentar várias vozes prontas de seguida**, sem repetir o
comando à mão uma vez por voz:

```powershell
$vozes = (Invoke-RestMethod http://127.0.0.1:8090/vozes).vozes.PSObject.Properties.Name

foreach ($voz in $vozes) {
    $body = @{ texto = "Boa tarde. Sou o JARVIS. Esta é a voz $voz."; voz = $voz } | ConvertTo-Json
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    Invoke-RestMethod -Uri "http://127.0.0.1:8090/falar" -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -OutFile "voz_$($voz -replace ' ','_').wav"
}

explorer .
```

Cria um `.wav` por cada voz que o teu modelo trouxer, na pasta atual.

## Se algo correr mal

- **`torch.cuda.is_available()` diz `False`** — a versão do PyTorch não bate
  com o CUDA instalado. Volta ao passo 3.
- **O modelo não descarrega** — precisa de espaço em disco (mais de 2 GB) e
  de internet na primeira vez.
- **A voz sai distorcida ou nada parecida** — a amostra em
  `voices/referencia.wav` pode ter ruído a mais, ou ser curta de mais.
  Regrava num sítio silencioso.
- **`ImportError: cannot import name 'isin_mps_friendly'`** — a `transformers`
  instalada é a versão 5, que removeu essa função; o `coqui-tts` ainda não
  foi atualizado. `pip install "transformers<5"` resolve (já está no
  `requirements.txt`, mas quem instalou antes desta correção precisa de
  correr isto à mão uma vez).
- **`torchcodec library is required for audio IO`** — a partir do PyTorch
  2.9, o coqui-tts precisa do `torchcodec`, que não vem por omissão.
  `pip install coqui-tts[codec]` resolve (já está no `requirements.txt`
  como `coqui-tts[codec]`, mesma nota da anterior).
- **Um nome de voz com acentos ou letras nórdicas vem trocado** (por
  exemplo, "Camilla Holmström" aparece como "Camilla HolmstrÃ¶m" numa
  variável, e depois `/falar` diz que essa voz não existe) — é a **Windows
  PowerShell** (a versão antiga, 5.1, não a "PowerShell 7"/`pwsh`) a
  adivinhar mal a codificação da resposta. Já está corrigido do lado do
  servidor (a resposta vem sempre com `charset=utf-8` explícito), mas só a
  partir de quem tiver feito `git pull` depois da correção — reinicia o
  serviço (`Ctrl+C` e `.\run.ps1` outra vez) para a apanhar. Se ainda
  assim acontecer, `pwsh` (PowerShell 7, se o tiveres instalado) não tem
  este problema, mesmo sem a correção.
- **O serviço diz que não há gravação, mas a pasta mostra `referencia.wav`**
  — o Explorador do Windows pode estar a esconder a extensão verdadeira.
  Confirma com `dir voices` no terminal: se aparecer `referencia.wav.wav`,
  o ficheiro tem duas extensões por engano — `Rename-Item
  voices\referencia.wav.wav voices\referencia.wav` corrige.
- **`RuntimeError: Could not load libtorchcodec`** — falta o FFmpeg (a
  versão "com bibliotecas partilhadas", não só o programa) — **e tem de ser
  uma versão 4 a 8**. O próprio erro diz isso: "We support versions 4, 5, 6,
  7, and 8". `winget install Gyan.FFmpeg.Shared` instala sempre a mais
  recente (hoje, a 9), que ainda não é suportada — não uses esse comando
  para isto.

  1. Descarrega a versão 7.1, confirmada como funcionando:
     ```powershell
     Invoke-WebRequest -Uri "https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-full_build-shared.zip" -OutFile ffmpeg.zip
     Expand-Archive ffmpeg.zip -DestinationPath . -Force
     ```
  2. Isto cria uma pasta `ffmpeg-7.1-full_build-shared\bin` com as DLLs.
     Usa esse caminho na variável `FFMPEG_DLL_DIR`, **na mesma janela** onde
     vais correr o serviço (variáveis de ambiente do PowerShell só duram
     nessa janela):
     ```powershell
     $env:FFMPEG_DLL_DIR = "$PWD\ffmpeg-7.1-full_build-shared\bin"
     .\run.ps1
     ```

  **Porquê não basta pôr no PATH:** desde o Python 3.8, o Windows deixou de
  usar a PATH para encontrar DLLs de que uma biblioteca Python precise — é
  preciso dizer-lho por código, e é o que `server.py` faz com
  `os.add_dll_directory`, lendo o caminho desta variável.
