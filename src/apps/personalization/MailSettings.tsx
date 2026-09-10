import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Trash2 } from 'lucide-react';

import { useMailSettings } from '@/hooks/use-mail-settings';
import { cn } from '@/lib/cn';
import { useMailSettingsStore } from '@/stores/use-mail-settings-store';
import { DEFAULT_MAIL_SETTINGS, looksLikeMailPassword, maskMailPassword } from '@/types/mail-settings';

/**
 * Correio real (Peça 8, lote 2).
 *
 * O correio precisa de quatro dados de ligação mais uma credencial. Só a
 * palavra-passe é segredo — por isso o molde do cofre é o da DeepSeek/NewsAPI:
 * fica no cofre do sistema, tapada, e o resto fica no storage normal. Sem
 * servidor + utilizador + palavra-passe, o widget continua com o simulado de
 * sempre. Diz-se por escrito o que sai do dispositivo e para onde, antes de
 * qualquer ligação.
 */
export function MailSettings(): React.JSX.Element {
  // Aplica as preferências ao serviço sempre que mudam — redundante com o
  // App.tsx, mas garante a aplicação quando o componente é montado em testes.
  useMailSettings();

  const settings = useMailSettingsStore((state) => state.settings);
  const setImapServer = useMailSettingsStore((state) => state.setImapServer);
  const setImapPort = useMailSettingsStore((state) => state.setImapPort);
  const setSmtpServer = useMailSettingsStore((state) => state.setSmtpServer);
  const setSmtpPort = useMailSettingsStore((state) => state.setSmtpPort);
  const setUsername = useMailSettingsStore((state) => state.setUsername);
  const setPassword = useMailSettingsStore((state) => state.setPassword);
  const forgetPassword = useMailSettingsStore((state) => state.forgetPassword);

  const [draft, setDraft] = useState('');
  const [isVisible, setVisible] = useState(false);

  const hasPassword = settings.password.length > 0;

  const parsePort = (raw: string, fallback: number): number => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
  };

  return (
    <div className="flex flex-col gap-s3">
      <p
        className="flex items-start gap-2 rounded-input border border-warn/30 bg-warn/[.06] p-2.5 text-cap leading-relaxed text-t2"
        role="note"
      >
        <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0 text-warn" aria-hidden="true" />
        <span>
          Ler e enviar correio fala diretamente com os servidores IMAP e SMTP que indicar — o que
          sai deste dispositivo é o endereço de email e a palavra-passe. A palavra-passe fica
          guardada no cofre do sistema — o Gestor de Credenciais do Windows — e não sai nas cópias
          de segurança. Só a caixa de entrada é lida; anexos e respostas ficam para depois.
        </span>
      </p>

      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <label className="block">
          <span className="t-label mb-1.5 block">Servidor IMAP (ler)</span>
          <input
            type="text"
            defaultValue={settings.imapServer}
            onBlur={(event) => setImapServer(event.target.value)}
            placeholder="imap.gmail.com"
            aria-label="Servidor IMAP"
            className="mono w-full rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
          />
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">Porta IMAP</span>
          <input
            type="number"
            defaultValue={settings.imapPort}
            onBlur={(event) => setImapPort(parsePort(event.target.value, DEFAULT_MAIL_SETTINGS.imapPort))}
            aria-label="Porta IMAP"
            className="mono w-full rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <label className="block">
          <span className="t-label mb-1.5 block">Servidor SMTP (enviar)</span>
          <input
            type="text"
            defaultValue={settings.smtpServer}
            onBlur={(event) => setSmtpServer(event.target.value)}
            placeholder="smtp.gmail.com"
            aria-label="Servidor SMTP"
            className="mono w-full rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
          />
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">Porta SMTP</span>
          <input
            type="number"
            defaultValue={settings.smtpPort}
            onBlur={(event) => setSmtpPort(parsePort(event.target.value, DEFAULT_MAIL_SETTINGS.smtpPort))}
            aria-label="Porta SMTP"
            className="mono w-full rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
          />
        </label>
      </div>

      <label className="block">
        <span className="t-label mb-1.5 block">Endereço de email</span>
        <input
          type="text"
          defaultValue={settings.username}
          onBlur={(event) => setUsername(event.target.value)}
          placeholder="voce@exemplo.com"
          aria-label="Endereço de email"
          className="mono w-full rounded-input border border-line bg-tint/[.03] px-3 py-2 text-[12px] outline-none transition-colors duration-hover placeholder:text-t3 focus:border-accent/45"
        />
        <span className="mt-1.5 block text-cap text-t3">
          É também o remetente das mensagens enviadas. Para o Gmail e similares, use uma
          "palavra-passe de aplicação" em vez da palavra-passe normal.
        </span>
      </label>

      {hasPassword ? (
        <div className="flex items-center gap-2 rounded-input border border-line bg-tint/[.02] px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-t3">Palavra-passe guardada no cofre</span>
            <span className="mono block truncate text-[12px]">
              {isVisible ? settings.password : maskMailPassword(settings.password)}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={isVisible ? 'Esconder a palavra-passe' : 'Mostrar a palavra-passe'}
            aria-pressed={isVisible}
            className="flex-shrink-0 rounded p-1.5 text-t3 transition-colors duration-hover hover:text-accent"
          >
            {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              forgetPassword();
              setVisible(false);
            }}
            aria-label="Apagar a palavra-passe"
            className="flex-shrink-0 rounded p-1.5 text-t3 transition-colors duration-hover hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Palavra-passe</span>
              <input
                type="password"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && looksLikeMailPassword(draft)) {
                    setPassword(draft);
                    setDraft('');
                  }
                }}
                placeholder="Palavra-passe ou token de aplicação"
                className={cn(
                  'mono w-full rounded-input border bg-tint/[.03] px-3 py-2',
                  'text-[12px] outline-none transition-colors duration-hover',
                  'placeholder:text-t3 focus:border-accent/45 border-line',
                )}
              />
            </label>

            <button
              type="button"
              disabled={!looksLikeMailPassword(draft)}
              onClick={() => {
                setPassword(draft);
                setDraft('');
              }}
              className={cn(
                'flex-shrink-0 rounded-btn border px-3.5 py-2 text-[12.5px] font-medium',
                'transition-all duration-hover ease-out',
                looksLikeMailPassword(draft)
                  ? 'border-accent/50 bg-accent/[.08] text-accent hover:bg-accent/[.14] active:scale-[.98]'
                  : 'cursor-not-allowed border-line text-t3 opacity-60',
              )}
            >
              Guardar
            </button>
          </div>
          <span className="mt-1.5 block text-cap text-t3">
            Só se guarda quando a palavra-passe tiver conteúdo — nunca em texto simples no storage.
          </span>
        </div>
      )}
    </div>
  );
}
