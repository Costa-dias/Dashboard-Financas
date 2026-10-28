import { importXls } from '@/lib/spreadsheet';

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({ data: importXls(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Backup inválido.' });
  }
};
