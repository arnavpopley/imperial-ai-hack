// Consented results upload, performance nudges and tailored exam feedback (spec 23). Marks are visible to the student
// only, are never written to the trace (summaries only), and reach no model except the transcript reader and the
// tailored-feedback agent. Withdrawing consent, or deleting the profile, deletes every stored mark.
import { schemas, type SessionState, type TailoredFeedback } from '@modulematch/shared';
import { Hono, type Context } from 'hono';
import { createHash } from 'node:crypto';
import { tailoredFeedback } from '../agents/exam-feedback.ts';
import { isLive } from '../agents/llm.ts';
import { readResultsFile } from '../agents/results-reader.ts';
import { catalogue, clearExplanationCache, performanceFor, tracerSink } from '../agents/session.ts';
import * as repo from '../db/repo.ts';
import { examFacts, parseTranscript, type ParsedTranscript } from '../engines/index.ts';
import { stripInjection } from '../guardrails/g3-injection.ts';
import { createTracer } from '../trace/tracer.ts';
import { body } from './validate.ts';

function load(c: Context): SessionState | Response {
  const session = repo.getSession(c.req.param('id') ?? '');
  return session ?? c.json({ error: 'session not found' }, 404);
}

export const PASTE_INSTEAD = 'Reading a PDF or photo needs the live AI mode, which is off here. Please paste the text of your transcript instead.';
const UNREADABLE = 'Sorry, I could not read module marks from that file. Please paste the text of your transcript instead.';
const NOTHING_FOUND =
  'No module marks were found. Paste one module per line, for example "MECH50010 Fluid Mechanics 2 62", with question marks such as "Q1 14/20" if you have them.';

/**
 * Counts deletions of results per session (DELETE results, or deleting the profile), so an upload whose live read was
 * still running when the student withdrew consent is dropped rather than stored after the deletion.
 */
const deletions = new Map<string, number>();

/**
 * Tailored feedback per session (spec 5 cost control), keyed by form version, results version and a hash of the facts,
 * so a change to the student's completed modules or to the catalogue (which changes the affected modules) misses.
 */
const feedbackCache = new Map<string, Map<string, TailoredFeedback>>();

/** Forgets everything derived from a session's marks. Called when results are deleted or replaced, or the profile is deleted. */
export function forgetResults(sessionId: string, deleted: boolean): void {
  if (deleted) deletions.set(sessionId, (deletions.get(sessionId) ?? 0) + 1);
  feedbackCache.delete(sessionId);
  clearExplanationCache();
}

/** G3 pattern pass, line by line so the transcript's layout survives. No model sees the marks at this stage. */
function stripTranscript(text: string): { text: string; removed: number } {
  let removed = 0;
  const lines = text.split(/\r?\n/).map((line) => {
    const r = stripInjection(line);
    removed += r.removed;
    return r.removed ? r.text : line;
  });
  return { text: lines.join('\n'), removed };
}

/** A one-line trace summary of an upload: counts only, never marks. */
const describe = (p: ParsedTranscript) => {
  const matched = p.results.filter((r) => r.matched).length;
  const withQuestions = p.results.filter((r) => r.questionMarks.length > 0).length;
  return `${p.results.length} result(s): ${matched} matched, ${p.results.length - matched} unmatched, ${withQuestions} with question marks`;
};

