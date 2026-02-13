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
            overflowX: "hidden",
            overflowY: "auto",
            display: "block",
            maxHeight: "calc(100vh - 220px)",
          }}
          onScroll={() => {
            const el = wrapRef.current;
            if (el) {
              setValue(el.scrollLeft);
              setVValue(el.scrollTop);
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
        <div
          style={{
            position: "sticky",
            top: 120,
            alignSelf: "flex-start",
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
            disabled={vMax === 0}
            onChange={(e) => {
              const next = Number(e.target.value);
              const el = wrapRef.current;
              if (el) el.scrollTop = next;
              setVValue(next);
            }}
            style={{
              writingMode: "vertical-rl",
              height: "60vh",
              width: 16,
              WebkitAppearance: "slider-vertical",
            }}
          />
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
