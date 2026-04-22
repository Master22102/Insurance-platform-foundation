"use client";

import { useState } from "react";

type VariantId = "missed" | "activity" | "border" | "local" | "summary";

const VARIANTS: { id: VariantId; label: string; caption: string }[] = [
  { id: "missed", label: "Missed conn.", caption: "Missed connection alert" },
  { id: "activity", label: "Ski resort", caption: "Activity zone \u2014 ski resort" },
  { id: "border", label: "Border", caption: "Border crossing" },
  { id: "local", label: "Local risk", caption: "Local risk alert" },
  { id: "summary", label: "Summary", caption: "Daily travel summary" },
];

function VariantChips({ active, onChange }: { active: VariantId; onChange: (v: VariantId) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto", background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
      {VARIANTS.map((v) => (
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      {children}
    </div>
  );
}

function MissedVariant() {
  return (
    <Card>
      <div style={{ background: "var(--color-background-danger)", padding: "14px 16px", borderBottom: "0.5px solid var(--color-border-danger)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="var(--color-text-danger)" /><path d="M12 9v4M12 17h.01" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-danger)" }}>Missed boarding risk</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-danger)", margin: 0, lineHeight: 1.5 }}>
          You are 22 minutes from Newark Airport. Boarding for AA 347 begins in 18 minutes.
        </p>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>If you miss this flight, your coverage includes:</p>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>Chase Sapphire Reserve</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>Missed connection: up to $500</p>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>After 3+ hour delay on connecting flight</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ padding: 10, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>View airline rebooking policy</div>
          <div style={{ padding: 10, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>Call American Airlines</div>
          <div style={{ padding: 10, border: "0.5px solid var(--color-border-info)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-info)" }}>Start documenting now</div>
        </div>
      </div>
    </Card>
  );
}

function ActivityVariant() {
  return (
    <Card>
      <div style={{ background: "var(--color-background-warning)", padding: "14px 16px", borderBottom: "0.5px solid var(--color-border-warning)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 22h20L12 2z" stroke="var(--color-text-warning)" strokeWidth="1.5" fill="none" /><path d="M12 9v4M12 17h.01" stroke="var(--color-text-warning)" strokeWidth="2" strokeLinecap="round" /></svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-warning)" }}>Coverage alert</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-warning)", margin: 0, lineHeight: 1.5 }}>
          You appear to be at a ski resort. Your insurance may have winter sports exclusions.
        </p>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>World Nomads Explorer</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-danger)", margin: 0 }}>Excludes off-piste skiing and snowboarding</p>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>Clause 14.3 &mdash; Winter sports exclusion</p>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "0 0 2px" }}>Chase Sapphire Reserve</p>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-success)", margin: 0 }}>No winter sports exclusion found</p>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>Medical coverage applies normally</p>
        </div>
        <div style={{ padding: 10, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>View full coverage details</div>
      </div>
    </Card>
  );
}

function BorderVariant() {
  return (
    <Card>
      <div style={{ background: "var(--color-background-info)", padding: "14px 16px", borderBottom: "0.5px solid var(--color-border-info)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>🌍</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-info)" }}>Welcome to Switzerland</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-info)", margin: 0, lineHeight: 1.5 }}>
          Your health coverage outside the EU may be limited. Car rental coverage may not apply.
        </p>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Coverage changes detected</p>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Health coverage</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-warning)" }}>Limited</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>EHIC/GHIC not valid. Private policy applies with CHF 1,000 deductible.</p>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Car rental</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-danger)" }}>Not covered</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>Your CDW benefit excludes Switzerland. Purchase local coverage.</p>
        </div>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Emergency information</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[["Emergency", "112"], ["Ambulance", "144"], ["Police", "117"]].map(([k, v]) => (
            <div key={k} style={{ flex: 1, background: "var(--color-background-secondary)", borderRadius: 8, padding: 8, textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: 0 }}>{k}</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", margin: "2px 0 0" }}>{v}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: 10, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>Save emergency info offline</div>
      </div>
    </Card>
  );
}

function LocalVariant() {
  return (
    <Card>
      <div style={{ background: "var(--color-background-warning)", padding: "14px 16px", borderBottom: "0.5px solid var(--color-border-warning)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="var(--color-text-warning)" strokeWidth="1.5" /><path d="M12 9v4M12 17h.01" stroke="var(--color-text-warning)" strokeWidth="2" strokeLinecap="round" /></svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-warning)" }}>Travel disruption nearby</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-warning)", margin: 0, lineHeight: 1.5 }}>
          Airport ground crew strike reported at Lisbon Airport (LIS). Your flight TAP 302 may be affected.
        </p>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 2px" }}>Source: Portuguese Airport Authority</p>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.4 }}>Strike action reported from 06:00-18:00 local time. Expect delays of 2-4 hours. Some cancellations possible.</p>
        </div>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 8px" }}>Your coverage for this</p>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-success)", margin: 0 }}>Trip delay covered after 6 hours</p>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>Up to $500 for meals, transport, accommodation</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ padding: 10, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>Check flight status</div>
          <div style={{ padding: 10, border: "0.5px solid var(--color-border-info)", borderRadius: 10, textAlign: "center", fontSize: 12, fontWeight: 500, color: "var(--color-text-info)" }}>Start documenting now</div>
        </div>
      </div>
    </Card>
  );
}

function SummaryVariant() {
  return (
    <Card>
      <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>Today&rsquo;s travel summary</p>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>June 19 &mdash; Day 4 in Jaipur</p>
      </div>
      <div style={{ padding: "14px 16px" }}>
        {[
          { label: "Hotel (Rambagh Palace)", time: "8:00 AM", warn: false },
          { label: "Amber Fort", time: "10:30 AM - 1:00 PM", warn: false },
          { label: "Motorbike rental area", time: "4:30 PM", warn: true },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.warn ? "var(--color-text-warning)" : "var(--color-text-tertiary)", marginTop: 6, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 12, color: "var(--color-text-primary)", margin: 0 }}>{item.label}</p>
              <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0 }}>{item.time}</p>
            </div>
          </div>
        ))}
        <div style={{ background: "var(--color-background-warning)", borderRadius: 8, padding: "10px 12px", marginTop: 4, marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-warning)", margin: "0 0 4px" }}>Coverage note</p>
          <p style={{ fontSize: 11, color: "var(--color-text-warning)", margin: 0, lineHeight: 1.4 }}>
            You were near a motorbike rental area. Motorbike injuries may have coverage limitations. India requires an International Driving Permit for motorcycles.
          </p>
        </div>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: 0 }}>This summary is saved in your trip log for documentation.</p>
      </div>
    </Card>
  );
}

export default function TripPresenceModeAlert() {
  const [variant, setVariant] = useState<VariantId>("missed");
  const caption = VARIANTS.find((v) => v.id === variant)?.caption ?? "";

  return (
    <div className="w-full h-full overflow-y-auto" style={{ background: "var(--color-background-secondary)", fontFamily: "var(--font-sans)" }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: "0 14px 6px" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-brand-navy)", opacity: 0.6 }}>Wayfarer</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "2px 0 0", lineHeight: 1.2 }}>Presence alerts</h1>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "4px 0 10px", fontWeight: 500 }}>{caption}</p>
      </div>
      <VariantChips active={variant} onChange={setVariant} />
      <div style={{ padding: "12px 14px 20px" }}>
        {variant === "missed" && <MissedVariant />}
        {variant === "activity" && <ActivityVariant />}
        {variant === "border" && <BorderVariant />}
        {variant === "local" && <LocalVariant />}
        {variant === "summary" && <SummaryVariant />}
      </div>
    </div>
  );
}
