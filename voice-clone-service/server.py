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

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

VOICES_DIR = Path(__file__).parent / "voices"
REFERENCE_PATH = VOICES_DIR / "referencia.wav"
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"

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

app = FastAPI(title="JARVIS — voz clonada local")

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


@app.get("/health")
def saude() -> dict:
    return {
        "ok": True,
        "modelo_carregado": _tts_model is not None,
        "voz_configurada": REFERENCE_PATH.exists(),
    }


@app.get("/vozes")
def vozes_prontas() -> dict:
    """
    As vozes do próprio modelo, sem clonagem nenhuma.

    A lista é a verdadeira, a que o modelo carregado trouxer — mais de 40,
    no XTTS-v2 — com a descrição de `VOZES_PRONTAS` para as que já se
    ouviram, e uma genérica para as restantes. Antes do modelo carregar
    (ou nos testes sem GPU), cai-se só para a pequena curadoria.
    """
    nomes = _vozes_disponiveis if _vozes_disponiveis is not None else list(VOZES_PRONTAS)
    return {"vozes": {nome: VOZES_PRONTAS.get(nome, "Voz do modelo XTTS-v2") for nome in nomes}}


@app.post("/voz")
async def gravar_voz(ficheiro: UploadFile) -> dict:
    """
    Recebe a amostra de voz e guarda-a como referência.

    Substitui o que estiver lá — só há uma voz de propósito, a de quem grava.
    """
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    conteudo = await ficheiro.read()

    if len(conteudo) < 1000:
        raise HTTPException(400, "O ficheiro parece vazio ou vazio de mais para ser uma gravação.")

    REFERENCE_PATH.write_bytes(conteudo)
    return {"ok": True, "bytes": len(conteudo)}


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
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        caminho_temp = tmp.name

    try:
        _tts_model.tts_to_file(file_path=caminho_temp, **kwargs)
        audio_bytes = Path(caminho_temp).read_bytes()
    finally:
        Path(caminho_temp).unlink(missing_ok=True)

    return Response(content=audio_bytes, media_type="audio/wav")
