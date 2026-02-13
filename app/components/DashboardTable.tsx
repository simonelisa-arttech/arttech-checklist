"use client";

import { useRef } from "react";

type DashboardTableProps = {
  children: React.ReactNode;
};

export default function DashboardTable({ children }: DashboardTableProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
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
    </>
  );
}
