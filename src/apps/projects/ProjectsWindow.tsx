import { useMemo, useState } from 'react';
import { CircleDot, ListTodo, Pause, Check } from 'lucide-react';

import { seedProjects } from '@/data/projects';
import { cn } from '@/lib/cn';
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from '@/types/project';

const STATUS_ICON: Record<ProjectStatus, React.ComponentType<{ className?: string }>> = {
  ativo: CircleDot,
  pausado: Pause,
  concluido: Check,
};

const STATUS_STYLE: Record<ProjectStatus, string> = {
  ativo: 'text-ok',
  pausado: 'text-warn',
  concluido: 'text-t3',
};

/**
 * Projetos.
 *
 * Vista de leitura: estado, progresso, etiquetas e última atividade. Não há
 * edição porque não há para onde a guardar — os projetos reais virão de um
 * repositório ou de um serviço, e inventar um editor local que se perdesse
 * depois seria pior do que não o ter.
 */
export default function ProjectsWindow(): React.JSX.Element {
  const [status, setStatus] = useState<ProjectStatus | null>(null);

  // Uma só semente por montagem: recalcular a cada render faria as datas
  // relativas saltar durante a interação.
  const projects = useMemo(() => seedProjects(), []);

  const visible = projects.filter((project) => status === null || project.status === status);

  return (
    <div className="flex h-full flex-col gap-s2">
      <div className="flex flex-shrink-0 flex-wrap gap-1.5" role="group" aria-label="Estado">
        <StatusChip isActive={status === null} onClick={() => setStatus(null)}>
          Todos
        </StatusChip>
        {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((id) => (
          <StatusChip key={id} isActive={status === id} onClick={() => setStatus(id)}>
            {PROJECT_STATUS_LABELS[id]}
          </StatusChip>
        ))}
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {visible.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}

        {visible.length === 0 && (
          <li className="py-s3 text-center text-desc text-t3">Nenhum projeto neste estado.</li>
        )}
      </ul>
    </div>
  );
}

function ProjectCard({ project }: { readonly project: Project }): React.JSX.Element {
  const Icon = STATUS_ICON[project.status];
  const percent = Math.round(project.progress * 100);

  return (
    <li className="rounded-input border border-line bg-white/[.02] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium">{project.name}</h3>
        <span
          className={cn('flex items-center gap-1 text-[10.5px]', STATUS_STYLE[project.status])}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>

      <p className="mt-1 text-[11.5px] leading-[1.5] text-t3">{project.description}</p>

      <div
        className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[.06]"
        role="progressbar"
        aria-label={`Progresso de ${project.name}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon to-accent transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-t3">
        <span className="mono">{percent}%</span>
        <span className="flex items-center gap-1">
          <ListTodo className="h-3 w-3" aria-hidden="true" />
          {project.openTasks} por fazer
        </span>
        <span>{relativeTime(project.updatedAt)}</span>
        {project.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-line px-1.5 py-px">
            {tag}
          </span>
        ))}
      </p>
    </li>
  );
}

/**
 * "há 3 horas", "há 9 dias".
 *
 * Vive aqui e não em `lib/format.ts` porque é o único sítio que o usa; passa
 * para lá se um segundo o precisar.
 */
function relativeTime(at: number, now: number = Date.now()): string {
  const minutes = Math.round((now - at) / 60_000);

  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

function StatusChip({
  isActive,
  onClick,
  children,
}: {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] transition-all duration-hover ease-out',
        isActive
          ? 'border-accent/60 bg-accent/[.1] text-accent'
          : 'border-line text-t3 hover:border-accent/30 hover:text-t2',
      )}
    >
      {children}
    </button>
  );
}
