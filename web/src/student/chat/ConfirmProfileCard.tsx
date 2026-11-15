// "Here is what I heard" (spec 10.2): the interview ends with a visual summary the student confirms or edits.
// Issue 144: it is compact (two columns on a desktop), its body scrolls inside the card, and the confirm button sits in
// a footer that is always in view. Groups rise in together within about half a second, so none is ever blank.
import { motion, type Variants } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Meter } from '../../components/Meter.tsx';
import { splitInterests, STYLE_KEYS, STYLE_META, styleValueText, topicLabel } from '../labels.ts';
import { InterviewerAvatar } from '../interview/InterviewerAvatar.tsx';
import { useInterviewer } from '../interview/personas.ts';
import { KeepFreeDays } from '../profile/KeepFreeDays.tsx';
import { ProfileEditor } from '../profile/ProfileEditor.tsx';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { paths } from '../routes.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';
import { strengthStep, STRENGTH_LABELS } from './heard.ts';

const EASE = [0.2, 0.8, 0.2, 1] as const;
/** Six groups at 50ms apart, each 250ms: the whole card is in within about 550ms (issue 144). */
const GROUP: Variants = { shown: { transition: { staggerChildren: 0.05 } } };
const ITEM: Variants = {
  hidden: { opacity: 0, y: 6 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
};

export function ConfirmProfileCard({ className }: { className?: string }) {
  const { session } = useReadySession();
  const { pathwayById } = useReferenceData();
  const { save, saving, error } = useProfileActions();
  const persona = useInterviewer();
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const { profile } = session;

  const { liked, avoided } = splitInterests(profile.interests);
  const interests = liked.slice(0, 5);
  const styles = STYLE_KEYS.flatMap((key) => {
    const value = profile.style[key];
    return value === null ? [] : [{ key, value }];
  });
  const { avoidDays, earliestStart, avoidHalfDays = [] } = profile.timetablePrefs;
  const keepsFree = avoidDays.length > 0 || avoidHalfDays.length > 0 || Boolean(earliestStart);
  const left = interests.length > 0 || avoided.length > 0 || profile.pathways.length > 0;
  const right = styles.length > 0 || profile.breadthAppetite !== null || keepsFree;
  const empty = !left && !right;

  const confirm = async () => {
    if (await save({ confirm: true })) navigate(paths.catalogue);
  };

  return (
    <section
      aria-labelledby="heard-heading"
      className={cx('flex min-h-0 flex-col rounded-[1.25rem] border border-brand/25 bg-surface shadow-lift', className)}
    >
      <div className="flex shrink-0 items-center gap-3 px-4 pt-4 sm:px-5">
        <InterviewerAvatar persona={persona} size={32} />
        <div className="min-w-0 flex-1">
          <h3 id="heard-heading" className="text-base font-semibold tracking-tight">
            Here is what I heard
          </h3>
          <p className="text-[12px] text-muted">Check it looks like you.</p>
        </div>
        {/* Edit sits up here, so the footer holds only the confirm button and fits a phone on one line. */}
        {!editing && (
          <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {/* The body scrolls inside the card, so the footer below never leaves the screen. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-3 sm:px-5">
        {editing ? (
          <ProfileEditor
            profile={profile}
            saving={saving}
            error={error}
            onCancel={() => setEditing(false)}
            onSave={(body) => {
              void save(body).then((saved) => {
                if (saved) setEditing(false);
              });
            }}
          />
        ) : empty ? (
          <p className="text-[14px] text-muted">I did not pick up much yet. You can add details yourself.</p>
        ) : (
          <motion.div initial="hidden" animate="shown" variants={GROUP} className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
            {left && (
              <div className="grid content-start gap-4">
                {interests.length > 0 && (
                  <Group title="Drawn to">
                    <ul className="flex flex-wrap gap-1.5">
                      {interests.map(([topic, strength]) => {
                        const step = strengthStep(strength);
                        return (
                          <li key={topic} className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[13px] font-medium text-ink">
                            {topicLabel(topic)}
                            {/* A three-step strength dot row, not a bar every chip fills alike (issue 144). */}
                            <span aria-hidden="true" className="flex gap-0.5">
                              {[1, 2, 3].map((n) => (
                                <span key={n} className={cx('size-1.5 rounded-full', n <= step ? 'bg-brand' : 'bg-brand/20')} />
                              ))}
                            </span>
                            <span className="sr-only">, {STRENGTH_LABELS[step]}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </Group>
                )}
                {avoided.length > 0 && (
                  <Group title="Avoid">
                    <ul className="flex flex-wrap gap-1.5">
                      {avoided.map(([topic]) => (
                        <li key={topic} className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium text-muted line-through decoration-muted/60">
                          {topicLabel(topic)}
                        </li>
                      ))}
                    </ul>
                  </Group>
                )}
                {profile.pathways.length > 0 && (
                  <Group title="Heading towards">
                    <ul className="flex flex-wrap gap-1.5">
                      {profile.pathways.map((id) => (
                        <li key={id} className="rounded-full bg-brand-soft px-3 py-1 text-[13px] font-medium text-brand">
                          {pathwayById.get(id)?.title ?? id}
                        </li>
                      ))}
                    </ul>
                  </Group>
                )}
              </div>
            )}
            {right && (
              <div className="grid content-start gap-4">
                {styles.length > 0 && (
                  <Group title="How you learn">
                    <ul className="grid gap-y-2">
                      {styles.map(({ key, value }) => (
                        <li key={key} className="grid gap-1">
                          <span className="flex items-baseline justify-between gap-3 text-[12px]">
                            <span className="shrink-0 text-muted">{STYLE_META[key].label}</span>
                            <span className="min-w-0 truncate text-right font-medium">{styleValueText(key, value)}</span>
                          </span>
                          <Meter value={value} label={STYLE_META[key].label} valueText={styleValueText(key, value)} />
                        </li>
                      ))}
                    </ul>
                  </Group>
                )}
                {profile.breadthAppetite !== null && (
                  <Group title="Breadth">
                    <p className="mb-1.5 text-[13px] font-medium">
                      {profile.breadthAppetite >= 0.5 ? 'Open to modules outside your degree' : 'Staying close to your degree'}
                    </p>
                    <Meter value={profile.breadthAppetite} label="Appetite for modules outside your degree" />
                  </Group>
                )}
                {keepsFree && (
                  <Group title="Keep free">
                    <KeepFreeDays avoidDays={avoidDays} avoidHalfDays={avoidHalfDays} size="sm" />
                    {earliestStart && <p className="mt-1.5 text-[12px] text-muted">Nothing before {earliestStart}</p>}
                  </Group>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {!editing && (
        <div className="grid shrink-0 gap-2 border-t border-line px-4 py-3 sm:px-5">
          {error && (
            <p role="alert" className="text-[13px] text-fit-low">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="primary" icon="check" busy={saving} onClick={() => void confirm()} className="max-sm:w-full">
              That is me, show my modules
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** One group rises in as a whole, so a heading is never on screen without its content (issue 144). */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.div variants={ITEM}>
      <h4 className="mb-1.5 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">{title}</h4>
      {children}
    </motion.div>
  );
}
