# Prepara o serviço de voz clonada sozinho — Python, ambiente virtual,
# PyTorch com CUDA, dependências, e confirma no fim se a GPU foi encontrada.
#
# A única coisa que este script não escolhe sozinho com certeza é a versão
# exata do CUDA a pedir ao PyTorch — isso muda com o tempo. Tenta uma
# escolha recente por omissão; se a confirmação da GPU falhar no fim, diz
# o que fazer.
#
# Uso:
#   .\setup.ps1                  # usa a versão de CUDA por omissão (cu126)
#   .\setup.ps1 -Cuda cu124      # força outra versão, se a por omissão falhar

param(
    [string]$Cuda = "cu126"
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

Escreve "3. PyTorch com CUDA ($Cuda)..."
Escreve "   Se isto falhar mais abaixo na confirmação da GPU, corre de novo com -Cuda e outra versão — vê a lista em pytorch.org."
pip install --quiet torch --index-url "https://download.pytorch.org/whl/$Cuda"

Escreve "4. O resto das dependências (FastAPI, coqui-tts)..."
pip install --quiet -r requirements.txt

Escreve "5. A confirmar se a GPU foi encontrada..."
$resultado = python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')" 2>&1
$linhas = ($resultado -split "`r?`n") | ForEach-Object { $_.Trim() }

if ($linhas[0] -eq "True") {
    Escreve "   GPU encontrada: $($linhas[1])"
    Escreve ""
    Escreve "Tudo pronto. Falta:"
    Escreve "  1. Gravar a tua voz e guardar como voices\referencia.wav"
    Escreve "  2. Arrancar com: .\run.ps1"
} else {
    EscreveErro "   A GPU NÃO foi encontrada (torch.cuda.is_available() = False)."
    EscreveErro ""
    EscreveErro "   Isto normalmente quer dizer que a versão do CUDA pedida ($Cuda) não bate certo"
    EscreveErro "   com o que o PyTorch precisa para a tua placa. Vai a pytorch.org, escolhe"
    EscreveErro "   Stable > Windows > Pip > Python > a versão do CUDA mais recente da lista,"
    EscreveErro "   e corre este script outra vez com essa versão, por exemplo:"
    EscreveErro "     .\setup.ps1 -Cuda cu128"
    exit 1
}
