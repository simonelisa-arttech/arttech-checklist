import { Suspense } from "react";
import AvvisiClient from "./AvvisiClient";

export default function AvvisiPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Caricamento…</div>}>
      <AvvisiClient />
    </Suspense>
  );
}
