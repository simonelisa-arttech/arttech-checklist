"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DashboardTableProps = {
  children: React.ReactNode;
};

export default function DashboardTable({ children }: DashboardTableProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [max, setMax] = useState(0);
  const [value, setValue] = useState(0);
  const [mounted, setMounted] = useState(false);

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
      {mounted &&
        createPortal(
          <div
            className="dashboard-slider-bar"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              height: 40,
              zIndex: 2147483647,
              background: "white",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
            }}
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
              className="dashboard-slider"
              style={{ width: "100%" }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
