import { useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, KeyRound, Wallet } from 'lucide-react';
import { hasPinSet, setupPin, verifyPin, AUTO_LOCK_MS } from '@/lib/storage';

interface AuthScreenProps {
  onUnlock: (secret: string) => void;
}

export function AuthScreen({ onUnlock }: AuthScreenProps) {
  const existing = hasPinSet();
  const [mode] = useState<'create' | 'unlock'>(existing ? 'unlock' : 'create');
  const [secret, setSecret] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const validate = (s: string): string | null => {
    if (s.length < 4) return 'Digite pelo menos 4 caracteres.';
    if (s.length > 64) return 'Máximo de 64 caracteres.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const vErr = validate(secret);
    if (vErr) {
      setError(vErr);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'create') {
        if (secret !== confirm) {
          setError('As entradas não coincidem. Confirme seu PIN.');
          setBusy(false);
          return;
        }
        await setupPin(secret);
        onUnlock(secret);
      } else {
        const ok = await verifyPin(secret);
        if (!ok) {
          setError('PIN incorreto. Tente novamente.');
          setBusy(false);
          return;
        }
        onUnlock(secret);
      }
    } catch {
      setError('Algo deu errado. Tente novamente.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-100 via-sky-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-sky-500/30 mb-4">
            <Wallet size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finanças Seguras</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Painel financeiro privado — criptografado no seu dispositivo
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-5">
            {mode === 'create' ? (
              <>
                <ShieldCheck size={20} className="text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Crie seu PIN mestre
                </h2>
              </>
            ) : (
              <>
                <Lock size={20} className="text-sky-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Digite seu PIN para desbloquear
                </h2>
              </>
            )}
          </div>

          {mode === 'create' && (
            <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-4 py-3">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                Seu PIN criptografa todos os dados com AES-256 e nunca é armazenado em texto
                puro. Não há recuperação — se esquecer, seus dados não poderão ser
                descriptografados.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                {mode === 'create' ? 'PIN mestre ou senha' : 'PIN ou senha'}
              </label>
              <div className="relative">
                <KeyRound
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={show ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
                  placeholder="4 a 64 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  aria-label={show ? 'Ocultar' : 'Mostrar'}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {mode === 'create' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Confirmar PIN
                </label>
                <div className="relative">
                  <KeyRound
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
                    placeholder="Digite novamente para confirmar"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-rose-500 dark:text-rose-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition shadow-md shadow-sky-500/20"
            >
              {mode === 'create' ? 'Criar cofre' : 'Desbloquear'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
            Bloqueia automaticamente após {Math.round(AUTO_LOCK_MS / 60000)} minutos sem uso
          </p>
        </div>
      </div>
    </div>
  );
}
