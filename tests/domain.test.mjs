import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { computeSummary, accountBalance, isSettled } = await server.ssrLoadModule('/src/lib/finance.ts');
  const { exportXls, importXls, mergeData, generateRecurring } = await server.ssrLoadModule('/src/lib/storage.ts');
  const { exportProtected, importProtected } = await server.ssrLoadModule('/src/lib/encryptedBackup.ts');
  const today = new Date(), iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const tx = { id: 'one', title: 'Teste', amount: 100, type: 'income', category: 'Salário', method: 'PIX', date: iso, notes: '', createdAt: 1, status: 'settled', accountId: 'a' };
  const data = { transactions: [tx, { ...tx, id: 'two', amount: 30, type: 'expense', status: 'planned' }], categories: [{ name: 'Salário', type: 'income' }], budgets: [], settings: { theme: 'light', currency: 'BRL', lastBackupDate: null }, accounts: [{ id: 'a', name: 'Banco', openingBalance: 500 }, { id: 'b', name: 'Carteira', openingBalance: 0 }], transfers: [{ id: 'transfer', from: 'a', to: 'b', amount: 50, date: iso }] };
  const summary = computeSummary(data.transactions, today, 500);
  assert.equal(summary.totalBalance, 600); assert.equal(summary.projectedBalance, 570);
  assert.equal(accountBalance('a', data), 550); assert.equal(accountBalance('b', data), 50);
  assert.equal(isSettled({ ...tx, status: undefined, date: '2099-01-01' }), false);
  assert.equal(isSettled({ ...tx, status: undefined, date: '2000-01-01' }), true);
  const parsed = importXls(await exportXls(data).arrayBuffer());
  assert.deepEqual(parsed, data);
  const merged = mergeData(data, parsed); assert.equal(merged.transactions.length, 2); assert.equal(merged.transfers.length, 1); assert.equal(merged.accounts.length, 2);
  const blob = await exportProtected(data, 'uma-senha-teste-2026');
  assert.ok(!(await blob.text()).includes('Banco'));
  assert.deepEqual(await importProtected(new File([blob], 'backup.json'), 'uma-senha-teste-2026'), data);
  await assert.rejects(() => importProtected(new File([blob], 'backup.json'), 'senha-errada'));
  const entries = generateRecurring({ ...tx, date: '2026-01-31', amount: 100 }, 'installments', 3);
  assert.deepEqual(entries.map(t => t.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(entries.reduce((n, t) => n + Math.round(t.amount * 100), 0), 10000);
  assert.equal(entries[1].status, 'planned');
  console.log('Finanças: legacy/explicit status, projection, accounts/transfers, XLSX roundtrip, merge, protected backup and installments passed.');
} finally { await server.close(); }
