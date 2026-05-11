import type { Metadata } from "next";

import { CareerHealthClient } from "@/components/workspace/CareerHealthClient";

export const metadata: Metadata = {
  title: "Career health",
};

export default function CareerHealthPage() {
  return <CareerHealthClient />;
}
