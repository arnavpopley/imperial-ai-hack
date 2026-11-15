// Pure helpers for the results upload (spec 23): which files we accept, the size limit, reading a file as
// base64, and turning an API error into a friendly next step.

/**
 * The contract caps the base64 string at 8,000,000 characters, which is 6,000,000 bytes once decoded.
 * Checked on the client so a student never waits for an upload the server would refuse.
 */
export const MAX_FILE_BYTES = 6_000_000;

export type ResultsMediaType = 'application/pdf' | 'image/png' | 'image/jpeg';

/** What the file input offers: PDFs and photos (PNG or JPEG). */
export const ACCEPT = 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg';

const BY_EXTENSION: Record<string, ResultsMediaType> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/** The media type to send for a file, from its reported type or, failing that, its extension. */
export function mediaTypeOf(file: { type: string; name: string }): ResultsMediaType | null {
  if (file.type === 'application/pdf' || file.type === 'image/png' || file.type === 'image/jpeg') return file.type;
  if (file.type === 'image/jpg') return 'image/jpeg';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? null;
}

export type FileCheck = { ok: true; mediaType: ResultsMediaType } | { ok: false; reason: string };

export function checkFile(file: { type: string; name: string; size: number }): FileCheck {
  const mediaType = mediaTypeOf(file);
  if (!mediaType) return { ok: false, reason: 'Please choose a PDF, or a photo saved as PNG or JPEG.' };
  if (file.size > MAX_FILE_BYTES)
    return { ok: false, reason: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}, so try a smaller photo or paste the text.` };
  if (file.size === 0) return { ok: false, reason: 'That file looks empty. Try another one, or paste the text.' };
  return { ok: true, mediaType };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** "data:application/pdf;base64,AAAA" to "AAAA". */
export function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

/** Matches the contract's ResultsUploadBody rule: at least four characters of plain base64. */
export function isUsableBase64(value: string): boolean {
  return value.length >= 4 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/** Reads a file as base64 with FileReader. Rejects when the result is empty or not base64. */
export function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = base64FromDataUrl(typeof reader.result === 'string' ? reader.result : '');
      if (isUsableBase64(base64)) resolve(base64);
      else reject(new Error('unreadable'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

export interface UploadProblem {
  message: string;
  /** True when pasting the text would get round the problem, so the panel switches to the paste box. */
  pasteInstead: boolean;
}

/** The API client throws `Error("<status> <body>")`; map it to something kind and actionable. */
export function uploadProblem(error: unknown, sentFile: boolean): UploadProblem {
  const message = error instanceof Error ? error.message : '';
  const status = Number.parseInt(message, 10);
  if (status === 422 && sentFile)
    return {
      message: "We couldn't read that file just now. Copy the text from your transcript and paste it here instead.",
      pasteInstead: true,
    };
  if (status === 422)
    return {
      message: 'We could not find any module marks in that text. Each line needs a module code and a mark, like "MECH50010 Fluid Mechanics 2 62".',
      pasteInstead: false,
    };
  if (status === 413) return { message: 'That file is too large to send. Try a smaller photo or paste the text.', pasteInstead: true };
  if (status === 400) return { message: 'That upload was not quite right. Tick the consent box and add a file or some text.', pasteInstead: false };
  if (status === 404) return { message: 'Results upload is not switched on yet. You can skip this step for now.', pasteInstead: false };
  return { message: 'Something went wrong reading your results. Please try again in a moment.', pasteInstead: false };
}

/** A status code the API client put at the start of its error message, if any. */
export function errorStatus(error: string | null | undefined): number | null {
  if (!error) return null;
  const status = Number.parseInt(error, 10);
  return Number.isFinite(status) ? status : null;
}
