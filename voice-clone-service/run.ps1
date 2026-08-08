# Arranca o serviço de voz clonada — depois de correres .\setup.ps1 uma vez
# e de teres uma gravação em voices\referencia.wav.

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".venv")) {
    Write-Host "Ainda não configurei nada aqui — corre .\setup.ps1 primeiro." -ForegroundColor Red
    exit 1
}

& .\.venv\Scripts\Activate.ps1

if (-not (Test-Path "voices\referencia.wav")) {
    Write-Host "Aviso: ainda não há nenhuma gravação em voices\referencia.wav." -ForegroundColor Yellow
    Write-Host "O serviço arranca na mesma, mas /falar não funciona até gravares." -ForegroundColor Yellow
}

Write-Host "A arrancar em http://127.0.0.1:8090 — Ctrl+C para parar." -ForegroundColor Cyan
uvicorn server:app --host 127.0.0.1 --port 8090
