"use client";

import { useState } from "react";

type VariantId = "iran" | "kuwait" | "lebanon";

const VARIANTS: { id: VariantId; label: string; caption: string }[] = [
  { id: "iran", label: "Iran", caption: "Entry banned \u2014 Israeli passport" },
  { id: "kuwait", label: "Kuwait", caption: "Transit banned \u2014 Kuwait layover" },
  { id: "lebanon", label: "Lebanon", caption: "Stamp risk \u2014 Israel then Lebanon" },
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

function DangerIcon() {
  return (
    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18.36 5.64a9 9 0 11-12.73 0M12 2v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
    </div>
  );
}

function WarnIcon() {
  return (
    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
    </div>
  );
}

function IranVariant() {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>Middle East trip</p>
        <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>Route segments</p>
      </div>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>TLV &rarr; Dubai (DXB)</p>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>Apr 5</p>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>Dubai &rarr; Tehran (IKA)</p>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: 0 }}>Apr 10</p>
        </div>

        <div style={{ background: "#fef2f2", border: "2px solid #dc2626", borderRadius: 12, padding: 14, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <DangerIcon />
            <p style={{ fontSize: 14, fontWeight: 500, color: "#991b1b", margin: 0 }}>Entry prohibited</p>
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#991b1b", margin: "0 0 4px" }}>Iran does not permit Israeli passport holders</p>
          <p style={{ fontSize: 11, color: "#7f1d1d", margin: "0 0 10px", lineHeight: 1.5 }}>
            Iran does not recognize Israel and prohibits entry to all Israeli passport holders. Transit through Iranian airports is also prohibited. Attempting entry may result in detention.
          </p>

          <div style={{ background: "rgba(153,27,27,0.06)", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 500, color: "#991b1b", margin: 0 }}>What this means for your trip</p>
            <p style={{ fontSize: 11, color: "#7f1d1d", margin: "3px 0 0", lineHeight: 1.4 }}>
              You cannot fly to Tehran on an Israeli passport. This flight segment cannot proceed. Remove this destination or consult your country&rsquo;s foreign affairs ministry.
            </p>
          </div>

          <div style={{ padding: 8, background: "white", border: "0.5px solid #fecaca", borderRadius: 8, textAlign: "center", fontSize: 11, fontWeight: 500, color: "#991b1b", cursor: "pointer" }}>
            Remove this segment
          </div>
        </div>

        <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: "8px 0 0", lineHeight: 1.4 }}>
          This is based on current diplomatic records. Verify with the Israeli Ministry of Foreign Affairs before making travel plans.
        </p>
      </div>
    </div>
  );
}

function KuwaitVariant() {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>TLV &rarr; Bangkok (BKK)</p>
          <p style={{ fontSize: 10, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>via Kuwait City (KWI) &mdash; 3hr layover</p>
        </div>

        <div style={{ background: "#fef2f2", border: "2px solid #dc2626", borderRadius: 12, padding: 14, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <DangerIcon />
            <p style={{ fontSize: 14, fontWeight: 500, color: "#991b1b", margin: 0 }}>Transit prohibited</p>
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#991b1b", margin: "0 0 4px" }}>Cannot transit through Kuwait</p>
          <p style={{ fontSize: 11, color: "#7f1d1d", margin: "0 0 10px", lineHeight: 1.5 }}>
            Your connecting flight passes through Kuwait International Airport. Kuwait prohibits transit for Israeli passport holders &mdash; even without leaving the airport. You will be denied boarding or detained at transit.
          </p>

          <div style={{ background: "#eff6ff", border: "0.5px solid #bfdbfe", borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ fontSize: 10, fontWeight: 500, color: "#1e3a8a", margin: 0 }}>Alternative routes to Bangkok</p>
            <p style={{ fontSize: 11, color: "#1e40af", margin: "3px 0 0", lineHeight: 1.4 }}>
              Consider routing through Istanbul (IST), Doha (DOH), or connecting through Europe. These transit points do not restrict Israeli passport holders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LebanonVariant() {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 14, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "6px 10px", flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: 0 }}>Leg 1</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: "2px 0 0" }}>Israel</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--color-text-tertiary)" }}>&rarr;</div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "6px 10px", flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: 0 }}>Leg 2</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", margin: "2px 0 0" }}>Jordan</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--color-text-tertiary)" }}>&rarr;</div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 10px", flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "#92400e", margin: 0 }}>Leg 3</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#92400e", margin: "2px 0 0" }}>Lebanon</p>
          </div>
        </div>

        <div style={{ background: "#fffbeb", border: "1.5px solid #f59e0b", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <WarnIcon />
            <p style={{ fontSize: 14, fontWeight: 500, color: "#92400e", margin: 0 }}>Passport stamp risk</p>
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#92400e", margin: "0 0 4px" }}>Israeli stamps may cause denial at Lebanon</p>
          <p style={{ fontSize: 11, color: "#78350f", margin: "0 0 10px", lineHeight: 1.5 }}>
            Your itinerary visits Israel before Lebanon. Any evidence of travel to Israel in your passport &mdash; entry stamps, exit stamps, boarding passes, or visa stickers &mdash; may result in denial of entry and interrogation at Lebanon&rsquo;s border.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ background: "white", border: "0.5px solid #fde68a", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "#92400e", margin: 0 }}>Practical advice</p>
              <p style={{ fontSize: 10, color: "#78350f", margin: "3px 0 0", lineHeight: 1.4 }}>
                Israel generally stamps a separate entry card rather than passports (since 2013). However, other evidence of Israel travel (airline stickers, Jordanian border stamps from Allenby Bridge) may still be detected.
              </p>
            </div>
            <div style={{ background: "white", border: "0.5px solid #fde68a", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "#92400e", margin: 0 }}>If you have a second passport</p>
              <p style={{ fontSize: 10, color: "#78350f", margin: "3px 0 0", lineHeight: 1.4 }}>
                Consider using one passport for Israel and a different passport for Lebanon to avoid any evidence of Israel travel.
              </p>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: "8px 0 0", lineHeight: 1.4 }}>
          This is a risk advisory based on known border policies. Actual enforcement varies. Verify with your country&rsquo;s foreign affairs ministry.
        </p>
      </div>
    </div>
  );
}

export default function PassportRestrictionAlert() {
  const [variant, setVariant] = useState<VariantId>("iran");
  const caption = VARIANTS.find((v) => v.id === variant)?.caption ?? "";

  return (
    <div className="w-full h-full overflow-y-auto" style={{ background: "var(--color-background-secondary)", fontFamily: "var(--font-sans)" }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: "0 14px 6px" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-brand-navy)", opacity: 0.6 }}>Wayfarer</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)", margin: "2px 0 0", lineHeight: 1.2 }}>Passport &amp; Restrictions</h1>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "4px 0 10px", fontWeight: 500 }}>{caption}</p>
      </div>
      <VariantChips active={variant} onChange={setVariant} />
      <div style={{ padding: "12px 14px 20px" }}>
        {variant === "iran" && <IranVariant />}
        {variant === "kuwait" && <KuwaitVariant />}
        {variant === "lebanon" && <LebanonVariant />}
      </div>
    </div>
  );
}
