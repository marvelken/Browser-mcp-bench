interface Stats {
  revenue: number;
  users: number;
  growth: number;
  tickets: number;
}

export function StatDisplay({ stats }: { stats: Stats }) {
  return (
    <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.5rem' }}>
      <div>Revenue: ${stats.revenue.toLocaleString()}</div>
      <div>Users: {stats.users.toLocaleString()}</div>
      <div>Growth: {stats.growth.toFixed(1)}%</div>
      <div>Tickets: {stats.tickets}</div>
    </div>
  );
}
