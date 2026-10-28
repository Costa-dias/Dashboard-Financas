import { useState } from 'react';
import type { AppData } from '@/types';
import { accountBalance, formatCurrency, localToday, isSettled } from '@/lib/finance';
import { validAmount } from '@/lib/validation';

export function AccountsPanel({ data, onUpdate }: { data: AppData; onUpdate: (d: AppData) => Promise<boolean> }) {
  const [name, setName] = useState(''), [opening, setOpening] = useState('0');
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [amount, setAmount] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<string, string>>({});
  const accounts = data.accounts ?? [];
  const unassigned = data.transactions.filter(t => !t.accountId && isSettled(t));
  const unassignedBalance = unassigned.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  const field = 'rounded-lg border p-2 bg-white dark:bg-slate-800';
  return <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
    <summary className="cursor-pointer font-semibold">Contas e transferências</summary>
    <p className="my-2 text-sm text-slate-500">Informe o saldo inicial anterior aos lançamentos cadastrados para não contar o mesmo valor duas vezes. Transferências não são receitas nem despesas.</p>
    <p className="my-2 text-sm">Sem conta: {unassigned.length} lançamentos realizados · saldo líquido {formatCurrency(unassignedBalance, data.settings.currency)}. Esses valores entram no saldo geral, mas não no saldo de uma conta.</p>
    {accounts.map(a => <div key={a.id} className="my-3 rounded border p-3"><p>{a.name}: {formatCurrency(accountBalance(a.id, data), data.settings.currency)}</p><label className="text-sm">Saldo conferido (não altera lançamentos)<input className={field} type="number" step="0.01" value={checked[a.id] ?? ''} onChange={e => setChecked({ ...checked, [a.id]: e.target.value })} /></label>{checked[a.id]?.trim() && Number.isFinite(Number(checked[a.id])) && <p role="status">Diferença entre conferido e calculado: {formatCurrency(Number(checked[a.id]) - accountBalance(a.id, data), data.settings.currency)}. Confira datas, saldo inicial e lançamentos. Esta comparação fica apenas nesta sessão.</p>}</div>)}
    <form className="my-3 flex flex-wrap gap-2" onSubmit={async e => {
      e.preventDefault(); if (busy) return; setError('');
      const value = Number(opening);
      if (!name.trim() || !Number.isFinite(value) || Math.abs(value) > 1e12 || accounts.length >= 100 || accounts.some(a => a.name.toLowerCase() === name.trim().toLowerCase())) { setError('Confira nome único e saldo inicial da conta.'); return; }
      setBusy(true); try { if (await onUpdate({ ...data, accounts: [...accounts, { id: crypto.randomUUID(), name: name.trim().slice(0, 60), openingBalance: Math.round(value * 100) / 100 }] })) { setName(''); setOpening('0'); } } finally { setBusy(false); }
    }}>
      <input className={field} aria-label="Nome da conta" placeholder="Nome da conta" maxLength={60} value={name} onChange={e => setName(e.target.value)} required />
      <input className={field} aria-label="Saldo inicial" type="number" step="0.01" value={opening} onChange={e => setOpening(e.target.value)} required />
      <button disabled={busy} className={field}>Adicionar conta</button>
    </form>
    {accounts.length >= 2 && <form className="flex flex-wrap gap-2" onSubmit={async e => {
      e.preventDefault(); if (busy) return; setError(''); const value = Math.round(Number(amount) * 100) / 100;
      if (from === to || !accounts.some(a => a.id === from) || !accounts.some(a => a.id === to) || !validAmount(value)) { setError('Selecione duas contas diferentes e um valor positivo.'); return; }
      setBusy(true); try { if (await onUpdate({ ...data, transfers: [...(data.transfers ?? []), { id: crypto.randomUUID(), from, to, amount: value, date: localToday() }] })) setAmount(''); } finally { setBusy(false); }
    }}>
      <select className={field} aria-label="Conta de origem" value={from} onChange={e => setFrom(e.target.value)} required><option value="">Origem</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <select className={field} aria-label="Conta de destino" value={to} onChange={e => setTo(e.target.value)} required><option value="">Destino</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input className={field} type="number" min="0.01" step="0.01" aria-label="Valor da transferência" placeholder="Valor" value={amount} onChange={e => setAmount(e.target.value)} required />
      <button disabled={busy} className={field}>Transferir hoje</button>
    </form>}
    <div className="mt-3 max-h-48 overflow-y-auto">{[...(data.transfers ?? [])].reverse().map(t => <div className="my-2 flex flex-wrap justify-between gap-2 text-sm" key={t.id}>
      <span>{t.date}: {accounts.find(a => a.id === t.from)?.name} → {accounts.find(a => a.id === t.to)?.name} · {formatCurrency(t.amount, data.settings.currency)}</span>
      <button disabled={busy} onClick={async () => { if (!confirm('Excluir esta transferência?')) return; setBusy(true); try { await onUpdate({ ...data, transfers: data.transfers?.filter(x => x.id !== t.id) }); } finally { setBusy(false); } }}>Excluir transferência</button>
    </div>)}</div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
  </details>;
}
