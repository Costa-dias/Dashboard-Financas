import assert from 'node:assert/strict';
import { createServer } from 'vite';
const map = new Map(); let fail = false;
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => map.get(k) ?? null, setItem: (k,v) => { if (fail && k === 'fd_vault_v2') throw new Error('QuotaExceeded'); map.set(k,v); }, removeItem: k => map.delete(k) }, configurable: true });
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
 const s = await server.ssrLoadModule('/src/lib/storage.ts');
 const c = await server.ssrLoadModule('/src/lib/crypto.ts');
 await s.setupPin('582946');
 assert.equal(await s.changePin('wrong','new-secret'), false);
 const d = await s.loadData('582946'); d.transactions.push({id:'t',title:'Preservar',amount:600,type:'income',category:'Salário',method:'PIX',date:'2026-10-27',notes:'',createdAt:1});
 await s.saveData(d,'582946'); const original=map.get('fd_vault_v2'); fail=true;
 await assert.rejects(()=>s.changePin('582946','new-secret'));
 assert.equal(map.get('fd_vault_v2'),original); assert.equal(await s.verifyPin('582946'),true);
 assert.equal((await s.loadData('582946')).transactions[0].amount,600);
 fail=false; await s.changePin('582946','new-secret');
 assert.equal(await s.verifyPin('582946'),false); assert.equal(await s.verifyPin('new-secret'),true);
 await assert.rejects(()=>s.saveData(d,'582946'));
 assert.equal((await s.loadData('new-secret')).transactions[0].amount,600);
 // A queued save completes before the PIN rotation, retaining its payload.
 d.transactions[0].amount=700;
 await Promise.all([s.saveData(d,'new-secret'),s.changePin('new-secret','third-secret')]);
 assert.equal((await s.loadData('third-secret')).transactions[0].amount,700);
 // Another tab changes the authoritative token: stale writer must fail.
 const v=JSON.parse(map.get('fd_vault_v2'));v.cipher=await c.encrypt(JSON.stringify(d), await c.deriveKey('third-secret',v.salt));map.set('fd_vault_v2',JSON.stringify(v));
 await assert.rejects(()=>s.saveData(d,'third-secret'),s.DataConflictError);
 s.wipeAll(); const salt=c.randomSaltB64();map.set('fd_salt',salt);map.set('fd_pin_hash',await c.sha256Hex('legacy-pin'+salt));map.set('fd_data_enc',await c.encrypt(JSON.stringify(d),await c.deriveKey('legacy-pin',salt)));
 await s.loadData('legacy-pin'); fail=true; await assert.rejects(()=>s.changePin('legacy-pin','migrated-secret')); assert.equal(await s.verifyPin('legacy-pin'),true);fail=false;
 await s.changePin('legacy-pin','migrated-secret');assert.equal((await s.loadData('migrated-secret')).transactions[0].amount,700);assert.equal(map.has('fd_pin_hash'),false);
 const incoming={...d,transactions:[{...d.transactions[0],amount:100}],accounts:[],transfers:[],settings:{...d.settings,currency:'USD'}};
 assert.equal(s.mergeData(d,incoming,new Set()).transactions[0].amount,700);
 assert.equal(s.mergeData(d,incoming,new Set()).settings.currency,'BRL');
 assert.equal(s.mergeData(d,incoming,new Set(['transactions:t'])).transactions[0].amount,100);
 console.log('Atomic writes, failed rotation, empty vault auth, queued saves, stale tabs, legacy migration and selective restore passed.');
} finally {await server.close();}
