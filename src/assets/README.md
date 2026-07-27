# `assets/`

Recursos estáticos importados pelo código (Parte 3).

Vazio na Fase 1. As quatro subpastas da Parte 3 criam-se quando tiverem
conteúdo — quatro diretórios vazios com `.gitkeep` seriam ruído a fingir
estrutura.

## Subpastas previstas

### `icons/`

**Provavelmente nunca será usada.** Os ícones são todos do Lucide React, por
imposição da Parte 2: SVG, mesmo peso, mesmo alinhamento, nunca PNG, nunca
emoji. Só entra aqui um SVG que o Lucide não tenha — logótipos de terceiros,
por exemplo — e mesmo esse como componente React, não como ficheiro solto.

### `fonts/`

A Inter vem hoje do Google Fonts, por `<link>` no `index.html`. Passa para aqui
quando a aplicação tiver de funcionar offline de raiz: um build Tauri não deve
depender de um CDN para ter a tipografia certa. Formato `.woff2`, com
`font-display: swap`.

### `sounds/`

Os efeitos sonoros das Partes 4, 6.1 e 9 — arranque, energia, scanner,
confirmação, erro, notificação, abrir e fechar. Ficaram por fazer na Fase 1 por
não haver recursos de áudio.

Quando entrarem: `.webm` ou `.mp3` curtos, discretos, com um `AudioService` a
respeitar uma preferência de silêncio. A Parte 9 é explícita — cada som tem um
propósito, e nenhum compete com música a tocar.

### `videos/`

As Partes 4 e 8 proíbem vídeo nas animações do sistema — tudo é procedural, em
Canvas, SVG e CSS. Esta pasta existe apenas para conteúdo de produto, como um
tutorial ou uma demonstração dentro de uma janela.

## Regra

Ficheiros que o Vite processa e a que o código faz `import` ficam aqui. Ficheiros
servidos tal e qual, por URL, vão para `public/`.
