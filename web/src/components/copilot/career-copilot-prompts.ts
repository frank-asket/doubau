import type { AppIconName } from "@/components/ui/app-icon";

export type CopilotPromptChip = {
  label: string;
  prompt: string;
};

/** Mirrors backend `app/agents/copilot_tools.py` — LangChain tool-calling specialists behind Career Copilot. */
export const CAREER_COPILOT_BACKEND_AGENTS: Array<{
  id: string;
  label: string;
  description: string;
  icon: AppIconName;
}> = [
  {
    id: "applications",
    label: "Applications",
    description: "List and open your saved applications with draft status.",
    icon: "briefcase",
  },
  {
    id: "detail",
    label: "Role intel",
    description: "Pull posting context, channels, and draft snippets for one application.",
    icon: "file-text",
  },
  {
    id: "outreach",
    label: "Outreach pair",
    description: "Generate email + LinkedIn drafts (moves pipeline when rules allow).",
    icon: "message-circle",
  },
  {
    id: "interview",
    label: "Interview prep",
    description: "Themes, questions, and talking points grounded in résumé + JD.",
    icon: "clipboard-check",
  },
  {
    id: "jobs",
    label: "Job search",
    description: "Keyword search across published roles in your workspace catalog.",
    icon: "search",
  },
  {
    id: "resume",
    label: "Résumé context",
    description: "Summarize your latest résumé text for tailored coaching.",
    icon: "upload",
  },
];

export const CAREER_COPILOT_QUICK_ACTIONS: CopilotPromptChip[] = [
  {
    label: "Career strategy",
    prompt:
      "Given my persona and goals, what should I prioritize this week and what is a realistic 90-day career plan?",
  },
  {
    label: "Résumé review",
    prompt: "Review my latest résumé text and list the top five improvements before I apply to competitive roles.",
  },
  {
    label: "Interview prep",
    prompt:
      "What interview questions should I expect for my target role, and how should I structure concise STAR answers?",
  },
  {
    label: "Skill analysis",
    prompt:
      "Which skills should I emphasize next based on typical job postings in my field, and how do I show proof?",
  },
];

export const CAREER_COPILOT_POPULAR_TOPICS: CopilotPromptChip[] = [
  { label: "Salary negotiation", prompt: "How should I approach salary negotiation after a positive final interview?" },
  { label: "Portfolio story", prompt: "Help me turn my recent project into a tight portfolio narrative with metrics." },
  { label: "Networking outreach", prompt: "Draft a short, respectful cold email to a hiring manager I found on LinkedIn." },
  { label: "Burnout check-in", prompt: "I feel stretched thin—suggest a sustainable weekly rhythm while job searching." },
];

export const CAREER_COPILOT_WELCOME_CARDS: Array<{
  title: string;
  description: string;
  prompt: string;
  icon: "sparkle" | "file-text" | "message-circle" | "star";
}> = [
  {
    title: "Career strategy",
    description: "Personalized roadmaps and growth priorities for the next chapter.",
    prompt: CAREER_COPILOT_QUICK_ACTIONS[0]!.prompt,
    icon: "sparkle",
  },
  {
    title: "Résumé review",
    description: "Tighten wording, impact, and ATS clarity before you hit apply.",
    prompt: CAREER_COPILOT_QUICK_ACTIONS[1]!.prompt,
    icon: "file-text",
  },
  {
    title: "Interview preparation",
    description: "Practice prompts, framing, and follow-ups that sound like you.",
    prompt: CAREER_COPILOT_QUICK_ACTIONS[2]!.prompt,
    icon: "message-circle",
  },
  {
    title: "Skill analysis",
    description: "Spot gaps, proof points, and the fastest path to credibility.",
    prompt: CAREER_COPILOT_QUICK_ACTIONS[3]!.prompt,
    icon: "star",
  },
];
