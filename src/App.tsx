import { ReleaseVersion } from './ReleaseVersion';
import { lazy, Suspense, useState } from 'react';
import { AuthScreen } from '@/components/AuthScreen';
const Dashboard = lazy(() => import('@/components/Dashboard').then(m => ({ default: m.Dashboard }))); 
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
        <Suspense fallback={<p role="status" className="p-8 text-center">Abrindo painel…</p>}><Dashboard
          key={sessionKey}
          secret={secret}
          onLock={handleLock}
          onWipe={handleWipe}
        /></Suspense>
      )}
      <footer className="px-5 py-4 text-center text-slate-500"><ReleaseVersion /></footer>
    </ToastProvider>
  );
}

export default App;
