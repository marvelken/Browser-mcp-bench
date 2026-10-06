import { AppProvider } from './context/AppContext';
import { CardRow } from './components/CardRow';
import { NotesBox } from './components/NotesBox';
import { ActivityTable } from './components/ActivityTable';

function App() {
  return (
    <AppProvider>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Dashboard</h1>
        <CardRow />
        <NotesBox />
        <ActivityTable />
      </div>
    </AppProvider>
  );
}

export default App;
