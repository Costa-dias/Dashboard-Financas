import type { AppData } from '@/types';

/** Import on a worker so even a difficult spreadsheet cannot freeze the UI. */
export function readBackup(buffer: ArrayBuffer): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/importBackup.ts', import.meta.url), { type: 'module' });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('A planilha demorou demais para abrir. Verifique o arquivo.'));
    }, 15_000);
    const finish = () => { window.clearTimeout(timeout); worker.terminate(); };
    worker.onmessage = (event: MessageEvent<{ data?: AppData; error?: string }>) => {
      finish();
      if (event.data.data) resolve(event.data.data);
      else reject(new Error(event.data.error ?? 'Backup inválido.'));
    };
    worker.onerror = () => { finish(); reject(new Error('Não foi possível processar a planilha.')); };
    worker.postMessage(buffer, [buffer]);
  });
}
