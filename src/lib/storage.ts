import * as XLSX from 'xlsx';
import type { AppData, Budget, Category, Transaction, TxType } from '@/types';
import { decrypt, deriveKey, encrypt, randomSaltB64, sha256Hex } from './crypto';
import { sanitizeTextLimit } from './sanitize';

const PIN_HASH_KEY = 'fd_pin_hash';
const SALT_KEY = 'fd_salt';
const DATA_KEY = 'fd_data_enc';
const THEME_KEY = 'fd_theme';

export const AUTO_LOCK_MS = 10 * 60 * 1000; // 10 minutos

export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Salário', type: 'income' },
  { name: 'Freelance', type: 'income' },
  { name: 'Investimentos', type: 'income' },
  { name: 'Presentes', type: 'income' },
  { name: 'Vendas', type: 'income' },
  { name: 'Outras Receitas', type: 'income' },
  { name: 'Mercado', type: 'expense' },
  { name: 'Aluguel', type: 'expense' },
  { name: 'Contas (Luz, Água, Gás)', type: 'expense' },
  { name: 'Transporte', type: 'expense' },
  { name: 'Restaurantes', type: 'expense' },
  { name: 'Lazer', type: 'expense' },
  { name: 'Saúde', type: 'expense' },
  { name: 'Compras', type: 'expense' },
  { name: 'Educação', type: 'expense' },
  { name: 'Viagem', type: 'expense' },
  { name: 'Assinaturas', type: 'expense' },
  { name: 'Outras Despesas', type: 'expense' },
];

export const DEFAULT_METHODS = [
  'Dinheiro',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Transferência Bancária',
  'PIX',
  'Boleto',
  'Carteira Digital',
  'Outro',
];

function defaultData(): AppData {
  return {
    transactions: [],
    categories: DEFAULT_CATEGORIES,
    budgets: [],
    settings: { theme: 'light', currency: 'BRL', lastBackupDate: null },
  };
}

/** ---- PIN / account management ---- */

export function hasPinSet(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY) && !!localStorage.getItem(SALT_KEY);
}

export async function setupPin(secret: string): Promise<void> {
  const salt = randomSaltB64();
  const hash = await sha256Hex(secret + salt);
  localStorage.setItem(SALT_KEY, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
}

export async function verifyPin(secret: string): Promise<boolean> {
  const salt = localStorage.getItem(SALT_KEY);
  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  if (!salt || !storedHash) return false;
  const hash = await sha256Hex(secret + salt);
  return hash === storedHash;
}

export async function changePin(oldSecret: string, newSecret: string): Promise<boolean> {
  const salt = localStorage.getItem(SALT_KEY);
  if (!salt) return false;
  const oldKey = await deriveKey(oldSecret, salt);
  const raw = localStorage.getItem(DATA_KEY);
  let data: AppData | null = null;
  if (raw) {
    try {
      data = JSON.parse(await decrypt(raw, oldKey)) as AppData;
    } catch {
      return false;
    }
  }
  const newSalt = randomSaltB64();
  const newHash = await sha256Hex(newSecret + newSalt);
  const newKey = await deriveKey(newSecret, newSalt);
  localStorage.setItem(SALT_KEY, newSalt);
  localStorage.setItem(PIN_HASH_KEY, newHash);
  if (data) {
    const enc = await encrypt(JSON.stringify(data), newKey);
    localStorage.setItem(DATA_KEY, enc);
  }
  return true;
}

/** ---- Encrypted data I/O ---- */

export async function loadData(secret: string): Promise<AppData> {
  const salt = localStorage.getItem(SALT_KEY);
  const raw = localStorage.getItem(DATA_KEY);
  if (!salt) return defaultData();
  if (!raw) return defaultData();
  const key = await deriveKey(secret, salt);
  try {
    const plain = await decrypt(raw, key);
    const parsed = JSON.parse(plain) as AppData;
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      categories:
        Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : DEFAULT_CATEGORIES,
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      settings: {
        theme: parsed.settings?.theme ?? 'light',
        currency: parsed.settings?.currency ?? 'BRL',
        lastBackupDate: parsed.settings?.lastBackupDate ?? null,
      },
    };
  } catch {
    throw new Error('PIN incorreto ou dados corrompidos.');
  }
}

