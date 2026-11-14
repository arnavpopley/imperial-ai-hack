// Screen 2: a progress timeline on the left, the conversation in the middle and the live profile on the
// right. Phones get a compact progress bar and a toggle between the conversation and the profile.
// The optional extras (CV, societies) open in place of the conversation, which stays mounted underneath.
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { ChatPanel } from '../chat/ChatPanel.tsx';
import { AvatarPicker } from '../interview/AvatarPicker.tsx';
import { clearExamplePrefill, readExamplePrefill } from '../example.ts';
import { CvPanel } from '../interview/CvPanel.tsx';
import { InterviewProgressBar, InterviewTimeline } from '../interview/InterviewTimeline.tsx';
import { SocietiesPanel } from '../interview/SocietiesPanel.tsx';
import { useCompletedExtras, type TimelineExtra } from '../interview/timeline.ts';
import { ProfilePanel } from '../profile/ProfilePanel.tsx';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { paths } from '../routes.ts';
import { useReadySession } from '../state/SessionProvider.tsx';

type Pane = 'chat' | 'profile';
type ExtraId = TimelineExtra['id'];

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function InterviewScreen() {
  const { session } = useReadySession();
  const { save, saving, error } = useProfileActions();
  const navigate = useNavigate();
  const [pane, setPane] = useState<Pane>('chat');
  const [activeExtra, setActiveExtra] = useState<ExtraId | null>(null);
  const [cvSlots, setCvSlots] = useState<ReadonlySet<string>>(() => new Set());
  const [doneExtras, markExtraDone] = useCompletedExtras(session.id);
  // The example student's first answer, waiting in the message box when the example was just started.
  const [examplePrefill] = useState(readExamplePrefill);
  useEffect(clearExamplePrefill, []);
  const { depth, confirmed } = session.interview;
  const learned = Object.keys(session.profile.interests).length;

  const extras: TimelineExtra[] = [
    { id: 'cv', label: 'Add your CV', icon: 'bookmark', done: doneExtras.has('cv') },
    { id: 'societies', label: 'Societies and clubs', icon: 'heart', done: doneExtras.has('societies') },
  ];

  const openExtra = (id: ExtraId) => {
    setActiveExtra((current) => (current === id ? null : id));
    setPane('chat');
  };
  const closeExtra = () => setActiveExtra(null);
  const onCvImported = (slots: string[]) => {
    setCvSlots(new Set(slots));
    markExtraDone('cv');
  };
  const onSocietiesSeen = useCallback(() => markExtraDone('societies'), [markExtraDone]);

  // Spec 12: skipping the interview moves on to recommendations with the profile as it stands.
  const skip = async () => {
    if (confirmed || (await save({ confirm: true }))) navigate(paths.catalogue);
  };

  const timelineProps = { session, extras, activeExtra, onOpenExtra: openExtra };

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid grid-cols-1 gap-5 lg:gap-7">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4"
        >
          <div className="min-w-0">
            <h1 className="text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]">Your interview</h1>
            <p className="mt-1 text-[15px] text-muted">
              {depth === 'quick' ? 'Quick, about three minutes' : 'Deep, take your time'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AvatarPicker />
            <div className="grid justify-items-end gap-1">
              <Button variant="ghost" icon="arrow-right" busy={saving} onClick={() => void skip()}>
                {confirmed ? 'Go to recommendations' : 'Skip to modules'}
              </Button>
              {error && (
                <p role="alert" className="text-[12px] text-fit-low">
                  {error}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <InterviewProgressBar {...timelineProps} className="lg:hidden" />

        <SegmentedControl
          className="xl:hidden"
          legend="Show"
          hideLegend
          options={[
            { value: 'chat', label: 'Conversation' },
            { value: 'profile', label: `Your profile${learned > 0 ? ` (${learned})` : ''}` },
          ]}
          value={pane}
          onChange={setPane}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[14.5rem_minmax(0,1fr)_22rem] xl:gap-7">
          <aside className="max-lg:hidden lg:sticky lg:top-20 lg:self-start lg:pt-2">
            <InterviewTimeline {...timelineProps} />
          </aside>

          <section
            aria-label="Interview conversation"
            className={cx(
              'relative flex h-[calc(100dvh-17rem)] min-h-[30rem] flex-col overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-soft lg:col-start-2 lg:row-start-1 lg:h-[calc(100dvh-16rem)] lg:max-h-[56rem]',
              pane !== 'chat' && 'max-xl:hidden',
            )}
          >
            <ChatPanel
              variant="interview"
              prefill={examplePrefill}
              onAddCv={() => openExtra('cv')}
              className={cx('h-full', activeExtra && 'invisible')}
            />
            <AnimatePresence>
              {activeExtra && (
                <motion.div
                  key={activeExtra}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="absolute inset-0 overflow-y-auto bg-surface p-5 sm:p-8"
                >
                  {activeExtra === 'cv' ? (
                    <CvPanel onImported={onCvImported} onClose={closeExtra} />
                  ) : (
                    <SocietiesPanel onSeen={onSocietiesSeen} onClose={closeExtra} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <aside
            aria-label="Live profile"
            className={cx(
              'rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft lg:col-start-2 lg:row-start-1 xl:sticky xl:top-20 xl:col-start-3 xl:max-h-[calc(100dvh-16rem)] xl:overflow-y-auto',
              pane !== 'profile' && 'max-xl:hidden',
            )}
          >
            <ProfilePanel profile={session.profile} evidence={session.evidence} highlightSlots={cvSlots} />
          </aside>
        </div>
      </div>
    </MotionConfig>
  );
}
