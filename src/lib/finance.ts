import type { Transaction } from '@/types';

export interface Summary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
}

export function computeSummary(transactions: Transaction[], refDate = new Date()): Summary {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  let totalBalance = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  for (const t of transactions) {
    const dt = new Date(t.date + 'T00:00:00');
    if (t.type === 'income') totalBalance += t.amount;
    else totalBalance -= t.amount;
    if (dt.getFullYear() === y && dt.getMonth() === m) {
      if (t.type === 'income') monthlyIncome += t.amount;
      else monthlyExpenses += t.amount;
    }
  }
  const savingsRate =
    monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;
  return { totalBalance, monthlyIncome, monthlyExpenses, savingsRate };
}

export interface MonthFlow {
  label: string;
  income: number;
  expenses: number;
  net: number;
}

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function monthlyCashFlow(transactions: Transaction[], months = 6): MonthFlow[] {
  const now = new Date();
  const result: MonthFlow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = MESES_CURTO[d.getMonth()];
    let income = 0;
    let expenses = 0;
    for (const t of transactions) {
      const td = new Date(t.date + 'T00:00:00');
      if (td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth()) {
        if (t.type === 'income') income += t.amount;
        else expenses += t.amount;
      }
    }
    result.push({ label, income, expenses, net: income - expenses });
  }
  return result;
}

export interface CategorySlice {
  name: string;
  value: number;
}

export function categoryBreakdown(
  transactions: Transaction[],
  refDate = new Date()
): CategorySlice[] {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const td = new Date(t.date + 'T00:00:00');
    if (td.getFullYear() !== y || td.getMonth() !== m) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export interface FilterOptions {
  search: string;
  month: string;
  category: string;
  type: 'all' | 'income' | 'expense';
}

export function filterTransactions(
  transactions: Transaction[],
  opts: FilterOptions
): Transaction[] {
  const q = opts.search.trim().toLowerCase();
  return transactions
    .filter((t) => {
      if (opts.type !== 'all' && t.type !== opts.type) return false;
      if (opts.category !== 'all' && t.category !== opts.category) return false;
      if (opts.month !== 'all' && !t.date.startsWith(opts.month)) return false;
      if (q) {
        const hay = `${t.title} ${t.category} ${t.method} ${t.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export function formatCurrency(amount: number, currency = 'BRL'): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `R$ ${amount.toFixed(2).replace('.', ',')}`;
  }
}

const MESES_LONGO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function availableMonths(transactions: Transaction[]): { value: string; label: string }[] {
  const set = new Set<string>();
  for (const t of transactions) set.add(t.date.slice(0, 7));
  return Array.from(set)
    .sort((a, b) => b.localeCompare(a))
    .map((value) => {
      const [y, m] = value.split('-');
      const label = `${MESES_LONGO[Number(m) - 1]} de ${y}`;
      return { value, label };
    });
}

export function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Format a number as BRL currency input mask (e.g. 1000 -> "R$ 10,00"). */
export function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  const value = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Parse a BRL-masked string back to a number. */
export function unmaskBRL(masked: string): number {
  const digits = masked.replace(/\D/g, '');
  if (digits === '') return 0;
  return parseInt(digits, 10) / 100;
}
