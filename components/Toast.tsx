"use client";

import { useEffect } from "react";

type ToastVariant = "success" | "error";

type ToastProps = {
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
  durationMs?: number;
};

export default function Toast({
  message,
  variant = "success",
  onClose,
  durationMs = 2500,
}: ToastProps) {
  useEffect(() => {
    if (!onClose) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  const isError = variant === "error";
  const bg = isError ? "#fee2e2" : "#dcfce7";
  const color = isError ? "#991b1b" : "#166534";
  const border = isError ? "#fecaca" : "#bbf7d0";

  return (
    <div
      data-testid={isError ? "toast-error" : "toast-success"}
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 60,
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: "10px 12px",
        boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
        fontSize: 13,
        maxWidth: 360,
      }}
    >
      {message}
    </div>
  );
}
