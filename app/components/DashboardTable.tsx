"use client";

import { useEffect, useRef } from "react";

type DashboardTableProps = {
  children: React.ReactNode;
};

export default function DashboardTable({ children }: DashboardTableProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      void el.scrollWidth;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [children]);
  return (
    <div className="dashboard-table-wrap" ref={wrapRef}>
      <div
        ref={contentRef}
        className="dashboard-table-content"
      >
        {children}
      </div>
    </div>
  );
}
