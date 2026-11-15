// Screen 9: staff correct a module's derived fields beside the analyst's rationale (spec 10.4).
import { formatSuggestedEdit, parseSuggestedEdit, SKILL_IDS, TOPIC_IDS } from '@modulematch/shared';
import type { Module, ModuleDemand, Pathway, SuggestedEdit } from '@modulematch/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../api.ts';
import { DiffSummary } from '../components/DiffSummary.tsx';
import { Rationale, countReviewFlags } from '../components/Rationale.tsx';
import { WeightMapEditor, WeightSlider } from '../components/WeightEditor.tsx';
import type { Option } from '../components/WeightEditor.tsx';
import { Button, ErrorState, LoadingState, Panel } from '../components/ui.tsx';
import { AlertIcon, CheckIcon } from '../components/icons.tsx';
import { useResource } from '../hooks/useResource.ts';
import { applySuggestedEdit, changeCount, diffDraft, draftFrom, editBody } from '../lib/derivedDraft.ts';
import type { DerivedDraft, DraftDiff, WeightField } from '../lib/derivedDraft.ts';
import { focusRing, humanise, plural, skillLabel, topicLabel, weight } from '../lib/format.ts';
import { errorMessage } from '../lib/errors.ts';
import { EDIT_PARAM } from '../lib/insights.ts';
import { useStaffData } from '../StaffData.tsx';
import { useModuleOutlet } from './ModulesPage.tsx';

const DEMAND_FIELDS: { key: keyof ModuleDemand; label: string; hint: string }[] = [
  { key: 'examShare', label: 'Exam share', hint: 'Share of assessment by exam' },
  { key: 'groupShare', label: 'Group work', hint: 'Share of assessed group work' },
  { key: 'applied', label: 'Applied', hint: '0 theoretical, 1 applied' },
  { key: 'mathsIntensity', label: 'Maths intensity', hint: 'How much maths it demands' },
  { key: 'codingIntensity', label: 'Coding intensity', hint: 'How much coding it demands' },
  { key: 'workload', label: 'Workload', hint: 'Relative weekly effort' },
];

const TOPIC_OPTIONS: Option[] = TOPIC_IDS.map((id) => ({ id, label: topicLabel(id) })).sort((a, b) =>
  a.label.localeCompare(b.label),
);
const SKILL_OPTIONS: Option[] = SKILL_IDS.map((id) => ({ id, label: skillLabel(id) })).sort((a, b) =>
  a.label.localeCompare(b.label),
);

