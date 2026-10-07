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

O texto a dizer vai a `https://api.openai.com/v1/audio/speech`. Não são
enviadas gravações de microfone para a OpenAI. A interface informa que a voz
é gerada por IA e que exige Internet e utilização paga. O pedido usa WAV,
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

## Limite da API atual

O modelo usado é `gpt-4o-mini-tts-2025-12-15`, ainda documentado para este
endpoint. A OpenAI anunciou a sua retirada para **06/01/2027**, recomendando
`gpt-realtime-2.1-mini`. A chamada está isolada em `openai-voice.ts`; a
migração para Realtime exige outro protocolo e fica pendente antes dessa data.
Não basta trocar o nome do modelo no mesmo pedido HTTP.

- [Síntese de voz](https://developers.openai.com/api/docs/guides/text-to-speech)
- [Contrato do endpoint](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create)
- [Retirada e substituição](https://developers.openai.com/api/docs/deprecations)

## Verificação reproduzível

- `npm run typecheck`
- `npx eslint` nos ficheiros alterados
- `npx vitest run tests/voice`
- Python: `python -m pytest voice-clone-service/tests -q`
- Rust: `cargo test voice_clone::tests --lib`, em `src-tauri/`
- Interface: iniciar `npm run dev -- --host 127.0.0.1 --port 1422`, e
  correr `node scripts/verificar-voz-openai.mjs` com Edge instalado.
  O script usa um browser real, uma chave fictícia e uma resposta WAV
  simulada; não consome API nem avalia naturalidade sonora.

Uma chave real ainda é necessária para confirmar acesso da conta, latência
e qualidade em pt-BR. Não apresentar estes testes como audição ou validação
da voz real.
