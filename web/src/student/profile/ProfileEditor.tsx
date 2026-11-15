// Lets the student correct anything the interviewer heard (spec 20.3: see, edit and delete).
import { TOPIC_IDS, type HalfDay, type ProfileEditBody, type Style, type StudentProfile, type Weekday } from '@modulematch/shared';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Icon } from '../../components/Icon.tsx';
import { RangeSlider } from '../../components/RangeSlider.tsx';
import { DAY_LABELS, DAY_NAMES, halfDayLabel, percent, STYLE_KEYS, STYLE_META, styleValueText, topicLabel, WEEKDAYS } from '../labels.ts';

const START_TIMES = ['09:00', '10:00', '11:00', '12:00'] as const;

interface ProfileEditorProps {
  profile: StudentProfile;
  onSave: (body: ProfileEditBody) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

export function ProfileEditor({ profile, onSave, onCancel, saving, error }: ProfileEditorProps) {
  const [interests, setInterests] = useState<Record<string, number>>(profile.interests);
  const [style, setStyle] = useState<Style>(profile.style);
  const [breadth, setBreadth] = useState<number | null>(profile.breadthAppetite);
  const [avoidDays, setAvoidDays] = useState<Weekday[]>(profile.timetablePrefs.avoidDays);
  const [earliestStart, setEarliestStart] = useState<string | null>(profile.timetablePrefs.earliestStart);
  const [avoidHalfDays, setAvoidHalfDays] = useState<HalfDay[]>(profile.timetablePrefs.avoidHalfDays ?? []);
  const [newTopic, setNewTopic] = useState('');
  const addTopicId = useId();
  const startId = useId();

  const available = TOPIC_IDS.filter((t) => !(t in interests));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      interests,
      style,
      breadthAppetite: breadth,
      // A whole day kept free already covers its half days.
      timetablePrefs: {
        avoidDays,
        earliestStart,
        avoidHalfDays: avoidHalfDays.filter((h) => !avoidDays.some((d) => h.startsWith(d))),
      },
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Interests</legend>
        {Object.entries(interests).map(([topic, value]) => (
          <div key={topic} className="flex items-end gap-2">
            <RangeSlider
              className="flex-1"
              label={topicLabel(topic)}
              value={value}
              valueText={percent(value)}
              onChange={(v) => setInterests((current) => ({ ...current, [topic]: v }))}
            />
            <button
              type="button"
              onClick={() =>
                setInterests((current) => Object.fromEntries(Object.entries(current).filter(([k]) => k !== topic)))
              }
              className="mb-0.5 grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fit-low"
            >
              <Icon name="x" size={14} label={`Remove ${topicLabel(topic)}`} />
            </button>
          </div>
        ))}
        {available.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={addTopicId} className="text-xs font-medium">
                Add an interest
              </label>
              <select
                id={addTopicId}
                value={newTopic}
                onChange={(event) => setNewTopic(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm"
              >
                <option value="">Choose a topic</option>
                {available.map((t) => (
                  <option key={t} value={t}>
                    {topicLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              icon="plus"
              disabled={!newTopic}
              onClick={() => {
                setInterests((current) => ({ ...current, [newTopic]: 0.6 }));
                setNewTopic('');
              }}
            >
              Add
            </Button>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
          How you like to learn
        </legend>
        {STYLE_KEYS.map((key) => {
          const value = style[key];
          const meta = STYLE_META[key];
          return (
            <RangeSlider
              key={key}
              label={meta.label}
              value={value ?? 0.5}
              unset={value === null}
              valueText={value === null ? 'Not answered' : styleValueText(key, value)}
              lowLabel={meta.low}
              highLabel={meta.high}
              onChange={(v) => setStyle((current) => ({ ...current, [key]: v }))}
            />
          );
        })}
        <RangeSlider
          label="Appetite for modules outside your degree"
          value={breadth ?? 0.5}
          unset={breadth === null}
          valueText={breadth === null ? 'Not answered' : percent(breadth)}
          lowLabel="Stay close to my degree"
          highLabel="Something different"
          onChange={setBreadth}
        />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Timetable</legend>
        <p className="mb-2 text-xs font-medium" id={`${startId}-days`}>
          Days to keep free
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${startId}-days`}>
          {WEEKDAYS.map((day) => {
            const on = avoidDays.includes(day);
            return (
              <label
                key={day}
                className={cx(
                  'cursor-pointer rounded-full px-3 py-1 text-xs font-medium ring-1 transition ring-inset has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                  on ? 'bg-brand text-on-brand ring-brand' : 'bg-surface text-ink ring-line-strong hover:bg-surface-2',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() =>
                    setAvoidDays((current) => (on ? current.filter((d) => d !== day) : [...current, day]))
                  }
                />
                {DAY_NAMES[day]}
              </label>
            );
          })}
        </div>
        <p className="mt-4 mb-2 text-xs font-medium" id={`${startId}-halves`}>
          Half days to keep free
        </p>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-labelledby={`${startId}-halves`}>
          {WEEKDAYS.map((day) => (
            <div key={day} className="grid gap-1">
              {(['am', 'pm'] as const).map((part) => {
                const half: HalfDay = `${day}-${part}`;
                const whole = avoidDays.includes(day);
                const on = whole || avoidHalfDays.includes(half);
                return (
                  <label
                    key={half}
                    className={cx(
                      'rounded-lg py-1 text-center text-2xs font-medium ring-1 transition ring-inset has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand',
                      whole ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                      on ? 'bg-brand/15 text-brand ring-brand/40' : 'bg-surface text-muted ring-line-strong hover:bg-surface-2',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      disabled={whole}
                      aria-label={halfDayLabel(half)}
                      onChange={() =>
                        setAvoidHalfDays((current) => (on ? current.filter((h) => h !== half) : [...current, half]))
                      }
                    />
                    <span aria-hidden="true">
                      {DAY_LABELS[day]} {part.toUpperCase()}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        <label htmlFor={startId} className="mt-4 block text-xs font-medium">
          Earliest start
        </label>
        <select
          id={startId}
          value={earliestStart ?? ''}
          onChange={(event) => setEarliestStart(event.target.value || null)}
          className="mt-1.5 h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-sm sm:w-48"
        >
          <option value="">Any time</option>
          {START_TIMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </fieldset>

      {error && (
        <p role="alert" className="text-xs text-fit-low">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon="check" busy={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
