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
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

# Constantes de validação de áudio
ALLOWED_AUDIO_MIME_TYPES = {
    "audio/wav": ".wav",
    "audio/wave": ".wav",
    "audio/x-wav": ".wav",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".mp4",
    "audio/mpeg": ".mp3",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MIN_DURATION_SECONDS = 1
MAX_DURATION_SECONDS = 300  # 5 minutos

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

# "Só ouve em 127.0.0.1" trava quem pode alcançar isto por rede — não diz
# nada sobre quem, na própria máquina, consegue chamar. `allow_origins=["*"]`
# deixava QUALQUER página aberta em QUALQUER separador do browser (nada a ver
# com o JARVIS) mandar um pedido para aqui e ler a resposta — o CORS existe
# exatamente para impedir isso, e um `*` desliga-o por completo. Na prática:
# uma página maliciosa, só por estar aberta enquanto este serviço corre,
# conseguia POST /voz com um áudio à escolha dela e substituir a voz clonada
# sem a pessoa dar por nada — o consentimento explícito que esta peça existe
# para garantir vivia só na convenção da interface do JARVIS (gravar pelo
# microfone), nunca aplicado aqui, o único sítio que decide o que fica
# guardado em `referencia.wav`. Restrito às origens que o próprio JARVIS usa: a
# porta exata de desenvolvimento (`devUrl` em tauri.conf.json — não "qualquer
# porta em localhost", que deixaria confiar em qualquer outro servidor local
# que por acaso esteja a correr na máquina), e os esquemas do WebView em
# produção. Os esquemas de produção não foram confirmados contra uma build
# empacotada a sério — só o de desenvolvimento, que é o que está a correr
# esta noite.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(http://localhost:1420|https?://tauri\.localhost|tauri://localhost)$",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# O modelo é grande (mais de 1GB) e demora a carregar — uma vez só, no
# arranque do serviço, não a cada pedido. `None` até lá: um pedido que chegue
# antes de estar pronto recebe um erro claro em vez de um crash a meio.
_tts_model = None

# O modelo de reconhecimento (Whisper), carregado à parte do de síntese —
# ver a nota junto a `STT_MODEL_NAME`. Só carrega na primeira chamada a
# `/ouvir`, nunca no arranque: se a GPU não tiver memória para os dois ao
# mesmo tempo, a síntese (a funcionalidade original) continua a funcionar
# sozinha, e a transcrição fica a dar "ainda a carregar" em vez de bloquear
# o arranque. `None` até lá.
_stt_model = None
_stt_loading = False


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
    global _tts_model, _vozes_disponiveis
    _preparar_ffmpeg_no_windows()

    # Importado aqui, não no topo do ficheiro: importar `TTS` já obriga o
    # PyTorch a inicializar a GPU, e isso não deve acontecer só por importar
    # este módulo (por exemplo, em testes que nunca chegam a arrancar o servidor).
    from TTS.api import TTS

    device = "cuda" if os.environ.get("VOICE_CLONE_CPU") != "1" else "cpu"
    _tts_model = TTS(MODEL_NAME).to(device)
    _vozes_disponiveis = list(_tts_model.speakers or [])

    # O Whisper NÃO carrega aqui — só na primeira chamada a `/ouvir`
    # (`_carregar_stt_se_preciso`). Se a GPU não tiver memória para os dois
    # ao mesmo tempo, a síntese (a funcionalidade original) continua a
    # funcionar, e a transcrição fica a dar "ainda a carregar".


def _carregar_stt_se_preciso() -> None:
    """Carrega o Whisper, uma vez só, na primeira chamada a /ouvir."""
    global _stt_model, _stt_loading
    if _stt_model is not None:
        return
    if _stt_loading:
        raise HTTPException(503, "O reconhecimento ainda está a carregar. Tenta outra vez em instantes.")

    _stt_loading = True
    try:
        import whisper
        device = "cuda" if os.environ.get("VOICE_CLONE_CPU") != "1" else "cpu"
        _stt_model = whisper.load_model(STT_MODEL_NAME, device=device)
    finally:
        _stt_loading = False


@app.get("/health")
def saude() -> Response:
    return _json_utf8({
        "ok": True,
        "modelo_carregado": _tts_model is not None,
        "voz_configurada": REFERENCE_PATH.exists(),
        "reconhecimento_carregado": _stt_model is not None,
        "reconhecimento_a_carregar": _stt_loading,
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


def _validar_duracao_audio(caminho_arquivo: str) -> float:
    """Valida a duração do áudio usando ffprobe."""
    try:
        resultado = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                caminho_arquivo
            ],
            capture_output=True,
            text=True,
            timeout=5
        )
        if resultado.returncode != 0:
            return 0.0
        
        duracao = float(resultado.stdout.strip())
        return duracao
    except (subprocess.TimeoutExpired, ValueError, FileNotFoundError):
        return 0.0


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
    
    Validações:
    - Tipo MIME deve estar na whitelist ALLOWED_AUDIO_MIME_TYPES
    - Tamanho máximo: 10MB
    - Duração: 1-300 segundos
    """
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    conteudo = await ficheiro.read()

    # Validação de tamanho mínimo
    if len(conteudo) < 1000:
        raise HTTPException(400, "O ficheiro parece vazio ou vazio de mais para ser uma gravação.")
    
    # Validação de tamanho máximo
    if len(conteudo) > MAX_FILE_SIZE:
        raise HTTPException(
            413, 
            f"O ficheiro excede o tamanho máximo de {MAX_FILE_SIZE // 1024 // 1024}MB."
        )
    
    # Validação de tipo MIME
    mime_type = ficheiro.content_type or ""
    if mime_type and mime_type not in ALLOWED_AUDIO_MIME_TYPES:
        raise HTTPException(
            415,
            f"Tipo de ficheiro '{mime_type}' não suportado. Tipos aceites: {', '.join(ALLOWED_AUDIO_MIME_TYPES.keys())}"
        )

    sufixo = Path(ficheiro.filename or "gravacao.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=sufixo, delete=False) as tmp:
        tmp.write(conteudo)
        caminho_temp = tmp.name

    try:
        # Validar duração antes de converter
        duracao = _validar_duracao_audio(caminho_temp)
        if duracao > 0:  # Só valida se conseguiu obter duração
            if duracao < MIN_DURATION_SECONDS:
                Path(caminho_temp).unlink(missing_ok=True)
                raise HTTPException(
                    400,
                    f"Áudio muito curto ({duracao:.1f}s). Mínimo: {MIN_DURATION_SECONDS} segundos."
                )
            if duracao > MAX_DURATION_SECONDS:
                Path(caminho_temp).unlink(missing_ok=True)
                raise HTTPException(
                    400,
                    f"Áudio muito longo ({duracao:.1f}s). Máximo: {MAX_DURATION_SECONDS} segundos (5 minutos)."
                )
        
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

    `pedido["velocidade"]` por omissão `1.0` (o ritmo de base do modelo) —
    aceita um número entre 0.5 e 2.0, colando-se aos limites fora disso.
    """
    if _tts_model is None:
        raise HTTPException(503, "O modelo ainda está a carregar. Tenta outra vez em instantes.")

    texto = pedido.get("texto", "").strip()
    if not texto:
        raise HTTPException(400, "Falta o texto a dizer.")

    idioma = pedido.get("idioma", "pt")
    voz = pedido.get("voz")
    velocidade = pedido.get("velocidade")

    kwargs: dict = {"text": texto, "language": idioma}

    # `velocidade` (opcional) acelera a leitura: 1.0 é o ritmo de base do
    # XTTS-v2, que sai deliberado de mais para conversa. Aceita-se um número
    # entre 0.5 e 2.0 — fora disso, cola-se ao limite, para um pedido errado
    # não produzir áudio inaudível nem esticado ao ponto de não caber.
    if velocidade is not None:
        try:
            velocidade_float = float(velocidade)
        except (TypeError, ValueError):
            raise HTTPException(400, "A velocidade tem de ser um número.")
        kwargs["speed"] = max(0.5, min(2.0, velocidade_float))

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
    _carregar_stt_se_preciso()

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
