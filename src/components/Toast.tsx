import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  notify: (type: ToastType, message: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-[calc(100vw-2.5rem)] max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-start gap-3 rounded-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-4 py-3 shadow-lg animate-[slideIn_0.2s_ease]"
          >
            {t.type === 'success' && (
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            )}
            {t.type === 'error' && (
              <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            )}
            {t.type === 'info' && (
              <Info size={18} className="text-sky-500 shrink-0 mt-0.5" />
            )}
            <p className="text-sm text-slate-700 dark:text-slate-200 flex-1 leading-snug">
              {t.message}
            </p>
            <button
              onClick={() => remove(t.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
