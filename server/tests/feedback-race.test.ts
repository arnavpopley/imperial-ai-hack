// A vote still waiting on the live text checks when the student deletes their data is dropped, not saved after
// the deletion (spec 20.3). The checks are held open here so the deletion lands in between.
import { schemas as S } from '@modulematch/shared';
import { describe, expect, it, vi } from 'vitest';

const checks = vi.hoisted(() => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  return { held, release: () => release(), started: { count: 0 } };
});

vi.mock('../src/guardrails/stored-text.ts', () => ({
  cleanForStorage: async (text: string) => {
    checks.started.count += 1;
    await checks.held;
    return { text, changed: false };
  },
}));

const { createApp } = await import('../src/app.ts');
const repo = await import('../src/db/repo.ts');
const { seedIfEmpty } = await import('../src/bootstrap.ts');

const app = createApp();
const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

describe('feedback during deletion', () => {
  it('drops a module-answer vote when the profile is deleted while it is being checked', async () => {
    seedIfEmpty();
    const created = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3 }));
    const id = S.SessionState.parse(await created.json()).id;
    const pending = app.request(
      `/api/sessions/${id}/feedback`,
      json({ target: { kind: 'module-answer', id: 'a1', moduleId: 'MECH60006' }, rating: 'down', comment: 'Too vague.' }),
    );
    await vi.waitFor(() => expect(checks.started.count).toBe(3));
    await app.request(`/api/sessions/${id}/profile`, { method: 'DELETE' });
    checks.release();
    expect((await pending).status).toBe(410);
    expect(repo.listFeedback(id)).toEqual([]);
  });
});
