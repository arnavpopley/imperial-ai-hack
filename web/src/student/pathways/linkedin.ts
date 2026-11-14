// LinkedIn people-search links per pathway. LinkedIn's API does not expose a member's connections, so the app
// cannot list people you know; it opens a public people search instead, and the button says exactly that.

const KEYWORDS: Record<string, { keywords: string; field: string }> = {
  'aerospace-motorsport': { keywords: 'aerodynamics Formula 1 aerospace', field: 'aerospace and motorsport' },
  'energy-transition': { keywords: 'renewable energy transition', field: 'the energy transition' },
  'robotics-automation': { keywords: 'robotics automation engineer', field: 'robotics and automation' },
  'biomedical-devices': { keywords: 'medical devices engineer', field: 'biomedical devices' },
  'software-data': { keywords: 'software engineer data scientist', field: 'software and data' },
  consulting: { keywords: 'consultant finance', field: 'consulting and finance' },
  'startup-founder': { keywords: 'founder start-up', field: 'start-ups' },
  'research-academia': { keywords: 'PhD researcher', field: 'research and academia' },
};

export interface LinkedInSearch {
  url: string;
  /** Button text, for example "Search LinkedIn for Imperial alumni in aerospace and motorsport". */
  label: string;
}

export function linkedInSearch(pathwayId: string, pathwayTitle: string): LinkedInSearch {
  const known = KEYWORDS[pathwayId];
  const keywords = known?.keywords ?? pathwayTitle;
  const field = known?.field ?? pathwayTitle.toLowerCase();
  const query = encodeURIComponent(`Imperial College London ${keywords}`);
  return {
    url: `https://www.linkedin.com/search/results/people/?keywords=${query}`,
    label: `Search LinkedIn for Imperial alumni in ${field}`,
  };
}
