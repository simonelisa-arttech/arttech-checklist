"use client";

import { DashboardCockpitPage } from "@/app/page";

export default function DashboardPage() {
  return (
    <DashboardCockpitPage
      pageLabel="DASHBOARD"
      showClientiSection={false}
      showCronoSection={false}
      showProjectsSection
    />
  );
}
