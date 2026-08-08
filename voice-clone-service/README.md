# Voz clonada local

Serviço à parte do JARVIS — a mesma relação que o Ollama já tem com a app:
corre no teu PC, o JARVIS fala com ele por HTTP no `localhost`, nada sai da
máquina. Ver o desenho completo em
[`docs/spec/voz-clonada-local.md`](../docs/spec/voz-clonada-local.md).

**Ainda não testado numa GPU a sério** — escrito com cuidado a partir da API
documentada do `coqui-tts`, mas sem uma RTX 5070 à mão para confirmar. Os
passos abaixo dizem o que fazer se algo não bater certo.

## 1. Python

Precisas de Python 3.10, 3.11 ou 3.12 — o `coqui-tts` ainda não costuma
suportar a versão mais recente do Python no dia em que ela sai. Confirma a
tua versão:
```powershell
python --version
```

## 2. Um ambiente virtual, para não misturar com outra coisa

```powershell
cd voice-clone-service
python -m venv .venv
.venv\Scripts\activate
```

## 3. PyTorch com CUDA — a parte que precisa de atenção

**Não uses `pip install torch` sozinho** — isso costuma trazer a versão sem
GPU. A RTX 5070 usa a arquitetura Blackwell, que precisa de uma versão do
PyTorch recente o suficiente para a suportar; qual exatamente, muda com
frequência a mais para fixar aqui um número que não fique desatualizado.

Vai a **pytorch.org** → "Get Started" → escolhe *Stable*, *Windows*, *Pip*,
*Python*, e a versão do **CUDA** mais recente que aparecer na lista. O site
dá-te o comando exato a copiar — algo como:
```powershell
pip install torch --index-url https://download.pytorch.org/whl/cu126
```
(o número depois de `cu` é que muda; usa o que o site te disser)

**Confirma que a GPU foi encontrada** antes de continuares:
```powershell
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```
Tem de imprimir `True` e o nome da tua placa. Se disser `False`, o problema
está aqui, antes de tocares em mais nada — normalmente é a versão do CUDA
que não bate certo com a que o PyTorch instalado espera.

## 4. O resto das dependências

```powershell
pip install -r requirements.txt
```

A primeira vez que o serviço arrancar, o modelo XTTS-v2 é descarregado
sozinho (mais de 1 GB) — demora, só acontece uma vez.

## 5. Gravar a tua voz

Grava-te uns segundos a falar (o telemóvel serve, exporta como `.wav`) e
guarda o ficheiro como `voices/referencia.wav` nesta pasta. Mais amostra
costuma dar melhor resultado, mas não há um número exato — testa e ajusta.

## 6. Arrancar

```powershell
uvicorn server:app --host 127.0.0.1 --port 8090
```

## 7. Testar por terminal, sem abrir o JARVIS

```powershell
curl http://127.0.0.1:8090/health

curl -X POST http://127.0.0.1:8090/falar `
  -H "Content-Type: application/json" `
  -d '{\"texto\": \"Boa tarde. Isto sou eu, a falar através do JARVIS.\"}' `
  --output teste.wav
```

Se `teste.wav` tocar com a tua voz, está a funcionar — o próximo passo é
ligar isto ao `voice-service.ts` da app (sub-fase 4.3 do desenho).

## Se algo correr mal

- **`torch.cuda.is_available()` diz `False`** — a versão do PyTorch não bate
  com o CUDA instalado. Volta ao passo 3.
- **O modelo não descarrega** — precisa de espaço em disco (mais de 2 GB) e
  de internet na primeira vez.
- **A voz sai distorcida ou nada parecida** — a amostra em
  `voices/referencia.wav` pode ter ruído a mais, ou ser curta de mais.
  Regrava num sítio silencioso.
