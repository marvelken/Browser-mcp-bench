import { useState, useEffect, memo } from 'react';
import { useAppContext } from '../context/AppContext';

interface ActivityRow {
  id: number;
  person: string;
  action: string;
  project: string;
  timestamp: string;
  cost: number;
  impact: number;
}

const TableRow = memo(function TableRow({ row }: { row: ActivityRow }) {
  const { theme } = useAppContext();

  const dateFmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const costFmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  const impactFmt = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const bg = theme === 'dark' ? '#1a1a1a' : row.id % 2 === 0 ? '#f9f9f9' : '#fff';

  return (
    <tr style={{ background: bg }}>
      <td style={{ padding: '4px 8px' }}>{row.id}</td>
      <td style={{ padding: '4px 8px' }}>{row.person}</td>
      <td style={{ padding: '4px 8px' }}>{row.action}</td>
      <td style={{ padding: '4px 8px' }}>{row.project}</td>
      <td style={{ padding: '4px 8px' }}>{dateFmt.format(new Date(row.timestamp))}</td>
      <td style={{ padding: '4px 8px' }}>{costFmt.format(row.cost)}</td>
      <td style={{ padding: '4px 8px' }}>{impactFmt.format(row.impact)}</td>
    </tr>
  );
});

export function ActivityTable() {
  const [rows, setRows] = useState<ActivityRow[]>([]);

  useEffect(() => {
    fetch('/api/activity')
      .then((r) => r.json())
      .then(setRows);
  }, []);

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Activity</h2>
      <div style={{ maxHeight: 500, overflow: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#eee', position: 'sticky', top: 0 }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Person</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Action</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Project</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Time</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Cost</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Impact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TableRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
