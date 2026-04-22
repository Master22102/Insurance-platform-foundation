"use client";

import { Shield, FileCheck, Archive, Flag, Wrench, ExternalLink, Check } from "lucide-react";
import { MobileShell } from "../MobileShell";

const POSTURE = [
  { label: "Policy version", value: "v1.4", sub: "Accepted Mar 12, 2026" },
  { label: "Retention tier", value: "Standard", sub: "Trip data kept 18 months" },
  { label: "Maintenance", value: "Normal", sub: "No open windows" },
];

const CONSENTS = [
  { label: "Itinerary parsing", granted: true, scope: "Booking confirmations only" },
  { label: "Location presence", granted: true, scope: "While trip is active" },
  { label: "Document intelligence", granted: true, scope: "Policy PDFs you upload" },
  { label: "Marketing analytics", granted: false, scope: "Declined" },
];

const LEDGER = [
  { when: "Apr 21", event: "Coverage graph recomputed", ref: "evt_9f21" },
  { when: "Apr 19", event: "Data export generated", ref: "evt_8c04" },
  { when: "Apr 12", event: "Silent hours enabled", ref: "evt_7a3b" },
];

export default function GovernanceTrustPanel() {
  return (
    <MobileShell title="Trust &amp; governance" subtitle="How Wayfarer handles your data">
      <div className="rounded-[14px] p-4" style={{ background: "linear-gradient(135deg, #0f172a, #1A2B4A)" }}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-white/80" />
          <span className="text-[10px] uppercase tracking-wider text-white/60">Governance posture</span>
        </div>
        <p className="text-white text-[16px] font-semibold mt-1">All systems calm</p>
        <p className="text-white/60 text-[11px] mt-1 leading-relaxed">
          Every action below is recorded to an immutable ledger you can export at any time.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {POSTURE.map((p) => (
          <div key={p.label} className="rounded-[12px] border p-3" style={{ background: "#ffffff", borderColor: "#e5e7eb" }}>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: "#94a3b8" }}>
              {p.label}
            </p>
            <p className="text-[14px] font-semibold mt-1" style={{ color: "#0f172a" }}>
              {p.value}
            </p>
            <p className="text-[10px] mt-1 leading-tight" style={{ color: "#64748b" }}>
              {p.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] border overflow-hidden" style={{ background: "#ffffff", borderColor: "#e5e7eb" }}>
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "#f1f5f9" }}>
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4" style={{ color: "#1A2B4A" }} />
            <span className="text-[12px] font-semibold" style={{ color: "#0f172a" }}>
              Consents
            </span>
          </div>
          <span className="text-[10px]" style={{ color: "#64748b" }}>
            Manage
          </span>
        </div>
        {CONSENTS.map((c, i) => (
          <div
            key={c.label}
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderTop: i === 0 ? "none" : "0.5px solid #f1f5f9" }}
          >
            <div>
              <p className="text-[13px]" style={{ color: "#0f172a" }}>
                {c.label}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>
                {c.scope}
              </p>
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1"
              style={{
                background: c.granted ? "#ecfdf5" : "#f1f5f9",
                color: c.granted ? "#059669" : "#64748b",
              }}
            >
              {c.granted ? <Check className="w-3 h-3" /> : null}
              {c.granted ? "Granted" : "Declined"}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] border overflow-hidden" style={{ background: "#ffffff", borderColor: "#e5e7eb" }}>
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "#f1f5f9" }}>
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4" style={{ color: "#1A2B4A" }} />
            <span className="text-[12px] font-semibold" style={{ color: "#0f172a" }}>
              Recent ledger
            </span>
          </div>
          <span className="text-[10px] flex items-center gap-0.5" style={{ color: "#1d4ed8" }}>
            Export <ExternalLink className="w-3 h-3" />
          </span>
        </div>
        {LEDGER.map((l, i) => (
          <div
            key={l.ref}
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderTop: i === 0 ? "none" : "0.5px solid #f1f5f9" }}
          >
            <div>
              <p className="text-[12px]" style={{ color: "#0f172a" }}>
                {l.event}
              </p>
              <p className="text-[10px] mt-0.5 font-mono" style={{ color: "#94a3b8" }}>
                {l.ref}
              </p>
            </div>
            <span className="text-[10px]" style={{ color: "#64748b" }}>
              {l.when}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="rounded-[12px] py-3 text-[12px] font-semibold flex items-center justify-center gap-1" style={{ background: "#ffffff", color: "#0f172a", border: "0.5px solid #e5e7eb" }}>
          <Archive className="w-3.5 h-3.5" /> Data export
        </button>
        <button className="rounded-[12px] py-3 text-[12px] font-semibold flex items-center justify-center gap-1" style={{ background: "#ffffff", color: "#dc2626", border: "0.5px solid #fecaca" }}>
          <Wrench className="w-3.5 h-3.5" /> Erasure request
        </button>
      </div>
    </MobileShell>
  );
}
