import Link from "next/link";

import { ResumeUploadSection } from "@/components/resume/ResumeUploadSection";

export default function OnboardingResumePage() {
  return (
    <div className="rounded-[var(--app-radius-lg)] border-[0.5px] border-solid border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 shadow-[var(--app-shadow-0)]">
      <h1 className="text-balance text-[length:var(--app-text-h1)] font-semibold tracking-tight text-[var(--app-text-primary)]">
        Upload your résumé
      </h1>
      <p className="mt-2 text-[14px] leading-6 text-[var(--app-text-secondary)]">
        PDF or Word (.docx). We extract text for job matching and drafts. Max 10&nbsp;MB.
      </p>

      <div className="mt-6">
        <ResumeUploadSection variant="onboarding" />
      </div>

      <p className="mt-8 text-center text-[12px] text-[var(--app-text-secondary)]">
        <Link
          href="/onboarding/contact"
          className="underline underline-offset-2 hover:text-[var(--app-text-primary)]"
        >
          Back
        </Link>
      </p>
    </div>
  );
}
