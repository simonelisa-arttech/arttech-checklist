"use client";

import { useEffect, useRef } from "react";

type DashboardTableProps = {
  children: React.ReactNode;
};

export default function DashboardTable({ children }: DashboardTableProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    const bar = barRef.current;
    const spacer = spacerRef.current;
    if (!wrap || !content || !bar || !spacer) return;

    let syncing = false;
    const findTable = () => content.querySelector("table");
    const updateWidths = () => {
      const table = findTable();
      const width = Math.max(
        wrap.scrollWidth || 0,
        content.scrollWidth || 0,
        table?.scrollWidth || 0,
        wrap.clientWidth + 1
      );
      spacer.style.width = `${width}px`;
      console.log(
        "[dashboard-scroll]",
        "wrap",
        wrap.clientWidth,
        wrap.scrollWidth,
        "bar",
        bar.clientWidth,
        bar.scrollWidth,
        "spacer",
        spacer.style.width
      );
    };

    updateWidths();

    const onWrapScroll = () => {
      if (syncing) return;
      syncing = true;
      bar.scrollLeft = wrap.scrollLeft;
      syncing = false;
    };

    const onBarScroll = () => {
      if (syncing) return;
      syncing = true;
      wrap.scrollLeft = bar.scrollLeft;
      syncing = false;
    };

    wrap.addEventListener("scroll", onWrapScroll);
    bar.addEventListener("scroll", onBarScroll);

    const ro = new ResizeObserver(updateWidths);
    ro.observe(wrap);
    ro.observe(content);
    const table = findTable();
    if (table) ro.observe(table);
    window.addEventListener("resize", updateWidths);

    return () => {
      wrap.removeEventListener("scroll", onWrapScroll);
      bar.removeEventListener("scroll", onBarScroll);
      ro.disconnect();
      window.removeEventListener("resize", updateWidths);
    };
  }, [children]);

  return (
    <>
      <div
        ref={wrapRef}
        className="dashboard-scroll-wrapper"
        style={{
          width: "100%",
          maxWidth: "100vw",
          overflowX: "scroll",
          overflowY: "hidden",
          display: "block",
        }}
      >
        <div
          ref={contentRef}
          className="dashboard-scroll-content dashboard-scroll-body"
          style={{ width: "max-content", minWidth: "max-content", display: "inline-block" }}
        >
          {children}
        </div>
      </div>
      <div
        ref={barRef}
        className="bottom-scrollbar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 28,
          overflowX: "scroll",
          overflowY: "hidden",
          background: "white",
          borderTop: "1px solid #e5e7eb",
          zIndex: 9999,
        }}
      >
        <div ref={spacerRef} style={{ height: 28 }} />
      </div>
    </>
  );
}
