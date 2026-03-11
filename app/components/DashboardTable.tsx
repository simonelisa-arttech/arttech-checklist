"use client";

import { useEffect, useRef, useState, type UIEvent } from "react";

type DashboardTableProps = {
  children: React.ReactNode;
};

export default function DashboardTable({ children }: DashboardTableProps) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<"top" | "main" | null>(null);
  const [scrollContentWidth, setScrollContentWidth] = useState(1100);

  function onTopScroll(e: UIEvent<HTMLDivElement>) {
    if (syncingScrollRef.current === "main") return;
    syncingScrollRef.current = "top";
    if (wrapRef.current) wrapRef.current.scrollLeft = e.currentTarget.scrollLeft;
    syncingScrollRef.current = null;
  }

  function onMainScroll(e: UIEvent<HTMLDivElement>) {
    if (syncingScrollRef.current === "top") return;
    syncingScrollRef.current = "main";
    if (topScrollRef.current) topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    syncingScrollRef.current = null;
  }

  useEffect(() => {
    const wrapEl = wrapRef.current;
    const contentEl = contentRef.current;
    if (!wrapEl || !contentEl) return;
    const update = () => {
      setScrollContentWidth(contentEl.scrollWidth || 1100);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapEl);
    ro.observe(contentEl);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [children]);
  return (
    <>
      <div
        ref={topScrollRef}
        className="dashboard-table-top-scroll"
        onScroll={onTopScroll}
        aria-label="Scrollbar orizzontale tabella dashboard"
      >
        <div style={{ width: scrollContentWidth, height: 1 }} />
      </div>
      <div
        ref={wrapRef}
        onScroll={onMainScroll}
        className="dashboard-table-wrap"
      >
        <div ref={contentRef} className="dashboard-table-content">
          {children}
        </div>
      </div>
    </>
  );
}
