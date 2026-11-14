// Screen 1: programme, year, completed modules and interview depth. Creating the session moves
// the student on; the entry route then sends them to the screen for the new session's mode.
import type { YearOfStudy } from '@modulematch/shared';
import { useId, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { ModeChip } from '../../components/ModeChip.tsx';
import { MultiSelect } from '../../components/MultiSelect.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { wasProfileDeleted } from '../shell/YourDataDrawer.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useSession } from '../state/SessionProvider.tsx';

const DEFAULT_PROGRAMME = 'MEng Mechanical Engineering';

const YEARS = [
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
] as const;
type YearValue = (typeof YEARS)[number]['value'];

type Depth = 'quick' | 'deep';
const DEPTHS: readonly { value: Depth; title: string; detail: string }[] = [
  { value: 'quick', title: 'Quick', detail: 'About 8 questions, three minutes' },
  { value: 'deep', title: 'Deep', detail: 'Up to 30 minutes, sharper matches' },
];

const YEAR_OF: Record<YearValue, YearOfStudy> = { '1': 1, '2': 2, '3': 3, '4': 4 };

const PROMISES: readonly { icon: IconName; text: string }[] = [
  { icon: 'chat', text: 'Every score links back to your own words.' },
  { icon: 'sliders', text: 'Change what matters most and watch the ranking move.' },
  { icon: 'lock', text: 'Never asks about grades, health or background. Delete it any time.' },
];

export function OnboardScreen() {
  const { start } = useSession();
  const { modules } = useReferenceData();
  const location = useLocation();
  const deleted = wasProfileDeleted(location.state);
  const [programme, setProgramme] = useState(DEFAULT_PROGRAMME);
  const [year, setYear] = useState<YearValue>('3');
  const [completed, setCompleted] = useState<string[]>([]);
  const [depth, setDepth] = useState<Depth>('quick');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const programmeId = useId();

  const options = (modules.data ?? []).map((m) => ({ value: m.id, label: m.title, detail: m.code }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await start({
        programme: programme.trim() || DEFAULT_PROGRAMME,
        yearOfStudy: YEAR_OF[year],
        completedModuleIds: completed,
        interviewDepth: depth,
      });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-10 py-4 lg:grid-cols-[1fr_28rem] lg:items-start lg:gap-16 lg:py-12">
      <div className="lg:sticky lg:top-24">
        <ModeChip variant="ONBOARD" />
        <h1 className="mt-5 text-[2.1rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Modules that fit <span className="text-brand">you</span>, not everyone.
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted sm:text-base">
          A short conversation builds your profile. Every module then gets a fit score you can open and question, and
          your shortlist becomes a timetable with clashes flagged before you commit.
        </p>
        <ul className="mt-7 grid max-w-md gap-3 text-sm">
          {PROMISES.map((item) => (
            <li key={item.text} className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface text-brand shadow-soft ring-1 ring-line">
                <Icon name={item.icon} size={14} />
              </span>
              <span className="pt-1">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        aria-labelledby="onboard-heading"
        className="grid gap-6 rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft sm:p-7"
      >
        {deleted && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-fit-high/10 px-3 py-2.5 text-[13px] font-medium">
            <Icon name="check" size={14} className="text-fit-high" />
            Your profile and evidence have been deleted.
          </p>
        )}
        <div>
          <h2 id="onboard-heading" className="text-lg font-semibold tracking-tight">
            Get started
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">Three details, then the interview.</p>
        </div>

        <div>
          <label htmlFor={programmeId} className="text-[13px] font-medium">
            Programme
          </label>
          <input
            id={programmeId}
            value={programme}
            onChange={(event) => setProgramme(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm transition focus:border-brand focus:ring-4 focus:ring-brand/12 focus:outline-none"
          />
        </div>

        <SegmentedControl legend="Year of study" options={YEARS} value={year} onChange={setYear} />

        <div>
          <MultiSelect
            label="Modules you have completed"
            hint="Used for prerequisites only. Search by title or code."
            options={options}
            selected={completed}
            onChange={setCompleted}
            placeholder={modules.loading && !modules.data ? 'Loading modules…' : 'Search modules'}
            disabled={!modules.data}
          />
          {modules.error && !modules.data && (
            <p role="alert" className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-fit-low">
              The module list did not load. You can continue without it.
              <button type="button" onClick={modules.reload} className="font-semibold underline underline-offset-2">
                Retry
              </button>
            </p>
          )}
          <SampleDataLabel className="mt-2" />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Interview</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {DEPTHS.map((d) => (
              <label
                key={d.value}
                className={cx(
                  'relative cursor-pointer rounded-xl border p-3.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                  depth === d.value ? 'border-brand bg-brand-soft/60' : 'border-line-strong hover:bg-surface-2',
                )}
              >
                <input
                  type="radio"
                  name="depth"
                  value={d.value}
                  checked={depth === d.value}
                  onChange={() => setDepth(d.value)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between text-sm font-semibold">
                  {d.title}
                  {depth === d.value && <Icon name="check" size={15} className="text-brand" />}
                </span>
                <span className="mt-0.5 block text-[12px] text-muted">{d.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-[13px] text-fit-low">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" busy={submitting} className="w-full">
          Start the interview
          <Icon name="arrow-right" size={16} />
        </Button>
      </form>
    </div>
  );
}
