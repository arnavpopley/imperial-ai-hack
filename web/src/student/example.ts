// A ready-made example student, so anyone can see the whole flow without typing their own details.
// The details mirror synthetic-robotics-automation-01 in data/cohort.json: invented, not a real student.

export const EXAMPLE_STUDENT = {
  name: 'Sam',
  summary: 'Year 3 MEng Mechanical Engineering. Loves robotics and control, wants a hands-on lab project.',
  tags: ['Robotics', 'Control systems', 'Lab work'],
  programme: 'MEng Mechanical Engineering',
  year: '3',
  completedModuleIds: [
    'MECH40002',
    'MECH40003',
    'MECH40004',
    'MECH40005',
    'MECH40006',
    'MECH40008',
    'MECH50001',
    'MECH50002',
    'MECH50003',
    'MECH50004',
    'MECH50005',
    'MECH50006',
    'MECH50008',
    'MECH50010',
  ],
  depth: 'quick',
  /** Waits in the interview's message box, so the example student's first answer is one click away. */
  firstAnswer:
    'I really enjoyed the mechatronics lab last year, especially getting a robot arm to follow a path. ' +
    "I'd like to work on robotics or automation after I graduate, and I learn best by building things.",
} as const;

const PREFILL_KEY = 'mm-example-prefill';

/** Remember that the session about to start is the example, so the interview can prefill its first answer. */
export function markExampleStart(): void {
  try {
    sessionStorage.setItem(PREFILL_KEY, EXAMPLE_STUDENT.firstAnswer);
  } catch {
    // Blocked storage only loses the prefilled answer; the example still starts.
  }
}

/** The example's first answer if the example was just started, else empty. Pair with clearExamplePrefill. */
export function readExamplePrefill(): string {
  try {
    return sessionStorage.getItem(PREFILL_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Forget the prefill once the interview has shown it, so a reload does not bring it back. */
export function clearExamplePrefill(): void {
  try {
    sessionStorage.removeItem(PREFILL_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}
