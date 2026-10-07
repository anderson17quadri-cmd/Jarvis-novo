import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
import server


def test_arranque_sem_clonagem_nao_importa_tts(monkeypatch):
    monkeypatch.delenv('JARVIS_LEGACY_TTS', raising=False)
    import builtins
    real_import = builtins.__import__
    def import_guard(name, *args, **kwargs):
        if name.startswith('TTS'):
            raise AssertionError('O serviço de reconhecimento não deve importar XTTS')
        return real_import(name, *args, **kwargs)
    monkeypatch.setattr(builtins, '__import__', import_guard)
    server.carregar_modelo()


def test_saude_anuncia_reconhecimento_frio_sem_sintese(monkeypatch):
    monkeypatch.setattr(server, '_stt_model', None)
    monkeypatch.setattr(server, '_tts_model', None)
    monkeypatch.setattr(server, '_reconhecimento_disponivel', lambda: True, raising=False)
    response = TestClient(server.app).get('/health')
    assert response.json()['reconhecimento_disponivel'] is True
    assert response.json()['sintese_local'] is False


def test_gravacao_de_clonagem_desativada_nao_substitui_referencia(monkeypatch, tmp_path):
    monkeypatch.delenv('JARVIS_LEGACY_TTS', raising=False)
    reference = tmp_path / 'referencia.wav'
    reference.write_bytes(b'original')
    monkeypatch.setattr(server, 'REFERENCE_PATH', reference)
    response = TestClient(server.app).post('/voz', files={'ficheiro': ('voz.wav', b'nova')})
    assert response.status_code == 410
    assert reference.read_bytes() == b'original'
