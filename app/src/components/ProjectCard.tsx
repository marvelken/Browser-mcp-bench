import { ErrorBoundary } from './ErrorBoundary';
import { StatDisplay } from './StatDisplay';

interface Project {
  id: number;
  name: string;
  status: string;
  owner: string;
}

interface Stats {
  revenue: number;
  users: number;
  growth: number;
  tickets: number;
}

export function ProjectCard({ project, stats }: { project: Project; stats: Stats | null }) {
  const statusColor = project.status === 'active' ? '#2a7' : project.status === 'paused' ? '#c90' : '#888';

  return (
    <div style={{
      flex: 1,
      border: '1px solid #ddd',
      borderRadius: 8,
      padding: '1rem',
      background: '#fff',
    }}>
      <div style={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: '1rem' }}>
        {project.name}
      </div>
      <div style={{ fontSize: '0.8rem', color: statusColor, marginTop: 4 }}>
        {project.status}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
        Owner: {project.owner}
      </div>
      <ErrorBoundary>
        {stats && <StatDisplay stats={stats} />}
      </ErrorBoundary>
    </div>
  );
}
