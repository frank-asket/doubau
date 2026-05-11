import Link from "next/link";

import { OnboardingStepFrame } from "@/components/onboarding/OnboardingStepFrame";
import { ResumeUploadSection } from "@/components/resume/ResumeUploadSection";

export default function OnboardingResumePage() {
  return (
    <OnboardingStepFrame
      eyebrow="Résumé source"
      title="Add your résumé when you are ready."
      description="PDF or Word (.docx). DouBow uses it to improve job matching, drafting, and fit checks. Max 10 MB."
      stepLabel="Step 3 of 5"
    >
      <div>
        <ResumeUploadSection variant="onboarding" />
      </div>

      <p className="mt-6 text-center text-[12px] text-[var(--app-text-secondary)]">
        <Link
          href="/onboarding/contact"
          className="underline underline-offset-2 hover:text-[var(--app-text-primary)]"
        >
          Back
        </Link>
      </p>
    </OnboardingStepFrame>
  );
}
