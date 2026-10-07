export type OpenAiVoice = 'cedar' | 'marin';

const INSTRUCTIONS = 'Fale em português brasileiro, com sotaque brasileiro neutro. ' +
  'Use um tom acolhedor, calmo e seguro, como numa conversa espontânea. ' +
  'Varie naturalmente a entonação, respeite a pontuação e faça pausas curtas. ' +
  'Evite voz de locutor, ritmo mecânico e pausas exageradas. Leia apenas o texto fornecido.';

export async function synthesizeOpenAi(
  text: string,
  voice: OpenAiVoice,
  apiKey: string,
  signal: AbortSignal,
): Promise<Blob> {
  if (!apiKey) throw new Error('Configura a chave da OpenAI em Personalização → Voz.');
  if (!text.trim()) throw new Error('Falta o texto a dizer.');
  if (text.length > 4096) throw new Error('O texto é demasiado longo para uma única fala (máximo: 4096 caracteres).');
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts-2025-12-15', voice, input: text,
      instructions: INSTRUCTIONS, response_format: 'wav',
    }),
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('A chave da OpenAI foi recusada. Confirma-a nas definições de voz.');
    if (response.status === 429) throw new Error('A OpenAI atingiu o limite de pedidos ou de saldo. Confirma o saldo e tenta mais tarde.');
    if (response.status === 403) throw new Error('A conta OpenAI não tem acesso à síntese de voz.');
    throw new Error(`A OpenAI não conseguiu gerar a voz (HTTP ${response.status}). Tenta mais tarde.`);
  }
  const audio = await response.blob();
  if (audio.size === 0 || !audio.type.startsWith('audio/')) {
    throw new Error('A OpenAI devolveu uma resposta sem áudio válido.');
  }
  return audio;
}
