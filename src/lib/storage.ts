import * as XLSX from 'xlsx';
import type { AppData, Budget, Category, Transaction, TxType } from '@/types';
import { decrypt, deriveKey, encrypt, randomSaltB64, sha256Hex } from './crypto';
import { sanitizeTextLimit } from './sanitize';
import { isISODate, validAmount, MAX_BACKUP_BYTES, MAX_TRANSACTIONS } from './validation';

const PIN_HASH_KEY = 'fd_pin_hash';
const SALT_KEY = 'fd_salt';
const DATA_KEY = 'fd_data_enc';
const THEME_KEY = 'fd_theme';
let expectedCipher: string | null | undefined;
let writeQueue: Promise<void> = Promise.resolve();
export class DataConflictError extends Error {
  constructor() {
    super('Outra aba alterou os dados. Exporte suas alterações pendentes, bloqueie e abra novamente antes de continuar.');
    this.name = 'DataConflictError';
  }
}

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
    expectedCipher = enc;
  }
  return true;
}

/** ---- Encrypted data I/O ---- */

export async function loadData(secret: string): Promise<AppData> {
  const salt = localStorage.getItem(SALT_KEY);
  const raw = localStorage.getItem(DATA_KEY);
  expectedCipher = raw;
  if (!salt && raw) throw new Error('Dados existentes sem a chave local. Não apague o armazenamento; restaure um backup.');
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

export function saveData(data: AppData, secret: string): Promise<void> {
  // Capture the snapshot before awaiting: callers cannot mutate an in-flight save.
  const json = JSON.stringify(data, (_key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Dados contêm um número inválido.');
    return value;
  });
  const task = async () => {
    const operation = async () => {
      const salt = localStorage.getItem(SALT_KEY);
      if (!salt) throw new Error('Sal não encontrado — PIN não configurado.');
      const current = localStorage.getItem(DATA_KEY);
      if (expectedCipher === undefined) expectedCipher = current;
      if (current !== expectedCipher) throw new DataConflictError();
      const key = await deriveKey(secret, salt);
      const enc = await encrypt(json, key);
      if (localStorage.getItem(DATA_KEY) !== current || localStorage.getItem(SALT_KEY) !== salt) throw new DataConflictError();
      localStorage.setItem(DATA_KEY, enc);
      expectedCipher = enc;
    };
    if (typeof navigator !== 'undefined' && navigator.locks) {
      await navigator.locks.request('financas-data-write', operation);
    } else {
      await operation();
    }
  };
  const result = writeQueue.then(task);
  writeQueue = result.catch(() => undefined);
  return result;
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
    'Grupo': t.groupId,
    'Parcela': t.installment,
    'Total de Parcelas': t.installmentTotal,
    'Recorrente': t.recurrent,
  }));

  const ws = XLSX.utils.json_to_sheet(txRows, {
    header: ['Título', 'Valor', 'Tipo', 'Categoria', 'Forma de Pagamento', 'Data', 'Observações', 'ID', 'Criado em', 'Grupo', 'Parcela', 'Total de Parcelas', 'Recorrente'],
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
    { 'Configuração': 'Versão do Backup', 'Valor': 2 },
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
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Selecione uma planilha de até 5 MB.');
  }
  const wb = XLSX.read(buffer, { type: 'array', sheetRows: MAX_TRANSACTIONS + 2, cellFormula: false, bookVBA: false });
  if (wb.SheetNames.length > 8) throw new Error('A planilha contém abas demais.');
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!fullref'] ?? sheet['!ref'] ?? 'A1');
    if (range.e.r >= MAX_TRANSACTIONS + 1 || range.e.c > 40) {
      throw new Error('A planilha excede o limite de linhas ou colunas.');
    }
  }
  const txWs = wb.Sheets['Transações'] ?? wb.Sheets[wb.SheetNames[0]];
  if (!txWs) throw new Error('A planilha não contém transações.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(txWs);
  const ids = new Set<string>();
  function fail(row: number, field: string): never {
    throw new Error(`Linha ${row + 2}: ${field} inválido. Nenhum dado foi importado.`);
  }
  function parseDate(value: unknown): string {
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return '';
      return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const text = String(value ?? '').trim();
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    return br ? `${br[3]}-${br[2]}-${br[1]}` : text;
  }
  function parseType(value: unknown): TxType | null {
    const text = String(value ?? '').toLowerCase();
    if (['receita', 'income'].includes(text)) return 'income';
    if (['despesa', 'expense'].includes(text)) return 'expense';
    return null;
  }
  const transactions: Transaction[] = rows.map((row, i) => {
    const title = sanitizeTextLimit(String(row['Título'] ?? row['title'] ?? ''), 80);
    const amount = Number(row['Valor'] ?? row['amount']);
    const date = parseDate(row['Data'] ?? row['data']);
    const type = parseType(row['Tipo'] ?? row['tipo']);
    const id = String(row['ID'] ?? row['id'] ?? crypto.randomUUID());
    const createdAt = Number(row['Criado em'] ?? row['createdAt'] ?? Date.now());
    if (!title) fail(i, 'título');
    if (!validAmount(amount)) fail(i, 'valor');
    if (!isISODate(date)) fail(i, 'data');
    if (!type) fail(i, 'tipo');
    if (!id || id.length > 200 || ids.has(id)) fail(i, 'ID duplicado ou');
    if (!Number.isSafeInteger(createdAt) || createdAt < 0) fail(i, 'horário de criação');
    ids.add(id);
    const tx: Transaction = {
      id, title, amount: Math.round(amount * 100) / 100, type, date, createdAt,
      category: sanitizeTextLimit(String(row['Categoria'] ?? row['category'] ?? 'Outras Despesas'), 30),
      method: sanitizeTextLimit(String(row['Forma de Pagamento'] ?? row['method'] ?? 'Outro'), 40),
      notes: sanitizeTextLimit(String(row['Observações'] ?? row['notes'] ?? ''), 300),
    };
    if (row['Grupo'] !== undefined && row['Grupo'] !== '') {
      const group = String(row['Grupo']);
      if (group.length > 200) fail(i, 'grupo');
      tx.groupId = group;
    }
    for (const [label, key] of [['Parcela', 'installment'], ['Total de Parcelas', 'installmentTotal']] as const) {
      if (row[label] !== undefined && row[label] !== '') {
        const n = Number(row[label]);
        if (!Number.isInteger(n) || n < 1 || n > 120) fail(i, label);
        tx[key] = n;
      }
    }
    if (tx.installmentTotal && tx.installment && tx.installment > tx.installmentTotal) fail(i, 'parcela');
    if (row['Recorrente'] !== undefined && row['Recorrente'] !== '') {
      const value = row['Recorrente'];
      if (![true, false, 'true', 'false', 1, 0].includes(value as boolean)) fail(i, 'recorrência');
      tx.recurrent = value === true || value === 'true' || value === 1;
    }
    return tx;
  });
  const categorySheet = wb.Sheets['Categorias'];
  let categories = DEFAULT_CATEGORIES;
  if (categorySheet) {
    const categoryRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(categorySheet);
    if (categoryRows.length > 1000) throw new Error('Há categorias demais na planilha.');
    const names = new Set<string>();
    const parsed = categoryRows.map((row) => {
      const name = sanitizeTextLimit(String(row['Nome'] ?? row['name'] ?? ''), 30);
      const type = parseType(row['Tipo'] ?? row['tipo']);
      if (!name || !type || names.has(name)) throw new Error('Categoria inválida ou duplicada na planilha.');
      names.add(name);
      return { name, type };
    });
    if (parsed.length) categories = parsed;
  }
  const budgets: Budget[] = [];
  if (wb.Sheets['Orçamentos']) {
    for (const row of XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Orçamentos'])) {
      const category = sanitizeTextLimit(String(row['Categoria'] ?? ''), 30);
      const limit = Number(row['Limite Mensal']);
      if (!category || !validAmount(limit)) throw new Error('Orçamento inválido na planilha.');
      budgets.push({ category, limit: Math.round(limit * 100) / 100 });
    }
  }
  const settings = { theme: 'light' as 'light' | 'dark', currency: 'BRL', lastBackupDate: null as number | null };
  if (wb.Sheets['Configurações']) {
    for (const row of XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Configurações'])) {
      const key = String(row['Configuração'] ?? '').toLowerCase();
      const value = String(row['Valor'] ?? '');
      if (key === 'versão do backup' && Number(value) > 2) throw new Error('Backup de uma versão mais recente.');
      if (key === 'moeda') {
        if (!/^[A-Z]{3}$/.test(value)) throw new Error('Moeda inválida na planilha.');
        try { new Intl.NumberFormat('pt-BR', {style:'currency',currency:value}); } catch { throw new Error('Moeda inválida na planilha.'); }
        settings.currency = value;
      }
      if (key === 'tema') {
        if (!['light', 'dark'].includes(value)) throw new Error('Tema inválido na planilha.');
        settings.theme = value as 'light' | 'dark';
      }
      if (key === 'último backup' || key === 'ultimo backup') {
        if (value !== '') {
          const n = Number(value);
          if (!Number.isSafeInteger(n) || n < 0) throw new Error('Data de backup inválida.');
          settings.lastBackupDate = n;
        }
      }
    }
  }
  return { transactions, categories, budgets, settings };
}

/** CSV export for the transactions table. */
export function exportCsv(transactions: Transaction[]): Blob {
  const headers = ['Título', 'Valor', 'Tipo', 'Categoria', 'Forma de Pagamento', 'Data', 'Observações'];
  const escapeCsv = (input: string): string => {
    const val = /^[\s]*[=+\-@]/.test(input) || /^[\t\r\n]/.test(input) ? `'${input}` : input;
    if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
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
  const [year, month, day] = base.date.split('-').map(Number);
  if (!isISODate(base.date) || !validAmount(base.amount) || !Number.isInteger(count) || count < 1 || count > 120) {
    throw new Error('Valor, data ou quantidade inválidos.');
  }
  const total = count;
  const cents = Math.round(base.amount * 100);
  if (mode === 'installments' && cents < count) throw new Error('Cada parcela deve valer ao menos um centavo.');
  const entries: Transaction[] = [];

  for (let i = 0; i < total; i++) {
    const target = new Date(Date.UTC(year, month - 1 + i, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    const dateStr = target.toISOString().slice(0, 10);
    entries.push({
      ...base,
      amount: mode === 'installments' ? (Math.floor(cents / count) + (i < cents % count ? 1 : 0)) / 100 : base.amount,
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
