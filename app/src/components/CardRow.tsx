import { useState, useEffect } from 'react';
import { ProjectCard } from './ProjectCard';

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

export function CardRow() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, Stats>>({});

  useEffect(() => {
    async function load() {
      const userRes = await fetch('/api/user');
      await userRes.json();

      const projRes = await fetch('/api/projects');
      const projData: Project[] = await projRes.json();
      setProjects(projData);

      const map: Record<number, Stats> = {};
      for (const p of projData) {
        const statsRes = await fetch(`/api/projects/${p.id}/stats`);
        const statsData = await statsRes.json();
        map[p.id] = statsData;
      }
      setStatsMap(map);
    }
    load();
  }, []);

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} stats={statsMap[p.id] ?? null} />
      ))}
    </div>
  );
}
