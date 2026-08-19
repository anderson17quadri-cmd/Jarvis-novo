"""Deteção local de wake word: áudio em memória, nunca enviado nem guardado.

Irmão do `voice-clone-service/` — a mesma relação com a app (Python à parte,
HTTP no localhost, gerido pelo Rust). Arranca com:
uvicorn server:app --host 127.0.0.1 --port 8091
"""

from __future__ import annotations

import json
import queue
import threading
import time
from pathlib import Path

import sounddevice as sd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from vosk import KaldiRecognizer, Model, SetLogLevel

ROOT = Path(__file__).parent
MODEL_PATH = ROOT / "model"
SAMPLE_RATE = 16_000
COOLDOWN_SECONDS = 2.5

app = FastAPI(title="JARVIS Wake Word Local")
# Só as origens que o próprio JARVIS usa — a mesma razão do
# `voice-clone-service`: um `*` deixava qualquer página aberta noutro
# separador do browser falar com um serviço que ouve o microfone.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(http://localhost:1420|https?://tauri\.localhost|tauri://localhost)$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
SetLogLevel(-1)

# Carregado uma só vez e mantido em memória — o modelo "small" é pequeno
# (dezenas de MB) mas não há razão para o reler a cada arranque da deteção.
_model: Model | None = None


def carregar_modelo() -> Model:
    """
    Carrega o modelo Vosk, cacheado. Lança se a pasta não existir (ainda não
    se correu `setup.ps1`) ou se o Vosk recusar o conteúdo (pasta a meio de
    um download, ou modelo errado lá dentro) — a prova a sério de que o
    motor existe e é válido, não só que a pasta tem esse nome.
    """
    global _model
    if _model is None:
        if not MODEL_PATH.is_dir():
            raise RuntimeError(
                "modelo Vosk não instalado — corre wake-word-service/setup.ps1"
            )
        _model = Model(str(MODEL_PATH))
    return _model


def transcrever(pcm: bytes) -> str:
    """
    Passa um áudio PCM16 mono a 16kHz, já completo, pelo reconhecedor e
    devolve o texto final. É o mesmo motor que `Detector._listen` usa em
    tempo real — aqui em modo lote, para os testes (`tests/test_deteccao.py`)
    poderem confirmar deteção sem precisar de um microfone ligado.
    """
    recognizer = KaldiRecognizer(carregar_modelo(), SAMPLE_RATE)
    recognizer.AcceptWaveform(pcm)
    return json.loads(recognizer.FinalResult()).get("text", "").casefold()


class Detector:
    def __init__(self) -> None:
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self.word = "sentinela"
        self.running = False
        self.event_id = 0
        self.last_detected_at: float | None = None
        self.last_error: str | None = None

    def start(self, word: str) -> None:
        """
        Arma a deteção. As duas verificações a sério acontecem aqui, antes de
        devolver — a lição do item 19 (Controlo Direto): não basta a porta
        responder, prova-se que o motor funciona. `carregar_modelo()` prova
        que o modelo é válido; `check_input_settings` prova que há um
        microfone a sério disponível nesta configuração, não só que existe
        algum dispositivo de entrada na lista. Uma falha aqui chega ao
        chamador como erro claro, em vez de a thread morrer sozinha lá
        dentro e só se descobrir minutos depois a ler `/health`.
        """
        modelo = carregar_modelo()
        try:
            sd.check_input_settings(samplerate=SAMPLE_RATE, channels=1, dtype="int16")
        except Exception as erro:
            raise RuntimeError(f"sem microfone disponível para a wake word: {erro}") from erro

        with self._lock:
            self.word = word.casefold().strip()
            if self.running:
                return
            self._stop.clear()
            self.running = True
            self.last_error = None
            self._thread = threading.Thread(target=self._listen, args=(modelo,), daemon=True)
            self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=1.5)
        with self._lock:
            self.running = False
            self._thread = None

    def status(self) -> dict[str, object]:
        with self._lock:
            return {
                "ok": True,
                "running": self.running,
                "word": self.word,
                "event_id": self.event_id,
                "last_detected_at": self.last_detected_at,
                "last_error": self.last_error,
                "model_ready": MODEL_PATH.is_dir(),
            }

    def _listen(self, modelo: Model) -> None:
        audio: queue.Queue[bytes] = queue.Queue()
        try:
            recognizer = KaldiRecognizer(modelo, SAMPLE_RATE)

            def callback(indata: bytes, _frames: int, _time: object, status: sd.CallbackFlags) -> None:
                if status:
                    return
                audio.put(bytes(indata))

            with sd.RawInputStream(
                samplerate=SAMPLE_RATE,
                blocksize=8_000,
                dtype="int16",
                channels=1,
                callback=callback,
            ):
                last_detection = 0.0
                while not self._stop.is_set():
                    try:
                        chunk = audio.get(timeout=0.25)
                    except queue.Empty:
                        continue
                    if not recognizer.AcceptWaveform(chunk):
                        continue
                    text = json.loads(recognizer.Result()).get("text", "").casefold()
                    now = time.monotonic()
                    if self.word in text and now - last_detection >= COOLDOWN_SECONDS:
                        last_detection = now
                        with self._lock:
                            self.event_id += 1
                            self.last_detected_at = time.time()
        except Exception as error:
            with self._lock:
                self.last_error = str(error)
        finally:
            with self._lock:
                self.running = False


detector = Detector()


@app.get("/health")
def health() -> dict[str, object]:
    return detector.status()


@app.post("/start")
def start(body: dict[str, object]) -> dict[str, object]:
    word = str(body.get("word", "sentinela")).strip()
    if not word:
        raise HTTPException(400, "A palavra de ativação não pode ficar vazia.")
    try:
        detector.start(word)
    except RuntimeError as error:
        raise HTTPException(503, str(error)) from error
    return detector.status()


@app.post("/stop")
def stop() -> dict[str, object]:
    detector.stop()
    return detector.status()


@app.on_event("shutdown")
def shutdown() -> None:
    detector.stop()
