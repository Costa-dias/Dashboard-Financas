import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import type { Summary } from '@/lib/finance';
import { formatCurrency } from '@/lib/finance';

interface SummaryCardsProps {
  summary: Summary;
  currency: string;
}

export function SummaryCards({ summary, currency }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Saldo Total',
      value: summary.totalBalance,
      icon: Wallet,
      gradient: 'from-sky-500 to-cyan-600',
      ring: 'shadow-sky-500/20',
      positive: summary.totalBalance >= 0,
    },
    {
      label: 'Receitas do Mês',
      value: summary.monthlyIncome,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-600',
      ring: 'shadow-emerald-500/20',
      positive: true,
    },
    {
      label: 'Despesas do Mês',
      value: summary.monthlyExpenses,
      icon: TrendingDown,
      gradient: 'from-rose-500 to-orange-600',
      ring: 'shadow-rose-500/20',
      positive: false,
    },
    {
      label: 'Taxa de Poupança',
      value: summary.savingsRate,
      icon: PiggyBank,
      gradient: 'from-violet-500 to-purple-600',
      ring: 'shadow-violet-500/20',
      isPercent: true,
      positive: summary.savingsRate >= 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {c.label}
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  c.isPercent
                    ? c.positive
                      ? 'text-slate-900 dark:text-white'
                      : 'text-rose-500 dark:text-rose-400'
                    : c.positive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-rose-500 dark:text-rose-400'
                }`}
              >
                {c.isPercent
                  ? `${c.value.toFixed(1)}%`
                  : formatCurrency(c.value, currency)}
              </p>
            </div>
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg ${c.ring} group-hover:scale-110 transition-transform`}
            >
              <c.icon size={20} className="text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
