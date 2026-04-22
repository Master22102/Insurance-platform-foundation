"use client";

import { useState } from "react";

type StateId = "pretrip" | "airport" | "disruption" | "quiet" | "defer";

const STATES: { id: StateId; label: string; caption: string }[] = [
  { id: "pretrip", label: "Pre-trip", caption: "State 1 \u2014 Pre-trip (3 days before)" },
  { id: "airport", label: "At airport", caption: "State 2 \u2014 At airport (2hrs before)" },
  { id: "disruption", label: "Disruption", caption: "State 3 \u2014 Active disruption" },
  { id: "quiet", label: "Quiet day", caption: "State 4 \u2014 Quiet day" },
  { id: "defer", label: "Defer + protect", caption: "State 5 \u2014 Defer and protect mode" },
];

function VariantChips({ active, onChange }: { active: StateId; onChange: (v: StateId) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto", background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
      {STATES.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: active === v.id ? "1px solid var(--color-brand-navy)" : "0.5px solid var(--color-border-tertiary)",
            background: active === v.id ? "var(--color-brand-navy)" : "var(--color-background-primary)",
            color: active === v.id ? "#ffffff" : "var(--color-text-secondary)",
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: "nowrap",
            cursor: "pointer",
          }}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function PretripState() {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: "linear-gradient(135deg, var(--color-background-info), var(--color-background-primary))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>Your trip to Lisbon starts in 3 days</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { icon: <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="var(--color-text-info)" strokeWidth="1.5" strokeLinecap="round" />, label: "Download documents for offline access" },
            { icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="var(--color-text-info)" strokeWidth="1.5" fill="none" />, label: "Review coverage summary" },
            { icon: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="var(--color-text-info)" strokeWidth="1.5" strokeLinecap="round" />, label: "Check readiness pins" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--color-background-primary)", borderRadius: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">{item.icon}</svg>
              <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AirportState() {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>✈️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>Flight to Lisbon departs in 2 hours</p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>Terminal B, Gate 14 &mdash; TAP 302</p>
          </div>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 4px" }}>If your flight is delayed</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>Your coverage triggers after 6 hours &mdash; up to $500</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--color-background-warning)", borderRadius: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--color-text-warning)" strokeWidth="1.5" /><path d="M8 12h8" stroke="var(--color-text-warning)" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <span style={{ fontSize: 12, color: "var(--color-text-warning)" }}>Save delay screenshots if anything changes</span>
        </div>
      </div>
    </div>
  );
}

function DisruptionState() {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-danger)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: "var(--color-background-danger)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-danger)" }}>Delay detected on TAP 302</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-danger)", margin: 0 }}>New departure: 19:45 (3h 20m delay)</p>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Start documenting now</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {["Photo of gate board showing delay", "Screenshot carrier notification", "Keep meal receipts (itemized)"].map((label) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--color-background-secondary)", borderRadius: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid var(--color-border-secondary)" }} />
              <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>Your delay threshold: 6 hours. 2h 40m remaining until coverage triggers.</p>
        </div>
        <div style={{ padding: 10, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-info)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-info)" }}>
          Open incident and start capturing
        </div>
      </div>
    </div>
  );
}

function QuietState() {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ padding: 16, textAlign: "center" }}>
        <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>☀️</span>
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Day 3 in Lisbon</p>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 14px" }}>No disruptions. Enjoy your trip.</p>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <div style={{ padding: "6px 14px", background: "var(--color-background-secondary)", borderRadius: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>24&deg;C sunny</div>
          <div style={{ padding: "6px 14px", background: "var(--color-background-secondary)", borderRadius: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>Next flight: Jun 22</div>
        </div>
      </div>
    </div>
  );
}

function DeferState() {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px" }}>Capture now, organize later</p>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>
          You don&rsquo;t have to get everything perfect right now. Capture what you can.
        </p>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <div style={{ padding: 14, background: "var(--color-background-info)", borderRadius: 10, textAlign: "center", cursor: "pointer" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 4 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--color-text-info)" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3" stroke="var(--color-text-info)" strokeWidth="1.5" />
            </svg>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-info)", margin: "2px 0 0" }}>Take photo</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, padding: "14px 8px", background: "var(--color-background-secondary)", borderRadius: 10, textAlign: "center", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 2 }}>
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="var(--color-text-secondary)" strokeWidth="1.5" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)", margin: "2px 0 0" }}>Voice note</p>
            </div>
            <div style={{ flex: 1, padding: "14px 8px", background: "var(--color-background-secondary)", borderRadius: 10, textAlign: "center", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 2 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--color-text-secondary)" strokeWidth="1.5" />
              </svg>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)", margin: "2px 0 0" }}>Screenshot</p>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 8px", textAlign: "center" }}>3 items captured, uncategorized</p>
        <div style={{ padding: 10, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", cursor: "pointer" }}>
          I&rsquo;m ready to organize
        </div>
      </div>
    </div>
  );
}

export default function ContextualIntelligenceNow() {
  const [variant, setVariant] = useState<StateId>("pretrip");
  const caption = STATES.find((v) => v.id === variant)?.caption ?? "";

  return (
    <div className="w-full h-full overflow-y-auto" style={{ background: "var(--color-background-secondary)", fontFamily: "var(--font-sans)" }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: "0 14px 6px" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-brand-navy)", opacity: 0.6 }}>Wayfarer</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "2px 0 0", lineHeight: 1.2 }}>Right now</h1>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "4px 0 10px", fontWeight: 500 }}>{caption}</p>
      </div>
      <VariantChips active={variant} onChange={setVariant} />
      <div style={{ padding: "12px 14px 20px" }}>
        {variant === "pretrip" && <PretripState />}
        {variant === "airport" && <AirportState />}
        {variant === "disruption" && <DisruptionState />}
        {variant === "quiet" && <QuietState />}
        {variant === "defer" && <DeferState />}
      </div>
    </div>
  );
}
