import type { ReactNode } from "react";

import { Container } from "@/components/marketing/Container";

export function Section({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <Container>{children}</Container>
    </section>
  );
}

