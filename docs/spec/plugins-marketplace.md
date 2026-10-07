# Marketplace de plugins — fonte GitHub configurável

O pedido de construir as pendências, em 07/10/2026, autoriza o cliente de
catálogo remoto. Usa um formato aberto sobre GitHub, sem servidor próprio,
pagamentos ou atualizações automáticas. A fonte é escolhida na interface;
sem fonte, os seis exemplos anteriores continuam rotulados e não instaláveis.

## Cliente funcional — 07/10/2026

`RemoteMarketplace.tsx` carrega um índice público de `raw.githubusercontent.com`
apenas ao clicar. Os pacotes devem vir do mesmo repositório do índice,
sem credenciais, parâmetros ou redirecionamentos. Há limites de 100 entradas,
256 KiB para o índice, 2 MiB por pacote e 15 segundos por download.

O índice tem esta forma:

```json
{
  "version": 1,
  "plugins": [{
    "id": "meu-plugin",
    "name": "Meu plugin",
    "version": "1.0.0",
    "author": "Editor",
    "downloadUrl": "https://raw.githubusercontent.com/editor/repo/main/meu-plugin.jarvis-plugin",
    "sha256": "hash SHA-256 dos bytes do pacote, com 64 caracteres hexadecimais"
  }]
}
```

O SHA-256 deve corresponder aos bytes descarregados. O pacote continua a
usar o formato `.jarvis-plugin` existente: manifesto, código, assinatura
Ed25519 e chave pública. Identificador e versão têm de corresponder ao índice;
a assinatura cobre manifesto e código e respeita as chaves revogadas.
Um pacote remoto não pode substituir identificadores do catálogo do sistema.

Antes de instalar, a pessoa vê o manifesto real verificado, versão, autor,
permissões pedidas e chave pública. Confirma que confia nessa chave. Uma
assinatura matematicamente válida não prova a identidade do editor nem uma
revisão de segurança; não é apresentado um selo de editor verificado.

As atualizações são manuais e conservam a chave do editor; uma troca de
chave é recusada. Guardam a versão anterior localmente e atualizam o runtime.
A instalação/atualização fica desativada até a pessoa a ativar na aba
Instalados. Recuperar a versão anterior requer confirmação e volta a
verificar a assinatura e a revogação. Guarda uma versão anterior por plugin;
recuperar permite alternar entre as duas versões guardadas. Uma falha ao
persistir a atualização repõe pacote, runtime e estado anteriores em memória.

O fluxo de carregar, verificar, confirmar, atualizar e recuperar foi
testado num Edge real com respostas de rede simuladas e assinaturas reais.
Não foi publicado nem ligado um catálogo de terceiros nesta sessão.

## História do esboço — 11/08/2026

A primeira aba mostrava seis exemplos, todos não instaláveis. O cliente
configurável substitui esse limite quando há uma fonte. Um registo central
com moderação, pagamentos e gestão pública de editores continua fora desta
entrega. O SDK e a instalação local permanecem disponíveis aos autores.
