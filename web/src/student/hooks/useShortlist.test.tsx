// @vitest-environment happy-dom
// Spec 12: the mode chip follows the session the shortlist POST returns, so shortlisting a second module
// shows "Planning timetable" at once, in every chip on the page, with no reload or timetable fetch.
import type { SessionState } from '@modulematch/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api.ts';
import { ModeChip } from '../../components/ModeChip.tsx';
import { SessionProvider, useReadySession, useSession } from '../state/SessionProvider.tsx';
import { writeStoredSessionId } from '../state/storage.ts';
import { useShortlist } from './useShortlist.ts';

vi.mock('../../api.ts', () => ({ api: { getSession: vi.fn(), shortlist: vi.fn(), timetable: vi.fn() } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = '2026-11-15T09:00:00.000Z';
const session = (mode: SessionState['mode'], shortlist: string[]): SessionState => ({
  id: 's1',
  mode,
  profile: {
    studentId: 'student-s1',
    programme: 'MEng Mechanical Engineering',
    yearOfStudy: 3,
    completedModuleIds: [],
    interests: {},
    pathways: [],
    pathwaysSkipped: false,
    style: { examPreference: null, groupPreference: null, appliedPreference: null, mathsComfort: null, codingComfort: null, workloadTolerance: null },
    breadthAppetite: null,
    timetablePrefs: { avoidDays: [], earliestStart: null },
    completeness: 1,
    updatedAt: at,
  },
  evidence: [],
  messages: [],
  weights: { interest: 0.45, goal: 0.25, style: 0.2, breadth: 0.1 },
  shortlist,
  interview: { depth: 'quick', questionsAsked: 0, budget: 6, finished: true, confirmed: true, askedSteps: [], targetSlots: [], disputes: 0 },
  escalations: [],
  escalationDraft: null,
  exceptions: [],
  createdAt: at,
  updatedAt: at,
});

/** The shell's chip and the advisor drawer's chip both read session.mode, as here. */
function Harness() {
  const { session: current } = useReadySession();
  const shortlist = useShortlist();
  return (
    <>
      <div data-testid="shell">
        <ModeChip variant={current.mode} />
      </div>
      <div data-testid="drawer">
        <ModeChip variant={current.mode} />
      </div>
      <button type="button" onClick={() => void shortlist.toggle('MECH60018')}>
        Shortlist Mechatronics 3A
      </button>
      <button type="button" onClick={() => void shortlist.swap('MECH60018', 'MECH60001').catch(() => undefined)}>
        Swap
      </button>
      <button type="button" onClick={() => void shortlist.remove('MECH60018').catch(() => undefined)}>
        Remove Mechatronics 3A
      </button>
      <p data-testid="shortlist">{current.shortlist.join(',')}</p>
    </>
  );
}

/** Like the app's session gate: the harness mounts once the stored session has loaded. */
function Gate() {
  return useSession().status === 'ready' ? <Harness /> : null;
}

describe('useShortlist and the mode chip', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    writeStoredSessionId('s1');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  const mount = () =>
    act(async () =>
      root.render(
        <SessionProvider>
          <Gate />
        </SessionProvider>,
      ),
    );
  const click = (label: string) =>
    act(async () => [...container.querySelectorAll('button')].find((b) => b.textContent === label)?.click());
  const chip = (where: 'shell' | 'drawer') => container.querySelector(`[data-testid="${where}"]`)?.textContent;
  const saved = () => container.querySelector('[data-testid="shortlist"]')?.textContent;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    writeStoredSessionId(null);
    vi.resetAllMocks();
  });

  it('shows "Planning timetable" as soon as a second module is shortlisted', async () => {
    vi.mocked(api.getSession).mockResolvedValue(session('RECOMMEND', ['MECH60009']));
    vi.mocked(api.shortlist).mockResolvedValue(session('PLAN', ['MECH60009', 'MECH60018']));
    await mount();
    expect(chip('shell')).toContain('Recommendations');

    await click('Shortlist Mechatronics 3A');

    expect(api.shortlist).toHaveBeenCalledWith('s1', { moduleId: 'MECH60018', action: 'add' });
    expect(chip('shell')).toContain('Planning timetable');
    expect(chip('drawer')).toContain('Planning timetable');
    expect(api.timetable).not.toHaveBeenCalled();
  });

  it('removes, and a second click never adds the module back (issue 103)', async () => {
    vi.mocked(api.getSession).mockResolvedValue(session('PLAN', ['MECH60009', 'MECH60018', 'MECH60017']));
    vi.mocked(api.shortlist).mockResolvedValue(session('PLAN', ['MECH60009', 'MECH60017']));
    await mount();

    await click('Remove Mechatronics 3A');
    await click('Remove Mechatronics 3A');

    expect(vi.mocked(api.shortlist).mock.calls).toEqual([
      ['s1', { moduleId: 'MECH60018', action: 'remove' }],
      ['s1', { moduleId: 'MECH60018', action: 'remove' }],
    ]);
    expect(saved()).toBe('MECH60009,MECH60017');
  });

  it('applies a swap by adding the alternative first, so the shortlist never drops below two', async () => {
    vi.mocked(api.getSession).mockResolvedValue(session('PLAN', ['MECH60009', 'MECH60018']));
    vi.mocked(api.shortlist)
      .mockResolvedValueOnce(session('PLAN', ['MECH60009', 'MECH60018', 'MECH60001']))
      .mockResolvedValueOnce(session('PLAN', ['MECH60009', 'MECH60001']));
    await mount();

    await click('Swap');

    expect(vi.mocked(api.shortlist).mock.calls).toEqual([
      ['s1', { moduleId: 'MECH60001', action: 'add' }],
      ['s1', { moduleId: 'MECH60018', action: 'remove' }],
    ]);
    expect(chip('shell')).toContain('Planning timetable');
  });

  it('keeps the swap when the removal was saved but its response was lost', async () => {
    vi.mocked(api.getSession)
      .mockResolvedValueOnce(session('PLAN', ['MECH60009', 'MECH60018']))
      .mockResolvedValueOnce(session('PLAN', ['MECH60009', 'MECH60001']));
    vi.mocked(api.shortlist)
      .mockResolvedValueOnce(session('PLAN', ['MECH60009', 'MECH60018', 'MECH60001']))
      .mockRejectedValueOnce(new Error('network error'));
    await mount();

    await click('Swap');

    expect(vi.mocked(api.shortlist).mock.calls).toHaveLength(2);
    expect(saved()).toBe('MECH60009,MECH60001');
  });

  it('takes the alternative off again when the removal really failed', async () => {
    const before = session('PLAN', ['MECH60009', 'MECH60018']);
    vi.mocked(api.getSession)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(session('PLAN', ['MECH60009', 'MECH60018', 'MECH60001']));
    vi.mocked(api.shortlist)
      .mockResolvedValueOnce(session('PLAN', ['MECH60009', 'MECH60018', 'MECH60001']))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(before);
    await mount();

    await click('Swap');

    expect(vi.mocked(api.shortlist).mock.calls[2]).toEqual(['s1', { moduleId: 'MECH60001', action: 'remove' }]);
    expect(saved()).toBe('MECH60009,MECH60018');
  });
});
