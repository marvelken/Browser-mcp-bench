import { useAppContext } from '../context/AppContext';

export function NotesBox() {
  const { draftNote, setDraftNote } = useAppContext();

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Notes</h2>
      <textarea
        value={draftNote}
        onChange={(e) => setDraftNote(e.target.value)}
        placeholder="Type your notes here..."
        style={{
          width: '100%',
          height: 80,
          padding: '0.5rem',
          border: '1px solid #ddd',
          borderRadius: 8,
          fontSize: '0.9rem',
          resize: 'vertical',
        }}
      />
    </div>
  );
}
