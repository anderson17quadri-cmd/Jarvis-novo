# Fase 3 — Controlo direto (teclado, rato, visão de ecrã, presença)

> Este documento não faz parte da spec original (`jarvis-spec-completo.md`,
> Partes 1–17) — é uma extensão pedida depois, com um objetivo diferente dos
> outros: não "mais uma janela do sistema", mas o JARVIS a operar o computador
> como uma pessoa operaria, com a mão no rato e no teclado.
>
> **Estado: só desenho. Nenhuma linha de código nativo escrita.** Depende de
> dois pré-requisitos que ainda não se cumpriram — ver §0.
>
> **Princípio único, do qual tudo o resto deriva:** um agente com controlo do
> rato e do teclado tem, na prática, o mesmo alcance que a pessoa sentada à
> frente do PC. Não há capability do Tauri que limite isso — quem controla o
> cursor controla qualquer programa que esse cursor consiga abrir. Por isso a
> segurança deste sistema não pode viver numa lista de comandos permitidos
> (essa lista, aqui, é "tudo"): tem de viver em **como e quando** a ação
> acontece — sempre visível, sempre confirmável, sempre com um travão de mão
> que funciona mesmo se o resto falhar.

---

## 0. Pré-requisitos, sem exceção

1. **Fase 1 validada no PC real.** Combinado desde o início do projeto: sem
   comandos Rust novos até isso acontecer — e este é, de longe, o maior
   conjunto de comandos Rust novos alguma vez proposto aqui. Construir por
   cima de uma base ainda não confirmada só torna mais difícil saber, quando
   algo correr mal, se a culpa é do alicerce ou do andar novo.
2. **Ativação explícita, por fora do código.** Mesmo depois de escrito, o
   controlo direto começa **desligado**. Uma pessoa tem de ir à janela de
   Privacidade e ligá-lo deliberadamente — a mesma filosofia das permissões de
   plugin (Parte 14): declaradas, visíveis, recusáveis, e a decisão persiste.

Nenhuma secção abaixo é implementada enquanto o §0 não estiver cumprido.

---

## 1. As quatro camadas

```
┌─────────────────────────────────────────────────────────┐
│  PRESENÇA        há alguém à frente do ecrã?             │
│  (webcam)         → sem isto, nada corre                 │
├─────────────────────────────────────────────────────────┤
│  PERCEÇÃO        o que está no ecrã agora?                │
│  (captura)        → efémera, indicador sempre visível     │
├─────────────────────────────────────────────────────────┤
│  AÇÃO            mover, clicar, escrever                  │
│  (rato/teclado)   → um passo de cada vez, confirmado       │
├─────────────────────────────────────────────────────────┤
│  AUDITORIA       o que é que ele fez, exatamente           │
│  (registo)        → cada passo, sempre, sem exceção         │
└─────────────────────────────────────────────────────────┘
```

Cada camada é independente e testável sozinha. Nenhuma é decorativa — se uma
falhar ou estiver desligada, a camada acima também não corre.

### 1.1 Presença (câmara)

**O que é.** Deteção simples de "há uma pessoa à frente do ecrã", por um
modelo leve a correr **localmente, na máquina** — nunca um vídeo enviado para
fora. Não é reconhecimento facial, não sabe quem és, só que há alguém.

**O que isto não é — e tem de ficar dito por escrito na própria interface,
não só aqui.** Presença não é autenticação. Um convidado, um filho, alguém
que pegou no portátil destrancado — todos passam neste teste. O que a
presença resolve é outro problema, real mas diferente: impede o JARVIS de
agir **sem ninguém a ver**, o que fecha a janela de "ele fez uma coisa
enquanto eu não estava a olhar e só reparei depois". Quem quiser autenticação
a sério continua a precisar do bloqueio por inatividade que já existe (Parte
14) e, no nativo, de algo como Windows Hello — isso é outro pré-requisito
⬜ já registado no `SPEC.md`, não este.

**Regras:**
- Indicador visível sempre que a câmara está ativa — um ícone no header, sem
  exceção, sem modo silencioso.
- Se a presença desaparecer a meio de uma tarefa, a tarefa **pausa**, não
  cancela — retoma com uma confirmação nova quando a presença voltar.
- A câmara só liga durante uma tarefa de controlo direto. Fora disso, está
  desligada — não é vigilância contínua.

### 1.2 Perceção (captura de ecrã)