export function TagEditor() {
  const { summary } = useModuleOutlet();
  const { catalogue, reloadCatalogue } = useStaffData();
  // "Make this change in the tag editor" on an accepted insight card passes its change here.
  const [params, setParams] = useSearchParams();
  const editParam = params.get(EDIT_PARAM) ?? '';
  // Once the suggestion is saved or discarded it leaves the URL, so a refresh does not bring it back.
  const settleSuggestion = useCallback(
    () =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete(EDIT_PARAM);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  if (catalogue.status === 'loading') return <LoadingState label="Loading module tags" rows={4} />;
  if (catalogue.status === 'error')
    return <ErrorState title="Could not load the module catalogue" error={catalogue.error} onRetry={reloadCatalogue} />;
  const module = catalogue.data.find((m) => m.id === summary.moduleId);
  if (!module)
    return (
      <ErrorState
        title="This module is missing from the catalogue"
        error={new Error(`No catalogue record for ${summary.moduleId}.`)}
        onRetry={reloadCatalogue}
      />
    );
  // Keyed so switching modules starts a fresh draft. The suggestion is read when the form mounts, so clearing
  // it from the URL later leaves the draft as it is.
  return (
    <TagEditorForm
      key={module.id}
      module={module}
      suggested={parseSuggestedEdit(editParam)}
      onSuggestionSettled={settleSuggestion}
    />
  );
}

type SaveState = { status: 'idle' } | { status: 'saving' } | { status: 'saved' } | { status: 'error'; message: string };

function TagEditorForm({
  module,
  suggested,
  onSuggestionSettled,
}: {
  module: Module;
  suggested: SuggestedEdit | null;
  onSuggestionSettled: () => void;
}) {
  const { replaceModule } = useStaffData();
  const pathways = useResource('pathways', api.pathways);
  const [saved, setSaved] = useState<Module>(module);
  // An accepted insight's change starts in the draft, unsaved, so it shows as a change to review.
  const [draft, setDraft] = useState<DerivedDraft>(() => applySuggestedEdit(draftFrom(module), suggested));
  const [save, setSave] = useState<SaveState>({ status: 'idle' });

  // A suggestion that arrives after the form mounted (for example when browser history restores the link) is
  // applied on top of the current draft. One that leaves the URL after a save or discard changes nothing.
  const suggestionKey = suggested ? formatSuggestedEdit(suggested) : '';
  const appliedKey = useRef(suggestionKey);
  useEffect(() => {
    if (suggestionKey === appliedKey.current) return;
    appliedKey.current = suggestionKey;
    if (!suggested) return;
    setDraft((d) => applySuggestedEdit(d, suggested));
    setSave({ status: 'idle' });
    // `suggested` is the parsed form of `suggestionKey`, so the key alone says when it changed.
  }, [suggestionKey]);

  const baseline = useMemo(() => draftFrom(saved), [saved]);
  const diff = useMemo(() => diffDraft(baseline, draft), [baseline, draft]);
  const changes = changeCount(diff);

  const pathwayList: Pathway[] = pathways.state.status === 'ready' ? pathways.state.data : [];
  const pathwayLabel = (id: string) => pathwayList.find((p) => p.id === id)?.title ?? humanise(id);
  const pathwayOptions: Option[] = pathwayList.map((p) => ({ id: p.id, label: p.title }));

  const labelFor = (field: keyof DraftDiff, key: string) => {
    if (field === 'topics') return topicLabel(key);
    if (field === 'skills') return skillLabel(key);
    if (field === 'pathwayRelevance') return pathwayLabel(key);
    return DEMAND_FIELDS.find((d) => d.key === key)?.label ?? key;
  };

  const saving = save.status === 'saving';

  // The editing fieldset is disabled while saving, so no edit can land between the request and its response.
  const edit = (next: Partial<DerivedDraft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setSave({ status: 'idle' });
  };
  const editWeights = (field: WeightField) => (value: Record<string, number>) => edit({ [field]: value });

  const submit = async () => {
    setSave({ status: 'saving' });
    try {
      const updated = await api.staff.editDerived(module.id, editBody(draft, diff));
      if (updated.id !== module.id) throw new Error(`the server returned ${updated.id} instead of ${module.id}`);
      setSaved(updated);
      setDraft(draftFrom(updated));
      replaceModule(updated);
      setSave({ status: 'saved' });
      if (suggested) onSuggestionSettled();
    } catch (e) {
      setSave({ status: 'error', message: errorMessage(e) });
    }
  };

  const reviewFlags = countReviewFlags(saved.derivedRationale);

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        className="grid grid-cols-1 gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {suggested && save.status !== 'saved' && (
          <p role="status" className="flex items-start gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              <span className="font-medium">Filled in from the insight you accepted:</span>{' '}
              {labelFor(suggested.group, suggested.key)} set to {weight(suggested.value)}. Nothing is saved until you
              review the change and save it.
            </span>
          </p>
        )}
        <fieldset disabled={saving} className="grid min-w-0 grid-cols-1 gap-5 transition-opacity disabled:opacity-60">
          <legend className="sr-only">Derived fields</legend>
          <Panel title="Topics" description="What the module covers. Only taxonomy topics can be added.">
            <WeightMapEditor
              value={draft.topics}
              original={baseline.topics}
              options={TOPIC_OPTIONS}
              labelFor={topicLabel}
              noun="topic"
              onChange={editWeights('topics')}
            />
          </Panel>
          <Panel title="Skills" description="Skills the module builds, which feed pathway progress.">
            <WeightMapEditor
              value={draft.skills}
              original={baseline.skills}
              options={SKILL_OPTIONS}
              labelFor={skillLabel}
              noun="skill"
              onChange={editWeights('skills')}
            />
          </Panel>
          <Panel title="Pathway relevance" description="How directly the module serves each career pathway.">
            <WeightMapEditor
              value={draft.pathwayRelevance}
              original={baseline.pathwayRelevance}
              options={pathwayOptions}
              labelFor={pathwayLabel}
              noun="pathway"
              onChange={editWeights('pathwayRelevance')}
            />
          </Panel>
          <Panel title="Demand profile" description="Assessment and intensity, used for learning-style fit.">
            <div className="grid gap-3">
              {DEMAND_FIELDS.map((f) => (
                <WeightSlider
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  value={draft.demand[f.key]}
                  original={baseline.demand[f.key]}
                  onChange={(v) => edit({ demand: { ...draft.demand, [f.key]: v } })}
                />
              ))}
            </div>
          </Panel>
        </fieldset>

        <Panel
          title="Review changes"
          description="Saving sets this module's tags to a staff edit and re-scores every student."
          className="xl:hidden"
        >
          <DiffSummary diff={diff} labelFor={labelFor} />
        </Panel>

        <div className="sticky bottom-3 z-(--z-sticky) flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 px-5 py-4 shadow-lift backdrop-blur">
          <p className="text-sm" aria-live="polite">
            {save.status === 'saved' ? (
              <span className="inline-flex items-center gap-1.5 text-fit-high">
                <CheckIcon /> Saved. Tags are now derived by staff-edit.
              </span>
            ) : save.status === 'error' ? (
              <span role="alert" className="inline-flex items-center gap-1.5 text-fit-low">
                <AlertIcon /> Could not save: {save.message}
              </span>
            ) : (
              <span className="text-muted">
                {changes === 0 ? 'No unsaved changes' : `${plural(changes, 'unsaved change')}`}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={changes === 0 || saving}
              onClick={() => {
                setDraft(baseline);
                if (suggested) onSuggestionSettled();
                setSave({ status: 'idle' });
              }}
            >
              Discard
            </Button>
            <Button type="submit" variant="primary" disabled={changes === 0 || saving}>
              {saving ? 'Saving…' : `Save ${changes > 0 ? plural(changes, 'change') : 'changes'}`}
            </Button>
          </div>
        </div>
      </form>

      <aside className="grid gap-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto" aria-label="Analyst rationale and source">
        <Panel
          title="Analyst rationale"
          actions={<DerivedByBadge derivedBy={saved.derivedBy} />}
          description={
            reviewFlags > 0 ? (
              <span className="inline-flex items-center gap-1 text-ink">
                <AlertIcon className="size-3.5 text-fit-mid" />
                {plural(reviewFlags, 'flag')} for staff review
              </span>
            ) : (
              'No flags for review.'
            )
          }
        >
          <Rationale text={saved.derivedRationale} />
        </Panel>
        <Panel title="Pending changes" className="hidden xl:block">
          <DiffSummary diff={diff} labelFor={labelFor} />
        </Panel>
        <Panel title="Public description">
          <p className="text-sm leading-relaxed text-muted">{saved.description}</p>
          <a
            href={saved.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 inline-block rounded text-sm font-medium text-brand hover:underline ${focusRing}`}
          >
            Source page<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Panel>
      </aside>
    </div>
  );
}

function DerivedByBadge({ derivedBy }: { derivedBy: Module['derivedBy'] }) {
  const staff = derivedBy === 'staff-edit';
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-2xs font-medium ${
        staff ? 'bg-fit-high/10 text-fit-high' : 'bg-brand-soft text-brand'
      }`}
    >
      derivedBy: {derivedBy}
    </span>
  );
}
