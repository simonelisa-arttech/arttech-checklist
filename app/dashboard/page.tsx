"use client";

import Link from "next/link";
import { DashboardCockpitPage } from "@/app/page";

export default function DashboardPage() {
  return (
    <div>
      <div
        style={{
          maxWidth: 1100,
          margin: "24px auto 0",
          padding: "0 16px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Link
          href="/dashboard-estesa"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
          }}
        >
          Apri dashboard estesa
        </Link>
      </div>
      <DashboardCockpitPage
        pageTitle="Dashboard"
        pageSubtitle="Progetti di tutti i clienti"
        showClientiSection={false}
        showCronoSection={false}
        showProjectsSection
        enableProjectFilters
        projectsView="compact"
      />
    </div>
  );
}
