import { useRef, useState } from 'react';
import type { AppData } from '@/types';
import { applyTurnoTransfer, parseTurnoTransfer, receiptState, type TurnoReceipt } from '@/lib/turnoTransfer';
import { formatCurrency } from '@/lib/finance';
export function TurnoImport({ data, onUpdate }: { data: AppData; onUpdate: (data: AppData) => Promise<boolean> }) {
  const [entries, setEntries] = useState<TurnoReceipt[]>([]), [selected, setSelected] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState(''), [category, setCategory] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const sequence = useRef(0), input = useRef<HTMLInputElement>(null);
  const categories = data.categories.filter(c => c.type === 'income');
  const chosenCategory = categories.some(c => c.name === category) ? category : categories[0]?.name ?? '';
  const actionable = entries.filter(e => selected.has(e.id) && receiptState(data, e) !== 'same');
  const field = 'w-full rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-800';
  return <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><summary className="cursor-pointer font-semibold">Importar recebimentos do TurnoExtra</summary>
    <p className="my-3 text-sm text-slate-500">No TurnoExtra, abra Configurações → Transferir recebimentos para o Dashboard. Este fluxo copia recebimentos; não sincroniza nem apaga dados de nenhum aplicativo.</p>
    <label className="block text-sm">Arquivo de recebimentos (.json, até 5 MB)<input ref={input} className={field} type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0], current = ++sequence.current; setEntries([]); setSelected(new Set()); setMessage(''); if (!file) return;
      if (!file.size || file.size > 5 * 1024 * 1024) { setMessage('Selecione um arquivo de até 5 MB.'); return; }
      setBusy(true); try { const parsed = parseTurnoTransfer(await file.text()); if (current !== sequence.current) return; setEntries(parsed); setSelected(new Set(parsed.filter(x => receiptState(data, x) === 'new').map(x => x.id))); } catch (error) { setMessage(error instanceof Error ? error.message : 'Arquivo inválido.'); } finally { if (current === sequence.current) setBusy(false); }
    }} /></label>
    {entries.length > 0 && <div className="mt-4 space-y-3">
      <p className="text-sm">Prévia: {entries.filter(e => receiptState(data, e) === 'new').length} novos · {entries.filter(e => receiptState(data, e) === 'same').length} já importados · {entries.filter(e => receiptState(data, e) === 'changed').length} alterados.</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Conta para novos recebimentos<select className={field} value={account} onChange={e => setAccount(e.target.value)}><option value="">Sem conta definida</option>{data.accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="text-sm">Categoria para novos recebimentos<select className={field} value={chosenCategory} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c.name}>{c.name}</option>)}</select></label></div>
      <p className="text-xs text-slate-500">Alterados começam desmarcados: selecione para substituir título, valor, data e situação. Conta, categoria e observações já existentes são preservadas. Remoções no TurnoExtra não excluem receitas automaticamente.</p>
      <div className="max-h-72 space-y-2 overflow-y-auto">{entries.map(e => {
        const state = receiptState(data, e), old = data.transactions.find(t => t.id === e.id);
        return <label key={e.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><input type="checkbox" disabled={busy || state === 'same'} checked={selected.has(e.id) && state !== 'same'} onChange={() => setSelected(prev => { const next = new Set(prev); if (next.has(e.id)) next.delete(e.id); else next.add(e.id); return next; })} /><span className="min-w-0 break-words">{e.title} · {e.date} · {formatCurrency(e.amount, data.settings.currency)}<br />{state === 'new' ? 'Novo' : state === 'same' ? 'Já importado — será ignorado' : `Alterado — antes: ${old?.date}, ${formatCurrency(old?.amount ?? 0, data.settings.currency)}`}{e.dateInferred && ' · Data herdada do serviço: confira'}</span></label>;
      })}</div>
      <p className="text-sm">{actionable.length} recebimento(s) selecionado(s). Os valores exportados pelo TurnoExtra são em reais.</p>
      <button disabled={busy || !actionable.length || data.settings.currency !== 'BRL'} className="rounded-lg bg-sky-600 px-4 py-2 text-white disabled:opacity-50" onClick={async () => {
        if (busy) return; setBusy(true); try { const next = applyTurnoTransfer(data, entries, selected, account, chosenCategory); if (await onUpdate(next)) { setMessage('Recebimentos importados. Reimportar o mesmo arquivo não cria duplicatas.'); setEntries([]); setSelected(new Set()); if (input.current) input.current.value = ''; } } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível importar.'); } finally { setBusy(false); }
      }}>Confirmar importação</button>{data.settings.currency !== 'BRL' && <p role="alert" className="text-amber-600">Mude a moeda para BRL antes de importar valores em reais. Não há conversão cambial.</p>}
    </div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </details>;
}
