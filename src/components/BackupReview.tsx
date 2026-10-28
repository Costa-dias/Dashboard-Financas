import type { AppData } from '@/types';
import { formatCurrency } from '@/lib/finance';

export function BackupReview({ current, incoming, selected, onSelect }: { current: AppData; incoming: AppData; selected: Set<string>; onSelect: (s: Set<string>) => void }) {
  const rows: { key: string; title: string; before: string; after: string }[] = [];
  const transactions = new Map(current.transactions.map(t => [t.id, t]));
  const accounts = new Map(current.accounts?.map(a => [a.id, a]) ?? []);
  const transfers = new Map(current.transfers?.map(t => [t.id, t]) ?? []);
  const money = (n: number) => formatCurrency(n, current.settings.currency);
  for (const t of incoming.transactions) {
    const old = transactions.get(t.id);
    if (old && JSON.stringify(old) !== JSON.stringify(t)) {
      const describe = (x: typeof t) => `${x.title} · ${money(x.amount)} · ${x.date} · ${x.type === 'income' ? 'Receita' : 'Despesa'} · ${x.status ?? 'Status pela data'} · ${x.category} · ${x.method} · conta: ${x.accountId ?? 'sem conta'} · ${x.notes} · recorrente: ${x.recurrent ? 'sim' : 'não'} · parcela: ${x.installment ?? '—'}/${x.installmentTotal ?? '—'} · grupo: ${x.groupId ?? '—'}`;
      rows.push({ key: 'transactions:' + t.id, title: 'Lançamento', before: describe(old), after: describe(t) });
    }
  }
  for (const a of incoming.accounts ?? []) {
    const old = accounts.get(a.id);
    if (old && JSON.stringify(old) !== JSON.stringify(a)) rows.push({ key: 'accounts:' + a.id, title: 'Conta e saldo inicial', before: `${old.name}: ${money(old.openingBalance)}`, after: `${a.name}: ${money(a.openingBalance)}` });
  }
  for (const t of incoming.transfers ?? []) {
    const old = transfers.get(t.id);
    const describe = (x: typeof t, d: AppData) => `${x.date} · ${money(x.amount)} · ${d.accounts?.find(a => a.id === x.from)?.name ?? x.from} → ${d.accounts?.find(a => a.id === x.to)?.name ?? x.to}`;
    if (old && JSON.stringify(old) !== JSON.stringify(t)) rows.push({ key: 'transfers:' + t.id, title: 'Transferência', before: describe(old, current), after: describe(t, incoming) });
  }
  if (JSON.stringify(current.settings) !== JSON.stringify(incoming.settings)) rows.push({ key: 'settings', title: 'Configurações (a moeda não converte os valores)', before: `${current.settings.currency} · ${current.settings.theme} · último backup: ${current.settings.lastBackupDate ? new Date(current.settings.lastBackupDate).toLocaleString('pt-BR') : 'não informado'}`, after: `${incoming.settings.currency} · ${incoming.settings.theme} · último backup: ${incoming.settings.lastBackupDate ? new Date(incoming.settings.lastBackupDate).toLocaleString('pt-BR') : 'não informado'}` });
  return <div className="my-3 rounded border border-amber-400 p-3 text-sm">
    <p>{incoming.transactions.filter(t => !transactions.has(t.id)).length} novos lançamentos; {incoming.transactions.filter(t => transactions.has(t.id) && JSON.stringify(transactions.get(t.id)) === JSON.stringify(t)).length} idênticos. Contas e transferências novas serão adicionadas. Categorias e orçamentos existentes são preservados.</p>
    <p>Por padrão, as versões atuais são mantidas. Marque somente o que deseja substituir pelo backup.</p>
    {rows.map(row => <label key={row.key} className="my-3 block rounded border p-2"><input type="checkbox" checked={selected.has(row.key)} onChange={e => { const next = new Set(selected); if (e.target.checked) next.add(row.key); else next.delete(row.key); onSelect(next); }} /> Substituir {row.title}<span className="block break-words">Atual: {row.before}</span><span className="block break-words">Backup: {row.after}</span></label>)}
    {!rows.length && <p>Nenhum registro existente difere do backup.</p>}
  </div>;
}
