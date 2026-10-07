param([string]$Origem = "", [string]$Cuda = "", [switch]$SoCopiar)
$ErrorActionPreference = "Stop"
if (-not $Origem) {
    $Origem = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "voice-clone-service")) {
        $PSScriptRoot
    } else { Split-Path -Parent $PSScriptRoot }
}
$Origem = (Resolve-Path -LiteralPath $Origem).Path
$destinoServicos = Join-Path $env:LOCALAPPDATA "com.projectarc.jarvis\services"
foreach ($service in @("voice-clone-service", "wake-word-service")) {
    $source = Join-Path $Origem $service
    $target = Join-Path $destinoServicos $service
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    foreach ($name in @("server.py", "setup.ps1", "run.ps1", "requirements.txt")) {
        Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $target $name) -Force
    }
}
if ($SoCopiar) { Write-Host "Scripts preparados em $destinoServicos"; exit 0 }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Instala Python 3.10–3.12 e repete este comando." }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw "Instala FFmpeg e adiciona-o ao PATH antes de preparar a transcrição." }
Push-Location (Join-Path $destinoServicos "voice-clone-service")
try {
    if ($Cuda) { & .\setup.ps1 -Cuda $Cuda } else { & .\setup.ps1 -Cpu }
    if ($LASTEXITCODE -ne 0) { throw "A preparação do Whisper falhou." }
} finally { Pop-Location }
Push-Location (Join-Path $destinoServicos "wake-word-service")
try {
    & .\setup.ps1
    if ($LASTEXITCODE -ne 0) { throw "A preparação do Vosk falhou." }
} finally { Pop-Location }
Write-Host "Serviços locais preparados. Reinicia o Jarvis e verifica-os no Centro de Desenvolvimento."
