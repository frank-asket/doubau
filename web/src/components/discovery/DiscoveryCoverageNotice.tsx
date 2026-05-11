/**
 * Customer-facing honesty about job coverage + attribution expectations (.tmp sprint guidance).
 */
export function DiscoveryCoverageNotice() {
  return (
    <aside className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-bg-elevated)] px-4 py-3 text-[13px] leading-relaxed text-[var(--app-text-secondary)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--app-text-tertiary)]">
        Coverage & trust
      </div>
      <p className="mt-2">
        Results combine <strong className="font-medium text-[var(--app-text-primary)]">remote/global</strong> feeds with{" "}
        <strong className="font-medium text-[var(--app-text-primary)]">regional</strong> listings (for example via Adzuna). Depth varies by
        market — use tabs, filters, and saves to build a pipeline that fits you.
      </p>
      <p className="mt-2">
        Every card shows the <strong className="font-medium text-[var(--app-text-primary)]">listing source</strong> and a{" "}
        <strong className="font-medium text-[var(--app-text-primary)]">view original</strong> link to the provider — required for attribution and
        compliance with source terms.
      </p>
    </aside>
  );
}
