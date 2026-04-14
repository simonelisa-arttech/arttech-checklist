"use client";

import { DashboardCockpitPage } from "@/app/page";

export default function ClientiCockpitPage() {
  return (
    <DashboardCockpitPage
      pageTitle="Clienti"
      pageSubtitle="Riepilogo clienti"
      showCockpitSection={false}
      showCronoSection={false}
      showClientiSection
    />
  );
}
