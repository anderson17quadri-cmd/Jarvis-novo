import { useCallback, useEffect, useRef, useState } from 'react';

import { voiceService, type RecordSampleResult } from '@/services/voice-service';

/** Quanto tempo grava, no máximo, antes de parar sozinho. */
const MAX_DURATION_MS = 12_000;

/** A frase para cada motivo de falha — nunca "não funcionou" sem mais nada. */
const MOTIVO_MESSAGES: Partial<Record<string, string>> = {
  'sem-suporte': 'Este ambiente não permite gravar áudio.',
  'not-allowed':
    'O Windows recusou o acesso ao microfone. Em Definições → Privacidade e segurança → Microfone, permita o acesso a aplicações de escrivaninha.',
  'audio-capture': 'Não encontrei nenhum microfone ligado a este dispositivo.',
  'sem-audio': 'Não ficou nada gravado. Tenta falar assim que a gravação começar.',
  'local-service-unavailable':
    'O serviço de voz local parou a meio do envio. Confirma se ainda está a correr e tenta outra vez.',
};

function describeMotivo(motivo: string): string {
  return MOTIVO_MESSAGES[motivo] ?? motivo;
}

export interface VoiceSampleRecorderState {
  readonly status: 'inativo' | 'a gravar' | 'a enviar' | 'sucesso' | 'erro';
  /** Segundos que faltam até parar sozinho, só relevante durante "a gravar". */
  readonly segundosRestantes: number;
  readonly erro: string | null;
  /** Começa a gravar. Sem efeito se já houver uma gravação em curso. */
  start(): void;
  /** Termina a gravação já — o que foi dito até agora é o que se envia. */
  stopEarly(): void;
}

/**
 * Grava uns segundos da voz de quem usa o sistema e manda ao serviço local
 * (Parte 7.1 §Voz clonada local, sub-fase 4.2) — `voiceService.recordVoiceSample`
 * faz o trabalho a sério; isto só junta o estado que a interface precisa
 * (contagem decrescente, status, mensagem de erro).
 */
export function useVoiceSampleRecorder(onSuccess?: () => void): VoiceSampleRecorderState {
  const [status, setStatus] = useState<VoiceSampleRecorderState['status']>('inativo');
  const [segundosRestantes, setSegundosRestantes] = useState(Math.ceil(MAX_DURATION_MS / 1000));
  const [erro, setErro] = useState<string | null>(null);
  const handleRef = useRef<ReturnType<typeof voiceService.recordVoiceSample> | null>(null);

  useEffect(() => {
    if (status !== 'a gravar') return undefined;

    const inicio = Date.now();
    const intervalo = setInterval(() => {
      const restanteMs = Math.max(0, MAX_DURATION_MS - (Date.now() - inicio));
      setSegundosRestantes(Math.ceil(restanteMs / 1000));
    }, 250);

    return () => clearInterval(intervalo);
  }, [status]);

  const start = useCallback((): void => {
    if (status === 'a gravar' || status === 'a enviar') return;

    setStatus('a gravar');
    setSegundosRestantes(Math.ceil(MAX_DURATION_MS / 1000));
    setErro(null);

    const handle = voiceService.recordVoiceSample(MAX_DURATION_MS);
    handleRef.current = handle;

    void handle.result.then((resultado: RecordSampleResult) => {
      handleRef.current = null;
      setStatus('a enviar');

      if (resultado.ok) {
        setStatus('sucesso');
        onSuccess?.();
      } else {
        setStatus('erro');
        setErro(describeMotivo(resultado.motivo));
      }
    });
  }, [onSuccess, status]);

  const stopEarly = useCallback((): void => {
    handleRef.current?.stop();
    setStatus('a enviar');
  }, []);

  return { status, segundosRestantes, erro, start, stopEarly };
}
