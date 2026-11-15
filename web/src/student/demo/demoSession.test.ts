// Rosa's demo snapshot must be one the server's restore endpoint accepts, every profile value must be backed by a
// quote from her own answers, and ids must be new on every call so two visitors' demos never collide.
import { schemas } from '@modulematch/shared';
import { describe, expect, it } from 'vitest';
import modulesFile from '../../../../data/modules.json';
import { demoSnapshot } from './demoSession.ts';

let counter = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

describe('the interactive demo snapshot', () => {
  const snapshot = demoSnapshot(nextId, new Date('2026-11-15T12:00:00Z'));

  it('passes the restore endpoint schema', () => {
    expect(() => schemas.RestoreSessionBody.parse(snapshot)).not.toThrow();
  });

  it('is past the interview, finished and confirmed, in the mode the server rests a shortlist in', () => {
    expect(snapshot.mode).toBe('PLAN');
    expect(snapshot.interview.finished).toBe(true);
    expect(snapshot.interview.confirmed).toBe(true);
  });

  it('uses only whitelisted slots, with values of the right type', () => {
    for (const e of snapshot.evidence) {
      const schema = schemas.slotValueSchema(e.slot);
      expect(schema, e.slot).not.toBeNull();
      expect(schema!.safeParse(e.value).success, e.slot).toBe(true);
    }
  });

  it('quotes each piece of evidence from the student message it points to', () => {
    const byId = new Map(snapshot.messages.map((m) => [m.id, m]));
    for (const e of snapshot.evidence) {
      const turn = byId.get(e.turnId);
      expect(turn?.role, e.slot).toBe('student');
      expect(turn!.content, e.slot).toContain(e.quote);
    }
  });

  it('backs every interest in the profile with evidence', () => {
    const slots = new Set(snapshot.evidence.map((e) => e.slot));
    for (const topic of Object.keys(snapshot.profile.interests)) expect(slots.has(`interest:${topic}`), topic).toBe(true);
  });

  it('shortlists and completes only modules that exist', () => {
    const ids = new Set((modulesFile as { modules: { id: string }[] }).modules.map((m) => m.id));
    for (const id of [...snapshot.shortlist, ...snapshot.profile.completedModuleIds]) expect(ids.has(id), id).toBe(true);
  });

  it('gives every message and evidence item a new id on each call', () => {
    const again = demoSnapshot(nextId);
    const first = new Set([...snapshot.messages, ...snapshot.evidence].map((x) => x.id));
    const second = [...again.messages, ...again.evidence].map((x) => x.id);
    expect(first.size).toBe(snapshot.messages.length + snapshot.evidence.length);
    expect(second.some((id) => first.has(id))).toBe(false);
  });
});
