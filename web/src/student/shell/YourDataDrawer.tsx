// Spec 20.3: the student can see, edit and delete everything held about them.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api.ts';
import { Button } from '../../components/Button.tsx';
import { Drawer } from '../../components/Drawer.tsx';
import { Icon } from '../../components/Icon.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { errorMessage } from '../../components/StateViews.tsx';
import { formatEvidenceValue, slotLabel } from '../labels.ts';
import { ProfileEditor } from '../profile/ProfileEditor.tsx';
import { ProfilePanel } from '../profile/ProfilePanel.tsx';
import { useProfileActions } from '../profile/useProfileActions.ts';
import { paths } from '../routes.ts';
import { useModuleTitle } from '../state/ReferenceDataProvider.tsx';
import { useReadySession } from '../state/SessionProvider.tsx';

/** Navigation state that tells onboarding to confirm the deletion. */
const DELETED_STATE = { profileDeleted: true } as const;

export function wasProfileDeleted(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'profileDeleted' in state && state.profileDeleted === true;
}

type View = 'view' | 'edit';
const VIEWS = [
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
] as const;

export function YourDataDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Your data"
      subtitle="Interests, goals and learning preferences only. Never grades, health or background."
    >
      <YourDataBody />
    </Drawer>
  );
}

function YourDataBody() {
  const { session, forget } = useReadySession();
  const { save, saving, error } = useProfileActions();
  const moduleTitle = useModuleTitle();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('view');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { profile, evidence } = session;

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteProfile(session.id);
      navigate(paths.onboard, { state: DELETED_STATE });
      forget();
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-5 py-5">
      <SegmentedControl legend="Your data view" hideLegend options={VIEWS} value={view} onChange={setView} />

      {view === 'edit' ? (
        <div className="mt-5">
          <ProfileEditor
            profile={profile}
            saving={saving}
            error={error}
            onCancel={() => setView('view')}
            onSave={(body) => {
              void save(body).then((saved) => {
                if (saved) setView('view');
              });
            }}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-7">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <dt className="text-muted">Programme</dt>
            <dd className="font-medium">{profile.programme}</dd>
            <dt className="text-muted">Year</dt>
            <dd className="font-medium">Year {profile.yearOfStudy}</dd>
            <dt className="text-muted">Completed</dt>
            <dd className="font-medium">
              {profile.completedModuleIds.length > 0 ? profile.completedModuleIds.map(moduleTitle).join(', ') : 'None listed'}
            </dd>
          </dl>

          <ProfilePanel profile={profile} evidence={evidence} />

          <section aria-labelledby="evidence-heading">
            <h3 id="evidence-heading" className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Your words we kept ({evidence.length})
            </h3>
            {evidence.length === 0 ? (
              <p className="text-[13px] text-muted">Nothing yet.</p>
            ) : (
              <ul className="grid gap-2">
                {evidence.map((e) => (
                  <li key={e.id} className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-[13px]">
                    <q className="leading-snug">{e.quote}</q>
                    <p className="mt-1 text-[11px] text-muted">
                      {slotLabel(e.slot)}: {formatEvidenceValue(e.value)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="delete-heading" className="rounded-card border border-fit-low/30 p-4">
            <h3 id="delete-heading" className="text-sm font-semibold">
              Delete my profile
            </h3>
            <p className="mt-1 text-[13px] text-muted">
              Removes your profile and every quote above, then starts over. This cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="mt-2 text-[13px] text-fit-low">
                {deleteError}
              </p>
            )}
            {confirmDelete ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium">Delete everything?</span>
                <Button variant="danger" size="sm" icon="trash" busy={deleting} onClick={() => void remove()}>
                  Yes, delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Keep it
                </Button>
              </div>
            ) : (
              <Button className="mt-3" size="sm" icon="trash" onClick={() => setConfirmDelete(true)}>
                Delete my profile
              </Button>
            )}
          </section>
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <Icon name="lock" size={12} />
            Staff only ever see aggregates of five or more students.
          </p>
        </div>
      )}
    </div>
  );
}
