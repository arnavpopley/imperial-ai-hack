// "Here is what I heard" (spec 10.2): the interview ends with a summary the student confirms or edits.
import type { StudentProfile } from '@modulematch/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { Icon } from '../../components/Icon.tsx';
import { DAY_NAMES, STYLE_KEYS, STYLE_META, styleValueText, topicLabel } from '../labels.ts';
import { ProfileEditor } from '../profile/ProfileEditor.tsx';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { paths } from '../routes.ts';
import { useReferenceData } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

function heardLines(profile: StudentProfile, pathwayTitle: (id: string) => string): string[] {
  const lines: string[] = [];
  const top = Object.entries(profile.interests)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([t]) => topicLabel(t).toLowerCase());
  if (top.length > 0) lines.push(`You are most drawn to ${top.join(', ')}.`);
  if (profile.pathways.length > 0) lines.push(`You are aiming for ${profile.pathways.map(pathwayTitle).join(' and ')}.`);
  const styles = STYLE_KEYS.flatMap((key) => {
    const value = profile.style[key];
    return value === null ? [] : [`${STYLE_META[key].label.toLowerCase()}: ${styleValueText(key, value).toLowerCase()}`];
  });
  if (styles.length > 0) lines.push(`On learning style, ${styles.join('; ')}.`);
  if (profile.breadthAppetite !== null) {
    lines.push(
      profile.breadthAppetite >= 0.5
        ? 'You are open to something outside your degree.'
        : 'You would rather stay close to your degree.',
    );
  }
  if (profile.timetablePrefs.avoidDays.length > 0) {
    lines.push(`You want to keep ${profile.timetablePrefs.avoidDays.map((d) => DAY_NAMES[d]).join(' and ')} free.`);
  }
  return lines;
}

export function ConfirmProfileCard() {
  const { session } = useReadySession();
  const { pathwayById } = useReferenceData();
  const { save, saving, error } = useProfileActions();
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const lines = heardLines(session.profile, (id) => pathwayById.get(id)?.title ?? id);

  const confirm = async () => {
    if (await save({ confirm: true })) navigate(paths.catalogue);
  };

  return (
    <section
      aria-labelledby="heard-heading"
      className="animate-rise rounded-card border border-brand/25 bg-surface p-5 shadow-soft"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon name="sparkle" size={16} />
        </span>
        <h3 id="heard-heading" className="font-semibold tracking-tight">
          Here is what I heard
        </h3>
      </div>
      {editing ? (
        <div className="mt-4">
          <ProfileEditor
            profile={session.profile}
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
          {lines.length > 0 ? (
            <ul className="mt-3 grid gap-1.5 text-sm leading-relaxed">
              {lines.map((line) => (
                <li key={line} className="flex gap-2">
                  <Icon name="check" size={14} className="mt-1 shrink-0 text-fit-high" />
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">I did not pick up much yet. You can add details yourself.</p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-fit-low">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button icon="edit" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="primary" icon="check" busy={saving} onClick={() => void confirm()}>
              That is right, show my modules
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
