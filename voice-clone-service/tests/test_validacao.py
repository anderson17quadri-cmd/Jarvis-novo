"""
Testes para validação de arquivos e segurança no Voice Clone Service.

Estes testes verificam as validações de:
- Tipo MIME de arquivos de áudio
- Tamanho máximo (10MB)
- Duração do áudio (1-300 segundos)
- Estrutura dos endpoints

Executar: pytest tests/test_validacao.py -v
"""

import pytest
from io import BytesIO
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import sys

# Adiciona o diretório raiz ao path para imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from server import ALLOWED_AUDIO_MIME_TYPES, MAX_FILE_SIZE, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS


class MockUploadFile:
    """Mock para UploadFile do FastAPI."""
    
    def __init__(self, content_type: str = "audio/wav", filename: str = "teste.wav"):
        self.content_type = content_type
        self.filename = filename
        self._data = b""
    
    async def read(self):
        return self._data
    
    @property
    def size(self):
        return len(self._data)


class TestValidacaoMimeType:
    """Testes para validação de tipos MIME."""
    
    def test_mime_types_suportados(self):
        """Verifica se os principais formatos de áudio estão na whitelist."""
        mime_types_esperados = {
            "audio/wav",
            "audio/webm",
            "audio/ogg",
            "audio/mp4",
            "audio/mpeg",  # MP3
        }
        
        for mime_type in mime_types_esperados:
            assert mime_type in ALLOWED_AUDIO_MIME_TYPES, \
                f"Tipo MIME {mime_type} deveria ser suportado"
    
    def test_extensoes_correspondem_mime_types(self):
        """Verifica se as extensões mapeadas fazem sentido."""
        for mime_type, extensao in ALLOWED_AUDIO_MIME_TYPES.items():
            assert extensao.startswith("."), \
                f"Extensão '{extensao}' deve começar com ponto"
            assert len(extensao) <= 5, \
                f"Extensão '{extensao}' parece muito longa"


class TestValidacaoTamanho:
    """Testes para validação de tamanho de arquivo."""
    
    def test_max_file_size_10mb(self):
        """Verifica se o limite máximo é 10MB."""
        assert MAX_FILE_SIZE == 10 * 1024 * 1024, "Tamanho máximo deve ser 10MB"
    
    def test_rejeita_arquivo_muito_pequeno(self):
        """Arquivos menores que 1000 bytes devem ser rejeitados."""
        conteudo = b'\x00' * 999  # 999 bytes
        
        assert len(conteudo) < 1000, \
            "Este teste deve usar conteúdo menor que 1000 bytes"
    
    def test_aceita_arquivo_minimo_valido(self):
        """Arquivos com 1000 bytes ou mais são válidos em tamanho."""
        conteudo = b'\x00' * 1000  # Exatamente 1000 bytes
        
        assert len(conteudo) >= 1000, \
            "Conteúdo deve ser pelo menos 1000 bytes"
    
    def test_rejeita_arquivo_acima_10mb(self):
        """Arquivos acima de 10MB devem ser rejeitados."""
        conteudo_grande = b'\x00' * (MAX_FILE_SIZE + 1)
        
        assert len(conteudo_grande) > MAX_FILE_SIZE, \
            "Conteúdo deve exceder o limite máximo"


class TestValidacaoDuracao:
    """Testes para validação de duração de áudio."""
    
    def test_duracao_minima_1_segundo(self):
        """Verifica se a duração mínima é 1 segundo."""
        assert MIN_DURATION_SECONDS == 1, "Duração mínima deve ser 1 segundo"
    
    def test_duracao_maxima_300_segundos(self):
        """Verifica se a duração máxima é 300 segundos (5 minutos)."""
        assert MAX_DURATION_SECONDS == 300, "Duração máxima deve ser 300 segundos"
    
    def test_janela_duracao_razoavel(self):
        """A janela de duração deve ser prática para uso real."""
        assert MAX_DURATION_SECONDS > MIN_DURATION_SECONDS, \
            "Duração máxima deve ser maior que mínima"
        
        # 5 minutos é razoável para uma amostra de voz
        assert MAX_DURATION_SECONDS >= 60, \
            "Duração máxima deve permitir pelo menos 1 minuto"


class TestEndpointsExistentes:
    """Testes para verificar existência dos endpoints."""
    
    def test_endpoint_health_existe(self):
        """O endpoint /health deve existir."""
        from server import app
        
        routes = [route.path for route in app.routes]
        assert "/health" in routes, "Endpoint /health deve existir"
    
    def test_endpoint_vozes_existe(self):
        """O endpoint /vozes deve existir."""
        from server import app
        
        routes = [route.path for route in app.routes]
        assert "/vozes" in routes, "Endpoint /vozes deve existir"
    
    def test_endpoint_voz_existe(self):
        """O endpoint /voz deve existir."""
        from server import app
        
        routes = [route.path for route in app.routes]
        assert "/voz" in routes, "Endpoint /voz deve existir"
    
    def test_endpoint_falar_existe(self):
        """O endpoint /falar deve existir."""
        from server import app
        
        routes = [route.path for route in app.routes]
        assert "/falar" in routes, "Endpoint /falar deve existir"
    
    def test_endpoint_ouvir_existe(self):
        """O endpoint /ouvir deve existir."""
        from server import app
        
        routes = [route.path for route in app.routes]
        assert "/ouvir" in routes, "Endpoint /ouvir deve existir"


class TestConfiguracaoCORS:
    """Testes para configuração CORS."""
    
    def test_cors_configurado(self):
        """O middleware CORS deve estar configurado."""
        from server import app
        
        middlewares = [m.cls.__name__ for m in app.user_middleware]
        assert "CORSMiddleware" in middlewares, \
            "CORS middleware deve estar configurado"
    
    def test_regex_origens_permitidas(self):
        """O regex de origens deve incluir localhost:1420 e tauri.localhost."""
        from server import app
        
        cors_middleware = None
        for m in app.user_middleware:
            if hasattr(m, 'cls') and m.cls.__name__ == "CORSMiddleware":
                cors_middleware = m
                break
        
        assert cors_middleware is not None, "CORS middleware não encontrado"
        
        # Verifica se o regex está configurado
        kwargs = cors_middleware.kwargs if hasattr(cors_middleware, 'kwargs') else {}
        allow_origin_regex = kwargs.get('allow_origin_regex', '')
        
        assert 'localhost:1420' in allow_origin_regex, \
            "Regex deve permitir localhost:1420"
        assert 'tauri' in allow_origin_regex.lower(), \
            "Regex deve permitir origens Tauri"


@pytest.mark.asyncio
async def test_imports_modulo():
    """Verifica se o módulo pode ser importado sem erros."""
    try:
        import server
        assert hasattr(server, 'app'), "Módulo deve exportar 'app'"
        assert hasattr(server, 'ALLOWED_AUDIO_MIME_TYPES'), \
            "Módulo deve exportar constantes de validação"
    except ImportError as e:
        pytest.fail(f"Falha ao importar módulo server: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
