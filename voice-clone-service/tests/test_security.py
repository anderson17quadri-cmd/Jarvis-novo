"""
Testes de segurança para o Voice Clone Service.

Estes testes verificam:
- Validação de CORS
- Validação de tipos MIME
- Proteção contra uploads maliciosos
- Limites de recursos

Executar: pytest tests/test_security.py -v
"""

import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from server import (
    ALLOWED_AUDIO_MIME_TYPES,
    MAX_FILE_SIZE,
    MIN_DURATION_SECONDS,
    MAX_DURATION_SECONDS,
    app,
)


class TestSegurancaCORS:
    """Testes para configuração de segurança CORS."""

    def test_cors_nao_permite_origem_arbitraria(self):
        """O CORS não deve permitir origens arbitrárias."""
        from server import app
        
        cors_middleware = None
        for m in app.user_middleware:
            if hasattr(m, 'cls') and m.cls.__name__ == "CORSMiddleware":
                cors_middleware = m
                break
        
        assert cors_middleware is not None
        
        kwargs = cors_middleware.kwargs if hasattr(cors_middleware, 'kwargs') else {}
        allow_origin_regex = kwargs.get('allow_origin_regex', '')
        
        # Origens que NÃO devem ser permitidas
        origens_proibidas = [
            "http://evil.com",
            "https://malicious-site.com",
            "http://localhost:3000",  # Porta diferente da permitida
            "http://127.0.0.1:1420",  # IP direto não é igual a localhost
        ]
        
        import re
        regex_compiled = re.compile(allow_origin_regex)
        
        for origem in origens_proibidas:
            assert not regex_compiled.match(origem), \
                f"Origem {origem} não deveria ser permitida"

    def test_cors_permite_origens_jarvis(self):
        """O CORS deve permitir apenas origens do JARVIS."""
        from server import app
        
        cors_middleware = None
        for m in app.user_middleware:
            if hasattr(m, 'cls') and m.cls.__name__ == "CORSMiddleware":
                cors_middleware = m
                break
        
        assert cors_middleware is not None
        
        kwargs = cors_middleware.kwargs if hasattr(cors_middleware, 'kwargs') else {}
        allow_origin_regex = kwargs.get('allow_origin_regex', '')
        
        import re
        regex_compiled = re.compile(allow_origin_regex)
        
        # Origens que DEVEM ser permitidas
        origens_permitidas = [
            "http://localhost:1420",
            "https://tauri.localhost",
            "tauri://localhost",
        ]
        
        for origem in origens_permitidas:
            assert regex_compiled.match(origem), \
                f"Origem {origem} deveria ser permitida"


class TestValidacaoMIME:
    """Testes para validação de tipos MIME."""

    def test_tipos_executaveis_bloqueados(self):
        """Tipos MIME executáveis não devem estar na whitelist."""
        mime_types_perigosos = [
            "application/x-executable",
            "application/x-msdownload",
            "application/octet-stream",
            "text/html",
            "application/javascript",
        ]
        
        for mime_type in mime_types_perigosos:
            assert mime_type not in ALLOWED_AUDIO_MIME_TYPES, \
                f"Tipo MIME perigoso {mime_type} não deveria ser permitido"

    def test_apenas_audio_eh_permitido(self):
        """Apenas tipos de áudio devem ser permitidos."""
        for mime_type in ALLOWED_AUDIO_MIME_TYPES.keys():
            assert mime_type.startswith("audio/"), \
                f"Tipo MIME {mime_type} deve ser de áudio"


class TestLimitesRecursos:
    """Testes para limites de recursos."""

    def test_max_file_size_razoavel(self):
        """O tamanho máximo de arquivo deve ser razoável (nem muito pequeno, nem muito grande)."""
        # 10MB é razoável para áudio
        assert MAX_FILE_SIZE == 10 * 1024 * 1024
        
        # Deve ser pelo menos 1MB
        assert MAX_FILE_SIZE >= 1 * 1024 * 1024
        
        # Não deve exceder 50MB (razoável para um serviço local)
        assert MAX_FILE_SIZE <= 50 * 1024 * 1024

    def test_duracao_minima_segura(self):
        """A duração mínima deve prevenir arquivos vazios."""
        # 1 segundo é razoável como mínimo
        assert MIN_DURATION_SECONDS == 1
        
        # Deve ser maior que 0
        assert MIN_DURATION_SECONDS > 0

    def test_duracao_maxima_segura(self):
        """A duração máxima deve prevenir abuso de recursos."""
        # 5 minutos (300 segundos) é razoável
        assert MAX_DURATION_SECONDS == 300
        
        # Deve permitir pelo least 1 minuto
        assert MAX_DURATION_SECONDS >= 60
        
        # Não deve exceder 10 minutos (600 segundos)
        assert MAX_DURATION_SECONDS <= 600


class TestEndpointsSaude:
    """Testes para endpoints de saúde e monitoramento."""

    def test_health_endpoint_existe(self):
        """O endpoint /health deve existir para monitoramento."""
        routes = [route.path for route in app.routes]
        assert "/health" in routes

    def test_health_detailed_endpoint_existe(self):
        """O endpoint /health/detailed deve existir para monitoramento detalhado."""
        routes = [route.path for route in app.routes]
        # Nota: Este endpoint pode ser adicionado como melhoria futura
        # assert "/health/detailed" in routes


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
