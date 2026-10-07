param([string]$ModelUrl = "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip")

$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot
try {
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Instala Python 3.10, 3.11 ou 3.12 antes de continuar."
}
if (-not (Test-Path .venv)) { python -m venv .venv }
if ($LASTEXITCODE -ne 0) { throw "Não consegui preparar o ambiente Python." }
& .\.venv\Scripts\Activate.ps1
pip install --quiet -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "A instalação das dependências Vosk falhou." }

if (-not (Test-Path model)) {
    $setupRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
    $downloadDir = Join-Path $setupRoot (".model-download-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $downloadDir | Out-Null
    try {
        $zip = Join-Path $downloadDir "model.zip"
        Invoke-WebRequest -Uri $ModelUrl -OutFile $zip
        Expand-Archive -LiteralPath $zip -DestinationPath $downloadDir
        $folders = @(Get-ChildItem -LiteralPath $downloadDir -Directory | Where-Object { $_.Name -like "vosk-model-*pt*" })
        if ($folders.Count -ne 1) { throw "Não encontrei um único modelo português no ficheiro descarregado." }
        $modelSource = [System.IO.Path]::GetFullPath($folders[0].FullName)
        $modelTarget = [System.IO.Path]::GetFullPath((Join-Path $setupRoot "model"))
        if (-not $modelSource.StartsWith($downloadDir + [System.IO.Path]::DirectorySeparatorChar) -or
            -not $modelTarget.StartsWith($setupRoot + [System.IO.Path]::DirectorySeparatorChar)) {
            throw "O caminho do modelo está fora da pasta de preparação."
        }
        Move-Item -LiteralPath $modelSource -Destination $modelTarget
    } finally {
        $resolvedDownload = [System.IO.Path]::GetFullPath($downloadDir)
        if ($resolvedDownload.StartsWith($setupRoot + [System.IO.Path]::DirectorySeparatorChar)) {
            Remove-Item -LiteralPath $resolvedDownload -Recurse -Force
        }
    }
}
Write-Host "Wake word local pronta. O modelo fica apenas nesta máquina." -ForegroundColor Green
} finally { Pop-Location }
