// Links staff attach to a module (past papers, reading, recordings), grouped by kind.
import type { ModuleResource } from '@modulematch/shared';
import { Icon, type IconName } from '../../components/Icon.tsx';

type Kind = ModuleResource['kind'];

const GROUPS: readonly { kind: Kind; label: string; icon: IconName }[] = [
  { kind: 'past-paper', label: 'Past papers', icon: 'edit' },
  { kind: 'reading', label: 'Reading', icon: 'bookmark' },
  { kind: 'video', label: 'Video', icon: 'external' },
  { kind: 'other', label: 'Other links', icon: 'grid' },
];

export function ResourcesSection({ resources }: { resources: readonly ModuleResource[] }) {
  return (
    <section aria-labelledby="resources-heading" className="rounded-[1.25rem] border border-line bg-surface p-5 shadow-soft sm:p-6">
      <h2 id="resources-heading" className="flex items-center gap-2 text-subheading">
        <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-muted" aria-hidden="true">
          <Icon name="bookmark" size={14} />
        </span>
        Resources
      </h2>
      {resources.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
            <Icon name="edit" size={17} />
          </span>
          <p className="text-xs leading-snug text-muted">
            <span className="block font-semibold text-ink">Past papers and reading lists will appear here.</span>
            The department adds them once they are published.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {GROUPS.map(({ kind, label, icon }) => {
            const items = resources.filter((r) => r.kind === kind);
            if (items.length === 0) return null;
            return (
              <div key={kind}>
                <h3 className="flex items-center gap-1.5 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
                  <Icon name={icon} size={12} />
                  {label}
                </h3>
                <ul className="mt-2 grid gap-1.5">
                  {items.map((r) => (
                    <li key={r.url}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium transition hover:border-brand/40 hover:bg-brand-soft/40"
                      >
                        <span className="min-w-0 flex-1 truncate">{r.label}</span>
                        <Icon name="external" size={13} className="shrink-0 text-muted group-hover:text-brand" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
