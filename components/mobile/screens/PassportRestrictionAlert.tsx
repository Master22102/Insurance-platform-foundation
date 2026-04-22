"use client";

import { TriangleAlert as AlertTriangle, ChevronRight, FileText, ShieldAlert } from "lucide-react";
import { MobileShell } from "../MobileShell";

const RESTRICTIONS = [
  {
    severity: "critical",
    kind: "Medication",
    title: "Adderall restricted in Japan",
    body: "Amphetamines are classified as stimulants under Japanese law. Import is prohibited even with a US prescription. Apply for a Yakkan Shoumei before travel.",
    accent: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    tag: "JP · 2 weeks out",
  },
  {
    severity: "warning",
    kind: "Visa",
    title: "Transit visa required in Istanbul",
    body: "Layover exceeds 24 hours. A Turkish e-Visa is required for US passport holders transiting IST. Apply at least 48 hours before departure.",
    accent: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    tag: "TR · 6 days out",
  },
  {
    severity: "info",
    kind: "Stamps",
    title: "Only 2 blank passport pages remain",
    body: "Portugal and Morocco may deny entry with fewer than 2 blank pages. Consider renewal before June 12.",
    accent: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
    tag: "US passport",
  },
];

export default function PassportRestrictionAlert() {
  return (
    <MobileShell title="Passport & Restrictions" subtitle="Portugal 2026 &middot; 2 active alerts">
      <div className="rounded-[14px] border overflow-hidden" style={{ background: "#1A2B4A", borderColor: "#0f1f3a" }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/60 uppercase tracking-wider">Entry posture</p>
            <p className="text-sm font-semibold text-white">Action needed in 2 countries</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "#fbbf24", color: "#1A2B4A" }}>
            2 alerts
          </span>
        </div>
      </div>

      {RESTRICTIONS.map((r) => (
        <div
          key={r.title}
          className="rounded-[14px] border p-3"
          style={{ background: r.bg, borderColor: r.border }}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: "#ffffffb0", color: r.accent }}
            >
              {r.kind}
            </span>
            <span className="text-[10px]" style={{ color: r.accent }}>
              {r.tag}
            </span>
          </div>
          <p className="text-[14px] font-semibold leading-snug" style={{ color: r.accent }}>
            {r.title}
          </p>
          <p className="text-[12px] leading-[1.5] mt-1" style={{ color: "#334155" }}>
            {r.body}
          </p>
          <button
            className="mt-3 w-full rounded-[10px] border py-2 flex items-center justify-center gap-1 text-[12px] font-semibold"
            style={{ borderColor: r.border, background: "#ffffff", color: r.accent }}
          >
            <FileText className="w-3.5 h-3.5" />
            View documentation requirements
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        className="w-full rounded-[10px] py-3 text-[13px] font-semibold flex items-center justify-center gap-2"
        style={{ background: "#ffffff", color: "#1A2B4A", border: "0.5px solid #e5e7eb" }}
      >
        <AlertTriangle className="w-4 h-4" />
        Run restriction scan for all upcoming trips
      </button>
    </MobileShell>
  );
}
