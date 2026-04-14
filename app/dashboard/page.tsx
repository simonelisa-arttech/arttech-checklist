"use client";

import { DashboardCockpitPage } from "@/app/page";

export default function DashboardPage() {
  return (
    <DashboardCockpitPage
      pageTitle="Dashboard"
      pageSubtitle="Progetti di tutti i clienti"
      showClientiSection={false}
      showCronoSection={false}
      showProjectsSection
    />
  );
}
