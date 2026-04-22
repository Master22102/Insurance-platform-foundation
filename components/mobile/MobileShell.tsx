"use client";

import { ReactNode } from "react";

export function MobileShell({
  title,
  subtitle,
  children,
  accent = "#1A2B4A",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#f5f5f7" }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <header
        className="flex items-end justify-between px-5 pb-3"
        style={{ background: "#f5f5f7" }}
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: accent, opacity: 0.6 }}>
            Wayfarer
          </div>
          <h1 className="text-[22px] font-semibold leading-tight" style={{ color: "#0f172a" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs mt-1" style={{ color: "#64748b" }}>
              {subtitle}
            </p>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: "#f5f5f7" }}>
        {children}
      </div>
      <div style={{ height: 28, background: "rgba(245,245,247,0.92)", flexShrink: 0 }} />
    </div>
  );
}
