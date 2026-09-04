import { useRef, useState } from 'react';
import {
  Settings,
  Download,
  Upload,
  KeyRound,
  Trash2,
  Sun,
  Moon,
  Lock,
  Tag,
  Plus,
  X,
  ShieldAlert,
  FileSpreadsheet,
  Wallet,
} from 'lucide-react';

import { Modal, ConfirmDialog } from './Modal';
import { useToast } from './Toast';
import { sanitizeTextLimit } from '@/lib/sanitize';
import { formatCurrency, maskBRL, unmaskBRL } from '@/lib/finance';
import {
  changePin,
  exportXls,
  importXls,
  mergeData,
  wipeAll,
} from '@/lib/storage';
import type { AppData, Budget, Category, TxType } from '@/types';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  data: AppData;
  secret: string;
  onUpdateData: (d: AppData) => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onWipe: () => void;
  onLock: () => void;
  onBackupDone: () => void;
}

type Tab = 'general' | 'categories' | 'budgets' | 'backup' | 'security';

export function SettingsPanel({
  open,
  onClose,
  data,
  secret,
  onUpdateData,
  onThemeChange,
  onWipe,
  onLock,
  onBackupDone,
}: SettingsPanelProps) {
  void secret;
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>('general');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<ArrayBuffer | null>(null);
  const [importName, setImportName] = useState('');

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TxType>('expense');

  const [wipeOpen, setWipeOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  const tabs: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: 'general', label: 'Geral', icon: Settings },
    { id: 'categories', label: 'Categorias', icon: Tag },
    { id: 'budgets', label: 'Orçamentos', icon: Wallet },
    { id: 'backup', label: 'Backup', icon: FileSpreadsheet },
    { id: 'security', label: 'Segurança', icon: ShieldAlert },
  ];

  const expenseCats = data.categories.filter((c) => c.type === 'expense');

  const handleExport = () => {
    try {
      const blob = exportXls(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financas-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onBackupDone();
      notify('success', 'Backup em Excel (.xlsx) baixado com sucesso.');
    } catch {
      notify('error', 'Falha ao exportar o backup.');
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImportFile(reader.result as ArrayBuffer);
    reader.onerror = () => notify('error', 'Não foi possível ler o arquivo selecionado.');
    reader.readAsArrayBuffer(file);
  };

  const handleImport = () => {
    if (!importFile) {
      notify('error', 'Selecione um arquivo de backup primeiro.');
      return;
    }
    try {
      const imported = importXls(importFile);
      const merged = mergeData(data, imported);
      onUpdateData(merged);
      notify('success', 'Backup restaurado e mesclado com sucesso.');
      setImportFile(null);
      setImportName('');
      if (fileRef.current) fileRef.current.value = '';
      setImportConfirmOpen(false);
    } catch {
      notify('error', 'Arquivo inválido ou corrompido.');
    }
  };

  const handleChangePin = async () => {
    if (newPin.length < 4) {
      notify('error', 'O novo PIN deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPin !== confirmPin) {
      notify('error', 'Os novos PINs não coincidem.');
      return;
    }
    setPinBusy(true);
    try {
      const ok = await changePin(oldPin, newPin);
      if (!ok) {
        notify('error', 'O PIN atual está incorreto.');
        setPinBusy(false);
        return;
      }
      notify('success', 'PIN alterado. Por favor, desbloqueie novamente com o novo PIN.');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setPinBusy(false);
      onLock();
    } catch {
      notify('error', 'Não foi possível alterar o PIN.');
      setPinBusy(false);
    }
  };

  const handleAddCategory = () => {
    const name = sanitizeTextLimit(newCatName, 30);
    if (!name) {
      notify('error', 'Digite um nome para a categoria.');
      return;
    }
    if (data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      notify('error', 'Essa categoria já existe.');
      return;
    }
    const cat: Category = { name, type: newCatType };
    onUpdateData({ ...data, categories: [...data.categories, cat] });
    setNewCatName('');
    notify('success', `Categoria "${name}" adicionada.`);
  };

  const handleDeleteCategory = (name: string) => {
    onUpdateData({
      ...data,
      categories: data.categories.filter((c) => c.name !== name),
    });
    notify('info', `Categoria "${name}" removida.`);
  };

  const handleSetBudget = (category: string, limitStr: string) => {
    const limit = unmaskBRL(limitStr);
    const existing = data.budgets.find((b) => b.category === category);
    if (limit <= 0) {
      if (existing) {
        onUpdateData({ ...data, budgets: data.budgets.filter((b) => b.category !== category) });
        notify('info', `Orçamento de "${category}" removido.`);
      }
      return;
    }
    const budget: Budget = { category, limit: Math.round(limit * 100) / 100 };
    const budgets = existing
      ? data.budgets.map((b) => (b.category === category ? budget : b))
      : [...data.budgets, budget];
    onUpdateData({ ...data, budgets });
  };

  const handleWipe = () => {
    wipeAll();
    setWipeOpen(false);
    onWipe();
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Configurações" maxWidth="max-w-2xl">
        {/* Abas */}
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.id
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Geral */}
        {tab === 'general' && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Moeda
              </label>
              <select
                value={data.settings.currency}
                onChange={(e) =>
                  onUpdateData({
                    ...data,
                    settings: { ...data.settings, currency: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
              >
                {['BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'CNY'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Tema
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => onThemeChange('light')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition ${
                    data.settings.theme === 'light'
                      ? 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-950/40'
                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Sun size={16} /> Claro
                </button>
                <button
                  onClick={() => onThemeChange('dark')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition ${
                    data.settings.theme === 'dark'
                      ? 'border-sky-500 text-sky-600 bg-sky-50 dark:bg-sky-950/40'
                      : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Moon size={16} /> Escuro
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Categorias */}
        {tab === 'categories' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                maxLength={30}
                placeholder="Nome da nova categoria"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
              />
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as TxType)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
              <button
                onClick={handleAddCategory}
                className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 transition"
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {data.categories.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/60"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        c.type === 'income'
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {c.type === 'income' ? 'Receita' : 'Despesa'}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      {c.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(c.name)}
                    className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition"
                    aria-label="Remover categoria"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orçamentos */}
        {tab === 'budgets' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Defina um limite mensal para cada categoria de despesa. O painel mostrará uma
              barra de progresso quando você se aproximar do limite.
            </p>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {expenseCats.map((c) => {
                const budget = data.budgets.find((b) => b.category === c.name);
                return (
                  <BudgetRow
                    key={c.name}
                    category={c.name}
                    limit={budget?.limit ?? 0}
                    onSave={handleSetBudget}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Backup */}
        {tab === 'backup' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet size={18} className="text-emerald-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Exportar backup em Excel (.xlsx)
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                Baixa um arquivo Excel com todas as suas transações, categorias, orçamentos e
                configurações. Guarde em local seguro — pode ser usado para restaurar os
                dados depois.
              </p>
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition"
              >
                <Download size={16} /> Baixar planilha Excel
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={18} className="text-sky-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Importar backup
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                Selecione um arquivo Excel (.xlsx) exportado anteriormente. As transações
                serão mescladas por ID, sem duplicar nada.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFilePick}
                className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-600 mb-2"
              />
              {importName && (
                <p className="text-xs text-slate-400 mb-2">Arquivo: {importName}</p>
              )}
              <button
                onClick={() => setImportConfirmOpen(true)}
                disabled={!importFile}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition"
              >
                <Upload size={16} /> Restaurar backup
              </button>
            </div>
          </div>
        )}

        {/* Segurança */}
        {tab === 'security' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound size={18} className="text-sky-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Trocar PIN
                </h4>
              </div>
              <div className="space-y-3">
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="PIN atual"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
                />
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Novo PIN"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
                />
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Confirmar novo PIN"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
                />
                <button
                  onClick={handleChangePin}
                  disabled={pinBusy}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 transition"
                >
                  <KeyRound size={16} /> Atualizar PIN
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock size={18} className="text-sky-500" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Bloquear agora
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Bloqueia o aplicativo imediatamente. Você precisará digitar seu PIN novamente.
              </p>
              <button
                onClick={onLock}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-sky-600 dark:text-sky-400 border border-sky-300 dark:border-sky-700 hover:bg-sky-100 dark:hover:bg-sky-950/40 transition"
              >
                <Lock size={16} /> Bloquear
              </button>
            </div>

            <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 size={18} className="text-rose-500" />
                <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                  Zona de perigo
                </h4>
              </div>
              <p className="text-xs text-rose-600/80 dark:text-rose-400/70 mb-3 leading-relaxed">
                Apaga permanentemente o PIN, todos os dados criptografados e configurações
                deste navegador. Isso não pode ser desfeito.
              </p>
              <button
                onClick={() => setWipeOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                <Trash2 size={16} /> Apagar tudo
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={wipeOpen}
        title="Apagar todos os dados?"
        message="Isso exclui permanentemente seu PIN, todas as transações, categorias e configurações deste navegador. Não há recuperação. Considere exportar um backup primeiro."
        confirmLabel="Sim, apagar tudo"
        danger
        onConfirm={handleWipe}
        onCancel={() => setWipeOpen(false)}
      />
      <ConfirmDialog
        open={importConfirmOpen}
        title="Restaurar backup?"
        message="As transações importadas serão mescladas com seus dados atuais. Entradas existentes com o mesmo ID serão sobrescritas."
        confirmLabel="Restaurar"
        onConfirm={handleImport}
        onCancel={() => setImportConfirmOpen(false)}
      />
    </>
  );
}

// ---- Budget row sub-component ----

function BudgetRow({
  category,
  limit,
  onSave,
}: {
  category: string;
  limit: number;
  onSave: (category: string, limitStr: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(limit > 0 ? maskBRL(String(Math.round(limit * 100))) : '');

  const handleSave = () => {
    onSave(category, val);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/60 gap-2">
      <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">
        {category}
      </span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            value={val}
            onChange={(e) => setVal(maskBRL(e.target.value))}
            placeholder="R$ 0,00"
            className="w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setEditing(false);
                setVal(limit > 0 ? maskBRL(String(Math.round(limit * 100))) : '');
              }
            }}
            autoFocus
          />
          <button
            onClick={handleSave}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition"
          >
            OK
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {limit > 0 ? formatCurrency(limit) : '—'}
          </span>
          <button
            onClick={() => {
              setVal(limit > 0 ? maskBRL(String(Math.round(limit * 100))) : '');
              setEditing(true);
            }}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
          >
            {limit > 0 ? 'Editar' : 'Definir'}
          </button>
        </div>
      )}
    </div>
  );
}
