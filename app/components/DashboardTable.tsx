"use client";

import { useEffect, useRef, useState } from "react";

type DashboardTableProps = {
  children: React.ReactNode;
};

export default function DashboardTable({ children }: DashboardTableProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [max, setMax] = useState(0);
  const [value, setValue] = useState(0);

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
  return (
    <>
      <div
        ref={wrapRef}
        className="dashboard-scroll-wrapper"
        style={{
          width: "100%",
          maxWidth: "100vw",
          overflowX: "auto",
          overflowY: "visible",
          display: "block",
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
      <div
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white px-4 py-2"
        style={{ boxShadow: "0 -1px 0 rgba(0,0,0,0.05)" }}
      >
        <input
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            const el = wrapRef.current;
            if (el) el.scrollLeft = next;
            setValue(next);
          }}
          className="w-full"
        />
      </div>
    </>
  );
}
