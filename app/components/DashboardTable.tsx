"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    setVMax(maxScroll);
    setVValue(window.scrollY);
  }, []);

  const onWindowScroll = useCallback(() => {
    setVValue(window.scrollY);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    recalcV();
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    window.addEventListener("resize", recalcV);
    return () => {
      window.removeEventListener("scroll", onWindowScroll);
      window.removeEventListener("resize", recalcV);
    };
  }, [mounted, onWindowScroll, recalcV]);
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
        onScroll={() => {
          const el = wrapRef.current;
          if (el) setValue(el.scrollLeft);
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
              padding: "0",
            }}
          >
            <div
              style={{
                maxWidth: 1100,
                margin: "0 auto",
                padding: "8px 16px",
                width: "100%",
                display: "flex",
                alignItems: "center",
              }}
            >
              <input
                type="range"
                min={0}
                max={max}
                value={value}
                disabled={max === 0}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  const el = wrapRef.current;
                  if (el) el.scrollLeft = next;
                  setValue(next);
                }}
                style={{ width: "100%", height: 16 }}
              />
            </div>
          </div>,
          document.body
        )}
      {mounted &&
        createPortal(
          <div
            style={{
              position: "fixed",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2147483647,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 8,
            }}
          >
            <input
              type="range"
              min={0}
              max={vMax}
              value={vValue}
              onChange={(e) => {
                const next = Number(e.target.value);
                setVValue(next);
                window.scrollTo({ top: next, behavior: "auto" });
              }}
              style={{
                writingMode: "bt-lr",
                WebkitAppearance: "slider-vertical",
                height: "60vh",
                width: 16,
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
