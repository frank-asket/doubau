export type CopilotPromptChip = {
  label: string;
  prompt: string;
};

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
