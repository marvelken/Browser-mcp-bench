import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface AppContextValue {
  user: { id: number; name: string; role: string; avatar: string } | null;
  theme: 'light' | 'dark';
  draftNote: string;
  setDraftNote: (note: string) => void;
}

const AppContext = createContext<AppContextValue>({
  user: null,
  theme: 'light',
  draftNote: '',
  setDraftNote: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppContextValue['user']>(null);
  const [theme] = useState<'light' | 'dark'>('light');
  const [draftNote, setDraftNote] = useState('');

  useEffect(() => {
    fetch('/api/user')
      .then((r) => r.json())
      .then(setUser);
  }, []);

  return (
    <AppContext.Provider value={{ user, theme, draftNote, setDraftNote }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
