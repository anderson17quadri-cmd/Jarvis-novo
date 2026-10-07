import { useEffect, useState } from 'react';
import { Check, Play, Square } from 'lucide-react';

import { cn } from '@/lib/cn';
import { getPlatformAdapter } from '@/platform';
import { voiceService, type VoiceSelection } from '@/services/voice-service';
import { useVoiceSettingsStore } from '@/stores/use-voice-settings-store';

const SAMPLE = 'Oi! Eu sou o Jarvis. Me conta o que você precisa, que eu te ajudo. Vamos começar?';

function isSameSelection(a: VoiceSelection, b: VoiceSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'sistema' && b.kind === 'sistema') return a.voiceURI === b.voiceURI;
  if (a.kind === 'openai' && b.kind === 'openai') return a.voice === b.voice;
  return true;
}

function VoiceOption({ label, selection }: {
  readonly label: string; readonly selection: VoiceSelection;
}): React.JSX.Element {
  const current = useVoiceSettingsStore(state => state.selection);
  const setSelection = useVoiceSettingsStore(state => state.setSelection);
  const key = useVoiceSettingsStore(state => state.openAiKey);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isActive = isSameSelection(current, selection);

  return (
    <div className="flex flex-col gap-1">
      <div className={cn('flex items-center gap-2 rounded-input border px-3 py-2 text-[12.5px]',
        isActive ? 'border-accent bg-accent/[.08] text-accent' : 'border-line text-t2')}>
        <button type="button" role="radio" aria-checked={isActive}
          onClick={() => setSelection(selection)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left hover:text-accent">
          <span className="min-w-0 truncate">{label}</span>
          {isActive && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        <button type="button" aria-label={testing ? `Parar o teste de ${label}` : `Testar a voz ${label}`}
          disabled={selection.kind === 'openai' && !key}
          className="rounded p-1 text-t3 hover:text-accent disabled:opacity-40"
          onClick={() => {
            if (testing) { voiceService.stopSpeaking(); setTesting(false); return; }
            setError(null);
            setTesting(true);
            const started = voiceService.speak(SAMPLE, { onEnd: () => {
              setTesting(false);
              if (selection.kind === 'openai') setError(voiceService.lastOpenAiVoiceError);
            } }, selection);
            if (!started) { setTesting(false); setError('Não foi possível iniciar a reprodução.'); }
          }}>
          {testing ? <Square className="h-3.5 w-3.5" aria-hidden="true" /> :
            <Play className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
      {error && <p role="alert" className="px-1 text-cap text-danger">{error}</p>}
    </div>
  );
}

export function VoiceSettings(): React.JSX.Element {
  const key = useVoiceSettingsStore(state => state.openAiKey);
  const saveKey = useVoiceSettingsStore(state => state.saveOpenAiKey);
  const [draftKey, setDraftKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [systemVoices, setSystemVoices] = useState(() => voiceService.availableVoices);
  const hasVault = getPlatformAdapter().capabilities.secretVault;

  async function save(value: string): Promise<void> {
    setSaving(true);
    try {
      const ok = await saveKey(value);
      setMessage(ok ? (value.trim() ? 'Chave configurada. Já podes testar as vozes.' : 'Chave apagada.')
        : 'Não consegui atualizar o cofre. A chave anterior foi mantida.');
      if (ok) setDraftKey('');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const update = (): void => setSystemVoices(voiceService.availableVoices);
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-t2">Voz OpenAI · português brasileiro</p>
      <p className="text-cap leading-relaxed text-t3">
        Voz gerada por inteligência artificial, com tom de conversa. Requer Internet e tem custo por
        utilização. Apenas o texto a dizer é enviado à OpenAI; o reconhecimento local funciona à parte.
      </p>
      <form className="flex flex-col gap-2" onSubmit={event => {
        event.preventDefault();
        void save(draftKey);
      }}>
        <label htmlFor="openai-voice-key" className="text-cap text-t3">Chave API OpenAI</label>
        <input id="openai-voice-key" type="password" autoComplete="off" value={draftKey}
          onChange={event => setDraftKey(event.target.value)}
          placeholder={key ? 'Chave configurada; escreve outra para substituir' : 'Configura a tua chave API'}
          className="min-w-0 rounded-input border border-line bg-black/20 px-3 py-2 text-[12.5px] text-t1" />
        <div className="flex gap-2">
          <button type="submit" disabled={saving || !draftKey.trim()}
            className="rounded-input border border-line px-3 py-1.5 text-cap text-t2 disabled:opacity-40">
            {saving ? 'A guardar…' : 'Guardar chave'}
          </button>
          {key && <button type="button" disabled={saving} className="text-cap text-t3"
            onClick={() => { void save(''); }}>Apagar chave</button>}
        </div>
      </form>
      <p className="text-cap text-t3">{hasVault ? 'A chave é guardada no cofre do sistema.' :
        'Sem cofre neste ambiente: a chave dura só esta sessão e não é guardada no browser.'}</p>
      {message && <p role="status" className="text-cap text-t2">{message}</p>}
      {!key && <p className="text-cap text-t3">Configura a chave para ouvir as amostras.</p>}
      <div role="radiogroup" aria-label="Voz OpenAI" className="flex flex-col gap-1">
        <VoiceOption label="Cedar" selection={{ kind: 'openai', voice: 'cedar' }} />
        <VoiceOption label="Marin" selection={{ kind: 'openai', voice: 'marin' }} />
      </div>
      <p className="text-cap text-t3">Vozes do sistema</p>
      <div role="radiogroup" aria-label="Voz do assistente" className="flex flex-col gap-1">
        <VoiceOption label="Escolha automática" selection={{ kind: 'auto' }} />
        {systemVoices.map(voice => <VoiceOption key={voice.voiceURI} label={voice.name}
          selection={{ kind: 'sistema', voiceURI: voice.voiceURI }} />)}
      </div>
    </div>
  );
}
