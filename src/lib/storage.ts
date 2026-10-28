import type { AppData, Category, Transaction } from '@/types';
import { decrypt, deriveKey, encrypt, randomSaltB64, sha256Hex } from './crypto';
import { isISODate, validAmount } from './validation';

const PIN_HASH_KEY = 'fd_pin_hash';
const SALT_KEY = 'fd_salt';
const DATA_KEY = 'fd_data_enc';
const VAULT_KEY = 'fd_vault_v2';
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

type Vault = { version: 2; salt: string; verifier: string; cipher: string | null };
function snapshot() {
  const packed = localStorage.getItem(VAULT_KEY);
  if (packed) {
    const vault = JSON.parse(packed) as Vault;
    if (vault.version !== 2 || !vault.salt || !vault.verifier || (vault.cipher !== null && typeof vault.cipher !== 'string')) throw new Error('Cofre inválido. Preserve o armazenamento e restaure um backup.');
    return { ...vault, token: packed, legacy: false };
  }
  const salt = localStorage.getItem(SALT_KEY) ?? '';
  const verifier = localStorage.getItem(PIN_HASH_KEY) ?? '';
  const cipher = localStorage.getItem(DATA_KEY);
  return { salt, verifier, cipher, token: JSON.stringify([salt, verifier, cipher]), legacy: true };
}
async function authenticates(secret: string, v: ReturnType<typeof snapshot>) {
  if (!v.salt || !v.verifier) return false;
  if (v.legacy) return await sha256Hex(secret + v.salt) === v.verifier;
  try { return await decrypt(v.verifier, await deriveKey(secret, v.salt)) === 'financas-vault-v2'; } catch { return false; }
}
function queued<T>(operation: () => Promise<T>): Promise<T> {
  const task = async (): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request('financas-data-write', operation);
    return await operation();
  };
  const result = writeQueue.then(task);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}
function commitVault(vault: Vault, previous: string) {
  if (snapshot().token !== previous) throw new DataConflictError();
  const packed = JSON.stringify(vault);
  // One atomic storage write: failure preserves the complete previous vault.
  localStorage.setItem(VAULT_KEY, packed);
  expectedCipher = packed;
  // Never fall back to obsolete credentials after migration.
  for (const key of [PIN_HASH_KEY, SALT_KEY, DATA_KEY]) {
    try { localStorage.removeItem(key); } catch { /* The committed vault remains authoritative. */ }
  }
}
export function hasPinSet(): boolean { const v = snapshot(); return !!v.salt && !!v.verifier; }
export function setupPin(secret: string): Promise<void> {
  return queued(async () => {
    const previous = snapshot();
    if (previous.salt || previous.cipher) throw new Error('Já existe um cofre neste navegador.');
    const salt = randomSaltB64(), key = await deriveKey(secret, salt);
    const verifier = await encrypt('financas-vault-v2', key);
    commitVault({ version: 2, salt, verifier, cipher: null }, previous.token);
  });
}
export async function verifyPin(secret: string): Promise<boolean> { return authenticates(secret, snapshot()); }
export function changePin(oldSecret: string, newSecret: string): Promise<boolean> {
  return queued(async () => {
    const old = snapshot();
    if (!(await authenticates(oldSecret, old))) return false;
    if (expectedCipher !== undefined && old.token !== expectedCipher) throw new DataConflictError();
    const plain = old.cipher ? await decrypt(old.cipher, await deriveKey(oldSecret, old.salt)) : null;
    const salt = randomSaltB64(), key = await deriveKey(newSecret, salt);
    const verifier = await encrypt('financas-vault-v2', key);
    const cipher = plain === null ? null : await encrypt(plain, key);
    commitVault({ version: 2, salt, verifier, cipher }, old.token);
    return true;
  });
}
export async function loadData(secret: string): Promise<AppData> {
  const v = snapshot();
  if (!(await authenticates(secret, v))) throw new Error('PIN incorreto ou cofre inválido.');
  let parsed: AppData;
  try { parsed = v.cipher ? JSON.parse(await decrypt(v.cipher, await deriveKey(secret, v.salt))) : defaultData(); }
  catch { throw new Error('PIN incorreto ou dados corrompidos.'); }
  if (snapshot().token !== v.token) throw new DataConflictError();
  expectedCipher = v.token;
  return {
    ...parsed,
    accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
    budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
    settings: { theme: parsed.settings?.theme ?? 'light', currency: parsed.settings?.currency ?? 'BRL', lastBackupDate: parsed.settings?.lastBackupDate ?? null },
  };
}
export function saveData(data: AppData, secret: string): Promise<void> {
  const json = JSON.stringify(data, (_key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Dados contêm um número inválido.');
    return value;
  });
  return queued(async () => {
    const old = snapshot();
    if (expectedCipher !== undefined && old.token !== expectedCipher) throw new DataConflictError();
    if (!(await authenticates(secret, old))) throw new Error('O PIN mudou. Desbloqueie novamente.');
    const key = await deriveKey(secret, old.salt);
    const verifier = old.legacy ? await encrypt('financas-vault-v2', key) : old.verifier;
    const cipher = await encrypt(json, key);
    commitVault({ version: 2, salt: old.salt, verifier, cipher }, old.token);
  });
}
export function wipeAll(): void {
  for (const key of [VAULT_KEY, PIN_HASH_KEY, SALT_KEY, DATA_KEY, THEME_KEY]) localStorage.removeItem(key);
  expectedCipher = undefined;
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
export function mergeData(current: AppData, imported: AppData, replace?: Set<string>): AppData {
  const byId = new Map<string, Transaction>();
  for (const t of current.transactions) byId.set(t.id, t);
  for (const t of imported.transactions) if (!byId.has(t.id) || !replace || replace.has('transactions:' + t.id)) byId.set(t.id, t);
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
    accounts: Array.from(new Map([...(current.accounts ?? []), ...(imported.accounts ?? []).filter(a => !current.accounts?.some(c => c.id === a.id) || !replace || replace.has('accounts:' + a.id))].map(a => [a.id, a])).values()),
    transfers: Array.from(new Map([...(current.transfers ?? []), ...(imported.transfers ?? []).filter(t => !current.transfers?.some(c => c.id === t.id) || !replace || replace.has('transfers:' + t.id))].map(t => [t.id, t])).values()),
    categories: mergedCats,
    budgets: mergedBudgets,
    settings: !replace || replace.has('settings') ? imported.settings ?? current.settings : current.settings,
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
      status: i === 0 ? base.status : 'planned',
      installment: i + 1,
      installmentTotal: mode === 'installments' ? total : undefined,
      recurrent: mode === 'recurrent' || undefined,
      title: mode === 'installments' && total > 1 ? `${base.title} (${i + 1}/${total})` : base.title,
      createdAt: i === 0 ? base.createdAt : Date.now() + i,
    });
  }
  return entries;
}
