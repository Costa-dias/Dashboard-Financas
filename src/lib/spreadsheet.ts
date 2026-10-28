import * as XLSX from 'xlsx';
import type { AppData, Budget, Transaction, TxType, Account, Transfer } from '@/types';
import { DEFAULT_CATEGORIES } from './storage';
import { sanitizeTextLimit } from './sanitize';
import { isISODate, validAmount, MAX_BACKUP_BYTES, MAX_TRANSACTIONS } from './validation';

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
    'Status': t.status ?? '',
    'Conta ID': t.accountId ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(txRows, {
    header: ['Título', 'Valor', 'Tipo', 'Categoria', 'Forma de Pagamento', 'Data', 'Observações', 'ID', 'Criado em', 'Grupo', 'Parcela', 'Total de Parcelas', 'Recorrente', 'Status', 'Conta ID'],
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

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.accounts ?? []), 'Contas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.transfers ?? []), 'Transferências');

  const settingsRows = [
    { 'Configuração': 'Versão do Backup', 'Valor': 3 },
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
    if (row['Status'] !== undefined && row['Status'] !== '') {
      if (!['settled', 'planned'].includes(String(row['Status']))) fail(i, 'status');
      tx.status = row['Status'] as 'settled' | 'planned';
    }
    if (row['Conta ID'] !== undefined && row['Conta ID'] !== '') {
      tx.accountId = String(row['Conta ID']);
      if (tx.accountId.length > 200) fail(i, 'conta');
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
      if (key === 'versão do backup' && Number(value) > 3) throw new Error('Backup de uma versão mais recente.');
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
  const accounts: Account[] = [];
  const accountIds = new Set<string>();
  if (wb.Sheets['Contas']) for (const row of XLSX.utils.sheet_to_json<Account>(wb.Sheets['Contas'])) {
    if (accounts.length >= 100 || typeof row.id !== 'string' || !row.id || row.id.length > 200 || accountIds.has(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 60 || !Number.isFinite(row.openingBalance) || Math.abs(row.openingBalance) > 1e12) throw new Error('Conta inválida no backup.');
    accountIds.add(row.id); accounts.push({ id: row.id, name: row.name, openingBalance: row.openingBalance });
  }
  for (const tx of transactions) if (tx.accountId && !accountIds.has(tx.accountId)) throw new Error('Transação aponta para uma conta ausente.');
  const transfers: Transfer[] = [];
  const transferIds = new Set<string>();
  if (wb.Sheets['Transferências']) for (const row of XLSX.utils.sheet_to_json<Transfer>(wb.Sheets['Transferências'])) {
    if (transfers.length >= MAX_TRANSACTIONS || typeof row.id !== 'string' || !row.id || row.id.length > 200 || transferIds.has(row.id) || !accountIds.has(row.from) || !accountIds.has(row.to) || row.from === row.to || !validAmount(row.amount) || typeof row.date !== 'string' || !isISODate(row.date)) throw new Error('Transferência inválida no backup.');
    transferIds.add(row.id); transfers.push({ id: row.id, from: row.from, to: row.to, amount: row.amount, date: row.date });
  }
  return { transactions, categories, budgets, settings, accounts, transfers };
}

