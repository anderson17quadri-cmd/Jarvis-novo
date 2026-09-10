import type { Project } from '@/types/project';

/** Projetos de exemplo. Datas relativas — ver `data/README.md`. */

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export function seedProjects(now: number = Date.now()): readonly Project[] {
  return [
    {
      id: 'p1',
      name: 'Agendado',
      description: 'Marcações para barbearias e clínicas, com lembretes automáticos por SMS.',
      status: 'ativo',
      progress: 0.72,
      tags: ['SaaS', 'clientes'],
      updatedAt: now - 3 * HOUR_MS,
      openTasks: 4,
      attachments: [],
    },
    {
      id: 'p2',
      name: 'JARVIS AI OS',
      description: 'Sistema operativo de IA em Tauri, com desktop, janelas e widgets próprios.',
      status: 'ativo',
      progress: 0.45,
      tags: ['Tauri', 'React', 'Rust'],
      updatedAt: now - 40 * 60_000,
      openTasks: 7,
      attachments: [],
    },
    {
      id: 'p3',
      name: 'Voxel Studio — site',
      description: 'Presença institucional e portefólio, com painel de gestão de conteúdos.',
      status: 'pausado',
      progress: 0.3,
      tags: ['web', 'clientes'],
      updatedAt: now - 9 * DAY_MS,
      openTasks: 2,
      attachments: [],
    },
    {
      id: 'p4',
      name: 'Migração de infraestrutura',
      description: 'Passagem dos servidores para contentores, com integração contínua nova.',
      status: 'concluido',
      progress: 1,
      tags: ['infra'],
      updatedAt: now - 21 * DAY_MS,
      openTasks: 0,
      attachments: [],
    },
  ];
}
