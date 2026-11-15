// "Here is what I heard" (spec 10.2): the interview ends with a visual summary the student confirms or edits.
import { motion, type Variants } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { DAY_LABELS, DAY_NAMES, splitInterests, STYLE_KEYS, STYLE_META, styleValueText, topicLabel } from '../labels.ts';
import { InterviewerAvatar } from '../interview/InterviewerAvatar.tsx';
import { useInterviewer } from '../interview/personas.ts';
import { ProfileEditor } from '../profile/ProfileEditor.tsx';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { paths } from '../routes.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const GROUP: Variants = { shown: { transition: { staggerChildren: 0.06 } } };
const ITEM: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

export function ConfirmProfileCard() {
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
  const { avoidDays, earliestStart } = profile.timetablePrefs;
  const empty =
    interests.length === 0 &&
    avoided.length === 0 &&
    profile.pathways.length === 0 &&
    styles.length === 0 &&
    profile.breadthAppetite === null &&
    avoidDays.length === 0;

  const confirm = async () => {
    if (await save({ confirm: true })) navigate(paths.catalogue);
  };

  return (
    <section
      aria-labelledby="heard-heading"
      className="rounded-[1.5rem] border border-brand/25 bg-surface p-5 shadow-lift sm:p-7"
    >
      <div className="flex items-center gap-3">
        <InterviewerAvatar persona={persona} size={44} />
        <div>
          <h3 id="heard-heading" className="text-lg font-semibold tracking-tight">
            Here is what I heard
          </h3>
          <p className="text-[13px] text-muted">Check it looks like you.</p>
        </div>
      </div>
      {editing ? (
        <div className="mt-5">
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
        </div>
      ) : (
        <>
          {empty ? (
            <p className="mt-5 text-[15px] text-muted">I did not pick up much yet. You can add details yourself.</p>
          ) : (
            <motion.div initial="hidden" animate="shown" variants={GROUP} className="mt-6 grid gap-6 sm:grid-cols-2">
              {interests.length > 0 && (
                <Group title="Drawn to" wide>
                  <ul className="flex flex-wrap gap-2">
                    {interests.map(([topic, strength]) => (
                      <motion.li
                        key={topic}
                        variants={ITEM}
                        className="relative overflow-hidden rounded-full bg-surface-2 px-3.5 py-1.5 text-[14px] font-medium"
                      >
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 bg-brand/15"
                          style={{ width: `${Math.round(strength * 100)}%` }}
                        />
                        <span className="relative">{topicLabel(topic)}</span>
                      </motion.li>
                    ))}
                  </ul>
                </Group>
              )}
              {avoided.length > 0 && (
                <Group title="Avoid" wide>
                  <ul className="flex flex-wrap gap-2">
                    {avoided.map(([topic]) => (
                      <motion.li
                        key={topic}
                        variants={ITEM}
                        className="rounded-full bg-surface-2 px-3.5 py-1.5 text-[14px] font-medium text-muted"
                      >
                        {topicLabel(topic)}
                      </motion.li>
                    ))}
                  </ul>
                </Group>
              )}
              {profile.pathways.length > 0 && (
                <Group title="Heading towards" wide>
                  <ul className="flex flex-wrap gap-2">
                    {profile.pathways.map((id) => (
                      <motion.li
                        key={id}
                        variants={ITEM}
                        className="rounded-full bg-brand-soft px-3.5 py-1.5 text-[14px] font-medium text-brand"
                      >
                        {pathwayById.get(id)?.title ?? id}
                      </motion.li>
                    ))}
                  </ul>
                </Group>
              )}
              {styles.length > 0 && (
                <Group title="How you learn" wide>
                  <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {styles.map(({ key, value }) => (
                      <motion.li key={key} variants={ITEM} className="grid gap-1.5">
                        <span className="flex items-baseline justify-between gap-2 text-[13px]">
                          <span className="text-muted">{STYLE_META[key].label}</span>
                          <span className="font-medium">{styleValueText(key, value)}</span>
                        </span>
                        <span aria-hidden="true" className="relative block h-1.5 rounded-full bg-surface-2">
                          <motion.span
                            className="absolute inset-y-0 left-0 rounded-full bg-brand"
                            initial={{ width: 0 }}
                            animate={{ width: `${value * 100}%` }}
                            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
                          />
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </Group>
              )}
              {profile.breadthAppetite !== null && (
                <Group title="Breadth">
                  <motion.p variants={ITEM} className="text-[14px] font-medium">
                    {profile.breadthAppetite >= 0.5
                      ? 'Open to modules outside your degree'
                      : 'Staying close to your degree'}
                  </motion.p>
                </Group>
              )}
              {(avoidDays.length > 0 || earliestStart) && (
                <Group title="Keep free">
                  <ul className="flex flex-wrap gap-1.5">
                    {avoidDays.map((d) => (
                      <motion.li
                        key={d}
                        variants={ITEM}
                        aria-label={DAY_NAMES[d]}
                        className="rounded-lg bg-brand px-2.5 py-1 text-[13px] font-medium text-on-brand"
                      >
                        {DAY_LABELS[d]}
                      </motion.li>
                    ))}
                    {earliestStart && (
                      <motion.li variants={ITEM} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[13px]">
                        From {earliestStart}
                      </motion.li>
                    )}
                  </ul>
                </Group>
              )}
            </motion.div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-[13px] text-fit-low">
              {error}
            </p>
          )}
          <div className="mt-7 flex flex-wrap justify-end gap-2">
            <Button icon="edit" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="primary" icon="check" busy={saving} onClick={() => void confirm()}>
              That is me, show my modules
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function Group({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <h4 className="mb-2 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">{title}</h4>
      {children}
    </div>
  );
}
