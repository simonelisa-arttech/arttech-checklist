import { Suspense } from "react";
import ScadenzeClient from "@/app/scadenze/ScadenzeClient";

export const dynamic = "force-dynamic";

export default function ScadenzeServiziPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Caricamento scadenze servizi...</div>}>
      <ScadenzeClient lifecycleVerification />
    </Suspense>
  );
}
