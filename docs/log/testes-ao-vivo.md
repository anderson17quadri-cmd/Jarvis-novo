# Testes ao vivo — as 8 por confirmar (14/08/2026)

> **Porque existe este ficheiro.** A 14/08/2026 o assistente estava
> completamente mudo na máquina do utilizador enquanto a suite de testes
> dava 1734 verdes. A causa (voz clonada a falhar em silêncio com o
> serviço local desligado) era invisível a qualquer teste, porque todos
> simulam o `fetch` a responder. Lição: **um teste verde não prova que a
> funcionalidade serve para alguma coisa**. O `SPEC.md` marca 17
> funcionalidades como "confirmado ao vivo" e 8 como "não confirmado ao
> vivo" — estas 8 são o sítio onde os próximos bugs reais estão.
>
> Cada linha abaixo fecha-se com o utilizador à frente da app, não com
> um teste. O resultado — funcionou, ou o que falhou exatamente — entra
> aqui e no `docs/log/historico-sessoes.md`.

## Pré-requisito para tudo

A app tem de estar a correr **com o código mais recente**:

```
git pull origin claude/jarvis-ai-os-tauri-mvp-xa5km0
npm run tauri dev
```

## 1. Voz — `[a testar]`

Duas partes, porque há uma correção nova a validar (commit `3a78c2e`) e
a funcionalidade em si.

**1a. A queda para a voz do sistema** (a correção). Com o
`voice-clone-service` **desligado**, pede qualquer coisa ao assistente.
- Esperado: ouve-se a voz normal do Windows **e** aparece uma
  notificação a dizer que a voz clonada não está disponível.
- Se continuar mudo: a correção não chegou (falta `git pull`/reiniciar),
  ou há outra causa por baixo — anotar aqui exatamente o que aconteceu.

**1b. A voz clonada** (a funcionalidade). Noutro terminal:

```
cd voice-clone-service
.\run.ps1
```

Deixar a correr. Pedir outra coisa ao assistente.
- Esperado: a voz clonada (XTTS-v2, "Alison Dietlinde" ou a escolhida em
  Personalização → Voz), e **sem** a notificação de aviso.

## 2. Pesquisa na web (Peça 18) — `[a testar]`

Precisa de uma chave gratuita do Brave Search
(https://brave.com/search/api/, plano gratuito, 2000 pesquisas/mês),
colada em Personalização → Pesquisa web.
- Pedir ao assistente algo que o obrigue a pesquisar ("procura na web o
  que saiu hoje sobre X").
- Esperado: resultados reais (título, resumo, endereço), não a
  simulação. A resposta deve dizer que veio de uma pesquisa a sério.
- Sem chave: cai na simulação de propósito — isso não é falha, mas
  também não confirma nada.

## 3. Navegador do assistente (Peça 19) — `[a testar]`

**Desligado por omissão.** Ligar em Privacidade → Acesso (há um aviso a
explicar porquê).
- Pedir: "abre https://exemplo.pt e diz-me o que lá está".
- Esperado: o texto real da página, marcado como conteúdo externo.
- Testar também a defesa que foi corrigida: pedir para abrir
  `https://localhost/` ou `https://192.168.1.1/` — **tem de recusar**.

## 4. Vault Obsidian (Peça 17) — `[a testar]`

Escolher a pasta do vault em Personalização → Obsidian.
- Pedir: "procura a nota X", "lê a nota X", "guarda uma nota com Y".
- Esperado: lê e escreve mesmo no disco; a escrita pede confirmação
  (substituir apaga o que lá estava).
- Confirmar no Obsidian que a nota apareceu/mudou a sério.

## 5. Ferramentas do Claude no orquestrador (Peça 20) — `[a testar]`

Precisa de uma chave da Anthropic em Personalização → Assistente, com o
Claude escolhido como provedor.
- Pedir algo que exija uma ferramenta ("abre a janela de tarefas",
  "cria uma tarefa X").
- Esperado: a ferramenta corre mesmo — não uma resposta a dizer que o
  faria.

## 6. Chave física / WebAuthn — `[a testar]`

Só com uma chave física a sério (YubiKey ou equivalente), ou o Windows
Hello via WebAuthn. Registar em Privacidade → Acesso, depois usar no
login.

## 7. Notificações nativas — `[a testar]`

Confirmar que uma notificação do assistente aparece como notificação
**do Windows** (fora da janela da app), não só como aviso interno.

## 8. Terminal e Explorador, as partes que faltaram — `[a testar]`

- Terminal: fechar a janela mata mesmo o processo (confirmar no Gestor
  de Tarefas que não fica `powershell.exe` órfão).
- Explorador: escolher uma pasta real, fechar a app, reabrir —
  a pasta deve reabrir sozinha.

## Resultados

_(preencher à medida que se confirma cada uma)_
