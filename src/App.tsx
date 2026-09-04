import { useState } from 'react';
import { AuthScreen } from '@/components/AuthScreen';
import { Dashboard } from '@/components/Dashboard';
import { ToastProvider } from '@/components/Toast';

type AppState = 'auth' | 'dashboard';

function App() {
  const [state, setState] = useState<AppState>('auth');
  const [secret, setSecret] = useState('');
  // bumping this key forces Dashboard to remount fresh after lock/wipe
  const [sessionKey, setSessionKey] = useState(0);

  const handleUnlock = (s: string) => {
    setSecret(s);
    setState('dashboard');
    setSessionKey((k) => k + 1);
  };

  const handleLock = () => {
    setSecret('');
    setState('auth');
  };

  const handleWipe = () => {
    setSecret('');
    setState('auth');
    setSessionKey((k) => k + 1);
  };

  return (
    <ToastProvider>
      {state === 'auth' ? (
        <AuthScreen onUnlock={handleUnlock} />
      ) : (
        <Dashboard
          key={sessionKey}
          secret={secret}
          onLock={handleLock}
          onWipe={handleWipe}
        />
      )}
    </ToastProvider>
  );
}

export default App;
