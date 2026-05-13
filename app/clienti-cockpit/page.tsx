"use client";

import DashboardCockpitPage from "@/components/DashboardCockpitPage";

export default function ClientiCockpitPage() {
  return (
    <DashboardCockpitPage
      pageTitle="Clienti"
      pageSubtitle="Riepilogo clienti"
      showCockpitSection={false}
      showClientiSection
      showCronoSection={false}
      showProjectsSection={false}
      enableProjectFilters={false}
      enableClientFilters
      showClientiCockpit
      projectsView="compact"
    />
  );
}
