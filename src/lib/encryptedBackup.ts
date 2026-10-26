import type { AppData } from '@/types';
import { decrypt, deriveKey, encrypt, randomSaltB64 } from './crypto';
import { exportXls, importXls } from './storage';
import { MAX_BACKUP_BYTES } from './validation';

export async function exportProtected(data: AppData, password: string): Promise<Blob> {
  if (password.length < 8 || password.length > 128) throw new Error('Use uma senha de backup de 8 a 128 caracteres.');
  const salt = randomSaltB64();
  const bytes = new Uint8Array(await exportXls(data).arrayBuffer());
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  const ciphertext = await encrypt(btoa(binary), await deriveKey(password, salt));
  const blob = new Blob([JSON.stringify({ magic: 'FINANCAS-BACKUP', version: 1, salt, ciphertext })], { type: 'application/json' });
  if (blob.size > MAX_BACKUP_BYTES) throw new Error('Backup maior que 5 MB.');
  return blob;
}
export async function importProtected(file: File, password: string): Promise<AppData> {
  if (!file.size || file.size > MAX_BACKUP_BYTES || password.length > 128) throw new Error('Backup inválido ou maior que 5 MB.');
  const envelope = JSON.parse(await file.text());
  if (envelope.magic !== 'FINANCAS-BACKUP' || envelope.version !== 1 || typeof envelope.salt !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(envelope.salt) || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > MAX_BACKUP_BYTES) throw new Error('Formato de backup inválido.');
  let decoded: string;
  try { decoded = atob(await decrypt(envelope.ciphertext, await deriveKey(password, envelope.salt))); }
  catch { throw new Error('Senha incorreta ou backup corrompido.'); }
  const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
  return importXls(bytes.buffer);
}
