// Screen 1: programme, year, completed modules and interview depth. Creating the session moves
// the student on; the entry route then sends them to the screen for the new session's mode.
import type { YearOfStudy } from '@modulematch/shared';
import { AnimatePresence, motion, MotionConfig, type Variants } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { api } from '../../api.ts';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon, type IconName } from '../../components/Icon.tsx';
import { ModeChip } from '../../components/ModeChip.tsx';
import { MultiSelect } from '../../components/MultiSelect.tsx';
import { SampleDataLabel } from '../../components/SampleDataLabel.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { Dropdown, type DropdownOption } from '../interview/Dropdown.tsx';
import { clearExamplePrefill, EXAMPLE_STUDENT, markExampleStart } from '../example.ts';
import { useAsync } from '../hooks/useAsync.ts';
import '../interview/interview.css';
import { NO_RULES_DETAIL, noRulesHint, yearsWithoutRules } from '../rulesStatus.ts';
import { wasProfileDeleted } from '../shell/YourDataDrawer.tsx';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useSession } from '../state/SessionProvider.tsx';

const DEFAULT_PROGRAMME = 'MEng Mechanical Engineering';

/** Only one programme has data so far; the disabled option makes clear more will follow. */
const COMING_SOON = 'coming-soon';
const PROGRAMMES: readonly DropdownOption<string>[] = [
  { value: DEFAULT_PROGRAMME, label: DEFAULT_PROGRAMME },
  { value: COMING_SOON, label: 'More programmes', detail: 'Coming soon', disabled: true },
];

type YearValue = '1' | '2' | '3' | '4';
const YEARS: readonly DropdownOption<YearValue>[] = [
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
];

const EASE = [0.2, 0.8, 0.2, 1] as const;
const RISE: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

type Depth = 'quick' | 'deep';
const DEPTHS: readonly { value: Depth; title: string; detail: string }[] = [
  { value: 'quick', title: 'Quick', detail: 'About 8 questions, three minutes' },
  { value: 'deep', title: 'Deep', detail: 'Up to 30 minutes, sharper matches' },
];

type StartMode = 'fresh' | 'example';
const START_MODES = [
  { value: 'fresh', label: 'Start fresh' },
  { value: 'example', label: 'Try an example' },
] as const;

const YEAR_OF: Record<YearValue, YearOfStudy> = { '1': 1, '2': 2, '3': 3, '4': 4 };

