import type { AppData, Transaction } from '@/types';
import { isISODate, validAmount, MAX_BACKUP_BYTES } from './validation';
export interface TurnoReceipt { id: string; title: string; amount: number; date: string; dateInferred: boolean; }
export function parseTurnoTransfer(text: string): TurnoReceipt[] {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('O arquivo excede 5 MB.');
  const value = JSON.parse(text);
  if (!value || value.format !== 'turnoextra-receipts' || value.version !== 1 || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 20000) throw new Error('Selecione um arquivo de recebimentos exportado pelo TurnoExtra.');
  const seen = new Set<string>();
  return value.entries.map((e: TurnoReceipt) => {
    if (!e || typeof e.id !== 'string' || !e.id.startsWith('turnoextra:') || e.id.length > 200 || seen.has(e.id) || typeof e.title !== 'string' || !e.title.trim() || e.title.length > 80 || !validAmount(e.amount) || Math.abs(e.amount * 100 - Math.round(e.amount * 100)) > 0.0001 || typeof e.date !== 'string' || !isISODate(e.date) || typeof e.dateInferred !== 'boolean') throw new Error('O arquivo contém um recebimento inválido ou duplicado.');
    seen.add(e.id); return { id: e.id, title: e.title, amount: e.amount, date: e.date, dateInferred: e.dateInferred };
  });
}
export function receiptState(data: AppData, item: TurnoReceipt): 'new' | 'same' | 'changed' {
  const old = data.transactions.find(t => t.id === item.id);
  return !old ? 'new' : old.amount === item.amount && old.date === item.date && old.title === item.title && old.type === 'income' && old.status === 'settled' ? 'same' : 'changed';
}
export function applyTurnoTransfer(data: AppData, entries: TurnoReceipt[], ids: Set<string>, accountId: string, category: string): AppData {
  if (data.settings.currency !== 'BRL') throw new Error('A transferência usa reais; selecione BRL.');
  if (accountId && !data.accounts?.some(a => a.id === accountId)) throw new Error('Conta não encontrada.');
  if (!data.categories.some(c => c.type === 'income' && c.name === category)) throw new Error('Selecione uma categoria de receita.');
  const byId = new Map(data.transactions.map(t => [t.id, t]));
  for (const e of entries) {
    if (!ids.has(e.id) || receiptState(data, e) === 'same') continue;
    const old = byId.get(e.id);
    const tx: Transaction = { ...old, id: e.id, title: e.title, amount: e.amount, date: e.date, type: 'income', status: 'settled', accountId: old ? old.accountId : accountId || undefined, category: old ? old.category : category, method: old?.method ?? 'Outro', notes: old?.notes ?? `Importado do TurnoExtra.${e.dateInferred ? ' Data herdada do serviço; conferir.' : ''}`, createdAt: old?.createdAt ?? Date.now() };
    byId.set(e.id, tx);
  }
  if (byId.size > 20000) throw new Error('A importação excederia o limite de 20.000 transações.');
  return { ...data, transactions: [...byId.values()] };
}
