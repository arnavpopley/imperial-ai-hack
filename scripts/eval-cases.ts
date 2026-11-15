// Hand-written evaluation cases (spec 18.1). Personas are synthetic; module ids refer to data/modules.json.
import type { StudentProfile } from '@modulematch/shared';

export interface Persona {
  name: string;
  profile: Partial<Omit<StudentProfile, 'style'>> & { style?: Partial<StudentProfile['style']> };
  /** Three modules that must all appear in the persona's eligible top five. */
  expected: [string, string, string];
}

/** Year 1 and 2 core modules, which every Year 3 persona has completed. */
const YEAR_1_2_CORE = ['MECH40002', 'MECH40003', 'MECH40004', 'MECH40005', 'MECH40006', 'MECH40008', 'MECH50001', 'MECH50002', 'MECH50003', 'MECH50004', 'MECH50005', 'MECH50006', 'MECH50008', 'MECH50010'];

const persona = (
  name: string,
  interests: Record<string, number>,
  pathways: string[],
  style: Partial<StudentProfile['style']>,
  breadthAppetite: number,
  expected: [string, string, string],
): Persona => ({
  name,
  profile: { completedModuleIds: YEAR_1_2_CORE, interests, pathways, pathwaysSkipped: pathways.length === 0, style, breadthAppetite },
  expected,
});

// Expected modules were chosen from the module titles and descriptions, the way an advisor would, before
// looking at engine output. They are not tuned to the scores.
export const PERSONAS: Persona[] = [
  persona('motorsport aerodynamicist', { 'fluid-mechanics': 0.95, 'computational-simulation': 0.8, 'design-manufacturing': 0.6 }, ['aerospace-motorsport'], { appliedPreference: 0.8, mathsComfort: 0.8, codingComfort: 0.6 }, 0.2, ['MECH60006', 'MECH60024', 'MECH60021']),
  persona('nuclear and energy engineer', { 'nuclear-energy': 0.9, 'thermodynamics-energy': 0.85, 'sustainability-climate': 0.6 }, ['energy-transition'], { mathsComfort: 0.7 }, 0.3, ['MECH60004', 'MECH60011', 'IEX-CLIMATE']),
  persona('robotics builder', { 'control-robotics': 0.95, 'electronics-embedded': 0.85, 'programming-software': 0.75 }, ['robotics-automation'], { appliedPreference: 0.9, codingComfort: 0.8, groupPreference: 0.7 }, 0.2, ['MECH60018', 'MECH60009', 'MECH60001']),
  persona('structural analyst', { 'solid-mechanics-materials': 0.95, 'computational-simulation': 0.7, 'mathematics-modelling': 0.6 }, ['research-academia'], { mathsComfort: 0.85, examPreference: 0.6 }, 0.1, ['MECH60014', 'MECH60007', 'MECH60002']),
  persona('startup founder', { 'entrepreneurship-innovation': 0.95, 'finance-economics': 0.7, 'management-leadership': 0.7 }, ['startup-founder'], { groupPreference: 0.85, appliedPreference: 0.8, examPreference: 0.2 }, 0.9, ['BUSI60041', 'IEX-INNOVATE', 'BUSI60043']),
  persona('future consultant', { 'finance-economics': 0.9, 'management-leadership': 0.8, 'policy-ethics': 0.5 }, ['consulting'], { groupPreference: 0.7 }, 0.85, ['BUSI60038', 'BUSI60043', 'IEX-DECISIONS']),
  persona('data scientist', { 'statistics-data': 0.95, 'machine-learning-ai': 0.9, 'programming-software': 0.7 }, ['software-data'], { codingComfort: 0.85, mathsComfort: 0.8 }, 0.5, ['MECH60017', 'IEX-ML', 'MECH60016']),
  persona('materials specialist', { 'solid-mechanics-materials': 0.95, 'experimental-lab': 0.7, 'design-manufacturing': 0.5 }, [], { appliedPreference: 0.7 }, 0.1, ['MECH60013', 'MECH60019', 'MECH60002']),
  persona('mathematical modeller', { 'mathematics-modelling': 0.95, 'computational-simulation': 0.8, 'statistics-data': 0.6 }, ['research-academia'], { examPreference: 0.8, appliedPreference: 0.2, mathsComfort: 0.95 }, 0.1, ['MECH60016', 'MECH60021', 'MECH60017']),
  persona('climate policy advocate', { 'sustainability-climate': 0.95, 'policy-ethics': 0.85, 'global-development': 0.7 }, ['energy-transition'], { examPreference: 0.2 }, 0.9, ['IEX-CLIMATE', 'IEX-SCIPOLICY', 'IEX-GLOBALECON']),
  persona('humanities explorer', { 'history-philosophy': 0.95, 'psychology-behaviour': 0.85, 'communication-writing': 0.6 }, [], { examPreference: 0.3 }, 0.95, ['IEX-HISTSCI', 'IEX-PHILMIND', 'IEX-PSYCHPERF']),
  persona('creative technologist', { 'creative-arts-design': 0.9, 'design-manufacturing': 0.75, 'psychology-behaviour': 0.5 }, [], { appliedPreference: 0.9, groupPreference: 0.7 }, 0.8, ['IEX-VR', 'IEX-CROWDS', 'MECH60024']),
];

