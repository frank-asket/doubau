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
        DouBow does not try to be Google Jobs. Results come from a controlled job pool: explicitly supported feeds and APIs
        first, then narrow imports when you choose to add more roles. Depth varies by market while the index grows.
      </p>
      <p className="mt-2">
        Every card shows the <strong className="font-medium text-[var(--app-text-primary)]">provider</strong>, freshness, and a{" "}
        <strong className="font-medium text-[var(--app-text-primary)]">view original</strong> link when available, so you can verify where each
        opportunity came from.
      </p>
    </aside>
  );
}
