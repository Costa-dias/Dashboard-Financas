import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Settings, Lock, Plus, Moon, Sun, AlertTriangle } from 'lucide-react';
import { SummaryCards } from './SummaryCards';
import { CashFlowChart, CategoryPieChart } from './Charts';
import { TransactionList } from './TransactionList';
import { TransactionForm } from './TransactionForm';
import { SettingsPanel } from './SettingsPanel';
import { ConfirmDialog } from './Modal';
import { useToast } from './Toast';
import {
  categoryBreakdown,
  computeSummary,
  formatCurrency,
  monthlyCashFlow,
} from '@/lib/finance';
import { loadData, saveData, AUTO_LOCK_MS } from '@/lib/storage';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useTheme } from '@/hooks/useTheme';
import type { AppData, Category, Transaction } from '@/types';

const BACKUP_REMINDER_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

interface DashboardProps {
  secret: string;
  onLock: () => void;
  onWipe: () => void;
}

export function Dashboard({ secret, onLock, onWipe }: DashboardProps) {
  const { notify } = useToast();
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  useTheme(data?.settings.theme ?? 'light');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await loadData(secret);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Falha ao carregar dados.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoLock(AUTO_LOCK_MS, onLock, data !== null);

  const persist = useCallback(
    async (next: AppData) => {
      setData(next);
      try {
        await saveData(next, secret);
      } catch {
        notify('error', 'Não foi possível salvar — o armazenamento pode estar cheio.');
      }
    },
    [secret, notify]
  );

  const summary = useMemo(
    () => (data ? computeSummary(data.transactions) : null),
    [data]
  );
  const flow = useMemo(
    () => (data ? monthlyCashFlow(data.transactions) : []),
    [data]
  );
  const breakdown = useMemo(
    () => (data ? categoryBreakdown(data.transactions) : []),
    [data]
  );

  const backupNeeded = useMemo(() => {
    const last = data?.settings.lastBackupDate;
    if (!last) return data !== null && data.transactions.length > 0;
    return Date.now() - last > BACKUP_REMINDER_MS;
  }, [data]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <p className="text-rose-500 font-medium">{loadError}</p>
          <button
            onClick={onLock}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 transition"
          >
            Voltar ao desbloqueio
          </button>
        </div>
      </div>
    );
  }

  if (!data || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleSaveTxs = (txs: Transaction[]) => {
    if (txs.length === 0) return;
    const first = txs[0];
    const exists = data.transactions.some((t) => t.id === first.id);
    const idSet = new Set(txs.map((t) => t.id));
    let nextTxs: Transaction[];
    if (editing) {
      nextTxs = data.transactions
        .filter((t) => !idSet.has(t.id))
        .concat(txs);
    } else if (exists) {
      nextTxs = data.transactions.map((t) => {
        const match = txs.find((tx) => tx.id === t.id);
        return match ?? t;
      });
    } else {
      nextTxs = [...txs, ...data.transactions];
    }
    const next: AppData = { ...data, transactions: nextTxs };
    persist(next);
    setFormOpen(false);
    setEditing(null);
    const count = txs.length;
    notify(
      'success',
      count > 1
        ? `${count} transações criadas com sucesso.`
        : editing
        ? 'Transação atualizada.'
        : 'Transação adicionada.'
    );
  };

  const handleDeleteTx = () => {
    if (!deleteTarget) return;
    // If part of a group, ask to delete all or just one
    const groupId = deleteTarget.groupId;
    const next: AppData = {
      ...data,
      transactions: data.transactions.filter((t) => t.id !== deleteTarget.id),
    };
    persist(next);
    notify('info', 'Transação excluída.');
    setDeleteTarget(null);
    void groupId;
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setFormOpen(true);
  };

  const handleThemeToggle = () => {
    const next = data.settings.theme === 'light' ? 'dark' : 'light';
    persist({ ...data, settings: { ...data.settings, theme: next } });
  };

  const handleAddCategory = (cat: Category) => {
    persist({ ...data, categories: [...data.categories, cat] });
  };

  const handleBackupDone = () => {
    persist({ ...data, settings: { ...data.settings, lastBackupDate: Date.now() } });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-md shadow-sky-500/20">
              <Wallet size={18} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                Finanças Seguras
              </h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Criptografado no dispositivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {formatCurrency(summary.totalBalance, data.settings.currency)}
            </span>
            {backupNeeded && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition mr-1"
                title="Faça um backup — já faz mais de 30 dias"
              >
                <AlertTriangle size={14} />
                <span className="hidden sm:inline">Backup</span>
              </button>
            )}
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition shadow-sm sm:hidden"
              aria-label="Nova transação"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={handleThemeToggle}
              className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Alternar tema"
            >
              {data.settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              onClick={onLock}
              className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Bloquear"
            >
              <Lock size={18} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Configurações"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <SummaryCards summary={summary} currency={data.settings.currency} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CashFlowChart data={flow} currency={data.settings.currency} />
          <CategoryPieChart
            data={breakdown}
            currency={data.settings.currency}
            budgets={data.budgets}
          />
        </div>

        <TransactionList
          transactions={data.transactions}
          categories={data.categories}
          currency={data.settings.currency}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={(t) => setDeleteTarget(t)}
        />
      </main>

      <TransactionForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSaveTxs}
        categories={data.categories}
        editing={editing}
        onAddCategory={handleAddCategory}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        data={data}
        secret={secret}
        onUpdateData={persist}
        onThemeChange={(theme) => persist({ ...data, settings: { ...data.settings, theme } })}
        onWipe={onWipe}
        onLock={onLock}
        onBackupDone={handleBackupDone}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir transação?"
        message={`"${deleteTarget?.title}" no valor de ${formatCurrency(
          deleteTarget?.amount ?? 0,
          data.settings.currency
        )} será removida permanentemente.`}
        confirmLabel="Excluir"
        danger
        onConfirm={handleDeleteTx}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
