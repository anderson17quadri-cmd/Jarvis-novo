# Prepara o reconhecimento local — Python, ambiente virtual,
# PyTorch em CPU ou CUDA, dependências e verificação do ambiente.
#
# A única coisa que este script não escolhe sozinho com certeza é a versão
# exata do CUDA a pedir ao PyTorch — isso muda com o tempo, e placas novas
# de mais (a RTX 5070 foi o caso, confirmado a 09/08/2026 — cu126 não trazia
# kernels para ela, cu130 já trouxe) podem precisar de uma versão mais
# recente do que a por omissão. Se a confirmação da GPU falhar no fim, diz
# o que fazer.
#
# Uso:
#   .\setup.ps1 -Cpu             # reconhecimento sem GPU
#   .\setup.ps1                  # usa a versão de CUDA por omissão (cu130)
#   .\setup.ps1 -Cuda cu126      # força outra versão, se a por omissão falhar

param(
    [string]$Cuda = "cu130",
    [switch]$Cpu
)

$ErrorActionPreference = "Stop"

function Escreve($texto) {
    Write-Host $texto -ForegroundColor Cyan
}

function EscreveErro($texto) {
    Write-Host $texto -ForegroundColor Red
}

Escreve "1. A verificar o Python..."
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    EscreveErro "Não encontrei o Python. Instala a versão 3.10, 3.11 ou 3.12 e tenta outra vez."
    exit 1
}
Escreve "   $pythonVersion"

Escreve "2. Ambiente virtual..."
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Escreve "   Criado em .venv"
} else {
    Escreve "   Já existia — a reaproveitar"
}

& .\.venv\Scripts\Activate.ps1

if ($Cpu) {
    Escreve "3. PyTorch em CPU..."
} else {
    Escreve "3. PyTorch com CUDA ($Cuda)..."
    Escreve "   Se a GPU não for reconhecida, repete com -Cuda e uma versão adequada à placa."
}
$torchIndex = if ($Cpu) { "https://download.pytorch.org/whl/cpu" } else { "https://download.pytorch.org/whl/$Cuda" }
pip install --quiet torch --index-url $torchIndex
if ($LASTEXITCODE -ne 0) { throw "A instalação do PyTorch falhou." }

Escreve "4. O resto das dependências (FastAPI, Whisper local)..."
pip install --quiet -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "A instalação das dependências de transcrição falhou." }

if ($Cpu) {
    python -c "import torch, whisper; print('Whisper local pronto em CPU.')"
    if ($LASTEXITCODE -ne 0) { throw "Não consegui importar o Whisper." }
    exit 0
}

Escreve "5. A confirmar se a GPU foi encontrada..."
# O PyTorch escreve avisos inofensivos no stderr (por exemplo, sobre uma GPU
# nova de mais para os kernels compilados terem sido validados nela) — com
# `2>&1` e `$ErrorActionPreference = "Stop"`, o PowerShell trata isso como
# erro fatal e para o script, mesmo sem nada de errado ter acontecido.
# `2>$null` descarta esses avisos: só interessa aqui o "True"/"False" e o
# nome da placa, que vêm sempre no stdout.
$anteriorErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$resultado = python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')" 2>$null
$ErrorActionPreference = $anteriorErrorAction

$linhas = ($resultado -split '\r?\n') | ForEach-Object { $_.Trim() }

if ($linhas[0] -eq "True") {
    Escreve "   GPU encontrada: $($linhas[1])"
    Escreve ""
    Escreve "Tudo pronto. Falta:"
    Escreve "  1. Arrancar o reconhecimento local com: .\run.ps1"
    Escreve "  2. Configurar a voz OpenAI na app em Personalização → Voz"
} else {
    EscreveErro "   A GPU NÃO foi encontrada (torch.cuda.is_available() = False)."
    EscreveErro ""
    EscreveErro "   Isto normalmente quer dizer que a versão do CUDA pedida ($Cuda) não bate certo"
    EscreveErro "   com o que o PyTorch precisa para a tua placa. Vai a pytorch.org, escolhe"
    EscreveErro "   Stable > Windows > Pip > Python > a versão do CUDA mais recente da lista,"
    EscreveErro "   e corre este script outra vez com essa versão, por exemplo:"
    EscreveErro "     .\setup.ps1 -Cuda cu126"
    exit 1
}
