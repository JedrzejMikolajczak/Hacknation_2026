import moduleUrl from './vendor/pdf.min.mjs?url';
import workerUrl from './vendor/pdf.worker.min.mjs?url';

export const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_PAGES = 20;
const MAX_TEXT_LENGTH = 64_000;

interface PdfTextItem {
  str: string;
  hasEOL: boolean;
}

interface PdfLoadingTask {
  promise: Promise<{
    numPages: number;
    getPage(number: number): Promise<{
      getTextContent(): Promise<{ items: (PdfTextItem | { type: string })[] }>;
    }>;
    getFieldObjects(): Promise<Record<
      string,
      { value: unknown; alternativeText?: string }[]
    > | null>;
  }>;
  destroy(): Promise<void>;
}

interface PdfModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: {
    data: Uint8Array;
    useWasm: boolean;
    useWorkerFetch: boolean;
    isEvalSupported: boolean;
    enableXfa: boolean;
  }): PdfLoadingTask;
}

export async function readCasePdf(file: File, signal: AbortSignal): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder().decode(data.subarray(0, 1024));
  if (!signature.includes('%PDF-')) throw new Error('Wybrany plik nie jest poprawnym PDF-em.');
  signal.throwIfAborted();
  const pdf: PdfModule = await import(/* @vite-ignore */ moduleUrl);
  signal.throwIfAborted();
  pdf.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdf.getDocument({
    data,
    useWasm: false,
    useWorkerFetch: false,
    isEvalSupported: false,
    enableXfa: false,
  });
  let cleanup: Promise<void> | undefined;
  function dispose() {
    cleanup ??= task.destroy().catch(() => {});
    return cleanup;
  }
  const abort = () => {
    void dispose();
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    const document = await task.promise;
    if (document.numPages > MAX_PAGES) throw new Error('PDF przekracza limit 20 stron.');
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      signal.throwIfAborted();
      const page = await document.getPage(pageNumber);
      const { items } = await page.getTextContent();
      pages.push(
        items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '')).join(''),
      );
      if (pages.join('').length >= MAX_TEXT_LENGTH) break;
    }
    const fieldObjects = await document.getFieldObjects();
    for (const [name, fields] of Object.entries(fieldObjects ?? {})) {
      for (const field of fields) {
        if (typeof field.value === 'string' && field.value.trim()) {
          pages.push(`${field.alternativeText || name}: ${field.value}`);
        }
      }
    }
    return pages.join('\n').slice(0, MAX_TEXT_LENGTH);
  } finally {
    signal.removeEventListener('abort', abort);
    await dispose();
  }
}
