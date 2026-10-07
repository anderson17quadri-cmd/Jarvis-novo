# Voz OpenAI em português brasileiro

## Decisão — 07/10/2026

O utilizador quer substituir a clonagem por uma voz humanizada em pt-BR.
Ouviu e recusou Piper Cadu e Kokoro Alex por soarem robotizados. A continuação
prepara OpenAI como síntese principal; a naturalidade ainda terá de ser
avaliada com áudio real. A API não garante a mesma voz do ChatGPT.

Esta alteração é limitada ao fluxo de voz existente: escolha em
Personalização, pedido de síntese, reprodução, interrupção e serviço de
reconhecimento local. Não altera o provedor que gera as respostas do assistente.

## Utilização

Em Personalização → Voz, configurar a chave API OpenAI, escolher Cedar ou
Marin e carregar no botão de teste. O teste não muda a voz preferida.
Sem chave, os botões de teste OpenAI ficam desativados; uma fala pedida pelo
assistente termina com um aviso que explica o que falta.

No desktop a chave fica no cofre do sistema, sob `openai-voice-api-key`,
separada das chaves de IA. Se guardar ou apagar falhar, a chave anterior é
mantida. Não entra no armazenamento de preferências. No browser e no Android,
sem cofre disponível, fica apenas em memória até fechar ou recarregar a app.

O texto a dizer vai à sessão WebSocket `wss://api.openai.com/v1/realtime`. Não são
enviadas gravações de microfone para a OpenAI. A interface informa que a voz
é gerada por IA e que exige Internet e utilização paga. O áudio PCM16 mono a
24 kHz é reunido e convertido em WAV para reprodução. O pedido usa
instruções de sotaque brasileiro, entonação de conversa e pausas curtas.
Os pontos, reticências e pontos e vírgulas são preservados neste pedido;
a limpeza feita para o XTTS continua limitada aos motores anteriores.
Não há pré-síntese especulativa para OpenAI nem repetição automática de
pedidos pagos. O cancelamento aborta o pedido; um áudio tardio não toca.
O tempo máximo de síntese é 30 segundos, incluindo a leitura da resposta.

Falhas de autenticação, saldo/limite, rede ou reprodução são comunicadas.
Não se passa automaticamente para as vozes locais recusadas pelo utilizador.
As vozes do sistema continuam selecionáveis manualmente.

## Reconhecimento e compatibilidade

`voice-clone-service/` conserva o nome para não partir o arranque nativo,
mas por omissão serve o Whisper local sem carregar XTTS. Não é preciso uma
gravação de referência para arrancar. A clonagem deixa de aparecer na
interface. As preferências antigas de voz clonada migram para Cedar,
preservando a wake word e as opções do microfone. As escolhas explícitas de
voz do sistema mantêm-se.

O `/health` distingue um Whisper instalado mas ainda frio de um modelo já
carregado. O primeiro `/ouvir` pode assim carregar o modelo local. Esta
disponibilidade indica instalação, não uma prova de transcrição nem da GPU.
Os motores de reconhecimento anteriores não foram substituídos nesta alteração.

A gravação antiga não é apagada. Os endpoints de clonagem ficam desativados
por omissão. Para recuperar deliberadamente o serviço antigo, instalar
`requirements-legacy-tts.txt` e definir `JARVIS_LEGACY_TTS=1` antes do arranque.
Isto é compatibilidade de backend; não reintroduz a gravação na interface.

## Protocolo Realtime — 07/10/2026

O modelo usado é `gpt-realtime-2.1-mini`, substituto indicado na retirada
do TTS antigo em 06/01/2027. A migração de protocolo está construída em
`openai-voice.ts`: `POST /v1/realtime/client_secrets` cria uma chave efémera
de 60 segundos; só essa chave entra no subprotocolo WebSocket. A chave
principal não aparece no URL ou no registo. É uma app pessoal BYOK, com a
chave da própria pessoa no cofre/memória; não distribui uma chave de servidor.

`response.create` recebe apenas o texto a ler, sem histórico, ferramentas
ou áudio de entrada. A sessão não abre o microfone nem usa VAD. O narrador
recebe instruções para ler o texto literalmente em pt-BR. Ao concluir,
a ligação fecha; parar/timeout fecha também a sessão. Uma resposta incompleta,
sem áudio, com PCM inválido ou acima de 16 MiB é recusada. O limite de texto
é 4096 caracteres e o limite de geração é 30 segundos. A reprodução começa
depois de receber o áudio completo; textos longos podem exceder esse tempo.

- [Realtime](https://developers.openai.com/api/docs/guides/realtime)
- [WebSockets](https://developers.openai.com/api/docs/guides/voice-websockets?voice-api=realtime)
- [Chaves efémeras](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create)
- [Retirada e substituição](https://developers.openai.com/api/docs/deprecations)

## Verificação reproduzível

- `npm run typecheck`
- `npx eslint` nos ficheiros alterados
- `npx vitest run tests/voice`
- Python: `python -m pytest voice-clone-service/tests -q`
- Rust: `cargo test voice_clone::tests --lib`, em `src-tauri/`
- Interface: iniciar `npm run dev -- --host 127.0.0.1 --port 1422`, e
  correr `node scripts/verificar-voz-openai.mjs` com Edge instalado.
  O script usa um browser real, uma chave fictícia e eventos WebSocket com PCM
  simulado; não consome API nem avalia naturalidade sonora.

Uma chave real ainda é necessária para confirmar acesso da conta, latência
e qualidade em pt-BR. Não apresentar estes testes como audição ou validação
da voz real.
