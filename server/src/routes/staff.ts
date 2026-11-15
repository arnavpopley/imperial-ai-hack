// Staff routes (spec 13). Aggregate views only, with a minimum cohort of five (spec 20.4).
import { DEFAULT_WEIGHTS, MIN_COHORT, schemas, type ExamFeedbackForm, type Insight, type StaffEscalation, type StaffModuleSummary } from '@modulematch/shared';
import { Hono } from 'hono';
import { draftExamForm } from '../agents/exam-feedback.ts';
import { wordInsight } from '../agents/insights.ts';
import { clearSummaryCache } from '../agents/knowledge.ts';
import { catalogue, clearExplanationCache, rulesForProfile, setMode, tracerSink } from '../agents/session.ts';
import { rulesFor } from '../db/catalogue.ts';
import * as repo from '../db/repo.ts';
import { buildInsights, clashPriorities, cohortStats, feedbackJsonl, storedDecisions, summariseFeedback, type InsightContext } from '../engines/index.ts';
import { createTracer } from '../trace/tracer.ts';
import { body } from './validate.ts';

/** The synthetic cohort plus its programme's home topics, shared by every staff view. */
function insightContext(): InsightContext {
  const cohort = repo.listCohort();
  const first = cohort[0]?.profile;
  const rules = first ? (rulesFor(first.programme, first.yearOfStudy) ?? rulesForProfile(first)) : undefined;
  return {
    modules: catalogue.modules(),
    cohort: cohort.map((s) => s.profile),
    shortlists: cohort.map((s) => s.shortlist),
    weights: DEFAULT_WEIGHTS,
    homeTopics: rules?.homeTopics ?? {},
    slots: catalogue.slots(),
    // A student's top five counts only the modules they may take, as on their own recommendations.
    ...(rules ? { rules } : {}),
  };
}

/** The one exam feedback form a module holds (spec 23). Staff trace events use the 'staff' session id. */
const examFormId = (moduleId: string) => `exam-${moduleId}`;
const staffTracer = () => createTracer('staff', tracerSink);

