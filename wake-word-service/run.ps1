$ErrorActionPreference = "Stop"
if (-not (Test-Path .venv)) { throw "Corre setup.ps1 primeiro." }
& .\.venv\Scripts\Activate.ps1
uvicorn server:app --host 127.0.0.1 --port 8091
