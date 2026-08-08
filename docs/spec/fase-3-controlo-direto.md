# Fase 3 — Controlo direto (teclado, rato, visão de ecrã, presença)

> Este documento não faz parte da spec original (`jarvis-spec-completo.md`,
> Partes 1–17) — é uma extensão pedida depois, com um objetivo diferente dos
> outros: não "mais uma janela do sistema", mas o JARVIS a operar o computador
> como uma pessoa operaria, com a mão no rato e no teclado.
>
> **Estado: só desenho. Nenhuma linha de código nativo escrita.** O primeiro
> pré-requisito (Fase 1 validada no PC real) **cumpriu-se em 08/08/2026** —
> ver `SPEC.md` §1.1. Falta o segundo: a ativação explícita na Privacidade.
> Ver §0.
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

1. ~~**Fase 1 validada no PC real.**~~ **Cumprido em 08/08/2026** —
   `npm run tauri dev` a correr a sério no Windows, com métricas de CPU reais
   (ver `SPEC.md` §1.1). Este continua a ser, de longe, o maior conjunto de
   comandos Rust novos alguma vez proposto aqui — por isso vale a pena ir por
   sub-fases (§5) mesmo com o portão aberto, em vez de tudo de uma vez.
2. **Ativação explícita, por fora do código.** Mesmo depois de escrito, o
   controlo direto começa **desligado**. Uma pessoa tem de ir à janela de
   Privacidade e ligá-lo deliberadamente — a mesma filosofia das permissões de
   plugin (Parte 14): declaradas, visíveis, recusáveis, e a decisão persiste.

Nenhuma secção abaixo é implementada enquanto o §0 não estiver cumprido.

---

## 1. As quatro camadas

