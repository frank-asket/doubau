import type { Metadata } from "next";

import { CareerProfileClient } from "@/components/workspace/CareerProfileClient";

export const metadata: Metadata = {
  title: "Career profile",
};

export default function CareerProfilePage() {
  return <CareerProfileClient />;
}
