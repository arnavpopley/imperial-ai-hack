// The interviewer's face. Students pick who they talk to; the choice lives in localStorage.
//
// Avatars come from DiceBear's "Lorelei" style, based on Lorelei by Lisa Wischofsky, licensed CC0 1.0
// (https://creativecommons.org/publicdomain/zero/1.0/). The DiceBear code itself is MIT.
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import { useSyncExternalStore } from 'react';

type HairVariant = NonNullable<lorelei.Options['hair']>[number];

export interface Persona {
  id: string;
  name: string;
  /** Pastel backdrop behind the face, also used for the speaking ring. */
  tint: string;
  options: {
    hair: HairVariant;
    skin: string;
    hairColor: string;
    beard?: 'variant01' | 'variant02';
    glasses?: boolean;
    earrings?: boolean;
  };
}

/** Varied presentations: different hair, skin tones and features. */
export const PERSONAS: readonly Persona[] = [
  {
    id: 'maya',
    name: 'Maya',
    tint: '#e7eafc',
    options: { hair: 'variant35', skin: 'f2d3b1', hairColor: '4a312c', earrings: true },
  },
  {
    id: 'sam',
    name: 'Sam',
    tint: '#dff3ea',
    options: { hair: 'variant04', skin: 'eac4a4', hairColor: 'b58143', beard: 'variant01' },
  },
  {
    id: 'priya',
    name: 'Priya',
    tint: '#fbe7dc',
    options: { hair: 'variant41', skin: 'b9825c', hairColor: '1b1716', earrings: true },
  },
  {
    id: 'alex',
    name: 'Alex',
    tint: '#f3e8fb',
    options: { hair: 'variant13', skin: 'f9d4c4', hairColor: 'd6b370', glasses: true },
  },
  {
    id: 'jordan',
    name: 'Jordan',
    tint: '#fdf3d4',
    options: { hair: 'variant39', skin: '6b4226', hairColor: '1b1716' },
  },
  {
    id: 'leo',
    name: 'Leo',
    tint: '#dcefff',
    options: { hair: 'variant06', skin: 'd6a07c', hairColor: '2c1b18', beard: 'variant02' },
  },
  { id: 'amara', name: 'Amara', tint: '#ffe3ec', options: { hair: 'variant45', skin: '8d5a3b', hairColor: '1b1716' } },
  {
    id: 'kenji',
    name: 'Kenji',
    tint: '#e2f5f3',
    options: { hair: 'variant43', skin: 'e8c39e', hairColor: '0e0e0e', glasses: true },
  },
];

const DEFAULT_PERSONA = PERSONAS[0] as Persona;

const uriCache = new Map<string, string>();

/** A data URI for the persona's SVG face. Built once per persona, since generation walks the whole style. */
export function personaAvatarUri(persona: Persona): string {
  const cached = uriCache.get(persona.id);
  if (cached) return cached;
  const { hair, skin, hairColor, beard, glasses, earrings } = persona.options;
  const uri = createAvatar(lorelei, {
    seed: persona.id,
    hair: [hair],
    skinColor: [skin],
    hairColor: [hairColor],
    beard: beard ? [beard] : undefined,
    beardProbability: beard ? 100 : 0,
    glassesProbability: glasses ? 100 : 0,
    earringsProbability: earrings ? 100 : 0,
    frecklesProbability: 0,
    hairAccessoriesProbability: 0,
    mouth: ['happy01', 'happy02', 'happy04', 'happy08'],
  }).toDataUri();
  uriCache.set(persona.id, uri);
  return uri;
}

const STORAGE_KEY = 'modulematch.interviewer';
const listeners = new Set<() => void>();

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let currentId: string = readStoredId() ?? DEFAULT_PERSONA.id;

export function personaById(id: string): Persona {
  return PERSONAS.find((p) => p.id === id) ?? DEFAULT_PERSONA;
}

/** Saves the choice (best effort: private windows may block storage) and tells every avatar to redraw. */
export function choosePersona(id: string): void {
  currentId = personaById(id).id;
  try {
    window.localStorage.setItem(STORAGE_KEY, currentId);
  } catch {
    // Storage is unavailable; the choice still holds for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The interviewer the student chose, shared by the picker and every chat bubble. */
export function useInterviewer(): Persona {
  const id = useSyncExternalStore(
    subscribe,
    () => currentId,
    () => DEFAULT_PERSONA.id,
  );
  return personaById(id);
}
