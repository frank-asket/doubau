import type { Metadata } from "next";

import { Container } from "@/components/marketing/Container";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about DouBow’s approval gate, data, and how it works.",
};

const faqs = [
  {
    q: "Does DouBow auto-apply to jobs?",
    a: "No. DouBow drafts and prepares. Every outbound action requires explicit approval, and the backend enforces that rule.",
  },
  {
    q: "What’s the approval gate?",
    a: "A database-backed state machine. The submit endpoint returns 403 unless the application is APPROVED in the database.",
  },
  {
    q: "Is my résumé required?",
    a: "Yes—your résumé is the source of truth for scoring and drafting. You’ll be able to edit parsed fields if extraction is imperfect.",
  },
  {
    q: "Do you log AI outputs?",
    a: "Yes. For observability and quality, we log prompts, raw outputs, user edits, and feedback signals.",
  },
];

export default function FaqPage() {
  return (
    <main id="main" className="py-40">
      <Container>
        <div className="mx-auto max-w-3xl">
      <h1 className="font-[family-name:var(--font-display)] text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Frequently asked questions
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
        If you have a question not covered here, we’ll add it as we learn from users.
      </p>

      <div className="mt-10 space-y-4">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-[var(--border)] p-6"
          >
            <summary className="cursor-pointer list-none text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-md">
              <span className="flex items-center justify-between gap-4">
                {f.q}
                <span
                  className="text-[var(--muted)] transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)] text-pretty">{f.a}</p>
          </details>
        ))}
      </div>
      </div>
      </Container>
    </main>
  );
}

