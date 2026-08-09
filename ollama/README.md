# Modelo local com as convenções do projeto

Para o Ollama, a correr no teu PC, já saber as regras deste projeto
(`docs/estilo-de-codigo.md`) sem precisares de as colar todas as vezes.

## Criar

```powershell
cd ollama
ollama create jarvis-dev -f Modelfile
```

A primeira linha do `Modelfile` (`FROM qwen2.5-coder:latest`) escolhe o
modelo base — troca-a por um que já tenhas (`ollama list` mostra o que
está instalado). Um modelo de código costuma dar melhor resultado do que
um generalista.

## Usar

```powershell
ollama run jarvis-dev
```

Ou aponta uma ferramenta que já uses (a extensão **Continue** no VS Code,
por exemplo) para o modelo `jarvis-dev` em vez do modelo base — a
diferença é só que este já vem com o prompt de sistema deste projeto.

## Manter atualizado

O `Modelfile` **não lê** `docs/estilo-de-codigo.md` sozinho — o formato do
Ollama não suporta incluir outro ficheiro dentro do `SYSTEM`. Se uma regra
mudar num, muda no outro à mão, e recria o modelo:

```powershell
ollama create jarvis-dev -f Modelfile
```

(Substitui o anterior com o mesmo nome — não acumula versões.)