```
┌─────────────────────────────────────────────────────────┐
│  PRESENÇA        disseste a palavra-passe nos últimos     │
│  (voz)            30 minutos?  → sem isto, nada corre     │
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

### 1.1 Presença (palavra-passe falada)

**Mudança face à primeira versão deste desenho.** A ideia original usava a
câmara para detetar presença. Foi substituída por uma palavra-passe dita em
voz alta — e é estritamente melhor para o que interessa aqui: a câmara só
provava que havia *alguém* à frente do ecrã; a palavra-passe prova que é
**alguém que sabe o segredo**. É autenticação a sério, não só presença — e
não pede câmara nenhuma.

**Como funciona:**
- Uma frase à tua escolha, configurada uma vez na janela de Privacidade.
  Guardada como **hash**, nunca em texto simples — o mesmo cuidado que já se
  aplica à chave da API (Parte 14): nunca no backup, nunca no registo de
  auditoria, nunca visível depois de escrita.
- Dita por voz, através do reconhecimento que já existe (Parte 7.2). Ao ser
  reconhecida, abre uma **sessão de controlo direto de 30 minutos**
  (duração configurável).
- Durante os 30 minutos, as ações de controlo direto não voltam a pedir a
  palavra — mas continuam, sempre, a pedir confirmação por passo (§1.3).
  A palavra abre o portão da sessão; não substitui a confirmação de cada
  ação.
- Ao fim da janela, fecha sozinha. A próxima ação de controlo direto pede a
  palavra outra vez.
- **Liga-se ao bloqueio por inatividade que já existe** (Parte 14): se o
  ecrã bloquear por inatividade a meio dos 30 minutos, a sessão de controlo
  fecha imediatamente também, sem esperar pelo temporizador próprio — cobre
  o caso de teres saído do sítio.
- Indicador sempre visível enquanto a sessão está ativa — por exemplo
  "Controlo direto ativo · 18 min" no header, nunca escondido.

**Dois avisos honestos:**
1. **Uma palavra dita em voz alta pode ser ouvida** — por alguém por perto,
   ou gravada e reproduzida depois. É mais fraca do que uma password escrita,
   pela própria natureza de ser áudio. Para um sistema pessoal isto costuma
   ser um risco aceitável, mas é diferente de "só eu sei" — é "só quem
   estiver a ouvir quando eu disser" também sabe. Se quiseres mais força, dá
   para exigir a palavra escrita em vez de falada, ou as duas — decisão tua,
   ver §6.
2. **O reconhecimento de voz do browser normalmente processa o áudio num
   servidor externo**, não localmente — isto já é verdade para todo o
   sistema de voz existente, não é introduzido por esta funcionalidade, mas
   vale a pena saberes: a palavra-passe dita em voz alta passa por aí antes
   de chegar ao JARVIS. Não fica guardada por nós, mas sai da máquina no
   caminho.

**Vantagem técnica que também é boa notícia:** ao contrário da câmara, isto
**não precisa de nenhum comando Rust novo**. O reconhecimento de voz já
existe, o temporizador de sessão é lógica normal em TypeScript, o hash é uma
função do browser. Não há crate nova, não há capability nova. Por isso esta
camada entra na sub-fase 3.1 (§5), a única que não espera pela Fase 1 no PC
— pode começar a construir-se já.

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

1. **Presença.** Confirma se a sessão de 30 minutos ainda está ativa. Se não
   estiver, pede a palavra-passe por voz antes de continuar.
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

Se em qualquer ponto a sessão expirar, tocares no rato, ou carregares no
travão de mão: pára onde está, sem terminar o passo a meio.

---

## 3. Limites explícitos — o que isto continua a não ser

- **Não corre em segundo plano.** Mesma regra das automações: só enquanto o
  JARVIS estiver aberto e visível.
- **Não guarda a palavra-passe em texto simples nem prints em disco por
  omissão.** A palavra vive como hash; os prints são efémeros por definição,
  não por configuração esquecida.
- **Não usa câmara.** A camada de presença ficou resolvida por um segredo
  falado, não por vigilância. Ver §1.1.
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
passo atual, e do pedido de confirmação. Não sabe o que é `enigo`; só fala
com o `PlatformAdapter`.

**Camada de presença — sem Rust nenhum.** Vive inteira no browser:
`services/direct-control-session.ts` guarda o hash da palavra-passe
(`crypto.subtle.digest`, como já se faz noutros sítios do projeto para
não guardar segredos em claro), o temporizador dos 30 minutos, e ouve o
`idleLockMinutes` já existente (Parte 14) para fechar a sessão em conjunto
com o bloqueio por inatividade. A comparação do que a voz reconheceu contra
o hash guardado também é lógica pura — nenhum comando novo.

**Comandos Rust novos** (`src-tauri/src/commands/control.rs`), só para as
sub-fases que mexem mesmo no sistema operativo — cada um `Result`-based,
cada um validado antes de agir (coordenadas dentro dos limites do ecrã,
texto sanitizado, nunca `unwrap()`):

| Comando | Faz |
|---|---|
| `capture_screen` | Um print, devolvido para a camada de perceção decidir, nunca escrito em disco |
| `move_mouse_to` / `click_at` | Coordenadas explícitas, dentro dos limites do ecrã |
| `type_text` | Texto explícito, nunca interpretado como comando |
| `open_path` | Abre um ficheiro ou aplicação pelo caminho, via o abridor do próprio sistema operativo — não é execução arbitrária, é o equivalente a um duplo-clique |

**Candidatos a crate** (a confirmar quando chegar a altura, não fixados
agora): `enigo` para rato e teclado, `xcap` para captura de ecrã. Ambos
cross-platform, ambos com precedente em ferramentas de automação
estabelecidas — não inventar isto de raiz. Sem câmara, já não é preciso
`nokhwa` nem equivalente.

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
| 3.1 | Auditoria + overlay de confirmação + portão por palavra-passe (sessão de 30 min) | Não — testável já, em browser |
| 3.2 | Abrir aplicações e ficheiros por caminho | Sim, mas é o comando de menor risco |
| 3.3 | Captura de ecrã, indicador visível, zonas sensíveis | Sim |
| 3.4 | Rato e teclado, com o travão de mão e a confirmação por passo | Sim |
| 3.5 | Modelo de visão a interpretar o ecrã e propor os passos | Sim + provider multimodal |

3.1 é a única que não depende de nada nativo — dá para construir o
overlay de confirmação, a classificação de risco, o portão por
palavra-passe e a auditoria já, com ações de teste, e ter a experiência
toda pronta e testada antes de ligar a primeira ação real.

---

## 6. Decisões que ainda faltam, e que não são minhas para tomar sozinho

1. **Falada, escrita, ou as duas.** A versão simples é só por voz; mais forte
   é exigir também escrita, ou dar a escolher. Decide-se ao construir a 3.1.
2. **Duração da sessão** — 30 minutos é a proposta; muda-se numa linha.
3. **Visão local ou na nuvem.** Local é mais privado e mais fraco; na nuvem é
   mais capaz e manda o ecrã para fora. Pergunto quando chegar a 3.5.
4. **Retenção do registo de auditoria com prints** — quanto tempo fica
   guardado, se é para ficar.
5. **A tecla do travão de mão** — a omissão proposta é `Esc` duas vezes;
   pode ser outra.

Estas ficam para quando cada sub-fase começar a sério, não antes.