const PROMISES: readonly { icon: IconName; text: string }[] = [
  { icon: 'chat', text: 'Your words, your scores' },
  { icon: 'sliders', text: 'You set the weights' },
  // Spec 20.2 and 23: marks are kept only through the consented upload, which can be deleted at any time.
  { icon: 'lock', text: 'Marks only if you choose · never health' },
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
  const [startMode, setStartMode] = useState<StartMode>('fresh');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = (modules.data ?? []).map((m) => ({ value: m.id, label: m.title, detail: m.code }));
  // Issue 51: years without rules are still offered, but say so here and on the catalogue.
  const programmes = useAsync(() => api.programmes(), []);
  const noRules = yearsWithoutRules(programmes.data, programme);
  const yearOptions = YEARS.map((o) => (noRules.has(YEAR_OF[o.value]) ? { ...o, detail: NO_RULES_DETAIL } : o));

  // The example fills the form with a synthetic student; switching back clears it for the student's own details.
  const chooseStartMode = (mode: StartMode) => {
    setStartMode(mode);
    const example = mode === 'example';
    setProgramme(example ? EXAMPLE_STUDENT.programme : DEFAULT_PROGRAMME);
    setYear(example ? EXAMPLE_STUDENT.year : '3');
    setCompleted(example ? [...EXAMPLE_STUDENT.completedModuleIds] : []);
    setDepth(example ? EXAMPLE_STUDENT.depth : 'quick');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    if (startMode === 'example') markExampleStart();
    try {
      await start({
        programme,
        yearOfStudy: YEAR_OF[year],
        completedModuleIds: completed,
        interviewDepth: depth,
      });
    } catch (err) {
      clearExamplePrefill();
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial="hidden"
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.08 } } }}
        className="mx-auto grid max-w-6xl gap-10 py-4 lg:grid-cols-[minmax(0,1fr)_29rem] lg:items-start lg:gap-14 lg:py-10"
      >
        <div className="grid gap-6 lg:sticky lg:top-24">
          <motion.div variants={RISE}>
            <ModeChip variant="ONBOARD" />
            <h1 className="mt-5 text-display text-balance">
              Modules that fit <span className="text-brand">you</span>, not everyone.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:text-lg">
              A short chat about what you enjoy. Every score links back to your own words.
            </p>
          </motion.div>

          <motion.figure variants={RISE} className="mm-photo relative overflow-hidden rounded-[1.75rem] shadow-lift">
            <img
              src="/images/onboarding-outdoors.jpg"
              alt="Two students talking outdoors on campus"
              className="h-60 w-full object-cover sm:h-80 lg:h-[22rem]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent"
            />
            <ul className="absolute inset-x-5 bottom-5 hidden flex-wrap gap-2 sm:flex">
              {PROMISES.map((item, i) => (
                <motion.li
                  key={item.text}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.12, duration: 0.45, ease: EASE }}
                  className="flex items-center gap-2 rounded-full bg-surface/92 py-1.5 pr-3.5 pl-1.5 text-xs font-medium shadow-soft backdrop-blur"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-brand">
                    <Icon name={item.icon} size={12} />
                  </span>
                  {item.text}
                </motion.li>
              ))}
            </ul>
          </motion.figure>
        </div>

        <motion.form
          variants={RISE}
          onSubmit={(event) => void submit(event)}
          aria-labelledby="onboard-heading"
          className="grid gap-7 rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft sm:p-8"
        >
          <AnimatePresence>
            {deleted && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                role="status"
                className="flex items-center gap-2 rounded-xl bg-fit-high/10 px-3 py-2.5 text-xs font-medium"
              >
                <Icon name="check" size={14} className="text-fit-high" />
                Your profile and evidence have been deleted.
              </motion.p>
            )}
          </AnimatePresence>
          <div>
            <h2 id="onboard-heading" className="text-2xl font-semibold tracking-tight">
              Get started
            </h2>
            <p className="mt-1 text-sm text-muted">Three details, then a short chat.</p>
          </div>

          <SegmentedControl
            legend="How to start"
            hideLegend
            options={START_MODES}
            value={startMode}
            onChange={chooseStartMode}
          />
          <AnimatePresence initial={false}>
            {startMode === 'example' && (
              <motion.div
                key="example"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="flex gap-4 rounded-2xl bg-gradient-to-br from-brand-soft to-surface-2 p-4 ring-1 ring-brand/20">
                  <span
                    aria-hidden="true"
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-mode-explain text-lg font-semibold text-on-brand"
                  >
                    {EXAMPLE_STUDENT.name[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      Meet {EXAMPLE_STUDENT.name} <span className="font-normal text-muted">(an invented student)</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{EXAMPLE_STUDENT.summary}</p>
                    <ul className="mt-2.5 flex flex-wrap gap-1.5">
                      {EXAMPLE_STUDENT.tags.map((tag) => (
                        <li key={tag} className="rounded-full bg-surface px-2.5 py-0.5 text-2xs font-medium shadow-soft">
                          {tag}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2.5 text-2xs text-muted">
                      The form is filled in, and {EXAMPLE_STUDENT.name}&rsquo;s first answer will be waiting in the chat.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid gap-5">
            <Dropdown label="Programme" options={PROGRAMMES} value={programme} onChange={setProgramme} />
            <div className="grid gap-1.5">
              <Dropdown label="Year of study" options={yearOptions} value={year} onChange={setYear} />
              {noRules.has(YEAR_OF[year]) && (
                <p role="status" className="flex items-start gap-1.5 text-xs text-muted">
                  <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                  {noRulesHint(year)}
                </p>
              )}
            </div>
          </div>

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
              <p role="alert" className="mt-1.5 flex flex-wrap items-center gap-2 text-2xs text-fit-low">
                The module list did not load. You can continue without it.
                <button type="button" onClick={modules.reload} className="font-semibold underline underline-offset-2">
                  Retry
                </button>
              </p>
            )}
            <SampleDataLabel className="mt-2" />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs font-medium">Interview</legend>
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
                  <span className="mt-0.5 block text-2xs text-muted">{d.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-xs text-fit-low">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" busy={submitting} className="h-12 w-full rounded-2xl text-sm">
            {startMode === 'example' ? `Start as ${EXAMPLE_STUDENT.name}` : 'Start the interview'}
            <Icon name="arrow-right" size={16} />
          </Button>
        </motion.form>
      </motion.div>
    </MotionConfig>
  );
}
