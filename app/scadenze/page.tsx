import { Suspense } from "react";
import ScadenzeClient from "./ScadenzeClient";

export default function ScadenzePage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Caricamento…</div>}>
      <ScadenzeClient />
    </Suspense>
  );
}
