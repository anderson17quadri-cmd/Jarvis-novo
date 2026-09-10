# `data/`

Dados de exemplo (Parte 3).

## O que entra aqui

As sementes que povoam as janelas enquanto não há fonte real: tarefas,
projetos, árvore de ficheiros. Ficam separadas do componente por duas razões
práticas:

1. **Um componente com trinta linhas de dados no meio deixa de se ler.**
2. Quando a fonte real chegar, muda-se o `import` e o componente fica como
   está — é a mesma ideia dos provedores em `services/*/providers/`.

## Datas relativas, nunca fixas

Nenhum ficheiro daqui escreve uma data absoluta. Uma tarefa com prazo em
`2026-03-14` parece atrasada dois meses depois de ter sido escrita, e a
interface passa a mentir sozinha. Tudo se calcula a partir de `Date.now()`.

```ts
// data/tasks.ts
dueAt: inDays(2)   // ✅ daqui a dois dias, seja hoje que dia for
dueAt: 1773532800  // ❌ um dia concreto que envelhece
```

## O que **não** entra

- **Dados de serviços.** Meteorologia, notícias, email e música têm provedores
  (`services/*/providers/`), porque simulam também a latência, os erros e a
  passagem do tempo. Isso é comportamento, não dados
- **Constantes.** Ver `constants/README.md`
