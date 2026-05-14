import { DM_Sans, IBM_Plex_Serif } from "next/font/google";

/** Workspace Career Copilot + floating dock — professional sans + serif for long-form replies. */
export const copilotSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-copilot-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const copilotSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  variable: "--font-copilot-serif",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const copilotFontVariables = `${copilotSans.variable} ${copilotSerif.variable}`;
