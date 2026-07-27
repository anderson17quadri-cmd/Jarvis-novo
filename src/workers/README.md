# `workers/`

Web Workers, para tirar trabalho pesado da thread principal (Parte 3 §Performance).

Vazio na Fase 1 — e é isso que se pretende. Nada do que o sistema faz hoje
justifica um worker: o canvas do núcleo corre a 60 FPS na thread principal, e as
métricas do sistema vêm já calculadas do Rust.

## Quando um worker se justifica

Só quando houver medição a mostrar que a thread principal está a perder frames.
Um worker acrescenta serialização, latência e um segundo ciclo de vida para
gerir — usá-lo por precaução custa mais do que rende.

Candidatos previstos:

| Trabalho | Fase | Porquê |
|---|---|---|
| Indexação da pesquisa global | 2 | Percorrer ficheiros, notas e emails bloqueia a interface |
| Embeddings e memória semântica | 3 | Cálculo vetorial pesado, fora do ciclo de render |
| Análise de logs e telemetria | 3 | Agregação sobre séries longas |

## Convenções

- Um ficheiro por worker, com o sufixo `.worker.ts`
- O Vite carrega-os com `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`
- As mensagens são tipadas nos dois sentidos, em `types/` — a fronteira do
  worker é `unknown` por omissão, e sem tipos explícitos o `any` entra por aqui
- Um worker nunca toca no DOM nem nas stores; devolve dados a um serviço, e é o
  serviço que atualiza o estado
