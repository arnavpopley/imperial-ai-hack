// Screen 2: the interview on the left, the live profile on the right (stacked behind a toggle on phones).
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { Meter } from '../../components/Meter.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { ChatPanel } from '../chat/ChatPanel.tsx';
import { ProfilePanel } from '../profile/ProfilePanel.tsx';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { paths } from '../routes.ts';
import { useReadySession } from '../state/SessionProvider.tsx';

type Pane = 'chat' | 'profile';

export function InterviewScreen() {
  const { session } = useReadySession();
  const { save, saving, error } = useProfileActions();
  const navigate = useNavigate();
  const [pane, setPane] = useState<Pane>('chat');
  const { questionsAsked, budget, depth, confirmed } = session.interview;
  const asked = Math.min(questionsAsked, budget);
  const learned = Object.keys(session.profile.interests).length;

  // Spec 12: skipping the interview moves on to recommendations with the profile as it stands.
  const skip = async () => {
    if (confirmed || (await save({ confirm: true }))) navigate(paths.catalogue);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Interview</h1>
          <div className="mt-2 flex items-center gap-3">
            <Meter
              value={budget > 0 ? asked / budget : 0}
              label="Interview progress"
              valueText={`Question ${asked} of ${budget}`}
              className="w-32 sm:w-44"
            />
            <span className="text-[13px] text-muted tabular-nums">
              {asked} of {budget} questions · {depth === 'quick' ? 'Quick' : 'Deep'} interview
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="ghost" size="sm" icon="arrow-right" busy={saving} onClick={() => void skip()}>
            {confirmed ? 'Go to recommendations' : 'Skip to recommendations'}
          </Button>
          {error && (
            <p role="alert" className="text-[12px] text-fit-low">
              {error}
            </p>
          )}
        </div>
      </div>

      <SegmentedControl
        className="lg:hidden"
        legend="Show"
        hideLegend
        options={[
          { value: 'chat', label: 'Conversation' },
          { value: 'profile', label: `Your profile${learned > 0 ? ` (${learned})` : ''}` },
        ]}
        value={pane}
        onChange={setPane}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <section
          aria-label="Interview conversation"
          className={cx(
            'flex h-[calc(100dvh-15rem)] min-h-[26rem] flex-col overflow-hidden rounded-[1.25rem] border border-line bg-surface shadow-soft lg:h-[calc(100dvh-13rem)] lg:max-h-[52rem]',
            pane !== 'chat' && 'max-lg:hidden',
          )}
        >
          <ChatPanel variant="interview" className="h-full" />
        </section>
        <aside
          aria-label="Live profile"
          className={cx(
            'rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft lg:sticky lg:top-20 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto',
            pane !== 'profile' && 'max-lg:hidden',
          )}
        >
          <ProfilePanel profile={session.profile} evidence={session.evidence} />
        </aside>
      </div>
    </div>
  );
}
