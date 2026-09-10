param([string]$ModelUrl = "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip")

$ErrorActionPreference = "Stop"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Instala Python 3.10, 3.11 ou 3.12 antes de continuar."
}
if (-not (Test-Path .venv)) { python -m venv .venv }
& .\.venv\Scripts\Activate.ps1
pip install --quiet -r requirements.txt

if (-not (Test-Path model)) {
    $zip = Join-Path $env:TEMP "jarvis-vosk-pt.zip"
    Invoke-WebRequest -Uri $ModelUrl -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $env:TEMP -Force
    $folder = Get-ChildItem $env:TEMP -Directory | Where-Object { $_.Name -like "vosk-model-*pt*" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -eq $folder) { throw "Não encontrei o modelo Vosk extraído." }
    Move-Item $folder.FullName model
    Remove-Item $zip -Force
}
Write-Host "Wake word local pronta. O modelo fica apenas nesta máquina." -ForegroundColor Green
