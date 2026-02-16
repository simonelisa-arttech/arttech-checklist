"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DashboardTableProps = {
  children: React.ReactNode;
};

export default function DashboardTable({ children }: DashboardTableProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const topSpacerRef = useRef<HTMLDivElement | null>(null);
  const [max, setMax] = useState(0);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const nextMax = Math.max(0, el.scrollWidth - el.clientWidth);
      setMax(nextMax);
      setValue((prev) => Math.min(prev, nextMax));
      if (topSpacerRef.current) {
        topSpacerRef.current.style.width = `${el.scrollWidth}px`;
      }
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

  const onWrapScroll = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setValue(el.scrollLeft);
    if (topBarRef.current && topBarRef.current.scrollLeft !== el.scrollLeft) {
      topBarRef.current.scrollLeft = el.scrollLeft;
    }
  }, []);

  useEffect(() => {
    const topBar = topBarRef.current;
    const onTopBarScroll = () => {
      const wrap = wrapRef.current;
      if (!wrap || !topBar) return;
      if (wrap.scrollLeft !== topBar.scrollLeft) {
        wrap.scrollLeft = topBar.scrollLeft;
      }
    };
    if (topBar) {
      topBar.addEventListener("scroll", onTopBarScroll, { passive: true });
    }
    return () => {
      if (topBar) {
        topBar.removeEventListener("scroll", onTopBarScroll);
      }
    };
  }, []);
  return (
    <>
      <div style={{ display: "grid", gap: 8 }}>
        <div
          ref={topBarRef}
          style={{
            height: 14,
            overflowX: "auto",
            overflowY: "hidden",
            background: "#f3f4f6",
            borderRadius: 999,
          }}
        >
          <div ref={topSpacerRef} style={{ height: 14 }} />
        </div>
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
          onScroll={onWrapScroll}
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