export const resultsRoutes = new Hono()
  .post('/:id/results', body(schemas.ResultsUploadBody), async (c) => {
    const session = load(c);
    if (session instanceof Response) return session;
    const input = c.req.valid('json');
    const tracer = createTracer(session.id, tracerSink);
    const modules = catalogue.modules();
    const deletionsBefore = deletions.get(session.id) ?? 0;

    let parsed: ParsedTranscript | null;
    let source: 'model' | 'parser';
    if (input.file) {
      // When both a file and text are sent, the file is read.
      const file = input.file;
      if (!isLive()) return c.json({ error: PASTE_INSTEAD }, 422);
      parsed = await tracer.timed(
        { actor: 'results reader', kind: 'agent', input: `${file.mediaType} upload (${Math.round((file.base64.length * 0.75) / 1024)} KB)` },
        () => readResultsFile(file, modules),
        (p) => ({ output: p ? describe(p) : 'could not read the file', verdict: p ? null : 'block' }),
      );
      if (!parsed) return c.json({ error: UNREADABLE }, 422);
      source = 'model';
    } else {
      const stripped = stripTranscript(input.text ?? '');
      tracer.record({
        actor: 'G3 injection',
        kind: 'guardrail',
        input: `transcript text (${input.text?.length ?? 0} chars)`,
        output: stripped.removed ? `stripped ${stripped.removed} instruction(s)` : 'no injection',
        verdict: stripped.removed ? 'redact' : 'pass',
      });
      parsed = parseTranscript(stripped.text, modules);
      source = 'parser';
    }

    if (parsed.problems.length > 0) {
      tracer.record({ actor: 'results', kind: 'tool', input: 'results upload', output: `${parsed.problems.length} impossible value(s), nothing stored`, verdict: 'block' });
      return c.json({ error: `${parsed.problems.join(' ')} Please check and upload again.`, problems: parsed.problems }, 422);
    }
    if (parsed.results.length === 0) return c.json({ error: NOTHING_FOUND }, 422);
    if ((deletions.get(session.id) ?? 0) !== deletionsBefore || !repo.getSession(session.id)) {
      return c.json({ error: 'your results were deleted while this upload was being read, so it was not stored' }, 410);
    }
    const stored = repo.saveResults(session.id, parsed.results);
    forgetResults(session.id, false);
    tracer.record({ actor: 'results', kind: 'tool', input: 'results upload (consent given)', output: `${describe(parsed)} (${source})`, verdict: null });
    return c.json(schemas.ResultsUploadResponse.parse({ results: stored, unmatched: parsed.unmatched, source }));
  })
  .get('/:id/results', (c) => {
    const session = load(c);
    return session instanceof Response ? session : c.json(repo.getResults(session.id));
  })
  .delete('/:id/results', (c) => {
    // Withdrawing consent deletes every stored mark (spec 23).
    const session = load(c);
    if (session instanceof Response) return session;
    const cleared = repo.deleteResults(session.id);
    forgetResults(session.id, true);
    createTracer(session.id, tracerSink).record({ actor: 'results', kind: 'tool', input: 'withdraw consent', output: 'every stored mark deleted', verdict: null });
    return c.json(cleared);
  })
  .get('/:id/performance', (c) => {
    const session = load(c);
    return session instanceof Response ? session : c.json(performanceFor(session));
  })
  .get('/:id/exam-feedback', async (c) => {
    // Only published examiner forms are used: drafts are never shown to students (spec 23, human in the loop).
    const session = load(c);
    if (session instanceof Response) return session;
    const results = repo.getResults(session.id);
    if (!results.consent.granted) return c.json([]);
    const modules = catalogue.modules();
    const exclude = [...session.profile.completedModuleIds, ...results.results.filter((r) => r.matched).map((r) => r.moduleId)];
    const tracer = createTracer(session.id, tracerSink);
    const cache = feedbackCache.get(session.id) ?? new Map<string, TailoredFeedback>();
    const items = await Promise.all(
      repo.listExamForms('published').map(async (form) => {
        const result = results.results.find((r) => r.matched && r.moduleId === form.moduleId && r.questionMarks.length > 0);
        const facts = result ? examFacts(form, result, modules, exclude) : null;
        if (!facts) return null;
        const factsHash = createHash('sha256').update(JSON.stringify(facts)).digest('hex').slice(0, 16);
        const key = `${form.moduleId}:${form.updatedAt}:${results.updatedAt}:${factsHash}`;
        const cached = cache.get(key);
        if (cached) return cached;
        const feedback = await tracer.timed(
          { actor: 'exam feedback', kind: 'agent', input: `feedback on ${form.moduleId} ${form.examLabel}` },
          () => tailoredFeedback(facts, tracer),
          (f) => ({ output: `${f.weakPoints.length} weak question(s), ${f.affectsModules.length} future module(s), ${f.source}`, verdict: null }),
        );
        cache.set(key, feedback);
        return feedback;
      }),
    );
    // Stored only if the results were not deleted while the feedback was being written.
    if (repo.getResults(session.id).updatedAt === results.updatedAt) feedbackCache.set(session.id, cache);
    return c.json(items.filter((f): f is TailoredFeedback => f !== null));
  });
