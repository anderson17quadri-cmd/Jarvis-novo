"""
Serviço local de voz clonada (Parte 7.1 — docs/spec/voz-clonada-local.md).

Sozinho, à parte do JARVIS — a mesma relação que o Ollama já tem com a app:
corre no próprio PC, o JARVIS fala com ele por HTTP no localhost, e nada disto
sai da máquina. Usa o XTTS-v2 (Coqui) — que faz duas coisas diferentes, e as
duas ficam aqui: clona UMA voz só (a de quem grava a amostra em
`voices/referencia.wav` — isto é a voz de quem usa o sistema, não um serviço
geral de clonagem), e também traz várias dezenas de vozes já gravadas por
atores que autorizaram o uso, sem clonar ninguém (`GET /vozes`).

Confirmado a funcionar numa RTX 5070 (09/08/2026) — áudio real, gerado com a
voz gravada em `voices/referencia.wav`. Precisou de três correções que só
apareceram a sério no Windows: FFmpeg de uma versão específica (4 a 8, não a
mais recente), `os.add_dll_directory` para o Python encontrar as DLLs, e o
PyTorch reinstalado contra um índice CUDA mais recente (a RTX 5070 é
demasiado nova para o `cu126` inicial). Tudo documentado no README.md.

Arranca com: uvicorn server:app --host 127.0.0.1 --port 8090
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

VOICES_DIR = Path(__file__).parent / "voices"
REFERENCE_PATH = VOICES_DIR / "referencia.wav"
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"

# O reconhecimento de voz do WebView2 (o motor do Tauri no Windows) não tem
# nenhum serviço de verdade por trás da Web Speech API: o microfone liga
# (`onaudiostart` dispara), mas nunca sai transcrição, erro nem sequer o
# fim do reconhecimento — fica preso para sempre. Confirmado a sério nesta
# máquina, não é suposição. `POST /ouvir`, aqui, é o arranjo: local, sem
# pedir nada à Microsoft nem à Google, no mesmo espírito da voz clonada.
STT_MODEL_NAME = os.environ.get("STT_MODEL", "small")

# Vozes próprias do XTTS-v2 — gravadas por atores de voz que autorizaram o
# uso no modelo, distribuídas com ele. Nenhuma delas é clonada por nós; são
# do próprio pacote (ficheiro `speakers_xtts.pth`, dentro do modelo
# descarregado). Isto é só uma descrição para as que já se ouviram — a
# lista de vozes *válidas* vem do modelo a sério (`_vozes_disponiveis`,
# preenchida no arranque), nunca desta tabela: um nome escrito à mão errado
# dava um erro feio, vindo de dentro do coqui-tts.
VOZES_PRONTAS: dict[str, str] = {
    "Ana Florence": "Feminina, tom claro e neutro",
    "Sofia Hellen": "Feminina, mais grave",
    "Alison Dietlinde": "Feminina, tom firme",
    "Gracie Wise": "Feminina, tom suave",
    "Andrew Chipper": "Masculina, tom animado",
    "Damien Black": "Masculina, mais grave",
    "Royston Min": "Masculina, tom neutro",
    "Craig Gutsy": "Masculina, tom firme",
}

# Preenchida no arranque, com as vozes que o modelo carregado trouxer a
# sério (`TTS.speakers`) — mais de 40, no XTTS-v2. `None` até lá, e nos
# testes sem modelo nenhum: nesse caso cai-se para as chaves de
# VOZES_PRONTAS, só para a lógica das rotas continuar testável sem GPU.
_vozes_disponiveis: list[str] | None = None

def _json_utf8(data: dict, status_code: int = 200) -> Response:
    """
    JSON com `charset=utf-8` explícito no cabeçalho.

    Sem isto, o FastAPI manda só `Content-Type: application/json` — e a
    Windows PowerShell 5.1 (`Invoke-RestMethod`), sem essa pista, adivinha
    mal a codificação de nomes fora do inglês. "Camilla Holmström" chegava
    como "Camilla HolmstrÃ¶m" a um utilizador — um bug antigo e conhecido
    desse cmdlet, não deste modelo nem desta lista.
    """
    return Response(
        content=json.dumps(data, ensure_ascii=False),
        media_type="application/json; charset=utf-8",
        status_code=status_code,
    )


app = FastAPI(title="JARVIS — voz clonada local")


@app.exception_handler(HTTPException)
async def _erro_json_utf8(request: Request, exc: HTTPException) -> Response:
    """Os erros vêm da mesma fábrica que as respostas — o bug era o mesmo aí."""
    return _json_utf8({"detail": exc.detail}, status_code=exc.status_code)

# CORS aberto de propósito: isto só ouve em 127.0.0.1, nunca sai da máquina, e
# o JARVIS (Tauri/WebView) precisa de o poder chamar sem o browser bloquear o
# pedido por vir de uma origem diferente.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# O modelo é grande (mais de 1GB) e demora a carregar — uma vez só, no
# arranque do serviço, não a cada pedido. `None` até lá: um pedido que chegue
# antes de estar pronto recebe um erro claro em vez de um crash a meio.
_tts_model = None

# O modelo de reconhecimento (Whisper), carregado à parte do de síntese —
# ver a nota junto a `STT_MODEL_NAME`. Mesma regra do `_tts_model`: `None`
# até estar pronto.
_stt_model = None


def _preparar_ffmpeg_no_windows() -> None:
    """
    No Windows, desde o Python 3.8, a variável PATH deixou de bastar para o
    Python encontrar DLLs de que uma biblioteca precise — é preciso dizer-lho
    por código, com `os.add_dll_directory`. O `torchcodec` (usado pelo
    XTTS-v2 para ler o áudio) precisa das DLLs do FFmpeg, e sem isto falha
    a arrancar mesmo com o FFmpeg instalado.

    `FFMPEG_DLL_DIR` aponta para a pasta `bin` do FFmpeg — ver README.md.
    Sem essa variável definida, ou fora do Windows, não faz nada: o
    `torchcodec` no Linux/Mac já encontra as bibliotecas sozinho.
    """
    if not hasattr(os, "add_dll_directory"):
        return

    ffmpeg_bin = os.environ.get("FFMPEG_DLL_DIR")
    if not ffmpeg_bin:
        return

    if not Path(ffmpeg_bin).is_dir():
        raise RuntimeError(
            f"FFMPEG_DLL_DIR aponta para uma pasta que não existe: {ffmpeg_bin}"
        )

    os.add_dll_directory(ffmpeg_bin)


@app.on_event("startup")
def carregar_modelo() -> None:
    global _tts_model, _vozes_disponiveis, _stt_model
    _preparar_ffmpeg_no_windows()

    # Importado aqui, não no topo do ficheiro: importar `TTS` já obriga o
    # PyTorch a inicializar a GPU, e isso não deve acontecer só por importar
    # este módulo (por exemplo, em testes que nunca chegam a arrancar o servidor).
    from TTS.api import TTS
    import whisper

    device = "cuda" if os.environ.get("VOICE_CLONE_CPU") != "1" else "cpu"
    _tts_model = TTS(MODEL_NAME).to(device)
    _vozes_disponiveis = list(_tts_model.speakers or [])

    # Carregado depois do XTTS-v2: se a GPU não tiver memória para os dois,
    # é melhor a síntese (já confirmada a funcionar) continuar a arrancar do
    # que os dois falharem por causa do reconhecimento, que é o mais novo.
    _stt_model = whisper.load_model(STT_MODEL_NAME, device=device)


@app.get("/health")
def saude() -> Response:
    return _json_utf8({
        "ok": True,
        "modelo_carregado": _tts_model is not None,
        "voz_configurada": REFERENCE_PATH.exists(),
        "reconhecimento_carregado": _stt_model is not None,
    })


@app.get("/vozes")
def vozes_prontas() -> Response:
    """
    As vozes do próprio modelo, sem clonagem nenhuma.

    A lista é a verdadeira, a que o modelo carregado trouxer — mais de 40,
    no XTTS-v2 — com a descrição de `VOZES_PRONTAS` para as que já se
    ouviram, e uma genérica para as restantes. Antes do modelo carregar
    (ou nos testes sem GPU), cai-se só para a pequena curadoria.
    """
    nomes = _vozes_disponiveis if _vozes_disponiveis is not None else list(VOZES_PRONTAS)
    return _json_utf8(
        {"vozes": {nome: VOZES_PRONTAS.get(nome, "Voz do modelo XTTS-v2") for nome in nomes}}
    )


@app.post("/voz")
async def gravar_voz(ficheiro: UploadFile) -> Response:
    """
    Recebe a amostra de voz e guarda-a como referência.

    Substitui o que estiver lá — só há uma voz de propósito, a de quem grava.

    Aceita qualquer formato que o `ffmpeg` decodifique — inclui o
    `.webm`/Opus que o `MediaRecorder` do browser produz, gravado dentro da
    própria interface (Parte 7.1 §Voz clonada local, sub-fase 4.2), não só
    o `.wav` de quem grava à mão como antes. Sai sempre `.wav` PCM mono: o
    ficheiro pode chegar em qualquer contentor, `REFERENCE_PATH` tem de ser
    sempre o mesmo formato que o XTTS-v2 espera.
    """
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    conteudo = await ficheiro.read()

    if len(conteudo) < 1000:
        raise HTTPException(400, "O ficheiro parece vazio ou vazio de mais para ser uma gravação.")

    sufixo = Path(ficheiro.filename or "gravacao.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=sufixo, delete=False) as tmp:
        tmp.write(conteudo)
        caminho_temp = tmp.name

    try:
        resultado = subprocess.run(
            ["ffmpeg", "-y", "-i", caminho_temp, "-ar", "22050", "-ac", "1", str(REFERENCE_PATH)],
            capture_output=True,
            text=True,
        )
        if resultado.returncode != 0:
            raise HTTPException(
                422,
                "Não consegui converter a gravação para .wav — o FFmpeg disse: "
                f"{resultado.stderr.strip()[-300:]}",
            )
    finally:
        Path(caminho_temp).unlink(missing_ok=True)

    return _json_utf8({"ok": True, "bytes": REFERENCE_PATH.stat().st_size})


@app.post("/falar")
def falar(pedido: dict) -> Response:
    """
    Sintetiza `pedido["texto"]`. Devolve áudio WAV.

    Duas formas de escolher a voz, nunca as duas ao mesmo tempo:
    - `pedido["voz"]` — um nome de `GET /vozes`. Voz do próprio modelo, sem
      clonagem.
    - Nem isso: usa a amostra gravada em `voices/referencia.wav`, clonada.

    `pedido["idioma"]` por omissão `"pt"` — o XTTS-v2 aceita um código de
    idioma, não um código de região; "pt-PT" não é um valor válido aqui.
    """
    if _tts_model is None:
        raise HTTPException(503, "O modelo ainda está a carregar. Tenta outra vez em instantes.")

    texto = pedido.get("texto", "").strip()
    if not texto:
        raise HTTPException(400, "Falta o texto a dizer.")

    idioma = pedido.get("idioma", "pt")
    voz = pedido.get("voz")

    kwargs: dict = {"text": texto, "language": idioma}

    if voz:
        vozes_validas = _vozes_disponiveis if _vozes_disponiveis is not None else list(VOZES_PRONTAS)
        if voz not in vozes_validas:
            raise HTTPException(
                400,
                f"'{voz}' não é uma voz conhecida. Vê /vozes para a lista.",
            )
        kwargs["speaker"] = voz
    else:
        if not REFERENCE_PATH.exists():
            raise HTTPException(
                400,
                "Ainda não há nenhuma voz gravada, e não pediste uma voz pronta. "
                "Manda um ficheiro para /voz, ou indica 'voz' no pedido — ver /vozes.",
            )
        kwargs["speaker_wav"] = str(REFERENCE_PATH)

    # `tts_to_file` é a forma documentada de gerar áudio com este pacote;
    # gera-se para um ficheiro temporário e lê-se de volta, porque a versão
    # instalada pode não ter um método que devolva os bytes diretamente.
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        caminho_temp = tmp.name

    try:
        _tts_model.tts_to_file(file_path=caminho_temp, **kwargs)
        audio_bytes = Path(caminho_temp).read_bytes()
    finally:
        Path(caminho_temp).unlink(missing_ok=True)

    return Response(content=audio_bytes, media_type="audio/wav")


@app.post("/ouvir")
async def ouvir(ficheiro: UploadFile, idioma: str = Form("pt")) -> Response:
    """
    Transcreve um áudio gravado no browser (`MediaRecorder`, normalmente
    `.webm`/Opus) — o arranjo real do microfone, ver a nota junto a
    `STT_MODEL_NAME`. O Whisper decodifica pelo `ffmpeg` (subprocesso, não
    as DLLs do `torchcodec`): qualquer FFmpeg no PATH serve, mesmo o mais
    recente que o XTTS-v2 recusa.

    `idioma` segue o mesmo padrão de `/falar` — um código de idioma ("pt",
    não "pt-PT"), por omissão "pt". A interface não tem ainda escolha de
    idioma nenhuma (é uma app só em português); isto é só para o endpoint
    não ficar mais pobre do que o seu par em síntese.

    Filtra a alucinação conhecida do Whisper: dado só ruído ou silêncio, o
    modelo às vezes inventa uma frase inteira (o exemplo clássico é
    "Obrigado por assistir") em vez de dizer que não ouviu nada.
    `no_speech_prob`, que o próprio modelo devolve por segmento, é o sinal
    para não confiar nesse texto — sem ele, um comando de voz executava-se
    sozinho a partir do ruído do microfone.
    """
    if _stt_model is None:
        raise HTTPException(503, "O reconhecimento ainda está a carregar. Tenta outra vez em instantes.")

    conteudo = await ficheiro.read()
    if len(conteudo) < 100:
        raise HTTPException(400, "O áudio parece vazio ou vazio de mais para transcrever.")

    sufixo = Path(ficheiro.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=sufixo, delete=False) as tmp:
        tmp.write(conteudo)
        caminho_temp = tmp.name

    try:
        resultado = _stt_model.transcribe(caminho_temp, language=idioma, fp16=False)
    except Exception as erro:
        # Um `.webm` vazio de silêncio, ou um formato que o ffmpeg não
        # decodifica, não deve derrubar o serviço — só esta transcrição.
        raise HTTPException(422, f"Não consegui transcrever: {erro}") from erro
    finally:
        Path(caminho_temp).unlink(missing_ok=True)

    segmentos = resultado.get("segments") or []
    parece_so_ruido = bool(segmentos) and all(seg.get("no_speech_prob", 0) > 0.6 for seg in segmentos)
    texto = "" if parece_so_ruido else str(resultado.get("text", "")).strip()

    return _json_utf8({"texto": texto})
