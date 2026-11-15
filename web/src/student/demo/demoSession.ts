// The interactive demo's starting point: a finished, confirmed quick interview for Rosa, an invented Year 3
// student, sent to POST /sessions/:id/restore so the real app opens on her catalogue, ready to explore.
// Her profile and shortlist mirror synthetic-robotics-automation-01 in data/cohort.json; the transcript and the
// evidence quotes are written to match it, one answer per step of the quick interview plan.
import { DEFAULT_WEIGHTS, INTERVIEW_BUDGET, type RestoreSessionBody } from '@modulematch/shared';

interface Turn {
  step: string;
  question: string;
  answer: string;
  /** Profile values this answer supports, each quoting part of the answer. */
  evidence: { slot: string; value: number | string[]; quote: string }[];
}

const TURNS: readonly Turn[] = [
  {
    step: 'love',
    question: 'Hi! A few quick questions so I can match modules to you. Which topics or lectures made you lose track of time?',
    answer:
      'The mechatronics lab, getting a robot arm to follow a path. I loved the embedded electronics and writing the code for it, and some of the design side too.',
    evidence: [
      { slot: 'interest:control-robotics', value: 1, quote: 'The mechatronics lab, getting a robot arm to follow a path.' },
      { slot: 'interest:electronics-embedded', value: 0.94, quote: 'I loved the embedded electronics' },
      { slot: 'interest:programming-software', value: 0.74, quote: 'writing the code for it' },
      { slot: 'interest:design-manufacturing', value: 0.44, quote: 'some of the design side too' },
    ],
  },
  {
    step: 'avoid',
    question: 'And what would you avoid if you could?',
    answer: 'Long derivations with nothing to build at the end. I would rather make something work.',
    evidence: [],
  },
  {
    step: 'career',
    question: 'What would you like to be doing after you graduate? "Not sure yet" is a fine answer.',
    answer: 'Robotics or automation, ideally with some machine learning running on real hardware.',
    evidence: [
      { slot: 'pathways', value: ['robotics-automation'], quote: 'Robotics or automation' },
      { slot: 'interest:machine-learning-ai', value: 0.66, quote: 'some machine learning running on real hardware' },
    ],
  },
  {
    step: 'assessment',
    question: 'Do you prefer exams, coursework or projects? And theory, or hands-on and applied?',
    answer: 'Projects and coursework over exams, and definitely hands-on.',
    evidence: [
      { slot: 'style.examPreference', value: 0.21, quote: 'Projects and coursework over exams' },
      { slot: 'style.appliedPreference', value: 1, quote: 'definitely hands-on' },
    ],
  },
  {
    step: 'comfort',
    question: 'How comfortable are you with maths-heavy and coding-heavy modules? Use the two sliders.',
    answer: 'Maths: fairly comfortable. Coding: fairly comfortable.',
    evidence: [
      { slot: 'style.mathsComfort', value: 0.68, quote: 'Maths: fairly comfortable.' },
      { slot: 'style.codingComfort', value: 0.61, quote: 'Coding: fairly comfortable.' },
    ],
  },
  {
    step: 'team',
    question: 'Do you work best alone or in a team? And how heavy a workload feels right?',
    answer: 'Mostly on my own, with a small team now and then. A fairly heavy workload is fine.',
    evidence: [
      { slot: 'style.groupPreference', value: 0.39, quote: 'Mostly on my own, with a small team now and then.' },
      { slot: 'style.workloadTolerance', value: 0.7, quote: 'A fairly heavy workload is fine.' },
    ],
  },
  {
    step: 'breadth',
    question: 'Would you like something outside your degree, like a language, business or the arts?',
    answer: 'Not really, I would rather go deeper into my own subject.',
    evidence: [{ slot: 'breadthAppetite', value: 0, quote: 'I would rather go deeper into my own subject.' }],
  },
  {
    step: 'timetable',
    question: 'Last one: any days or times you want to keep free?',
    answer: 'No, any day works for me.',
    evidence: [{ slot: 'timetablePrefs.avoidDays', value: [], quote: 'any day works for me' }],
  },
];

const CLOSING =
  'Thanks, Rosa. I have what I need: your ranked modules are ready, with the reasons in your own words.';

/**
 * Rosa's session as a restore snapshot. Message and evidence ids are new on every call (`newId`), because the
 * server keeps them as they are and two visitors' demos must never collide.
 */
export function demoSnapshot(newId: () => string, now: Date = new Date()): RestoreSessionBody {
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  const messages: RestoreSessionBody['messages'] = [];
  const evidence: RestoreSessionBody['evidence'] = [];
  let minute = TURNS.length * 2 + 2;

  for (const turn of TURNS) {
    messages.push({ id: newId(), sessionId: '', role: 'assistant', agent: 'interviewer', content: turn.question, at: at(minute--) });
    const answerId = newId();
    messages.push({ id: answerId, sessionId: '', role: 'student', agent: null, content: turn.answer, at: at(minute--) });
    for (const e of turn.evidence) {
      evidence.push({ id: newId(), sessionId: '', turnId: answerId, slot: e.slot, value: e.value, quote: e.quote, confidence: 0.85 });
    }
  }
  messages.push({ id: newId(), sessionId: '', role: 'assistant', agent: 'interviewer', content: CLOSING, at: at(minute) });

  return {
    // With a shortlist the server's resting mode is PLAN, so the snapshot says so too; the demo opens on the catalogue.
    mode: 'PLAN',
    profile: {
      studentId: `demo-${newId().slice(0, 8)}`,
      programme: 'MEng Mechanical Engineering',
      yearOfStudy: 3,
      completedModuleIds: [
        'MECH40002', 'MECH40003', 'MECH40004', 'MECH40005', 'MECH40006', 'MECH40008', 'MECH50001',
        'MECH50002', 'MECH50003', 'MECH50004', 'MECH50005', 'MECH50006', 'MECH50008', 'MECH50010',
      ],
      interests: {
        'control-robotics': 1,
        'electronics-embedded': 0.94,
        'programming-software': 0.74,
        'machine-learning-ai': 0.66,
        'design-manufacturing': 0.44,
      },
      pathways: ['robotics-automation'],
      pathwaysSkipped: false,
      style: {
        examPreference: 0.21,
        groupPreference: 0.39,
        appliedPreference: 1,
        mathsComfort: 0.68,
        codingComfort: 0.61,
        workloadTolerance: 0.7,
      },
      breadthAppetite: 0,
      timetablePrefs: { avoidDays: [], earliestStart: null },
      completeness: 1,
      updatedAt: at(0),
    },
    evidence,
    messages,
    weights: DEFAULT_WEIGHTS,
    // Two of these clash in the spring term, so the timetable has something to show.
    shortlist: ['MECH60018', 'IEX-ML', 'MECH60009'],
    interview: {
      depth: 'quick',
      questionsAsked: TURNS.length,
      budget: INTERVIEW_BUDGET.quick,
      finished: true,
      confirmed: true,
      askedSteps: TURNS.map((t) => t.step),
      targetSlots: [],
      disputes: 0,
    },
    createdAt: at(TURNS.length * 2 + 3),
  };
}