export interface Transcript {
  name: string;
  turns: { text: string; targetSlots: string[] }[];
  /** Expected slot values: numbers are checked within 0.25, everything else exactly. */
  expected: Record<string, number | string | string[] | boolean>;
}

export const EXTRACTION_TRANSCRIPTS: Transcript[] = [
  {
    name: 'motorsport aerodynamicist',
    turns: [
      { text: 'I lost track of time in the wind tunnel lab and the CFD coursework.', targetSlots: ['interest'] },
      { text: 'I would avoid thermodynamics if I could.', targetSlots: ['interest'] },
      { text: 'I want to work in Formula 1 aerodynamics.', targetSlots: ['pathways'] },
      { text: 'Coursework over exams, and I like hands-on work.', targetSlots: ['style.examPreference', 'style.appliedPreference'] },
      { text: 'I prefer working in a team, and a heavy workload is fine.', targetSlots: ['style.groupPreference', 'style.workloadTolerance'] },
      { text: 'Maybe, a bit.', targetSlots: ['breadthAppetite'] },
      { text: 'Keep Fridays free.', targetSlots: ['timetablePrefs.avoidDays', 'timetablePrefs.earliestStart'] },
    ],
    expected: {
      'interest:fluid-mechanics': 0.85,
      'interest:computational-simulation': 0.85,
      'interest:thermodynamics-energy': 0.1,
      pathways: ['aerospace-motorsport'],
      'style.examPreference': 0.2,
      'style.appliedPreference': 0.85,
      'style.groupPreference': 0.8,
      'style.workloadTolerance': 0.8,
      breadthAppetite: 0.5,
      'timetablePrefs.avoidDays': ['fri'],
    },
  },
  {
    name: 'undecided theorist',
    turns: [
      { text: 'Honestly the maths modules and the statistics course were my favourite.', targetSlots: ['interest'] },
      { text: 'Not sure yet.', targetSlots: ['pathways'] },
      { text: 'I like exams and I prefer theory and derivations.', targetSlots: ['style.examPreference', 'style.appliedPreference'] },
      { text: 'I work best on my own.', targetSlots: ['style.groupPreference', 'style.workloadTolerance'] },
      { text: 'No, I would rather stay focused.', targetSlots: ['breadthAppetite'] },
      { text: 'Nothing before 10am please.', targetSlots: ['timetablePrefs.avoidDays', 'timetablePrefs.earliestStart'] },
    ],
    expected: {
      'interest:mathematics-modelling': 0.85,
      'interest:statistics-data': 0.85,
      pathwaysSkipped: true,
      'style.examPreference': 0.85,
      'style.appliedPreference': 0.2,
      'style.groupPreference': 0.2,
      breadthAppetite: 0.15,
      'timetablePrefs.earliestStart': '10:00',
    },
  },
  {
    name: 'robotics founder',
    turns: [
      { text: 'Building robots and programming the electronics is what I love.', targetSlots: ['interest'] },
      { text: 'I would like to start my own company one day.', targetSlots: ['pathways'] },
      { text: 'Projects, definitely, and practical work.', targetSlots: ['style.examPreference', 'style.appliedPreference'] },
      { text: 'Team work please, but a lighter workload this year.', targetSlots: ['style.groupPreference', 'style.workloadTolerance'] },
      { text: 'Yes, I would love to try entrepreneurship or a language.', targetSlots: ['breadthAppetite'] },
      {
        text: 'Keep Wednesday afternoons free for sport, and nothing before 10am please.',
        targetSlots: ['timetablePrefs.avoidDays', 'timetablePrefs.earliestStart'],
      },
    ],
    expected: {
      // Half of Wednesday, not the whole day (issue 53).
      'timetablePrefs.avoidDays': [],
      'timetablePrefs.avoidHalfDays': ['wed-pm'],
      'timetablePrefs.earliestStart': '10:00',
      'interest:control-robotics': 0.85,
      'interest:programming-software': 0.85,
      'interest:electronics-embedded': 0.85,
      pathways: ['startup-founder'],
      'style.examPreference': 0.2,
      'style.appliedPreference': 0.85,
      'style.groupPreference': 0.8,
      'style.workloadTolerance': 0.3,
      breadthAppetite: 0.85,
      'interest:entrepreneurship-innovation': 0.85,
    },
  },
  {
    name: 'sustainability engineer',
    turns: [
      { text: 'Renewables and climate work really interest me, and the materials labs were fun.', targetSlots: ['interest'] },
      { text: 'I find programming boring.', targetSlots: ['interest'] },
      { text: 'Something in energy, maybe nuclear or renewables.', targetSlots: ['pathways'] },
      { text: 'A mix of exams and coursework is fine.', targetSlots: ['style.examPreference', 'style.appliedPreference'] },
    ],
    expected: {
      'interest:sustainability-climate': 0.85,
      'interest:solid-mechanics-materials': 0.85,
      'interest:programming-software': 0.1,
      pathways: ['energy-transition'],
      'style.examPreference': 0.5,
    },
  },
];
