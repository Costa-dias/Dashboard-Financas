import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { sanitizeTextLimit } from '@/lib/sanitize';
import { DEFAULT_METHODS, generateRecurring } from '@/lib/storage';
import { maskBRL, unmaskBRL } from '@/lib/finance';
import { Plus, Check, X } from 'lucide-react';
import type { Category, Transaction, TxType } from '@/types';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (txs: Transaction[]) => void;
  categories: Category[];
  editing: Transaction | null;
  onAddCategory: (cat: Category) => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type RecurMode = 'none' | 'recurrent' | 'installments';

export function TransactionForm({
  open,
  onClose,
  onSave,
  categories,
  editing,
  onAddCategory,
}: TransactionFormProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TxType>('expense');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState(DEFAULT_METHODS[1]);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Recurring / installments
  const [recurMode, setRecurMode] = useState<RecurMode>('none');
  const [installmentCount, setInstallmentCount] = useState(2);

  // Inline category add
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');

  useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setAmount(maskBRL(String(editing.amount * 100)));
        setType(editing.type);
        setCategory(editing.category);
        setMethod(editing.method);
        setDate(editing.date);
        setNotes(editing.notes);
        setRecurMode('none');
        setInstallmentCount(2);
      } else {
        setTitle('');
        setAmount('');
        setType('expense');
        setCategory('');
        setMethod(DEFAULT_METHODS[1]);
        setDate(todayISO());
        setNotes('');
        setRecurMode('none');
        setInstallmentCount(2);
      }
      setError('');
      setShowInlineCat(false);
      setInlineCatName('');
    }
  }, [open, editing]);

  const typeCats = categories.filter((c) => c.type === type);
  const activeCat = typeCats.find((c) => c.name === category);
  const safeCategory = activeCat ? category : typeCats[0]?.name ?? '';

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(maskBRL(e.target.value));
  };

  const handleInlineAddCategory = () => {
    const name = sanitizeTextLimit(inlineCatName, 30);
    if (!name) {
      setError('Digite um nome para a categoria.');
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setError('Essa categoria já existe.');
      return;
    }
    onAddCategory({ name, type });
    setCategory(name);
    setShowInlineCat(false);
    setInlineCatName('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanTitle = sanitizeTextLimit(title, 80);
    if (!cleanTitle) {
      setError('Digite um título.');
      return;
    }
    const amt = unmaskBRL(amount);
    if (!isFinite(amt) || amt <= 0) {
      setError('Digite um valor válido maior que zero.');
      return;
    }
    if (!safeCategory) {
      setError('Escolha uma categoria.');
      return;
    }
    if (!date) {
      setError('Escolha uma data.');
      return;
    }
    const baseTx: Transaction = {
      id: editing?.id ?? genId(),
      title: cleanTitle,
      amount: Math.round(amt * 100) / 100,
      type,
      category: safeCategory,
      method: sanitizeTextLimit(method, 40),
      date,
      notes: sanitizeTextLimit(notes, 300),
      createdAt: editing?.createdAt ?? Date.now(),
    };

    if (editing) {
      onSave([baseTx]);
      return;
    }

    if (recurMode === 'recurrent') {
      // Create 12 monthly entries for a yearly preview
      const entries = generateRecurring(baseTx, 'recurrent', 12);
      onSave(entries);
    } else if (recurMode === 'installments' && installmentCount >= 2) {
      const entries = generateRecurring(baseTx, 'installments', installmentCount);
      onSave(entries);
    } else {
      onSave([baseTx]);
    }
  };

  const submitBtnClass =
    type === 'income'
      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
      : 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/20';

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar Transação' : 'Nova Transação'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`rounded-lg py-2.5 text-sm font-semibold transition ${
              type === 'expense'
                ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Despesa
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`rounded-lg py-2.5 text-sm font-semibold transition ${
              type === 'income'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Receita
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Título
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
              placeholder="Ex: Compra no mercado"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Valor
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={handleAmountChange}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
              placeholder="R$ 0,00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Categoria
            </label>
            <div className="flex gap-1.5">
              <select
                value={safeCategory}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
              >
                {typeCats.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowInlineCat((s) => !s)}
                className="shrink-0 rounded-lg w-9 h-9 flex items-center justify-center border border-slate-300 dark:border-slate-600 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition"
                aria-label="Adicionar categoria"
                title="Adicionar nova categoria"
              >
                <Plus size={16} />
              </button>
            </div>
            {showInlineCat && (
              <div className="flex gap-1.5 mt-1.5 animate-[fadeIn_0.15s_ease]">
                <input
                  value={inlineCatName}
                  onChange={(e) => setInlineCatName(e.target.value)}
                  maxLength={30}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInlineAddCategory();
                    }
                  }}
                  placeholder="Nome da categoria"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={handleInlineAddCategory}
                  className="shrink-0 rounded-lg w-8 h-8 flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 transition"
                  aria-label="Confirmar"
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineCat(false);
                    setInlineCatName('');
                  }}
                  className="shrink-0 rounded-lg w-8 h-8 flex items-center justify-center border border-slate-300 dark:border-slate-600 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="Cancelar"
                >
                  <X size={15} />
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Forma de Pagamento
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
            >
              {DEFAULT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Data
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
          />
        </div>

        {/* Recorrência / Parcelamento */}
        {!editing && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Recorrência e Parcelamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRecurMode('none')}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  recurMode === 'none'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Única
              </button>
              <button
                type="button"
                onClick={() => setRecurMode('recurrent')}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  recurMode === 'recurrent'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Recorrente (Mensal)
              </button>
              <button
                type="button"
                onClick={() => setRecurMode('installments')}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  recurMode === 'installments'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Parcelado
              </button>
            </div>
            {recurMode === 'recurrent' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Serão criadas 12 entradas mensais a partir da data escolhida (um ano de
                lançamentos).
              </p>
            )}
            {recurMode === 'installments' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  Nº de parcelas:
                </label>
                <select
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
                >
                  {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-400">
                  ({maskBRL(String(Math.round(unmaskBRL(amount) / installmentCount * 100)))} por parcela)
                </span>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Observações <span className="text-slate-400">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            rows={2}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition resize-none"
            placeholder="Qualquer detalhe extra…"
          />
        </div>

        {error && (
          <p className="text-sm text-rose-500 dark:text-rose-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition shadow-md ${submitBtnClass}`}
          >
            {editing
              ? 'Salvar alterações'
              : recurMode === 'installments'
              ? `Criar ${installmentCount}x parcelas`
              : recurMode === 'recurrent'
              ? 'Criar 12 lançamentos'
              : 'Adicionar transação'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
