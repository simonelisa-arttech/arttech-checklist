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
    <>
      <div style={{ display: "grid" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
          ref={wrapRef}
          className="dashboard-scroll-wrapper"
          style={{
            width: "100%",
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "auto",
            display: "block",
            height: "calc(100vh - 240px)",
            overscrollBehavior: "contain",
          }}
          onWheel={(e) => {
            const el = wrapRef.current;
            if (!el) return;
            const dx = e.deltaX;
            const dy = e.deltaY;
            if (dx !== 0) {
              el.scrollLeft += dx;
              return;
            }
            if (e.shiftKey && dy !== 0) {
              e.preventDefault();
              el.scrollLeft += dy;
            }
          }}
          >
            <div
              ref={contentRef}
              className="dashboard-scroll-content dashboard-scroll-body"
              style={{ width: "max-content", display: "inline-block" }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
