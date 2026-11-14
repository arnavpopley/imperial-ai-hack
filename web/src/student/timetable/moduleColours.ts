// Literal class strings per module palette token, so Tailwind can see every one of them.
export interface ModuleColour {
  block: string;
  dot: string;
}

const FIRST: ModuleColour = { block: 'bg-module-1/14 border-module-1', dot: 'bg-module-1' };

const PALETTE: readonly ModuleColour[] = [
  FIRST,
  { block: 'bg-module-2/14 border-module-2', dot: 'bg-module-2' },
  { block: 'bg-module-3/14 border-module-3', dot: 'bg-module-3' },
  { block: 'bg-module-4/14 border-module-4', dot: 'bg-module-4' },
  { block: 'bg-module-5/14 border-module-5', dot: 'bg-module-5' },
  { block: 'bg-module-6/14 border-module-6', dot: 'bg-module-6' },
  { block: 'bg-module-7/14 border-module-7', dot: 'bg-module-7' },
  { block: 'bg-module-8/14 border-module-8', dot: 'bg-module-8' },
];

/** Gives each module a stable colour by its position in `moduleIds`, cycling through the palette. */
export function moduleColours(moduleIds: readonly string[]): (moduleId: string) => ModuleColour {
  const index = new Map<string, number>();
  for (const id of moduleIds) if (!index.has(id)) index.set(id, index.size);
  return (moduleId) => PALETTE[(index.get(moduleId) ?? 0) % PALETTE.length] ?? FIRST;
}