export const staffRoutes = new Hono()
  .get('/modules', (c) => {
    const ctx = insightContext();
    const rows: StaffModuleSummary[] = ctx.modules.flatMap((m) => {
      const stats = cohortStats(m, ctx.cohort, ctx.shortlists, ctx.weights, ctx.homeTopics);
      // Below the minimum cohort nothing is shown for the module (spec 20.4).
      if (!stats) return [];
      return [{ moduleId: m.id, code: m.code, title: m.title, type: m.type, capacity: m.capacity, ...stats }];
    });
    return c.json(rows);
  })
  .get('/modules/:id/insights', async (c) => {
    const ctx = insightContext();
    const module = ctx.modules.find((m) => m.id === c.req.param('id'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    const built = buildInsights(module, ctx);
    // Stored decisions carry over by id, including those recorded under the older rank-based counterfactual ids.
    const { decisions, consumedIds } = storedDecisions(built, repo.listInsights(module.id));
    const cards: Insight[] = await Promise.all(
      built.map(async (i) => ({ ...(await wordInsight(i)), decision: decisions.get(i.id) ?? 'pending' })),
    );
    const current = cards.filter((i) => i.cohortSize >= MIN_COHORT);
    repo.upsertInsights(current);
    // An old row whose decision has moved to its new id is removed, so it can never mark a later card.
    repo.deleteInsights(consumedIds);
    // Only cards the current calculation still produces are shown, in the engine's order (most useful first);
    // stored decisions carry over by id.
    const order = new Map(current.map((i, n) => [i.id, n]));
    const shown = repo.listInsights(module.id).filter((i) => order.has(i.id));
    return c.json(shown.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
  })
  .post('/insights/:id/decision', body(schemas.InsightDecisionBody), (c) => {
    const insight = repo.setInsightDecision(c.req.param('id'), c.req.valid('json').decision);
    return insight ? c.json(insight) : c.json({ error: 'insight not found' }, 404);
  })
  .put('/modules/:id/derived', body(schemas.DerivedEditBody), (c) => {
    const module = repo.updateModuleDerived(c.req.param('id'), c.req.valid('json'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    clearExplanationCache();
    clearSummaryCache();
    return c.json(module);
  })
  // Exam feedback forms (spec 23). Cohort-level descriptions of each question, never about an individual student,
  // and staff never see a student's marks. Saving or drafting leaves the form a draft; only published forms reach students.
  .get('/modules/:id/exam-form', (c) => {
    const module = catalogue.modules().find((m) => m.id === c.req.param('id'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    return c.json(repo.getExamForm(module.id));
  })
  .put('/modules/:id/exam-form', body(schemas.ExamFormSaveBody), (c) => {
    const module = catalogue.modules().find((m) => m.id === c.req.param('id'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    const form: ExamFeedbackForm = { ...c.req.valid('json'), id: examFormId(module.id), moduleId: module.id, status: 'draft', authoredBy: 'examiner', updatedAt: new Date().toISOString() };
    const saved = repo.saveExamForm(form);
    staffTracer().record({ actor: 'staff', kind: 'tool', input: `exam form ${module.id}`, output: `saved by examiner as draft (${saved.questions.length} questions)`, verdict: null });
    return c.json(saved);
  })
  .post('/modules/:id/exam-form/draft', body(schemas.ExamFormDraftBody), async (c) => {
    const module = catalogue.modules().find((m) => m.id === c.req.param('id'));
    if (!module) return c.json({ error: 'module not found' }, 404);
    const { examLabel, notes } = c.req.valid('json');
    const tracer = staffTracer();
    const versionBefore = repo.getExamForm(module.id)?.updatedAt ?? null;
    const { draft } = await tracer.timed(
      { actor: 'exam form drafter', kind: 'agent', input: `draft ${module.id} from notes (${notes.length} chars)` },
      () => draftExamForm(notes, module, tracer),
      (d) => ({ output: `${d.draft.questions.length} question(s), ${d.source}`, verdict: null }),
    );
    // The draft takes a few seconds live; an examiner save or publish made meanwhile is never overwritten.
    if ((repo.getExamForm(module.id)?.updatedAt ?? null) !== versionBefore) {
      return c.json({ error: 'the form was changed while the draft was being written, so the draft was not saved' }, 409);
    }
    const form: ExamFeedbackForm = { ...draft, examLabel, id: examFormId(module.id), moduleId: module.id, status: 'draft', authoredBy: 'ai-draft', updatedAt: new Date().toISOString() };
    const saved = repo.saveExamForm(form);
    return c.json(saved);
  })
  .post('/modules/:id/exam-form/publish', (c) => {
    const current = repo.getExamForm(c.req.param('id'));
    if (!current) return c.json({ error: 'exam form not found' }, 404);
    // Publishing is the examiner's review: from here the form counts as examiner-authored.
    const saved = repo.saveExamForm({ ...current, status: 'published', authoredBy: 'examiner', updatedAt: new Date().toISOString() });
    staffTracer().record({ actor: 'staff', kind: 'tool', input: `exam form ${saved.moduleId}`, output: 'published to students', verdict: null });
    return c.json(saved);
  })
  .get('/timetable/clash-priorities', (c) => {
    const ctx = insightContext();
    // Pairs shared by fewer than five students are withheld (spec 20.4).
    return c.json(clashPriorities(ctx.shortlists, ctx.slots).filter((p) => p.students >= MIN_COHORT));
  })
  .get('/escalations', (c) => {
    const rows: StaffEscalation[] = repo.listEscalations().flatMap((e) => {
      const session = repo.getSession(e.sessionId);
      if (!session) return [];
      return [{ ...e, studentContext: { programme: session.profile.programme, yearOfStudy: session.profile.yearOfStudy, shortlist: session.shortlist } }];
    });
    return c.json(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  })
  // Student ratings of AI answers. Comments and texts were redacted (G2, G3) before storage, and no item carries a
  // session id. In this prototype every session is synthetic (spec 20.7).
  .get('/feedback', (c) => c.json(summariseFeedback(repo.listFeedback())))
  .get('/feedback/export', (c) => {
    // JSONL eval or fine-tuning seed rows: { question, answer, rating, reason, comment, kind, moduleId }.
    c.header('content-type', 'application/x-ndjson; charset=utf-8');
    c.header('content-disposition', 'attachment; filename="modulematch-feedback.jsonl"');
    return c.body(feedbackJsonl(repo.listFeedback()));
  })
  .post('/escalations/:id/respond', body(schemas.EscalationRespondBody), (c) => {
    const { response, resolve } = c.req.valid('json');
    const escalation = repo.updateEscalation(c.req.param('id'), { staffResponse: response, status: resolve ? 'resolved' : 'claimed' });
    if (!escalation) return c.json({ error: 'escalation not found' }, 404);
    const session = repo.getSession(escalation.sessionId);
    if (session) {
      const tracer = createTracer(session.id, tracerSink);
      tracer.record({ actor: 'staff', kind: 'escalation', input: escalation.type, output: resolve ? 'staff responded and resolved' : 'staff claimed', verdict: null });
      // The reply returns to the student's session (spec 11.1), and the session leaves ESCALATED.
      repo.addMessage({ id: crypto.randomUUID(), sessionId: session.id, role: 'assistant', agent: 'staff', content: `Reply from staff: ${response}`, at: new Date().toISOString() });
      if (resolve) setMode(session, 'RECOMMEND', tracer, 'staff responded');
    }
    return c.json(escalation);
  });
