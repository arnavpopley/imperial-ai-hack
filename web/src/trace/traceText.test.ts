// Issue #115: trace rows read as words, and counts agree with their nouns.
import { describe, expect, it } from 'vitest';
import { labelCodes, noun } from './traceText.ts';

describe('trace text', () => {
  it('names escalation types and modes, and draws transitions as arrows', () => {
    expect(labelCodes('RULE_EXCEPTION')).toBe('Rule exception');
    expect(labelCodes('LOW_CONFIDENCE')).toBe('Low confidence');
    expect(labelCodes('INTERVIEW -> RECOMMEND')).toMatch(/^[A-Z][a-z].* → [A-Z][a-z]/);
  });

  it('leaves module codes, guardrail names and unknown words alone', () => {
    expect(labelCodes('check_rules([MECH60016])')).toBe('check_rules([MECH60016])');
    expect(labelCodes('G3 injection on a CV')).toBe('G3 injection on a CV');
  });

  it('agrees a count with its noun', () => {
    expect(noun(1, 'safety check')).toBe('safety check');
    expect(noun(3, 'safety check')).toBe('safety checks');
    expect(noun(0, 'event')).toBe('events');
  });
});
