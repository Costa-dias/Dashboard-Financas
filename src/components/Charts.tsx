import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { MonthFlow, CategorySlice } from '@/lib/finance';
import { formatCurrency } from '@/lib/finance';
import type { Budget } from '@/types';

const PIE_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#a855f7',
];

interface CashFlowChartProps {
  data: MonthFlow[];
  currency: string;
}

export function CashFlowChart({ data, currency }: CashFlowChartProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
        Fluxo de Caixa — Últimos 6 Meses
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-slate-500 dark:text-slate-400"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'currentColor', fontSize: 12 }}
              className="text-slate-500 dark:text-slate-400"
              axisLine={false}
              tickLine={false}
              width={70}
              tickFormatter={(v: unknown) => formatCurrency(Number(v), currency).replace(/,\d+$/, '')}
            />
            <Tooltip
              formatter={(v) => formatCurrency(Number(v), currency)}
              contentStyle={{
                backgroundColor: 'rgb(15 23 42)',
                border: '1px solid rgb(51 65 85)',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'rgb(148 163 184)' }}
            />
            <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface CategoryPieProps {
  data: CategorySlice[];
  currency: string;
  budgets: Budget[];
}

export function CategoryPieChart({ data, currency, budgets }: CategoryPieProps) {
  const empty = data.length === 0;
  const budgetMap = new Map(budgets.map((b) => [b.category, b.limit]));

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
        Despesas por Categoria — Este Mês
      </h3>
      {empty ? (
        <div className="h-64 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Nenhuma despesa registrada neste mês ainda.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => formatCurrency(Number(v), currency)}
                contentStyle={{
                  backgroundColor: 'rgb(15 23 42)',
                  border: '1px solid rgb(51 65 85)',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '12px',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Budget progress bars */}
      {budgets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Orçamentos
          </h4>
          {data.map((slice) => {
            const limit = budgetMap.get(slice.name);
            if (!limit || limit <= 0) return null;
            const pct = Math.min((slice.value / limit) * 100, 100);
            const over = slice.value > limit;
            const barColor =
              over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <div key={slice.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300 truncate">
                    {slice.name}
                  </span>
                  <span className={`tabular-nums ${over ? 'text-rose-500 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                    {formatCurrency(slice.value, currency)} / {formatCurrency(limit, currency)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {over && (
                  <p className="text-[10px] text-rose-500 mt-0.5">
                    Limite excedido em {formatCurrency(slice.value - limit, currency)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
