"""
Confirma que o CORS do serviço não aceita qualquer origem (voz clonada
local, Parte 7.1 — revisão a sério de consentimento explícito).

Não usa `with TestClient(app) as client:` de propósito: esse gestor de
contexto dispara os eventos de arranque (`carregar_modelo`), que importa
`TTS` e carrega o modelo a sério — precisa de GPU e demora minutos. Um
pedido de pré-voo CORS é tratado inteiramente pelo `CORSMiddleware`, antes
de chegar a qualquer rota, por isso não precisa do modelo carregado.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient

from server import app

client = TestClient(app)


def _preflight(origin: str) -> "object":
    return client.options(
        "/voz",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
        },
    )


def test_origem_do_jarvis_em_desenvolvimento_e_aceite():
    resposta = _preflight("http://localhost:1420")
    assert resposta.headers.get("access-control-allow-origin") == "http://localhost:1420"


def test_pagina_qualquer_na_internet_e_recusada():
    resposta = _preflight("https://pagina-maliciosa.example")
    assert "access-control-allow-origin" not in resposta.headers


def test_outra_porta_em_localhost_e_recusada():
    # Não basta ser "localhost" — tem de ser a porta exata do JARVIS. Um
    # outro servidor de desenvolvimento qualquer, a correr por acaso na
    # mesma máquina, também não é de confiar só por partilhar o anfitrião.
    resposta = _preflight("http://localhost:9999")
    assert "access-control-allow-origin" not in resposta.headers