**O que é.** Um print do ecrã, tirado no momento em que o JARVIS precisa de
decidir onde clicar, mandado a um modelo com visão para o interpretar.

**O custo, dito sem rodeios.** Isto sai da máquina. Um modelo de visão hoje
significa uma chamada de rede a um provedor (a DeepSeek atual só faz texto —
ligar isto exige um provider multimodal, decisão em aberto, ver §5). Tudo o
que estiver visível no ecrã nesse instante — senhas, conversas, saldos —
viaja com o print. Não há forma de eliminar este custo por completo enquanto
a interpretação depender de um modelo remoto; só de o reduzir:

- **Zonas sensíveis marcáveis.** Nas configurações, o utilizador desenha
  retângulos do ecrã (a barra de senhas do browser, uma app de banco) que
  ficam sempre tapados antes de qualquer print sair da máquina.
- **Nunca guardado por omissão.** O print vive em memória o tempo da decisão
  e desaparece — não entra em disco, não entra no backup (Parte 14 já exclui
  a chave da API das cópias pela mesma lógica).
- **Indicador permanente enquanto ativo** — uma borda visível à volta do
  ecrã, não um ícone escondido numa barra.
- **Consentimento por sessão**, não por sempre: a primeira vez que o
  controlo direto corre depois de reiniciar o JARVIS, pede confirmação
  explícita antes do primeiro print.

### 1.3 Ação (rato e teclado)

**A regra central: um passo, uma confirmação.** Nunca "edita a imagem" como
um só comando que corre sozinho do início ao fim. Cada passo pequeno — mover
para aqui, clicar, escrever isto — aparece descrito em português simples,
com o alvo destacado por cima do print do ecrã, e só corre depois de
confirmares. É o mesmo padrão que os comandos de voz críticos já usam
(Parte 10): a confirmação é a interface, não um alerta que se ignora.

**Classificação de risco**, porque nem tudo pesa o mesmo:
- **Reversível** (mover o rato, abrir um menu, mudar de separador) — pode
  agrupar-se numa confirmação por tarefa inteira, se pedires isso.
- **Irreversível** (enviar, apagar, comprar, submeter um formulário com
  dados) — confirmação individual, sempre, nunca em lote, nunca dispensável.

**O travão de mão, ao nível mais baixo possível:**
- Uma tecla global (configurável, por omissão duas vezes em `Esc`) para tudo,
  imediatamente, implementada de forma a não depender do resto da aplicação
  estar a responder.
- **Tocar no rato ou no teclado com a tua própria mão interrompe o que
  estiver a correr**, sem precisar de carregar em nada — o mesmo princípio
  de um piloto automático de carro: a mão humana no volante sobrepõe-se
  sempre, sem negociação.

### 1.4 Auditoria

Cada passo — não cada tarefa, cada **passo** — entra no `logService.audit()`
que já existe (Parte 14): hora, o que foi clicado ou escrito, e, se
ativado, o print do momento. Uma aba dedicada (Centro de Programador ou
Privacidade) mostra isto como uma lista reproduzível: "14:32 abriu o
Photoshop · 14:33 clicou em Ficheiro → Abrir · 14:33 escreveu
'foto-praia.jpg'". Sem isto, nada das outras três camadas é verificável
depois — é a camada que transforma "confia em mim" em "vê tu mesmo".

---

## 2. Um pedido, passo a passo

> "Abre o Photoshop e roda esta imagem 90 graus."

1. **Presença.** Confirma câmara ligada e alguém à frente. Sem isto, pára
   aqui, com um aviso.
2. **Plano em português**, mostrado antes de qualquer clique: "1. Abrir
   Photoshop · 2. Abrir o ficheiro X · 3. Rodar 90° · 4. Guardar". Aceitas o
   plano inteiro ou passo a passo — escolha tua, guardada como preferência.
3. **Perceção.** Print do ecrã atual, zonas sensíveis tapadas, mandado ao
   modelo de visão para localizar o alvo do próximo passo.
4. **Ação.** O alvo aparece destacado por cima do print ("vou clicar aqui").
   Confirmas. Só então o clique ou a escrita acontece a sério.
5. **Auditoria.** Cada passo destes fica registado, com timestamp, antes de
   passar ao seguinte.
6. Repete 3–5 até ao fim do plano. "Guardar" é passo irreversível — pede
   confirmação própria, mesmo que tenhas aceitado o resto em bloco.

