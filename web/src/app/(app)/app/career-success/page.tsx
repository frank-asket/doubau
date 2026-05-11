import type { Metadata } from "next";

import { CareerSuccessPageClient } from "@/components/workspace/CareerSuccessPageClient";

export const metadata: Metadata = {
  title: "Career success",
};

export default function CareerSuccessPage() {
  return <CareerSuccessPageClient />;
}
