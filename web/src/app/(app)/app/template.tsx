import type { ReactNode } from "react";

import { AppRouteTransition } from "@/components/app/AppRouteTransition";

export default function AppWorkspaceTemplate({ children }: { children: ReactNode }) {
  return <AppRouteTransition>{children}</AppRouteTransition>;
}
