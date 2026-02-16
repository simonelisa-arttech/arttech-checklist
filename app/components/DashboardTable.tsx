"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DashboardTableProps = {
  children: React.ReactNode;
};

export default function DashboardTable({ children }: DashboardTableProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [max, setMax] = useState(0);
  const [value, setValue] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [vMax, setVMax] = useState(0);
  const [vValue, setVValue] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const nextMax = Math.max(0, el.scrollWidth - el.clientWidth);
      setMax(nextMax);
      setValue((prev) => Math.min(prev, nextMax));
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

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onScroll = () => {
      setValue(el.scrollLeft);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const recalcV = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    setVMax(maxScroll);
    setVValue(el.scrollTop);
  }, []);

  const onWrapScroll = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setVValue(el.scrollTop);
    setValue(el.scrollLeft);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    recalcV();
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener("scroll", onWrapScroll, { passive: true });
    window.addEventListener("resize", recalcV);
    return () => {
      el.removeEventListener("scroll", onWrapScroll);
      window.removeEventListener("resize", recalcV);
    };
  }, [mounted, onWrapScroll, recalcV, children]);
  return (
    <>
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
            maxHeight: "calc(100vh - 220px)",
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
    </>
  );
}
