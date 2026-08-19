"""
Gera os ficheiros de `tests/fixtures/` usados por `test_deteccao.py`.

Não corre sozinho nos testes (é lento — precisa do `voice-clone-service` a
sério, com o XTTS-v2 carregado, e do `ffmpeg` no PATH) — corre-se à mão uma
vez por máquina: `python tests/gerar_fixtures.py`. Os ficheiros ficam fora do
Git (`tests/fixtures/` no `.gitignore`); sem eles, `test_deteccao.py` salta os
testes que precisam de áudio real em vez de falhar.
"""

from __future__ import annotations

import subprocess
import sys
import wave
from pathlib import Path
from urllib import request

FIXTURES = Path(__file__).parent / "fixtures"
CLONE_SERVICE_URL = "http://127.0.0.1:8090"


def _falar(texto: str, destino: Path) -> None:
    corpo = f'{{"texto": {texto!r}, "voz": "Ana Florence"}}'.encode()
    pedido = request.Request(
        f"{CLONE_SERVICE_URL}/falar",
        data=corpo,
        headers={"Content-Type": "application/json"},
    )
    with request.urlopen(pedido, timeout=60) as resposta:
        bruto = destino.with_suffix(".bruto.wav")
        bruto.write_bytes(resposta.read())
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(bruto), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(destino)],
        check=True,
        capture_output=True,
    )
    bruto.unlink()


def _silencio(destino: Path, segundos: int) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r=16000:cl=mono", "-t", str(segundos),
         "-c:a", "pcm_s16le", str(destino)],
        check=True,
        capture_output=True,
    )


def _ruido(destino: Path, segundos: int) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", f"anoisesrc=d={segundos}:c=white:r=16000",
         "-ac", "1", "-c:a", "pcm_s16le", str(destino)],
        check=True,
        capture_output=True,
    )


def main() -> None:
    FIXTURES.mkdir(exist_ok=True)
    try:
        request.urlopen(f"{CLONE_SERVICE_URL}/health", timeout=2)
    except OSError:
        print(
            "voice-clone-service não está a correr em 127.0.0.1:8090 — "
            "arranca-o primeiro (voice-clone-service/run.ps1).",
            file=sys.stderr,
        )
        raise SystemExit(1)

    _silencio(FIXTURES / "silencio.wav", 3)
    _ruido(FIXTURES / "ruido.wav", 3)
    _falar("Sentinela", FIXTURES / "sentinela.wav")
    _falar(
        "O guarda ficou de sentinela toda a noite junto ao portão do castelo.",
        FIXTURES / "sentinela_embutido.wav",
    )
    _falar(
        "Hoje o tempo está bastante agradável em Lisboa, com sol e pouco vento.",
        FIXTURES / "sem_palavra.wav",
    )
    print(f"Fixtures geradas em {FIXTURES}")


if __name__ == "__main__":
    main()
