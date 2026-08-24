# Auditoria completa — 20/08/2026

Varrimento de todo o código a pedido do utilizador ("ve oque esta errado ate
acabar a sessão"). Cada achado fica aqui à medida que aparece, com ficheiro,
linha, o que está errado e como se prova. **Nada aqui é corrigido sem antes um
teste que falhe sem a correção.**

Legenda de gravidade:
- **ALTO** — segurança, privacidade, perda de dados, ou falha silenciosa
- **MÉDIO** — comportamento errado que a pessoa nota
- **BAIXO** — código morto, comentário que mente, fragilidade latente

---

## Estado do varrimento

| Área | Linhas | Estado |
|---|---|---|
| src-tauri/ (Rust) | 3900 | ✅ lido ficheiro a ficheiro (19/08) |
| src/plugins/ | 2537 | ✅ lido (19/08) |
| src/platform/ | 1736 | ✅ lido (19/08) |
| src/widgets/ | 1563 | ✅ revisto (item 15, 20/08) |
| src/services/ | 10940 | 🔄 em curso |
| src/stores/ | 3570 | ⬜ |
| src/hooks/ | 2021 | ⬜ |
| src/apps/ | 10442 | ⬜ |
| src/components/ | 6569 | ⬜ |
| src/types/ | 3020 | ⬜ |
| restantes (data, lib, config, design-system, automation, mcp) | ~1100 | ⬜ |

---

## Achados

### A1 — `confirmTool` confia inteiramente em quem chama — **MÉDIO**

`src/services/ai-service.ts:550`

```ts
async confirmTool(call: ToolCall): Promise<void> {
  const outcome = await runTool(call, true);   // `true` = já confirmado
  ...
}
```

Recebe um `ToolCall` qualquer e corre-o com o sinalizador de "já confirmado"
ligado, **sem verificar que esse pedido alguma vez esteve na lista de
pendentes**. Hoje é seguro porque só o `AssistantWindow.tsx:220` lhe chama, e
sempre com uma entrada real da lista. Mas é exatamente o padrão que já deu um
bug real neste projeto: o `directControlService.executeStep` dependia de quem
chamava se lembrar de verificar a sessão, e foi corrigido em 13/08 movendo a
verificação para dentro da função ("a fronteira vive na função, não em quem
chama", `docs/estilo-de-codigo.md`).

O comentário por cima do método diz "Só a interface chama isto, e só depois de
a pessoa ter dito que sim" — uma promessa que o código não impõe. Um caminho
novo (um plugin, uma automação, um atalho de voz) que chame `confirmTool`
diretamente executa uma ferramenta destrutiva sem confirmação nenhuma, e nada
o impede.

**Correção proposta**: o serviço guarda as confirmações que emitiu e
`confirmTool` recusa um `call.id` que não esteja lá (consumindo-o ao usar, para
não servir duas vezes).

### A2 — Automações por intervalo disparam outra vez a cada arranque da app — **MÉDIO**

`src/services/automation-service.ts:59-66, 356-369, 296-308`

O motor guarda as marcas do último disparo num `Map` **só em memória**:

```ts
private readonly lastFired = new Map<string, number>();
```

e o `hydrate()` repõe `automations` e `runs` do disco, mas **nunca repõe o
`lastFired`**. Consequência, num gatilho `intervalo`:

```ts
if (trigger.kind === 'intervalo') {
  return !this.firedRecently(automation.id, trigger.everyMinutes * 60_000);
}
```

No primeiro `tick()` depois de `start()` — que corre logo, de propósito — o
`lastFired.get(id)` é `undefined`, o `firedRecently` devolve `false`, e a
automação **dispara**. Uma regra "de 6 em 6 horas" corre a cada abertura do
JARVIS: abrir e fechar a app cinco vezes numa hora dispara-a cinco vezes.

O mais irónico é que a informação para o resolver **já está guardada**: o
`record()` escreve `lastRunAt` na automação sempre que uma execução corre bem,
e isso é persistido e reposto pelo `hydrate`. O `firedRecently` é que não olha
para lá.

Afeta também `hora`, embora bem menos: reiniciar dentro do mesmo minuto do
gatilho volta a disparar (a janela de 90s também vive só no `lastFired`).

**Correção proposta**: `firedRecently` cai para o `lastRunAt` persistido quando
não há marca em memória.

### A3 — "Mostra os widgets" **escondia** os widgets todos — **MÉDIO** ✅ CORRIGIDO

`src/services/voice/intents.ts:289` (antes da correção)

```ts
// "Mostra os widgets" sem nome nenhum: é o inverso de os esconder.
if (/widgets\b/.test(text)) return { kind: 'esconder-widgets' };
```

O comentário diz "é o inverso de os esconder" e o código devolve exatamente o
esconder. Não havia intenção nenhuma para *mostrar* os widgets todos — só a de
esconder. Dizer **"mostra os widgets"** percorria:

1. `text.includes('widget')` → entra no bloco;
2. não começa por verbo de esconder → não é o primeiro `return`;
3. `matchWidget` não encontra nenhum widget nomeado → `null`;
4. cai na linha 289 → **`esconder-widgets`** → `executor.hideAllWidgets()`.

Os widgets desapareciam todos. **Sem confirmação**, porque `esconder-widgets`
não está no conjunto `CRITICAL` (só lá estão `fechar-janelas` e
`reiniciar-interface`).

**Corrigido**: intenção nova `mostrar-widgets`, e o bloco passa a decidir pelo
verbo — só esconde se a frase começar por um `HIDE_VERBS`. O `showAllWidgets`
do `App.tsx` mostra um a um pelo `store.show`, e não pondo `isVisible` a `true`
em bloco, porque é o `show` que resolve colisões de posição na grelha.

Teste em `tests/voice/intents.test.ts`, confirmado a falhar com o bug reposto e
a passar com a correção.

### A4 — Apagar na interface nunca pede confirmação — **BAIXO** (observação, não bug)

`AutomationsWindow.tsx:261`, `HistoryPanel.tsx:268`, `ThemeEditor.tsx`,
`LayoutSettings.tsx`, `TasksWindow.tsx`

**Nenhum** botão de apagar da interface pede confirmação: apagar uma automação
que se construiu (gatilho, condições, ações), esquecer a memória toda do
assistente, apagar um tema personalizado ou um layout guardado — tudo à
distância de um clique, sem desfazer.

**Porque é que fica como observação e não como bug**: a spec exige confirmação
para ações críticas (Parte 10, linha 530) no contexto do **assistente** a
executar — e isso está cumprido nos dois sítios onde se aplica (`CRITICAL` nas
intenções de voz, `risk: 'perde'` no catálogo de ferramentas). Um clique
deliberado da pessoa num botão de lixo é, ele próprio, a intenção. É
consistente em toda a interface — nenhum apaga confirma — por isso é uma
decisão de desenho, não um esquecimento.

Fica registado porque a assimetria é curiosa: o assistente **tem** de pedir
confirmação para `esquecer_memoria`, e o botão "Esquecer tudo" ao lado faz o
mesmo sem perguntar nada.

