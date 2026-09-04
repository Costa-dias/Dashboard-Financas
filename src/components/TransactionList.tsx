import { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  Inbox,
  Download,
  Repeat,
} from 'lucide-react';
import { exportCsv } from '@/lib/storage';
import type { Category, Transaction } from '@/types';
import {
  availableMonths,
  filterTransactions,
  formatCurrency,
  formatDateBR,
  type FilterOptions,
} from '@/lib/finance';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  onAdd: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TransactionList({
  transactions,
  categories,
  currency,
  onAdd,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [category, setCategory] = useState('all');
  const [type, setType] = useState<FilterOptions['type']>('all');
  const [showFilters, setShowFilters] = useState(false);

  const months = useMemo(() => availableMonths(transactions), [transactions]);
  const catOptions = useMemo(
    () => Array.from(new Set(categories.map((c) => c.name))).sort(),
    [categories]
  );

  const filtered = useMemo(
    () => filterTransactions(transactions, { search, month, category, type }),
    [transactions, search, month, category, type]
  );

  const activeFilters = month !== 'all' || category !== 'all' || type !== 'all';

  const clearFilters = () => {
    setMonth('all');
    setCategory('all');
    setType('all');
    setSearch('');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 p-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Transações
            <span className="ml-2 text-xs font-normal text-slate-400">
              {filtered.length} exibida(s)
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const blob = exportCsv(filtered);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
              title="Exportar para CSV"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                activeFilters
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40'
                  : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Filter size={14} />
              Filtros
            </button>
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition shadow-sm"
            >
              <Plus size={14} />
              Nova
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, categoria, pagamento, observações…"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition"
          />
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-[fadeIn_0.15s_ease]">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
            >
              <option value="all">Todos os meses</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
            >
              <option value="all">Todas as categorias</option>
              {catOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as FilterOptions['type'])}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-sky-500 outline-none transition"
              >
                <option value="all">Todos os tipos</option>
                <option value="income">Receitas</option>
                <option value="expense">Despesas</option>
              </select>
              {activeFilters && (
                <button
                  onClick={clearFilters}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition whitespace-nowrap"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="max-h-[28rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma transação encontrada com esses filtros.
            </p>
            <button
              onClick={onAdd}
              className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition"
            >
              <Plus size={14} />
              Adicionar primeira transação
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    t.type === 'income'
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {t.type === 'income' ? (
                    <ArrowUpCircle size={18} />
                  ) : (
                    <ArrowDownCircle size={18} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {t.title}
                    </p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                      {t.category}
                    </span>
                    {t.recurrent && (
                      <span className="text-[10px] flex items-center gap-0.5 text-sky-500 dark:text-sky-400 font-medium">
                        <Repeat size={10} /> Recorrente
                      </span>
                    )}
                    {t.installment && t.installmentTotal && t.installmentTotal > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 font-medium">
                        {t.installment}/{t.installmentTotal}x
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {formatDateBR(t.date)}
                    {' · '}
                    {t.method}
                    {t.notes ? ` · ${t.notes}` : ''}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold tabular-nums shrink-0 ${
                    t.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {t.type === 'income' ? '+' : '−'}
                  {formatCurrency(t.amount, currency)}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => onEdit(t)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition"
                    aria-label="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(t)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition"
                    aria-label="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
