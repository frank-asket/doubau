import Link from "next/link";

export type AppSetupReminderKind = "resume_missing" | "resume_failed" | "resume_processing";

const copy: Record<
  AppSetupReminderKind,
  { title: string; body: string; cta: string; href: string; tone: "blue" | "amber" | "red" }
> = {
  resume_missing: {
    title: "Add your résumé to improve matches",
    body: "DouBow can still work without it, but your job recommendations and drafts get sharper once your résumé is on file.",
    cta: "Upload résumé",
    href: "/onboarding/resume",
    tone: "blue",
  },
  resume_failed: {
    title: "Résumé upload needs attention",
    body: "We could not finish processing your last résumé. Try uploading it again so your matches and drafts stay personalized.",
    cta: "Try again",
    href: "/onboarding/resume",
    tone: "red",
  },
  resume_processing: {
    title: "Your résumé is still processing",
    body: "Matching will improve as soon as processing is complete. You can keep using the rest of your workspace.",
    cta: "View résumé",
    href: "/app/dashboard",
    tone: "amber",
  },
};

const toneClass: Record<(typeof copy)[AppSetupReminderKind]["tone"], string> = {
  blue: "border-[color-mix(in_srgb,var(--app-accent)_30%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_7%,var(--app-bg-elevated))]",
  amber:
    "border-[color-mix(in_srgb,var(--app-warning)_35%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-warning)_9%,var(--app-bg-elevated))]",
  red: "border-[color-mix(in_srgb,var(--app-danger)_32%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-danger)_7%,var(--app-bg-elevated))]",
};

export function AppSetupReminder({ kind }: { kind: AppSetupReminderKind | null }) {
  if (!kind) return null;
  const item = copy[kind];

  return (
    <div className={`mb-5 rounded-[var(--app-radius-lg)] border-[0.5px] px-4 py-3 ${toneClass[item.tone]}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[var(--app-text-primary)]">{item.title}</div>
          <p className="mt-1 max-w-3xl text-pretty text-[12px] leading-5 text-[var(--app-text-secondary)]">
            {item.body}
          </p>
        </div>
        <Link
          href={item.href}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[var(--app-radius-pill)] bg-[var(--app-accent)] px-4 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-[var(--app-accent-hover)] active:scale-[0.96]"
        >
          {item.cta}
        </Link>
      </div>
    </div>
  );
}
