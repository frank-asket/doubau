import type { Metadata } from "next";

import { SalaryBenchmarkClient } from "@/components/workspace/SalaryBenchmarkClient";

export const metadata: Metadata = {
  title: "Salary benchmark",
};

export default function SalaryBenchmarkPage() {
  return <SalaryBenchmarkClient />;
}
