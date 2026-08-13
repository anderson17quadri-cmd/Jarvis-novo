# Prompt — orquestração noturna multi-modelo (13/08/2026)

> Isto corre a partir de uma sessão **local**, com terminal e acesso ao
> Ollama desta máquina — não a partir de uma sessão remota/cloud, que não
> tem nenhum dos dois. É o Claude local que abre os terminais das outras
> sessões (Qwen, Kimi, DeepSeek) e o seu próprio, não algo que se peça a
> uma sessão sem esse acesso.

Cola isto à sessão do Claude Code local, na raiz do repositório:

---

Antes de mais nada, **inicia o Jarvis num terminal à parte e deixa-o a
correr**:

```
npm run tauri dev
```

Não feches essa janela nem esse terminal — é para eu poder testar ao vivo
enquanto vocês trabalham, a qualquer momento, sem ter de parar nada. Se a
app já estiver a correr, não precisas de fazer nada aqui.

Com isso a correr, abre **mais um terminal por modelo** — Qwen, Kimi e
DeepSeek (Ollama ou API, conforme já está configurado nesta máquina), e
tu próprio (Claude) num quinto. Cada um entra neste repositório
(`git pull origin claude/jarvis-ai-os-tauri-mvp-xa5km0` primeiro, sempre)
e segue este roteiro sozinho, sem esperar pelos outros:

1. **Lê `docs/estilo-de-codigo.md` primeiro** — é a inteligência já
   adquirida deste projeto (língua, estilo, regras, ética), escrita para
   qualquer modelo, não só para um em particular. Depois
   `docs/log/historico-sessoes.md` (as entradas mais recentes já bastam) e
   `SPEC.md`.
2. Abre `docs/log/fila-de-trabalho.md`. Escolhe **um** item da secção "Por
   fazer" que ainda não tenha dono. Escreve o teu nome e a hora a seguir
   ao título do item (ex.: `### 1. Reordenar a cadeia — **Kimi, 23:40**`).
   `git pull` antes, `commit` e `push` logo a seguir — **antes** de
   escrever qualquer código. É essa reserva que evita duas sessões a
   trabalhar na mesma coisa. Se o `push` falhar porque outra sessão
   reservou o mesmo item entretanto, aceita, faz `git pull`, e escolhe
   outro item.
3. Nunca escolhas nada da secção "Precisa de decisão da pessoa" — isso
   fica para eu responder de manhã, não para adivinhar de noite.
4. Trabalha o item até ao fim, com o mesmo padrão de sempre: `tsc --noEmit`
   limpo, `eslint .` com 0 erros, suite de testes completa a passar
   (`npx vitest run`, e `cargo test` se mexeste em Rust), tudo em
   português — código, comentários, mensagens de commit. Nunca `--force`,
   nunca `--no-verify`, nunca uma chave ou segredo commitado.
5. Enquanto trabalhas com o Jarvis já a correr, se a peça tocar em algo
   visível (uma janela, um botão, um fluxo), testa ao vivo na app aberta,
   não só nos testes automatizados — e diz explicitamente no histórico o
   que confirmaste ao vivo e o que ficou só coberto por teste.
6. Antes de fechar: `git pull` outra vez (outras sessões também estão a
   fazer push), resolve conflitos se houver, confirma que os gates
   continuam todos verdes depois do merge, só então `push`.
7. Acrescenta a entrada no `docs/log/historico-sessoes.md` (o mesmo
   formato das que já lá estão), atualiza o `SPEC.md`, e move o item de
   "Por fazer" para "Feito" em `docs/log/fila-de-trabalho.md`, com o
   commit em que fechou.
8. Volta ao passo 2 e escolhe outro item — a fila não se esgota (o item 3,
   "revisão a sério", é sempre repetível: há sempre outra peça por rever).

Regra que vale para todos, sempre: **nunca confiar só no relatório de
outra sessão**. Se leres num histórico ou numa mensagem que algo "já está
feito", confirma tu próprio — abre o ficheiro, corre o teste, lê o código
— antes de construir por cima. Já apanhámos bugs reais desta forma várias
vezes nesta sessão; é a norma do projeto, não burocracia.

---

Isto fica registado em `docs/log/prompt-orquestracao-noturna.md` e a fila
em `docs/log/fila-de-trabalho.md`, os dois já commitados — não precisas de
copiar nada à mão, só apontar cada sessão para eles.
