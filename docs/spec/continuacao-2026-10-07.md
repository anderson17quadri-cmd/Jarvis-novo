# Pendências funcionais — 07/10/2026

A continuação autorizada pelo utilizador fecha as funcionalidades locais
da auditoria e prepara uma distribuição Windows. A avaliação sonora da voz
continua dependente de uma conta API configurada e da audição do utilizador.

## Agenda local

`LocalCalendarProvider` é o provedor por omissão: começa vazio, sem reuniões
inventadas. Guarda eventos em `calendar-events` através do armazenamento
da plataforma. Criar, editar, mudar o dia e eliminar atualiza a janela e o
widget de hoje. Valida data, hora, título e duração, serializa escritas
concorrentes e mantém o evento anterior se a persistência falhar.
O provedor de demonstração continua disponível para testes explícitos.
Não há sincronização com Google Calendar ou Outlook nesta entrega.

## Ficheiros do assistente

`procurar_ficheiro` pesquisa nomes na raiz real escolhida no Explorador,
usando a leitura nativa que já limita os caminhos à raiz. `abrir_ficheiro`
navega para a pasta do resultado, inclusive numa janela já aberta; não
executa o ficheiro. Sem raiz escolhida, os resultados são identificados
como exemplos. Uma raiz inacessível não é substituída por exemplos.

A pesquisa limita-se a 8 segundos, 100 pastas, 5000 entradas, 12 níveis
e 40 resultados. Falhas e limites produzem um aviso de pesquisa parcial;
uma mudança de raiz durante a leitura descarta os resultados anteriores.
Só lê nomes e metadados. Os nomes reais são delimitados como conteúdo
não confiável nos resultados enviados ao modelo.

## Controlo Direto e captura

Uma faixa sempre visível durante a sessão indica modo, tempo restante e
Parar, acima das janelas e junto à zona inferior do ecrã. A expiração
cancela confirmações pendentes e notifica os componentes. Desligar o
controlo ou o travão de mão também limpa a confirmação.

A primeira captura de cada sessão e provedor pede autorização antes de
ler o ecrã. O modal indica análise local ou envio remoto e identifica o
provedor; começa com foco em Recusar. A autorização expira com a sessão,
modo simulado ou troca de provedor. Parar antes da captura cancela-a;
parar durante a leitura descarta a imagem antes do envio. As zonas
sensíveis continuam tapadas no código nativo.

## Rede e diagnóstico

O Windows consulta `INetworkListManager::GetConnectivity` a cada cinco
segundos e emite mudanças de ligação. A fotografia inicial não dispara
automações; a primeira transição recebida conserva o estado anterior,
e várias regras podem disparar sem duplicar a mesma mudança. Os blocos
Rede ligada/desligada existem no editor. É ligação local reportada pelo SO,
não uma prova de acesso à Internet ou deteção de mudança de SSID. Web,
Android e outros sistemas não anunciam esta capacidade.
Referência: [GetConnectivity, Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/netlistmgr/nf-netlistmgr-inetworklistmanager-getconnectivity).

O Centro de Desenvolvimento distingue Voz OpenAI, Transcrição local e
Detetor local. Uma chave configurada não prova que houve áudio. O botão
Verificar serviços de voz consulta apenas as portas locais 8090/8091,
com timeout independente, sem abrir microfone ou fazer pedidos pagos.
Whisper instalado e frio difere de carregado; Vosk disponível e parado
difere de ativo. A hora da última verificação fica explícita.

## Distribuição Windows

O instalador inclui os scripts e fontes Python dos serviços. As dependências
e modelos ficam em `%LOCALAPPDATA%\com.projectarc.jarvis\services`,
uma pasta gravável do utilizador que o arranque nativo reconhece. A cópia
preserva ambientes virtuais e modelos já existentes. O script
`services/preparar-servicos-locais.ps1`, junto aos recursos da instalação,
prepara Whisper em CPU e Vosk; `-Cuda cu130` permite a configuração GPU.
Precisa de Python 3.10–3.12, FFmpeg no PATH e Internet para as dependências.
A execução dos scripts com downloads e a instalação em máquina limpa
continuam por validar. A cópia dos oito ficheiros foi testada num destino
isolado; os scripts de preparação e arranque passaram no parser Windows
PowerShell 5.1. Os três scripts alterados usam UTF-8 com BOM para conservar
os caracteres portugueses nessa versão. O instalador NSIS x64 foi gerado
com esses recursos, mas não foi executado.

## Verificação

`scripts/verificar-funcionalidades.mjs` usa Edge e servidor Vite de
desenvolvimento na porta 1423 para verificar agenda persistida, largura
390, consentimento recusado, Parar, diagnóstico, Marketplace assinado e
navegação real do assistente em janela já aberta. Usa respostas externas,
disco e captura simulados; a assinatura Ed25519 é verificada pelo browser.
`scripts/verificar-voz-openai.mjs` verifica o fluxo Realtime da voz com
eventos simulados num build servido na porta 1422.

Os testes Rust incluem uma leitura real do estado de rede desta máquina.
Não substituem desligar/religar a rede, testar o microfone, instalar em
máquina limpa ou ouvir uma síntese OpenAI com uma chave real.
