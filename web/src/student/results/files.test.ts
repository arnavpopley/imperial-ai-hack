// Guards the results upload's client-side checks: accepted files, the size cap that matches the contract, base64
// that the contract accepts, and friendly messages for API errors (a 422 on a file offers the paste box).
import { schemas } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import { base64FromDataUrl, checkFile, errorStatus, isUsableBase64, MAX_FILE_BYTES, mediaTypeOf, uploadProblem } from './files.ts';

describe('results upload files', () => {
  it('accepts PDFs and PNG or JPEG photos, by type or by extension', () => {
    expect(mediaTypeOf({ type: 'application/pdf', name: 'a' })).toBe('application/pdf');
    expect(mediaTypeOf({ type: '', name: 'transcript.PDF' })).toBe('application/pdf');
    expect(mediaTypeOf({ type: 'image/jpg', name: 'sheet' })).toBe('image/jpeg');
    expect(mediaTypeOf({ type: '', name: 'sheet.jpeg' })).toBe('image/jpeg');
    expect(mediaTypeOf({ type: 'image/heic', name: 'sheet.heic' })).toBeNull();
  });

  it('caps files so their base64 fits the contract', () => {
    expect(Math.ceil(MAX_FILE_BYTES / 3) * 4).toBeLessThanOrEqual(8_000_000);
    expect(checkFile({ type: 'application/pdf', name: 'a.pdf', size: MAX_FILE_BYTES }).ok).toBe(true);
    expect(checkFile({ type: 'application/pdf', name: 'a.pdf', size: MAX_FILE_BYTES + 1 }).ok).toBe(false);
    expect(checkFile({ type: 'application/pdf', name: 'a.pdf', size: 0 }).ok).toBe(false);
    expect(checkFile({ type: 'text/plain', name: 'a.txt', size: 10 }).ok).toBe(false);
  });

  it('only sends base64 the contract accepts', () => {
    const accepted = (base64: string) =>
      schemas.ResultsUploadBody.safeParse({ consent: true, file: { mediaType: 'application/pdf', base64 } }).success;
    for (const value of ['JVBERi0xLjQK', '', 'not base64!', 'QQ==']) expect(isUsableBase64(value)).toBe(accepted(value));
    expect(base64FromDataUrl('data:application/pdf;base64,JVBERi0xLjQK')).toBe('JVBERi0xLjQK');
  });

  it('turns API errors into a next step', () => {
    expect(uploadProblem(new Error('422 unreadable'), true).pasteInstead).toBe(true);
    expect(uploadProblem(new Error('422 no marks'), false).pasteInstead).toBe(false);
    expect(uploadProblem(new Error('500 boom'), true).message).not.toContain('500');
    // The server's own message is shown when it sends one, for example an impossible question mark.
    const impossible = uploadProblem(new Error('422 {"error":"MECH50010 Q3 is 26/20, above its maximum. Please check and upload again."}'), false);
    expect(impossible).toEqual({ message: 'MECH50010 Q3 is 26/20, above its maximum. Please check and upload again.', pasteInstead: false });
    expect(uploadProblem(new Error('422 {"error":"Please paste the text instead."}'), true)).toEqual({ message: 'Please paste the text instead.', pasteInstead: true });
    expect(errorStatus('404 not found')).toBe(404);
    expect(errorStatus('network down')).toBeNull();
  });
});
