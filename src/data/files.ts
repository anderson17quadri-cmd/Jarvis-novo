import type { FileEntry } from '@/types/file-entry';

/**
 * Árvore de ficheiros simulada.
 *
 * **Não toca no disco.** O acesso real exige o plugin `fs` do Tauri e diálogos
 * nativos — bloqueado até haver PC (ver `SPEC.md` §2). Serve para a navegação,
 * o histórico e a ordenação estarem prontos e testados quando a leitura real
 * chegar: aí muda-se a origem dos dados e o componente fica como está.
 */

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
const KB = 1024;
const MB = 1024 * KB;

export function seedFiles(now: number = Date.now()): readonly FileEntry[] {
  return [
    {
      id: 'documentos',
      name: 'Documentos',
      kind: 'pasta',
      sizeBytes: null,
      modifiedAt: now - 2 * DAY_MS,
      children: [
        {
          id: 'propostas',
          name: 'Propostas',
          kind: 'pasta',
          sizeBytes: null,
          modifiedAt: now - 5 * HOUR_MS,
          children: [
            {
              id: 'proposta-barbearia',
              name: 'proposta-barbearia-silva.pdf',
              kind: 'documento',
              sizeBytes: 412 * KB,
              modifiedAt: now - 5 * HOUR_MS,
            },
            {
              id: 'orcamento-hardware',
              name: 'orcamento-hardware-revisto.pdf',
              kind: 'documento',
              sizeBytes: 289 * KB,
              modifiedAt: now - 26 * HOUR_MS,
            },
          ],
        },
        {
          id: 'notas-versao',
          name: 'notas-de-versao.md',
          kind: 'documento',
          sizeBytes: 7 * KB,
          modifiedAt: now - 3 * DAY_MS,
        },
      ],
    },
    {
      id: 'projetos',
      name: 'Projetos',
      kind: 'pasta',
      sizeBytes: null,
      modifiedAt: now - 40 * 60_000,
      children: [
        {
          id: 'jarvis',
          name: 'jarvis-ai-os',
          kind: 'pasta',
          sizeBytes: null,
          modifiedAt: now - 40 * 60_000,
          children: [
            {
              id: 'jarvis-lib',
              name: 'lib.rs',
              kind: 'codigo',
              sizeBytes: 11 * KB,
              modifiedAt: now - 2 * DAY_MS,
            },
            {
              id: 'jarvis-app',
              name: 'App.tsx',
              kind: 'codigo',
              sizeBytes: 9 * KB,
              modifiedAt: now - 40 * 60_000,
            },
          ],
        },
        {
          id: 'agendado',
          name: 'agendado',
          kind: 'pasta',
          sizeBytes: null,
          modifiedAt: now - 3 * HOUR_MS,
          children: [
            {
              id: 'agendado-schema',
              name: 'schema.sql',
              kind: 'codigo',
              sizeBytes: 24 * KB,
              modifiedAt: now - 3 * HOUR_MS,
            },
          ],
        },
      ],
    },
    {
      id: 'media',
      name: 'Media',
      kind: 'pasta',
      sizeBytes: null,
      modifiedAt: now - 6 * DAY_MS,
      children: [
        {
          id: 'demo-mp4',
          name: 'demonstracao-agendado.mp4',
          kind: 'video',
          sizeBytes: 184 * MB,
          modifiedAt: now - 6 * DAY_MS,
        },
        {
          id: 'logo-svg',
          name: 'logo-jarvis.svg',
          kind: 'imagem',
          sizeBytes: 18 * KB,
          modifiedAt: now - 11 * DAY_MS,
        },
        {
          id: 'aviso-wav',
          name: 'aviso-sistema.wav',
          kind: 'audio',
          sizeBytes: 640 * KB,
          modifiedAt: now - 14 * DAY_MS,
        },
      ],
    },
    {
      id: 'copia-seguranca',
      name: 'copia-seguranca-2026.zip',
      kind: 'arquivo',
      sizeBytes: 2 * 1024 * MB,
      modifiedAt: now - 4 * DAY_MS,
    },
  ];
}