Se em qualquer ponto a presença falhar, tocares no rato, ou carregares no
travão de mão: pára onde está, sem terminar o passo a meio.

---

## 3. Limites explícitos — o que isto continua a não ser

- **Não corre em segundo plano.** Mesma regra das automações: só enquanto o
  JARVIS estiver aberto e visível.
- **Não guarda vídeo de câmara nem prints em disco por omissão.** Efémero por
  definição, não por configuração esquecida.
- **Não é reconhecimento de identidade.** É presença. Ver §1.1.
- **Não abre uma shell.** As ações são cliques e teclas simuladas ao nível do
  sistema operativo — nunca um comando de texto interpretado livremente. A
  regra de segurança mais antiga do projeto continua inteira: a interface
  nunca corre comandos arbitrários.
- **Não corre sem a capability ligada de propósito** na Privacidade, desligada
  por omissão.

---

## 4. Plano técnico (para quando o §0 estiver cumprido)

Mantém a regra de ouro do projeto: `Componente → Hook → Service →
PlatformAdapter → invoke() → Rust`. Nenhum componente passa a conhecer o
sistema operativo diretamente — só o `PlatformAdapter`.

**Serviço novo:** `services/direct-control-service.ts` — dono do plano,
passo atual, e do pedido de confirmação. Não sabe o que é `enigo` nem o que é
uma câmara; só fala com o `PlatformAdapter`.

**Comandos Rust novos** (`src-tauri/src/commands/control.rs`), cada um
`Result`-based, cada um validado antes de agir (coordenadas dentro dos
limites do ecrã, texto sanitizado, nunca `unwrap()`):

| Comando | Faz |
|---|---|
| `check_presence` | Uma leitura da câmara, devolve só um booleano — nunca a imagem |
| `capture_screen` | Um print, devolvido para a camada de perceção decidir, nunca escrito em disco |
| `move_mouse_to` / `click_at` | Coordenadas explícitas, dentro dos limites do ecrã |
| `type_text` | Texto explícito, nunca interpretado como comando |
| `open_path` | Abre um ficheiro ou aplicação pelo caminho, via o abridor do próprio sistema operativo — não é execução arbitrária, é o equivalente a um duplo-clique |

**Candidatos a crate** (a confirmar quando chegar a altura, não fixados
agora): `enigo` para rato e teclado, `xcap` para captura de ecrã, `nokhwa`
para a câmara. Todos cross-platform, todos com precedente em ferramentas de
automação estabelecidas — não inventar isto de raiz.

**Modelo de visão:** a abstração `AiProvider` já existe e já suporta troca de
provedor numa linha (é assim que a DeepSeek entrou). Falta um provider que
aceite imagens — a API atual da DeepSeek é só texto. Decisão em aberto, ver
§5.

**Capability Tauri nova**, dedicada, mínima, desligada por omissão —
`controlo-direto` — só concede o que as camadas acima realmente usam, pela
mesma disciplina de menor privilégio que as capabilities existentes já
seguem.

---

## 5. Faseamento — não entra tudo de uma vez

| Sub-fase | O quê | Precisa de nativo? |
|---|:--:|:--:|
| 3.1 | Auditoria + overlay de confirmação, com ações simuladas | Não — testável já, em browser |
| 3.2 | Abrir aplicações e ficheiros por caminho | Sim, mas é o comando de menor risco |
| 3.3 | Captura de ecrã, indicador visível, zonas sensíveis | Sim |
| 3.4 | Rato e teclado, com o travão de mão e a confirmação por passo | Sim |
| 3.5 | Presença por câmara como camada extra | Sim |
| 3.6 | Modelo de visão a interpretar o ecrã e propor os passos | Sim + provider multimodal |

3.1 é a única que não depende de nada nativo — dá para construir o
overlay de confirmação, a classificação de risco e a auditoria já, com
ações de teste, e ter a experiência toda pronta e testada antes de ligar a
primeira ação real.

---

## 6. Decisões que ainda faltam, e que não são minhas para tomar sozinho

1. **Visão local ou na nuvem.** Local é mais privado e mais fraco; na nuvem é
   mais capaz e manda o ecrã para fora. Pergunto quando chegar a 3.6.
2. **Retenção do registo de auditoria com prints** — quanto tempo fica
   guardado, se é para ficar.
3. **A tecla do travão de mão** — a omissão proposta é `Esc` duas vezes;
   pode ser outra.

Estas ficam para quando cada sub-fase começar a sério, não antes.
