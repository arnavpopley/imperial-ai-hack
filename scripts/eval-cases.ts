// Hand-written evaluation cases (spec 18.1). Personas are synthetic; module ids refer to data/modules.json.
import type { StudentProfile } from '@modulematch/shared';

export interface Persona {
  name: string;
  profile: Partial<Omit<StudentProfile, 'style'>> & { style?: Partial<StudentProfile['style']> };
  /** Three modules that must all appear in the persona's eligible top five. */
  expected: [string, string, string];
}

export const PERSONAS: Persona[] = [];

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
    ],
    expected: {
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
