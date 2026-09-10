"""
Prova a sério que o motor distingue a palavra do ruído — o risco maior da
24.1 (`docs/spec/wake-word-local.md` §5): se isto falhar, não há
funcionalidade nenhuma, por muito bem que o resto do serviço esteja escrito.

Precisa do modelo Vosk instalado (`setup.ps1`) e das fixtures de áudio real
(`tests/gerar_fixtures.py`, corrido à mão uma vez — precisa do
`voice-clone-service` a correr). Sem qualquer um dos dois, salta em vez de
falhar: um dev sem o modelo ou sem GPU não devia ver isto vermelho.
"""

from __future__ import annotations

import sys
import wave
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

import server  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
PALAVRA = "sentinela"

pytestmark = pytest.mark.skipif(
    not server.MODEL_PATH.is_dir(),
    reason="modelo Vosk não instalado — corre wake-word-service/setup.ps1",
)


def _pcm(nome: str) -> bytes:
    caminho = FIXTURES / f"{nome}.wav"
    if not caminho.exists():
        pytest.skip(f"fixture {caminho.name} não gerada — corre tests/gerar_fixtures.py")
    with wave.open(str(caminho), "rb") as w:
        return w.readframes(w.getnframes())


def test_silencio_nao_desperta() -> None:
    texto = server.transcrever(_pcm("silencio"))
    assert PALAVRA not in texto


def test_ruido_de_fundo_nao_desperta() -> None:
    texto = server.transcrever(_pcm("ruido"))
    assert PALAVRA not in texto


def test_frase_sem_a_palavra_nao_desperta() -> None:
    texto = server.transcrever(_pcm("sem_palavra"))
    assert PALAVRA not in texto


def test_a_palavra_dita_isolada_desperta() -> None:
    texto = server.transcrever(_pcm("sentinela"))
    assert PALAVRA in texto


def test_a_palavra_dentro_de_outra_frase_tambem_desperta() -> None:
    """
    Documenta o risco, não uma garantia: "sentinela" é uma palavra real do
    português, por isso o motor reconhece-a corretamente mesmo quando
    ninguém está a chamar o JARVIS (aqui, alguém a falar de um guarda
    medieval). Isto é o preço, já aceite no desenho (§1.2, §6.4), de um
    motor pequeno sem um segundo modo "só palavra isolada" — fica coberto
    pelo aviso na Privacidade e pela hipótese de trocar a palavra em 24.3,
    não corrigido aqui.
    """
    texto = server.transcrever(_pcm("sentinela_embutido"))
    assert PALAVRA in texto
