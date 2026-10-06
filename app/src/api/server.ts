import type { Connect } from 'vite';

const FIXED_DELAY = 350; // ms, deterministic

const user = {
  id: 1,
  name: 'Alice Chen',
  role: 'Engineering Manager',
  avatar: 'https://i.pravatar.cc/48?u=alice',
};

const projects = [
  { id: 1, name: 'Frontend Redesign', status: 'active', owner: 'Bob' },
  { id: 2, name: 'API Migration', status: 'active', owner: 'Carol' },
  { id: 3, name: 'InfrastructureMonitoringDashboardForProductionServices', status: 'active', owner: 'Dave' },
  { id: 4, name: 'Mobile App', status: 'paused', owner: 'Eve' },
  { id: 5, name: 'Data Pipeline', status: 'active', owner: 'Frank' },
  { id: 6, name: 'Auth Service', status: 'active', owner: 'Grace' },
  { id: 7, name: 'Search Engine', status: 'active', owner: 'Hank' },
  { id: 8, name: 'Analytics', status: 'completed', owner: 'Irene' },
];

function makeStats(projectId: number) {
  const base = projectId * 1234;
  return {
    revenue: 50000 + (base % 30000),
    users: 1200 + (base % 800),
    growth: 2.5 + ((base % 100) / 10),
    tickets: 15 + (base % 20),
  };
}

function makeStatsForProject5() {
  return {
    data: {
      revenue: 68000,
      users: 1850,
      growth: 4.2,
      tickets: 22,
    },
  };
}

function generateActivity() {
  const actions = ['deployed', 'merged PR', 'opened issue', 'closed ticket', 'reviewed PR', 'updated docs'];
  const people = ['Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank', 'Irene'];
  const rows = [];
  for (let i = 0; i < 1500; i++) {
    rows.push({
      id: i + 1,
      person: people[i % people.length],
      action: actions[i % actions.length],
      project: projects[i % projects.length].name,
      timestamp: new Date(2024, 0, 1, 9, i).toISOString(),
      cost: 100 + ((i * 73) % 900),
      impact: ((i * 31) % 100) / 10,
    });
  }
  return rows;
}

const activityData = generateActivity();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockApi(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url || '';

    if (url === '/api/user') {
      await delay(80);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(user));
      return;
    }

    if (url === '/api/projects') {
      await delay(80);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(projects));
      return;
    }

    const statsMatch = url.match(/^\/api\/projects\/(\d+)\/stats$/);
    if (statsMatch) {
      const projectId = parseInt(statsMatch[1], 10);
      await delay(FIXED_DELAY);
      res.setHeader('Content-Type', 'application/json');
      if (projectId === 5) {
        res.end(JSON.stringify(makeStatsForProject5()));
      } else {
        res.end(JSON.stringify(makeStats(projectId)));
      }
      return;
    }

    if (url === '/api/activity') {
      await delay(80);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(activityData));
      return;
    }

    next();
  };
}