export async function saveData(data: AppData, secret: string): Promise<void> {
  const salt = localStorage.getItem(SALT_KEY);
  if (!salt) throw new Error('Sal não encontrado — PIN não configurado.');
  const key = await deriveKey(secret, salt);
  const enc = await encrypt(JSON.stringify(data), key);
  localStorage.setItem(DATA_KEY, enc);
}

export function wipeAll(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(THEME_KEY);
}

/** ---- XLS Export / Import ---- */

export function exportXls(data: AppData): Blob {
  const txRows = data.transactions.map((t) => ({
    'Título': t.title,
    'Valor': t.amount,
    'Tipo': t.type === 'income' ? 'Receita' : 'Despesa',
    'Categoria': t.category,
    'Forma de Pagamento': t.method,
    'Data': t.date,
    'Observações': t.notes,
    'ID': t.id,
    'Criado em': t.createdAt,
  }));

  const ws = XLSX.utils.json_to_sheet(txRows, {
    header: ['Título', 'Valor', 'Tipo', 'Categoria', 'Forma de Pagamento', 'Data', 'Observações', 'ID', 'Criado em'],
  });
  ws['!cols'] = [
    { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 22 },
    { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transações');

  const catRows = data.categories.map((c) => ({
    'Nome': c.name,
    'Tipo': c.type === 'income' ? 'Receita' : 'Despesa',
  }));
  const catWs = XLSX.utils.json_to_sheet(catRows);
  XLSX.utils.book_append_sheet(wb, catWs, 'Categorias');

  const budgetRows = data.budgets.map((b) => ({
    'Categoria': b.category,
    'Limite Mensal': b.limit,
  }));
  const budgetWs = XLSX.utils.json_to_sheet(budgetRows);
  XLSX.utils.book_append_sheet(wb, budgetWs, 'Orçamentos');

  const settingsRows = [
    { 'Configuração': 'Moeda', 'Valor': data.settings.currency },
    { 'Configuração': 'Tema', 'Valor': data.settings.theme },
    { 'Configuração': 'Último Backup', 'Valor': data.settings.lastBackupDate ?? '' },
  ];
  const settingsWs = XLSX.utils.json_to_sheet(settingsRows);
  XLSX.utils.book_append_sheet(wb, settingsWs, 'Configurações');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function importXls(buffer: ArrayBuffer): AppData {
  const wb = XLSX.read(buffer, { type: 'array' });

  const txWs = wb.Sheets['Transações'] ?? wb.Sheets[wb.SheetNames[0]] ?? null;
  let transactions: Transaction[] = [];
  if (txWs) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(txWs);
    transactions = rows
      .map((row): Transaction | null => {
        const title = sanitizeTextLimit(String(row['Título'] ?? row['title'] ?? ''), 80);
        const amount = Number(row['Valor'] ?? row['amount'] ?? 0);
        if (!title || !isFinite(amount) || amount <= 0) return null;
        const tipoStr = String(row['Tipo'] ?? row['tipo'] ?? '').toLowerCase();
        const type: TxType = tipoStr.includes('rece') || tipoStr === 'income' ? 'income' : 'expense';
        const dateStr = String(row['Data'] ?? row['data'] ?? '');
        const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
          ? dateStr
          : new Date().toISOString().slice(0, 10);
        return {
          id: String(row['ID'] ?? row['id'] ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
          title,
          amount: Math.round(amount * 100) / 100,
          type,
          category: sanitizeTextLimit(String(row['Categoria'] ?? row['category'] ?? 'Outras Despesas'), 30),
          method: sanitizeTextLimit(String(row['Forma de Pagamento'] ?? row['method'] ?? 'Outro'), 40),
          date,
          notes: sanitizeTextLimit(String(row['Observações'] ?? row['notes'] ?? ''), 300),
          createdAt: Number(row['Criado em'] ?? row['createdAt'] ?? Date.now()),
        };
      })
      .filter((t): t is Transaction => t !== null);
  }

  let categories = DEFAULT_CATEGORIES;
  const catWs = wb.Sheets['Categorias'];
  if (catWs) {
    const catRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(catWs);
    const parsed: Category[] = catRows
      .map((row): Category | null => {
        const name = sanitizeTextLimit(String(row['Nome'] ?? row['name'] ?? ''), 30);
        if (!name) return null;
        const tipoStr = String(row['Tipo'] ?? row['tipo'] ?? '').toLowerCase();
        return { name, type: tipoStr.includes('rece') || tipoStr === 'income' ? 'income' : 'expense' };
      })
      .filter((c): c is Category => c !== null);
    if (parsed.length > 0) categories = parsed;
  }

  let budgets: Budget[] = [];
  const budgetWs = wb.Sheets['Orçamentos'];
  if (budgetWs) {
    const bRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(budgetWs);
    budgets = bRows
      .map((row): Budget | null => {
        const category = sanitizeTextLimit(String(row['Categoria'] ?? ''), 30);
        const limit = Number(row['Limite Mensal'] ?? 0);
        if (!category || !isFinite(limit) || limit <= 0) return null;
        return { category, limit: Math.round(limit * 100) / 100 };
      })
      .filter((b): b is Budget => b !== null);
  }

  let settings = { theme: 'light' as 'light' | 'dark', currency: 'BRL', lastBackupDate: null as number | null };
  const settingsWs = wb.Sheets['Configurações'];
  if (settingsWs) {
    const sRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(settingsWs);
    for (const row of sRows) {
      const key = String(row['Configuração'] ?? '').toLowerCase();
      const val = String(row['Valor'] ?? '');
      if (key === 'moeda') settings.currency = val || 'BRL';
      if (key === 'tema') settings.theme = val === 'dark' ? 'dark' : 'light';
      if (key === 'último backup' || key === 'ultimo backup') {
        const n = Number(val);
        settings.lastBackupDate = isFinite(n) && n > 0 ? n : null;
      }
    }
  }

  return { transactions, categories, budgets, settings };
}

/** CSV export for the transactions table. */
export function exportCsv(transactions: Transaction[]): Blob {
  const headers = ['Título', 'Valor', 'Tipo', 'Categoria', 'Forma de Pagamento', 'Data', 'Observações'];
  const escapeCsv = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  const rows = transactions.map((t) =>
    [escapeCsv(t.title), String(t.amount), t.type === 'income' ? 'Receita' : 'Despesa',
     escapeCsv(t.category), escapeCsv(t.method), t.date, escapeCsv(t.notes)].join(',')
  );
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

/** Merge imported data into current data. */
export function mergeData(current: AppData, imported: AppData): AppData {
  const byId = new Map<string, Transaction>();
  for (const t of current.transactions) byId.set(t.id, t);
  for (const t of imported.transactions) byId.set(t.id, t);
  const catNames = new Set(current.categories.map((c) => c.name));
  const mergedCats = [...current.categories];
  for (const c of imported.categories) {
    if (!catNames.has(c.name)) {
      mergedCats.push(c);
      catNames.add(c.name);
    }
  }
  const mergedBudgets = [...current.budgets];
  const budgetCats = new Set(mergedBudgets.map((b) => b.category));
  for (const b of imported.budgets) {
    if (!budgetCats.has(b.category)) {
      mergedBudgets.push(b);
      budgetCats.add(b.category);
    }
  }
  return {
    transactions: Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date)),
    categories: mergedCats,
    budgets: mergedBudgets,
    settings: imported.settings ?? current.settings,
  };
}

/** Generate installment / recurrent transaction entries. */
export function generateRecurring(
  base: Transaction,
  mode: 'recurrent' | 'installments',
  count: number
): Transaction[] {
  const groupId = base.groupId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const baseDate = new Date(base.date + 'T00:00:00');
  const total = mode === 'installments' ? count : 1;
  const entries: Transaction[] = [];

  for (let i = 0; i < total; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
    // Clamp day if it overflows (e.g. Jan 31 -> Feb 28)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (d.getDate() > lastDay) d.setDate(lastDay);
    const dateStr = d.toISOString().slice(0, 10);
    entries.push({
      ...base,
      id: i === 0 ? base.id : `${base.id}-inst-${i + 1}`,
      groupId,
      date: dateStr,
      installment: i + 1,
      installmentTotal: mode === 'installments' ? total : undefined,
      recurrent: mode === 'recurrent' || undefined,
      title: mode === 'installments' && total > 1 ? `${base.title} (${i + 1}/${total})` : base.title,
      createdAt: i === 0 ? base.createdAt : Date.now() + i,
    });
  }
  return entries;
}
