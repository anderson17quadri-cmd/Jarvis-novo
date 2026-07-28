import type { AssistantConversation } from '@/types/assistant';

/**
 * Exportar uma conversa (Parte 7.1 §Exportar).
 *
 * Markdown, porque é o formato que se lê tal e qual num editor de texto e ainda
 * assim mantém a estrutura. A conversão é pura; quem descarrega é outra função,
 * para o teste não precisar de um DOM.
 *
 * **Limite conhecido:** o ficheiro vai para a pasta de transferências do
 * browser. Escolher o destino exige o plugin `dialog` do Tauri — bloqueado até
 * a Fase 1 correr no PC. Está registado no `SPEC.md`.
 */

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function conversationToMarkdown(conversation: AssistantConversation): string {
  const lines: string[] = [
    `# ${conversation.title}`,
    '',
    `Conversa iniciada a ${dateFormatter.format(conversation.createdAt)}.`,
    '',
  ];

  for (const message of conversation.messages) {
    const author = message.author === 'assistant' ? 'Jarvis' : 'Eu';
    const favourite = message.isFavourite ? ' *(favorita)*' : '';

    lines.push(`## ${author}${favourite}`, '', message.text.trim(), '');
  }

  lines.push('---', '', 'Exportado do JARVIS AI OS.');
  return lines.join('\n');
}

/** Nome de ficheiro seguro em qualquer sistema, a partir do título. */
export function exportFileName(conversation: AssistantConversation): string {
  const slug = conversation.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `jarvis-${slug.length > 0 ? slug : 'conversa'}.md`;
}

/** Descarrega um texto como ficheiro. Só isto toca no DOM. */
export function downloadText(fileName: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  // Sem isto, o blob fica em memória até a página fechar.
  URL.revokeObjectURL(url);
}
