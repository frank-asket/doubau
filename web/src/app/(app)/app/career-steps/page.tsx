import type { Metadata } from "next";

import { CareerStepsClient } from "@/components/workspace/CareerStepsClient";

export const metadata: Metadata = {
  title: "Career steps",
};

export default function CareerStepsPage() {
  return <CareerStepsClient />;
}
