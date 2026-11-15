// Issue 49: a Senior Tutor's approval of a rule exception makes the module eligible and shortlistable for that
// student, a decline keeps it ineligible, the staff view gets the request as data, and the trace records the decision.
import { schemas as S, type StaffEscalation } from '@modulematch/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { seedIfEmpty } from '../src/bootstrap.ts';

const app = createApp();
const json = (b: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const put = (b: unknown) => ({ ...json(b), method: 'PUT' });

/** Robot dynamics and control: a Year 4 elective, so not open to a Year 3 student. */
const ROBOT = 'MECH70057';
const ROSA_COMPLETED = ['MECH40002', 'MECH40003', 'MECH40004', 'MECH40005', 'MECH40006', 'MECH40008', 'MECH50001', 'MECH50002', 'MECH50003', 'MECH50004', 'MECH50005', 'MECH50006', 'MECH50008', 'MECH50010'];

async function rosaInRecommend(): Promise<string> {
  const res = await app.request('/api/sessions', json({ programme: 'MEng Mechanical Engineering', yearOfStudy: 3, completedModuleIds: ROSA_COMPLETED }));
  const id = S.SessionState.parse(await res.json()).id;
  await app.request(`/api/sessions/${id}/profile`, put({ confirm: true }));
  return id;
}

const session = async (id: string) => S.SessionState.parse(await (await app.request(`/api/sessions/${id}`)).json());
const robotRec = async (id: string) =>
  S.RecommendationsResponse.parse(await (await app.request(`/api/sessions/${id}/recommendations`)).json()).recommendations.find((r) => r.moduleId === ROBOT)!;
const staffCase = async (escalationId: string): Promise<StaffEscalation> =>
  S.StaffEscalation.array().parse(await (await app.request('/api/staff/escalations')).json()).find((e) => e.id === escalationId)!;
const shortlist = (id: string) => app.request(`/api/sessions/${id}/shortlist`, json({ moduleId: ROBOT, action: 'add' }));

/** Asks the advisor for the module, then sends the draft it offers with a one-line reason. */
async function requestException(id: string, reason: string) {
  await (await app.request(`/api/sessions/${id}/messages`, json({ content: 'Can I take Robot dynamics and control without meeting the requirement?' }))).text();
  const draft = (await session(id)).escalationDraft;
  expect(draft?.type).toBe('RULE_EXCEPTION');
  const res = await app.request(`/api/sessions/${id}/escalations`, json({ type: 'RULE_EXCEPTION', summary: draft!.summary, moduleId: draft!.moduleId, reason }));
  expect(res.status).toBe(201);
  return { draft: draft!, escalation: S.Escalation.parse(await res.json()) };
}

beforeAll(() => {
  seedIfEmpty();
});

describe('rule-exception drafts', () => {
  it('name the module, carry the broken rule as data and speak about the student in the third person', async () => {
    const id = await rosaInRecommend();
    await (await app.request(`/api/sessions/${id}/messages`, json({ content: 'Can I take Robot dynamics and control? I really want it because I loved the mechatronics lab' }))).text();
    const draft = (await session(id)).escalationDraft!;
    expect(draft.moduleId).toBe(ROBOT);
    expect(draft.violations?.map((v) => v.code)).toEqual(['NOT_ALLOWED']);
    expect(draft.summary).toContain('The student asks to take MECH70057');
    expect(draft.summary).not.toMatch(/\b[Yy]ou(r)?\b/);
    expect(draft.reason).toBe('I loved the mechatronics lab.');
  });
});

describe('Senior Tutor decisions', () => {
  it('shares the rule, reason, completed modules and fit with staff, and nothing from the profile itself', async () => {
    const id = await rosaInRecommend();
    const { escalation } = await requestException(id, 'I built a robot arm controller on placement.');
    const staff = await staffCase(escalation.id);
    expect(staff.request).toMatchObject({ moduleId: ROBOT, reason: 'I built a robot arm controller on placement.', completedModuleIds: ROSA_COMPLETED });
    expect(staff.request?.violations[0]).toMatchObject({ code: 'NOT_ALLOWED', moduleId: ROBOT });
    expect(staff.request?.violations[0]?.message).not.toMatch(/\b[Yy]ou(r)?\b/);
    expect(staff.request?.fit?.fit).toBe((await robotRec(id)).fit);
    expect(staff).not.toHaveProperty('profile');
    expect(staff).not.toHaveProperty('evidence');
  });

  it('an approval makes the module eligible and shortlistable, and is traced', async () => {
    const id = await rosaInRecommend();
    const { escalation } = await requestException(id, 'I built a robot arm controller on placement.');
    expect((await robotRec(id)).eligible).toBe(false);
    expect((await shortlist(id)).status).toBe(422);
    const explain = async () =>
      S.ExplanationResponse.parse(await (await app.request(`/api/sessions/${id}/modules/${ROBOT}/explanation`)).json()).explanation.watchOuts;
    expect((await explain()).some((w) => w.includes('is not open to'))).toBe(true);

    const res = await app.request(`/api/staff/escalations/${escalation.id}/respond`, json({ decision: 'approve', response: 'Do the bridging notes first.' }));
    expect(res.status).toBe(200);
    const decided = S.Escalation.parse(await res.json());
    expect(decided).toMatchObject({ status: 'resolved', decision: 'approved' });
    expect(decided.staffResponse).toMatch(/^Exception approved: .*MECH70057.*credit cap\. Do the bridging notes first\.$/);

    const rec = await robotRec(id);
    expect(rec).toMatchObject({ eligible: true, ineligibleReasons: [], exception: 'approved' });
    // The explanation cached before the approval is not reused: the waived rule is no longer a watch-out.
    expect((await explain()).some((w) => w.includes('is not open to'))).toBe(false);
    expect((await shortlist(id)).status).toBe(200);
    const after = await session(id);
    expect(after.exceptions).toEqual([{ moduleId: ROBOT, waived: [{ code: 'NOT_ALLOWED' }] }]);
    expect(after.shortlist).toContain(ROBOT);
    expect(after.mode).not.toBe('ESCALATED');

    const trace = S.TraceEvent.array().parse(await (await app.request(`/api/trace/${id}`)).json());
    expect(trace.some((t) => t.actor === 'Senior Tutor' && t.output.startsWith('approved: waived NOT_ALLOWED') && t.input.includes(ROBOT))).toBe(true);
  });

  it('an approved module still counts towards the credit cap', async () => {
    const id = await rosaInRecommend();
    const { escalation } = await requestException(id, 'I built a robot arm controller on placement.');
    await app.request(`/api/staff/escalations/${escalation.id}/respond`, json({ decision: 'approve' }));
    const recs = S.RecommendationsResponse.parse(await (await app.request(`/api/sessions/${id}/recommendations`)).json()).recommendations;
    // Fill the shortlist with eligible modules and the approved one until the plan is over the cap.
    for (const r of [recs.find((x) => x.moduleId === ROBOT)!, ...recs.filter((x) => x.eligible && x.moduleId !== ROBOT)]) {
      await app.request(`/api/sessions/${id}/shortlist`, json({ moduleId: r.moduleId, action: 'add' }));
      const view = S.TimetableView.parse(await (await app.request(`/api/sessions/${id}/timetable`)).json());
      if (view.rules.violations.some((v) => v.code === 'ECTS_CAP_EXCEEDED')) break;
    }
    const view = S.TimetableView.parse(await (await app.request(`/api/sessions/${id}/timetable`)).json());
    const cap = view.rules.violations.find((v) => v.code === 'ECTS_CAP_EXCEEDED');
    expect(cap).toBeDefined();
    expect((await session(id)).shortlist).toContain(ROBOT);
    // The approved module itself is not flagged, but its credits are in the total.
    expect(view.rules.violations.some((v) => v.moduleId === ROBOT)).toBe(false);
  });

  it('an approved module can be added from the chat too', async () => {
    const id = await rosaInRecommend();
    const { escalation } = await requestException(id, 'I built a robot arm controller on placement.');
    await app.request(`/api/staff/escalations/${escalation.id}/respond`, json({ decision: 'approve' }));
    await (await app.request(`/api/sessions/${id}/messages`, json({ content: 'Add Robot dynamics and control to my shortlist' }))).text();
    expect((await session(id)).shortlist).toContain(ROBOT);
  });

  it('a decline keeps the module ineligible and says so', async () => {
    const id = await rosaInRecommend();
    const { escalation } = await requestException(id, 'It fits my career plan.');
    const res = await app.request(`/api/staff/escalations/${escalation.id}/respond`, json({ decision: 'decline' }));
    expect(S.Escalation.parse(await res.json())).toMatchObject({ decision: 'declined', status: 'resolved' });
    expect(await robotRec(id)).toMatchObject({ eligible: false, exception: 'declined' });
    expect((await shortlist(id)).status).toBe(422);
    expect((await session(id)).exceptions).toEqual([]);
    const trace = S.TraceEvent.array().parse(await (await app.request(`/api/trace/${id}`)).json());
    expect(trace.some((t) => t.actor === 'Senior Tutor' && t.output.startsWith('declined'))).toBe(true);
  });

  it('a decision is taken once, only on rule exceptions, and a plain reply still needs text', async () => {
    const id = await rosaInRecommend();
    const { escalation } = await requestException(id, 'It fits my career plan.');
    const respond = (escalationId: string, body: unknown) => app.request(`/api/staff/escalations/${escalationId}/respond`, json(body));
    expect((await respond(escalation.id, { response: '  ' })).status).toBe(400);
    expect((await respond(escalation.id, { decision: 'approve' })).status).toBe(200);
    expect((await respond(escalation.id, { decision: 'decline' })).status).toBe(409);

    const complaint = S.Escalation.parse(await (await app.request(`/api/sessions/${id}/escalations`, json({ type: 'COMPLAINT', summary: 'x' }))).json());
    expect(complaint.request).toBeNull();
    expect((await respond(complaint.id, { decision: 'approve' })).status).toBe(400);
    expect((await respond(complaint.id, { response: 'Thanks, noted.' })).status).toBe(200);
  });

  it('refuses an unknown module and redacts the reason before it is stored', async () => {
    const id = await rosaInRecommend();
    const unknown = await app.request(`/api/sessions/${id}/escalations`, json({ type: 'RULE_EXCEPTION', summary: 'x', moduleId: 'NOPE' }));
    expect(unknown.status).toBe(400);
    const res = await app.request(`/api/sessions/${id}/escalations`, json({ type: 'RULE_EXCEPTION', summary: 'x', moduleId: ROBOT, reason: 'I have ADHD and it suits me.' }));
    const created = S.Escalation.parse(await res.json());
    expect(created.request?.reason).not.toContain('ADHD');
    // Without a draft the server checks the rules itself; the body never supplies them.
    expect(created.request?.violations.map((v) => v.code)).toEqual(['NOT_ALLOWED']);
  });

  it('deleting the profile removes approved exceptions with the escalations', async () => {
    const id = await rosaInRecommend();
    const { escalation } = await requestException(id, 'It fits my career plan.');
    await app.request(`/api/staff/escalations/${escalation.id}/respond`, json({ decision: 'approve' }));
    const after = S.SessionState.parse(await (await app.request(`/api/sessions/${id}/profile`, { method: 'DELETE' })).json());
    expect(after.exceptions).toEqual([]);
  });
});
