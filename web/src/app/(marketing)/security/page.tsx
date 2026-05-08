import type { Metadata } from "next";

import { Container } from "@/components/marketing/Container";

export const metadata: Metadata = {
  title: "Security",
  description: "How DouBow approaches security, privacy, and compliance.",
};

export default function SecurityPage() {
  return (
    <main id="main" className="py-40">
      <Container>
        <div className="mx-auto max-w-3xl">
        <h1 className="font-[family-name:var(--font-display)] text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Security and privacy
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
          DouBow is designed to be safe at scale. The most important safeguard is human approval for
          all outbound actions—enforced server-side.
        </p>

        <div className="mt-10 space-y-6">
          <section className="rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-sm font-semibold tracking-tight">Human-in-the-loop enforcement</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] text-pretty">
              Outbound actions are blocked unless the application is in an APPROVED state in the
              database. UI checks are not sufficient; the backend enforces this invariant.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-sm font-semibold tracking-tight">PII handling</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] text-pretty">
              Résumé content and user profile data are treated as sensitive. The production system is
              designed for encryption at rest, strict access controls, and audit logs for sensitive
              state transitions.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] p-6">
            <h2 className="text-sm font-semibold tracking-tight">GDPR basics</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)] text-pretty">
              The roadmap includes right-to-erasure workflows, data retention policy controls, and
              consent-aware analytics. Production deployment will implement these in the API, not just
              the UI.
            </p>
          </section>
        </div>
      </div>
      </Container>
    </main>
  );
}

