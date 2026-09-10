# Marketplace de plugins — esboço

Desenho da interface, confirmado 11/08/2026. **Não é uma decisão de
ligar a uma fonte real** — é o oposto: existe para haver algo concreto a
olhar antes de tomar essa decisão, que é maior do que vale a pena tomar
sozinho, sem o utilizador a decidir.

## O que existe hoje

Uma terceira aba na Loja de plugins (`PluginManagerWindow.tsx`), ao lado
de "Loja" e "Instalados": `MarketplaceTab.tsx`, com seis entradas de
`marketplace-sample-data.ts` — nomes, autores e números **inventados à
mão**, sem nenhum ficheiro, servidor ou API por trás. "Instalar" está
sempre desativado, com `title` a explicar porquê. Não há pesquisa nem
filtro por categoria nesta aba — não faria sentido sobre seis entradas
estáticas, e teria de se refazer quando (se) a fonte real entrar com
paginação a sério.

## Porque não liga já a uma fonte real

O catálogo local (`plugin-catalog.ts`) já resolve "mostrar plugins" —
o que falta não é a interface, é confiar em código de terceiros. Isso
exige respostas a perguntas que este projeto não pode responder sozinho:

1. **Onde vivem os plugins?** Um registo próprio (servidor a manter,
   custo, disponibilidade) ou um formato aberto (ex.: um repositório Git
   com um `index.json`, sem servidor nenhum a manter)? A segunda opção é
   mais barata mas exige decidir quem pode escrever nesse índice.
2. **Quem verifica o quê, antes de instalar?** A sandbox
   (`docs/spec/plugins-sandbox.md`) já limita o que um plugin *consegue*
   fazer — mas não diz nada sobre se o código é o que diz ser. Falta
   assinatura (quem assina? uma CA própria? confiar na assinatura do
   repositório Git?) e algum tipo de revisão antes de um plugin aparecer
   listado, nem que seja automática (lint sobre o `manifest.json`,
   confirmar que as permissões pedidas batem com as capacidades usadas).
3. **Atualizações.** Um plugin instalado é uma cópia de um momento no
   tempo. Atualizar automaticamente é conveniente e arriscado (código
   novo a correr sem ninguém ver); pedir confirmação a cada atualização
   é seguro e cansativo. Isto pede uma decisão explícita, não um valor
   por omissão escolhido às pressas.
4. **Rollback.** Se uma atualização parte alguma coisa, voltar à versão
   anterior exige guardar versões antigas nalgum lado — mais uma decisão
   de armazenamento antes de "atualizações" fazer sentido sozinho.
5. **Dinheiro.** Metade dos exemplos em `marketplace-sample-data.ts` são
   "pagos" só para a interface mostrar os dois estados — mas cobrar a
   sério é pagamentos, reembolsos, fraude, impostos. Nada disto tem
   resposta nenhuma hoje, nem deve fingir que tem.
6. **Moderação.** Quem tira um plugin malicioso do ar, com que critério,
   e quão depressa? Sem resposta a isto, um "marketplace" a sério é uma
   promessa de segurança que ninguém está a cumprir.

## O que faria sentido antes da próxima decisão

Não é "construir o registo" — é decidir, com o utilizador, se o caminho
é um registo próprio ou um formato aberto sobre Git, porque as duas
respostas às perguntas acima são completamente diferentes consoante essa
escolha. Só depois disso decidido é que assinatura, atualizações e
moderação ganham uma forma concreta para desenhar.

## Para quem escrever plugins entretanto

O SDK mínimo já existe (`plugins/sdk/`, ver
`docs/spec/plugins-sandbox.md` §O SDK) — um plugin pode ser escrito e
testado localmente (`plugins/examples/`) muito antes de haver
marketplace nenhum para o publicar. As duas coisas não dependem uma da
outra.
