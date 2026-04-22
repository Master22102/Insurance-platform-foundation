"use client";

import { MapPin, Clock3, Settings } from "lucide-react";
import { MobileShell } from "../MobileShell";

const PARTNERS = [
  { initials: "SA", name: "Sarah A.", color: "#1d4ed8", status: "Online \u2014 2 min ago", dot: "#22c55e" },
  { initials: "MR", name: "Marco R.", color: "#059669", status: "Online \u2014 6 min ago", dot: "#22c55e" },
  { initials: "LT", name: "Lena T.", color: "#b45309", status: "Last seen 34 min ago", dot: "#f59e0b" },
];

export function TravelShieldPanel({ variant = "group" }: { variant?: "group" | "solo" }) {
  const isSolo = variant === "solo";
  return (
    <MobileShell title="TravelShield" subtitle={isSolo ? "Solo trip \u2014 trusted contact only" : "Portugal 2026 \u2014 3 partners"}>
      <div className="rounded-[14px] overflow-hidden border" style={{ background: "#ffffff", borderColor: "#e5e7eb" }}>
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "#f1f5f9" }}>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e" }} />
              <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: "#22c55e" }} />
            </div>
            <span className="text-[13px] font-semibold" style={{ color: "#0f172a" }}>
              TravelShield
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#059669" }}>
              Active
            </span>
          </div>
          <button className="flex items-center gap-1 text-[10px]" style={{ color: "#64748b" }}>
            <Settings className="w-3 h-3" /> Settings
          </button>
        </div>

        <div className="px-4 py-3">
          {(isSolo ? PARTNERS.slice(0, 1) : PARTNERS).map((p) => (
            <div key={p.initials} className="flex items-center gap-3 py-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold text-white"
                style={{ background: p.color }}
              >
                {p.initials}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold" style={{ color: "#0f172a" }}>
                  {p.name}
                </p>
                <p className="text-[11px] flex items-center gap-1" style={{ color: "#059669" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.dot }} /> {p.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                  Check-in
                </p>
                <p className="text-[10px]" style={{ color: "#64748b" }}>
                  every 2 hr
                </p>
              </div>
            </div>
          ))}

          <div
            className="rounded-[10px] mt-2 p-4 flex flex-col items-center justify-center"
            style={{ background: "linear-gradient(180deg, rgba(30,58,95,0.04) 0%, rgba(30,58,95,0.01) 100%)", minHeight: 120 }}
          >
            <MapPin className="w-5 h-5 opacity-40" style={{ color: "#94a3b8" }} />
            <p className="text-[11px] mt-1" style={{ color: "#64748b" }}>
              {isSolo ? "Near JFK Terminal 5, New York" : "Near Bel\u00E9m Tower, Lisbon"}
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: "#94a3b8" }}>
              Updated 2 min ago
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="rounded-[10px] py-2.5 text-[12px] font-semibold" style={{ background: "#ffffff", color: "#0f172a", border: "0.5px solid #e5e7eb" }}>
              Request check-in
            </button>
            <button className="rounded-[10px] py-2.5 text-[12px] font-semibold" style={{ background: "#1A2B4A", color: "#ffffff" }}>
              View on map
            </button>
          </div>
        </div>

        <div className="px-4 py-2 flex items-center justify-between border-t" style={{ borderColor: "#f1f5f9" }}>
          <p className="text-[10px] flex items-center gap-1" style={{ color: "#94a3b8" }}>
            <Clock3 className="w-3 h-3" /> {isSolo ? "Active on every segment" : "Active until Jun 24"}
          </p>
          <p className="text-[10px]" style={{ color: "#94a3b8" }}>
            {isSolo ? "Lock code enabled" : "No lock code"}
          </p>
        </div>
      </div>

      <div className="rounded-[12px] p-3" style={{ background: "#f0f9ff", border: "0.5px solid #bae6fd" }}>
        <p className="text-[11px] font-semibold" style={{ color: "#0369a1" }}>
          What happens if {isSolo ? "you miss a check-in" : "a partner misses a check-in"}?
        </p>
        <p className="text-[11px] leading-[1.5] mt-1" style={{ color: "#0c4a6e" }}>
          Wayfarer waits {isSolo ? 30 : 15} minutes, re-pings, then alerts your trusted contacts with your last known location.
        </p>
      </div>
    </MobileShell>
  );
}

export default TravelShieldPanel;
