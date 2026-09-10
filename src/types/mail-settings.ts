/**
 * Configuração do correio real (Peça 8, lote 2).
 *
 * Ao contrário da meteorologia (sem credenciais) e das notícias (uma chave),
 * o correio precisa de **quatro** dados de ligação mais uma credencial: o
 * servidor IMAP (ler), o servidor SMTP (enviar), o utilizador e a
 * palavra-passe/token. Só a palavra-passe é segredo — servidor, porta e
 * utilizador são configuração pública (o utilizador é o próprio endereço de
 * email). Por isso a regra do projeto aplica-se ao que é segredo: a
 * palavra-passe vai para o cofre do sistema, e o resto fica no storage normal,
 * com o mesmo padrão do `useAiSettingsStore`.
 *
 * Não há interruptor separado: a configuração é a própria presença de
 * servidor + utilizador + palavra-passe. Sem elas, mantém-se o simulado.
 */

export interface MailSettings {
  /** Servidor IMAP — o que a caixa usa para ler (ex.: `imap.gmail.com`). */
  readonly imapServer: string;
  /** Porta IMAP. 993 (TLS implícito) é o valor de origem. */
  readonly imapPort: number;
  /** Servidor SMTP — o que a caixa usa para enviar (ex.: `smtp.gmail.com`). */
  readonly smtpServer: string;
  /** Porta SMTP. 587 (STARTTLS) é o valor de origem. */
  readonly smtpPort: number;
  /** O endereço de email da conta — também é o remetente do envio. */
  readonly username: string;
  /**
   * Palavra-passe ou token de aplicação — vive no cofre do sistema, não no
   * storage (ver `useMailSettingsStore`).
   */
  readonly password: string;
}

export const DEFAULT_MAIL_SETTINGS: MailSettings = {
  imapServer: '',
  imapPort: 993,
  smtpServer: '',
  smtpPort: 587,
  username: '',
  password: '',
};

/**
 * Uma palavra-passe/token de correio pode ser qualquer coisa — incluindo a
 * "palavra-passe de aplicação" de 16 letras que o Gmail gera. Isto só rejeita
 * o óbvio: vazio, ou espaços a fingir.
 */
export function looksLikeMailPassword(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Esconde a palavra-passe para a poder indicar que está guardada sem a
 * revelar. Só se mostra inteira quando a pessoa carrega no olho.
 */
export function maskMailPassword(value: string): string {
  if (value.trim().length === 0) return '';
  return '•'.repeat(10);
}
