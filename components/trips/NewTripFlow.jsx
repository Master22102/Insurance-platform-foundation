"use client";

import { useState, useRef } from "react";

// ---------------------------------------------------------------------------
// SHARED PRIMITIVES
// ---------------------------------------------------------------------------
function FlowHeader({ onBack, step, totalSteps }) {
  return (
    <div style={{ padding: "10px 16px 0", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
            <path d="M6 1L2 6l4 5" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      {totalSteps && (
        <div style={{ flex: 1, display: "flex", gap: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < step ? "#1e3a5f" : "#e5e7eb",
              opacity: i < step ? 1 : 0.4,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function PrimaryBtn({ label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: "14px 0",
        background: disabled ? "#e5e7eb" : "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
        border: "none", borderRadius: 16,
        fontSize: 15, fontWeight: 700,
        color: disabled ? "#9ca3af" : "white",
        cursor: disabled ? "default" : "pointer",
        boxShadow: disabled ? "none" : "0 4px 14px rgba(30,58,95,0.28)",
        letterSpacing: "-0.1px",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function GhostBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "13px 0",
        background: "none", border: "1.5px solid #e5e7eb", borderRadius: 16,
        fontSize: 14, fontWeight: 600, color: "#6b7280",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// Simple accordion item
function AccordionItem({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #f0f0f0" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "none", border: "none",
          padding: "11px 0", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{title}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ paddingBottom: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 1 — TRIP TYPE SELECTION
// ---------------------------------------------------------------------------
function TripTypeScreen({ onSelect, onClose, hasCorporate }) {
  const types = [
    {
      id: "solo",
      label: "Solo trip",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
      desc: "Just you. Full control, individual coverage, private itinerary.",
      color: "#1e3a5f",
      bg: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
      disabled: false,
    },
    {
      id: "group",
      label: "Group trip",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="8" r="3.5" stroke="white" strokeWidth="1.7"/>
          <circle cx="17" cy="8" r="2.5" stroke="white" strokeWidth="1.5"/>
          <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
          <path d="M17 14c2 .4 4 2 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      desc: "Shared itinerary, role-based editing, individual coverage per traveler.",
      color: "#059669",
      bg: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      disabled: false,
    },
    {
      id: "corporate",
      label: "Corporate trip",
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="7" width="18" height="14" rx="2" stroke="white" strokeWidth="1.7"/>
          <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="white" strokeWidth="1.6"/>
          <path d="M3 13h18" stroke="white" strokeWidth="1.4"/>
        </svg>
      ),
      desc: "Organization-level management, bulk invite, HR sync, corporate billing.",
      color: hasCorporate ? "#0369a1" : "#9ca3af",
      bg: hasCorporate
        ? "linear-gradient(135deg, #0369a1 0%, #075985 100%)"
        : "linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)",
      disabled: !hasCorporate,
    },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <FlowHeader onBack={onClose} step={1} totalSteps={4} />

      <div style={{ padding: "20px 20px 28px" }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.4px" }}>New trip</p>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px", lineHeight: 1.5 }}>Choose trip type to get started</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => !t.disabled && onSelect(t.id)}
              style={{
                background: t.bg,
                border: "none", borderRadius: 20, padding: "16px 18px",
                cursor: t.disabled ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                opacity: t.disabled ? 0.55 : 1,
                boxShadow: t.disabled ? "none" : `0 6px 20px ${t.color}35`,
                position: "relative",
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {t.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "white", margin: "0 0 3px" }}>{t.label}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5 }}>{t.desc}</p>
              </div>
              {!t.disabled && (
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1 1l4 4-4 4" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {t.disabled && (
                <span style={{ fontSize: 9, fontWeight: 700, color: "white", background: "rgba(0,0,0,0.25)", borderRadius: 20, padding: "3px 8px", flexShrink: 0 }}>Upgrade</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 2A — GROUP INFO (accordion style)
// ---------------------------------------------------------------------------
function GroupInfoScreen({ onContinue, onBack }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <FlowHeader onBack={onBack} step={2} totalSteps={4} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 28px" }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Group trip</p>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 18px", lineHeight: 1.5 }}>
          You are the organizer. Invite travelers after the draft is created.
        </p>

        {/* Summary row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[
            { icon: "👤", label: "You're the organizer" },
            { icon: "✉", label: "Invite after draft" },
            { icon: "🛡", label: "Individual coverage" },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <p style={{ fontSize: 16, margin: "0 0 4px" }}>{s.icon}</p>
              <p style={{ fontSize: 9, fontWeight: 600, color: "#6b7280", margin: 0, lineHeight: 1.4 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Accordion */}
        <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 16, padding: "0 14px", marginBottom: 16 }}>
          <AccordionItem title="What happens after I invite someone?">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { step: "1", text: "They receive an email or link to join this trip." },
                { step: "2", text: "Once they accept, they appear in the Travelers tab." },
                { step: "3", text: "Their role determines what they can see and edit." },
                { step: "4", text: "Each traveler manages their own coverage and scan credits separately." },
              ].map((s) => (
                <div key={s.step} style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>{s.step}</div>
                  <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.5 }}>{s.text}</p>
                </div>
              ))}
            </div>
          </AccordionItem>

          <AccordionItem title="How do editing permissions work?">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { role: "Organizer", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", desc: "Full edit access. Creates the trip and manages its structure." },
                { role: "Co-organizer", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", desc: "Paid tier. Can edit the shared route and activity surfaces." },
                { role: "Participant", color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", desc: "Read-only by default. Free tier." },
              ].map((r) => (
                <div key={r.role} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: r.color, background: r.bg, border: `1px solid ${r.border}`, borderRadius: 20, padding: "2px 8px", flexShrink: 0, marginTop: 1 }}>{r.role}</span>
                  <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.5 }}>{r.desc}</p>
                </div>
              ))}
              <button style={{ background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: "#1d4ed8", cursor: "pointer", textAlign: "left", marginTop: 2 }}>
                View full traveler roles guide →
              </button>
            </div>
          </AccordionItem>

          <AccordionItem title="Can participants see everything?">
            <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.5 }}>
              Visibility is controlled per role. Participants see the shared itinerary and route. Private evidence, claim content, and personal documents are never shared automatically. Organizers can adjust visibility settings per traveler later.
            </p>
          </AccordionItem>
        </div>

        <PrimaryBtn label="Continue" onClick={onContinue} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 2B — CORPORATE ONBOARDING
// ---------------------------------------------------------------------------
function CorporateInfoScreen({ onContinue, onBack }) {
  const [orgName, setOrgName] = useState("");
  const [travelers, setTravelers] = useState("");
  const [billing, setBilling] = useState("");
  const [use, setUse] = useState("");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <FlowHeader onBack={onBack} step={2} totalSteps={4} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 28px" }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Corporate setup</p>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px", lineHeight: 1.5 }}>Organization details for corporate travel management</p>

        {[
          { label: "Organization name", value: orgName, onChange: setOrgName, placeholder: "e.g. Acme Corp" },
          { label: "Estimated traveler count", value: travelers, onChange: setTravelers, placeholder: "e.g. 25" },
          { label: "Billing contact", value: billing, onChange: setBilling, placeholder: "billing@company.com" },
          { label: "Intended use", value: use, onChange: setUse, placeholder: "e.g. Sales team travel, conference attendance" },
        ].map((f) => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{f.label}</p>
            <input
              type="text"
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              style={{
                width: "100%", padding: "12px 13px",
                background: "#f9fafb", border: "1.5px solid #e5e7eb",
                borderRadius: 12, fontSize: 13, color: "#111",
                boxSizing: "border-box", outline: "none",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            />
          </div>
        ))}

        <div style={{ height: 14 }} />
        <PrimaryBtn label="Continue to trip draft" onClick={onContinue} disabled={!orgName} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 3 — BUILD METHOD
// ---------------------------------------------------------------------------
function BuildMethodScreen({ onSelect, onBack }) {
  const methods = [
    {
      id: "narrate",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
          <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 19v3M9 22h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
      label: "Narrate your trip",
      desc: "Speak your itinerary. Parses dates, destinations, segments, activities, and travelers.",
      badge: "Voice-first",
      badgeColor: "#1e3a5f",
      badgeBg: "#eff6ff",
      accent: "#1e3a5f",
      gradient: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
    },
    {
      id: "import",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v12M8 11l4 4 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
      label: "Import",
      desc: "Upload a PDF, paste a booking confirmation, or bring in an email itinerary.",
      badge: "PDF / Email",
      badgeColor: "#0369a1",
      badgeBg: "#f0f9ff",
      accent: "#0369a1",
      gradient: "linear-gradient(135deg, #0369a1 0%, #075985 100%)",
    },
    {
      id: "manual",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
      label: "Enter manually",
      desc: "Build segment by segment using the route and activity form editors.",
      badge: "Manual",
      badgeColor: "#374151",
      badgeBg: "#f3f4f6",
      accent: "#374151",
      gradient: "linear-gradient(135deg, #374151 0%, #1f2937 100%)",
    },
    {
      id: "creators",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.7"/>
          <path d="M12 8v4l3 2" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
          <path d="M2 12h3M19 12h3M12 2v3M12 19v3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      label: "Add from creators",
      desc: "Browse and import curated routes and itineraries from trusted creators.",
      badge: "Curated",
      badgeColor: "#d97706",
      badgeBg: "#fffbeb",
      accent: "#d97706",
      gradient: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
    },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <FlowHeader onBack={onBack} step={3} totalSteps={4} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 28px" }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Build your trip</p>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 24px", lineHeight: 1.5 }}>Choose how to start your draft</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {methods.map((m) => {
            const isDisabled = m.id === "creators";
            return (
              <button
                key={m.id}
                onClick={isDisabled ? undefined : () => onSelect(m.id)}
                style={{
                  background: "white", border: "1.5px solid #f0f0f0",
                  borderRadius: 18, padding: "14px 16px",
                  cursor: isDisabled ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  opacity: isDisabled ? 0.55 : 1,
                  pointerEvents: isDisabled ? "none" : "auto",
                }}
              >
                <div style={{
                  width: 50, height: 50, borderRadius: 14,
                  background: m.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: `0 4px 12px ${m.accent}30`,
                }}>
                  {m.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: 0 }}>{m.label}</p>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: isDisabled ? "#9ca3af" : m.badgeColor,
                      background: isDisabled ? "#f3f4f6" : m.badgeBg,
                      borderRadius: 20, padding: "2px 7px",
                    }}>{isDisabled ? "Coming soon" : m.badge}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{m.desc}</p>
                </div>
                <svg width="5" height="8" viewBox="0 0 5 8" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 4A — NARRATE SCREEN
// ---------------------------------------------------------------------------
function NarrateScreen({ onDone, onBack, tripType }) {
  const [phase, setPhase] = useState("idle");
  const [text, setText] = useState("");
  const [confirmedFields, setConfirmedFields] = useState({});
  const [segmentsExpanded, setSegmentsExpanded] = useState(false);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [newActivity, setNewActivity] = useState("");
  const INITIAL_ACTIVITIES = ["Belém Tower", "LX Factory", "Douro Valley wine tour", "Sintra day trip", "Alfama walking tour", "Pastéis de Belém", "Time Out Market", "Fado show", "Parque das Nações", "Jerónimos Monastery", "Cape Roca", "Porto wine tasting"];
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES);

  const PARSED = {
    name: { value: "Portugal Weekend", detected: true },
    destination: { value: "Lisbon, Porto", detected: true },
    dates: { value: "Jun 12 – Jun 18, 2026", detected: true },
    segments: [
      "JFK → LIS · TAP TP205 · Jun 12",
      "LIS → OPO · TAP TP782 · Jun 14",
      "OPO → FAO · Ryanair FR8834 · Jun 15",
      "FAO → LIS · Bus 2h · Jun 16",
      "LIS → MAD · Iberia IB3174 · Jun 17",
      "MAD → BCN · Renfe AVE · Jun 17",
      "BCN → CDG · Vueling VY8370 · Jun 18",
      "CDG → JFK · Air France AF006 · Jun 18",
    ],
    activities: activities,
    travelers: tripType === "group" ? ["James Donovan (you)", "Maria Santos"] : ["James Donovan (you)"],
  };

  function startRecord() {
    setPhase("recording");
    setTimeout(() => {
      setPhase("processing");
      setTimeout(() => setPhase("parsed"), 2200);
    }, 3000);
  }

  function toggleConfirm(key) {
    setConfirmedFields(prev => ({ ...prev, [key]: true }));
  }

  const allConfirmed = confirmedFields.name && confirmedFields.destination && confirmedFields.dates;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <FlowHeader onBack={onBack} step={4} totalSteps={4} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 28px" }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Narrate your trip</p>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px", lineHeight: 1.5 }}>
          Speak naturally — describe your itinerary, destinations, flights, activities, and travel companions.
        </p>

        {phase !== "parsed" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <button
              onClick={phase === "idle" ? startRecord : undefined}
              style={{
                width: 80, height: 80, borderRadius: "50%", border: "none",
                cursor: phase === "idle" ? "pointer" : "default",
                background: phase === "recording"
                  ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
                  : phase === "processing"
                    ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
                    : "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: phase === "recording"
                  ? "0 0 0 12px rgba(220,38,38,0.12), 0 0 0 22px rgba(220,38,38,0.06)"
                  : "0 6px 20px rgba(30,58,95,0.3)",
                transition: "all 0.25s",
              }}
            >
              {phase === "processing" ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                  <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 19v3M9 22h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <p style={{ fontSize: 13, fontWeight: 600, color: phase === "recording" ? "#dc2626" : phase === "processing" ? "#d97706" : "#374151", margin: 0 }}>
              {phase === "idle" ? "Start" : phase === "recording" ? "Recording..." : "Parsing your trip..."}
            </p>
            {phase === "idle" && (
              <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 14, padding: "10px 14px", width: "100%", boxSizing: "border-box" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Try saying</p>
                <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                  "My trip to Portugal, flying JFK to Lisbon on June 12th on TAP Air Portugal, then a short hop to Porto on June 18th. Maria is coming too."
                </p>
              </div>
            )}
          </div>
        )}

        {phase === "idle" && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Or type your itinerary</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe your trip — flights, hotels, activities, travel companions..."
              rows={4}
              style={{
                width: "100%", padding: "12px 14px",
                background: "#f9fafb", border: "1.5px solid #e5e7eb",
                borderRadius: 14, fontSize: 13, color: "#111",
                resize: "none", fontFamily: "system-ui, -apple-system, sans-serif",
                lineHeight: 1.6, boxSizing: "border-box", outline: "none",
              }}
            />
            {text.length > 0 && (
              <button
                onClick={() => { setPhase("processing"); setTimeout(() => setPhase("parsed"), 1800); }}
                style={{
                  width: "100%", marginTop: 8, padding: "12px 0",
                  background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                  border: "none", borderRadius: 14,
                  fontSize: 14, fontWeight: 700, color: "white", cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(30,58,95,0.25)",
                }}
              >
                Parse itinerary
              </button>
            )}
          </div>
        )}

        {phase === "parsed" && (
          <div>
            {/* Success banner */}
            <div style={{
              background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
              border: "1.5px solid #86efac",
              borderRadius: 16, padding: "12px 14px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l3.5 3.5L12 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#059669", margin: "0 0 1px" }}>Trip narrated successfully</p>
                <p style={{ fontSize: 11, color: "#16a34a", margin: 0 }}>Please confirm the details below before continuing</p>
              </div>
            </div>

            {/* Detected fields — each with confirm toggle */}
            {[
              { key: "name", label: "Trip name", field: PARSED.name },
              { key: "destination", label: "Destination", field: PARSED.destination },
              { key: "dates", label: "Dates", field: PARSED.dates },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", borderRadius: 20, padding: "1px 7px" }}>Auto-detected</span>
                    <button
                      onClick={() => toggleConfirm(f.key)}
                      style={{
                        fontSize: 9, fontWeight: 700, borderRadius: 20, padding: "2px 8px",
                        border: "none", cursor: "pointer",
                        background: confirmedFields[f.key] ? "#f0fdf4" : "#f3f4f6",
                        color: confirmedFields[f.key] ? "#059669" : "#9ca3af",
                      }}
                    >
                      {confirmedFields[f.key] ? "✓ Confirmed" : "Confirm"}
                    </button>
                  </div>
                </div>
                <div style={{
                  background: "#f9fafb",
                  border: `1.5px solid ${confirmedFields[f.key] ? "#bbf7d0" : "#e5e7eb"}`,
                  borderRadius: 12, padding: "10px 12px",
                  fontSize: 13, fontWeight: 600, color: "#111",
                }}>
                  {f.field.value}
                </div>
              </div>
            ))}


            {/* Route segments */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Route segments ({PARSED.segments.length})
                  <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", borderRadius: 20, padding: "1px 7px", textTransform: "none" }}>Auto-detected</span>
                </p>
                {PARSED.segments.length > 3 && (
                  <button
                    onClick={() => setSegmentsExpanded(v => !v)}
                    style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {segmentsExpanded ? "Show less" : `Show all ${PARSED.segments.length}`}
                  </button>
                )}
              </div>
              {(segmentsExpanded ? PARSED.segments : PARSED.segments.slice(0, 3)).map((s, i) => (
                <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 12px", marginBottom: 5, fontSize: 12, color: "#111", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>{i + 1}</div>
                  {s}
                </div>
              ))}
              {!segmentsExpanded && PARSED.segments.length > 3 && (
                <button
                  onClick={() => setSegmentsExpanded(true)}
                  style={{
                    width: "100%", padding: "8px 0",
                    background: "#f3f4f6", border: "1px solid #e5e7eb",
                    borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  + {PARSED.segments.length - 3} more segments
                </button>
              )}
            </div>

            {/* Activities */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Activities ({activities.length})
                  <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", borderRadius: 20, padding: "1px 7px", textTransform: "none" }}>Auto-detected</span>
                </p>
                {activities.length > 6 && (
                  <button
                    onClick={() => setActivitiesExpanded(v => !v)}
                    style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {activitiesExpanded ? "Show less" : `Show all ${activities.length}`}
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 8px", lineHeight: 1.5 }}>
                Activities are suggested based on your destinations. You can accept, remove, or add your own.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {(activitiesExpanded ? activities : activities.slice(0, 6)).map((a) => (
                  <div key={a} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, color: "#374151", background: "#f3f4f6", borderRadius: 20, padding: "4px 6px 4px 10px" }}>
                    {a}
                    <button
                      onClick={() => setActivities((prev) => prev.filter((x) => x !== a))}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "#9ca3af", fontSize: 13, display: "flex", alignItems: "center" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!activitiesExpanded && activities.length > 6 && (
                  <button
                    onClick={() => setActivitiesExpanded(true)}
                    style={{ fontSize: 11, fontWeight: 500, color: "#1d4ed8", background: "#eff6ff", borderRadius: 20, padding: "4px 10px", border: "none", cursor: "pointer" }}
                  >
                    +{activities.length - 6} more
                  </button>
                )}
                {addingActivity ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      autoFocus
                      value={newActivity}
                      onChange={(e) => setNewActivity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newActivity.trim()) {
                          setActivities((prev) => [...prev, newActivity.trim()]);
                          setNewActivity("");
                          setAddingActivity(false);
                        }
                        if (e.key === "Escape") { setAddingActivity(false); setNewActivity(""); }
                      }}
                      placeholder="Type activity…"
                      style={{ fontSize: 11, border: "1.5px solid #1e3a5f", borderRadius: 20, padding: "4px 10px", outline: "none", fontFamily: "inherit", width: 130 }}
                    />
                    <button
                      onClick={() => {
                        if (newActivity.trim()) { setActivities((prev) => [...prev, newActivity.trim()]); }
                        setNewActivity(""); setAddingActivity(false);
                      }}
                      style={{ background: "#1e3a5f", border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "white", cursor: "pointer", fontWeight: 600 }}
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingActivity(true)}
                    style={{ fontSize: 11, fontWeight: 600, color: "#1e3a5f", background: "white", border: "1.5px dashed #d1d5db", borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}
                  >
                    + Add activity
                  </button>
                )}
              </div>
            </div>

            {/* Travelers */}
            {PARSED.travelers.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Travelers ({PARSED.travelers.length})
                  {tripType === "group" && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", borderRadius: 20, padding: "1px 7px", textTransform: "none" }}>Auto-detected</span>}
                </p>
                {PARSED.travelers.map((t, i) => (
                  <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 12px", marginBottom: 5, fontSize: 12, color: "#111", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "#1d4ed8" : "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", flexShrink: 0 }}>
                      {t.split(" ").map(p => p[0]).slice(0, 2).join("")}
                    </div>
                    {t}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <PrimaryBtn label="Start my draft" onClick={onDone} disabled={!allConfirmed} />
            </div>
            <GhostBtn label="Re-narrate" onClick={() => { setPhase("idle"); setConfirmedFields({}); }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EMAIL CONNECTOR SHEET
// ---------------------------------------------------------------------------
function EmailConnectorSheet({ onDismiss }) {
  const providers = [
    { name: "Gmail", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="#dc2626" strokeWidth="1.6"/>
        <path d="M2 6l10 7 10-7" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    )},
    { name: "Outlook / Microsoft 365", color: "#0078d4", bg: "#eff6ff", border: "#bfdbfe", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="9" height="9" rx="1.5" fill="#0078d4" opacity="0.8"/>
        <rect x="13" y="3" width="8" height="9" rx="1.5" fill="#0078d4"/>
        <rect x="3" y="13" width="9" height="8" rx="1.5" fill="#0078d4"/>
        <rect x="13" y="13" width="8" height="8" rx="1.5" fill="#0078d4" opacity="0.6"/>
      </svg>
    )},
    { name: "Apple Mail / iCloud", color: "#374151", bg: "#f3f4f6", border: "#e5e7eb", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="#374151" strokeWidth="1.6"/>
        <path d="M2 6l10 7 10-7" stroke="#374151" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    )},
    { name: "Yahoo Mail", color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="#6d28d9" strokeWidth="1.6"/>
        <path d="M2 6l10 7 10-7" stroke="#6d28d9" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    )},
    { name: "Other / IMAP", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.6"/>
        <path d="M12 8v4l3 2" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )},
  ];

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 800 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 801, padding: "0 18px 36px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "16px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.2px" }}>Connect email</p>
            <button onClick={onDismiss} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1l-8 8" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 16px", lineHeight: 1.5 }}>
            Authorize read-only access to scan booking confirmations and travel receipts. We never store your emails.
          </p>

          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 11, padding: "9px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" fill="#059669" opacity="0.15" stroke="#059669" strokeWidth="1.6"/>
              <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#059669", margin: 0 }}>Read-only · No emails stored · Revoke anytime from settings</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {providers.map((p) => (
              <button
                key={p.name}
                onClick={onDismiss}
                style={{
                  width: "100%", background: "white",
                  border: `1.5px solid ${p.border}`,
                  borderRadius: 14, padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {p.icon}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", flex: 1 }}>{p.name}</span>
                <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
                  <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// STEP 4B — IMPORT
// ---------------------------------------------------------------------------
function ImportScreen({ onDone, onBack }) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [pasteText, setPasteText] = useState("");
  const [pasteExpanded, setPasteExpanded] = useState(false);
  const [emailConnectorOpen, setEmailConnectorOpen] = useState(false);
  const pasteRef = useRef(null);

  const loaded = files.length > 0;

  function handleFileChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }

  function handlePasteBlur() {
    if (!pasteText.trim()) {
      setPasteExpanded(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
      <FlowHeader onBack={onBack} step={4} totalSteps={4} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 100px" }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Trip intake</p>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px", lineHeight: 1.5 }}>Drop files, paste text, or connect your email to pull in booking confirmations</p>

        {/* Security notice */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 10, padding: "8px 12px", marginBottom: 18,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 2l7 4v6c0 5-3.5 9-7 10C8.5 21 5 17 5 12V6l7-4z" fill="#059669" fillOpacity="0.15" stroke="#059669" strokeWidth="1.6"/>
            <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p style={{ fontSize: 11, color: "#065f46", margin: 0, fontWeight: 500 }}>Sensitive information is encrypted and processed securely</p>
        </div>

        {/* Email connect */}
        <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>Connect your email</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {[
            { label: "Import from Gmail", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
            { label: "Import from Yahoo", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
            { label: "Import from other email", color: "#374151", bg: "#f9fafb", border: "#e5e7eb" },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={() => setEmailConnectorOpen(true)}
              style={{
                width: "100%", padding: "11px 14px",
                background: btn.bg, border: `1.5px solid ${btn.border}`,
                borderRadius: 13, fontSize: 13, fontWeight: 600, color: btn.color,
                cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              {btn.label}
              <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
                <path d="M1 1l3 3-3 3" stroke={btn.color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        </div>

        {/* Drop zone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            border: `2px dashed ${dragging ? "#1d4ed8" : loaded ? "#059669" : "#d1d5db"}`,
            borderRadius: 18, padding: "24px 20px 18px", marginBottom: 10,
            background: dragging ? "#eff6ff" : loaded ? "#f0fdf4" : "#fafafa",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <input type="file" accept=".pdf,.txt,.eml,.jpg,.jpeg,.png" multiple style={{ display: "none" }} onChange={handleFileChange} />
          {loaded ? (
            <>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12l5 5L20 7" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#059669", margin: 0 }}>
                {files.length === 1 ? "1 file ready to parse" : `${files.length} files ready to parse`}
              </p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Tap to add more files</p>
            </>
          ) : (
            <>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v12M8 11l4 4 4-4" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>Drop files here</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 6px" }}>Supports PDF, text, email, JPEG, PNG · up to 25 MB</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
                {["Airline booking email", "Hotel confirmation", "Rail ticket receipt", "Travel itinerary"].map((ex) => (
                  <span key={ex} style={{
                    fontSize: 10, fontWeight: 600, color: "#0369a1",
                    background: "#f0f9ff", border: "1px solid #bae6fd",
                    borderRadius: 20, padding: "3px 9px",
                  }}>{ex}</span>
                ))}
              </div>
            </>
          )}
        </label>

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 10 }}>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        </div>

        {/* Paste area — collapsible strip */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", margin: "0 0 6px" }}>Paste booking confirmation text</p>
          {pasteExpanded ? (
            <div>
              <textarea
                ref={pasteRef}
                autoFocus
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                onBlur={handlePasteBlur}
                placeholder="Paste your booking confirmation, email text, or itinerary here..."
                rows={6}
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "#f9fafb", border: "1.5px solid #1d4ed8",
                  borderRadius: 14, fontSize: 13, color: "#111",
                  resize: "none", fontFamily: "system-ui, -apple-system, sans-serif",
                  lineHeight: 1.6, boxSizing: "border-box", outline: "none",
                  transition: "all 0.2s",
                }}
              />
              {pasteText.trim().length > 0 && (
                <button
                  onClick={() => setPasteExpanded(false)}
                  style={{
                    marginTop: 6, fontSize: 11, fontWeight: 600, color: "#6b7280",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  Collapse
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setPasteExpanded(true)}
              style={{
                width: "100%", padding: "10px 14px",
                background: "#f9fafb", border: "1.5px solid #e5e7eb",
                borderRadius: 12, fontSize: 13, color: pasteText.trim() ? "#111" : "#9ca3af",
                cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: pasteText.trim() ? 500 : 400,
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {pasteText.trim() ? pasteText.slice(0, 60) + (pasteText.length > 60 ? "…" : "") : "Paste your booking confirmation text..."}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginLeft: 8 }}>
                <path d="M6 9l6 6 6-6" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        <PrimaryBtn label="Start my draft" onClick={onDone} disabled={!loaded && !pasteText.trim()} />
      </div>

      {emailConnectorOpen && <EmailConnectorSheet onDismiss={() => setEmailConnectorOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 4C — MANUAL
// ---------------------------------------------------------------------------
function ManualScreen({ onDone, onBack }) {
  const [name, setName] = useState("");
  const [dest, setDest] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <FlowHeader onBack={onBack} step={4} totalSteps={4} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 28px" }}>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#111", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Trip details</p>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 22px", lineHeight: 1.5 }}>Start with the basics — you can add route and activities in the workspace</p>

        {[
          { label: "Trip name", value: name, onChange: setName, placeholder: "e.g. Portugal 2026" },
          { label: "Primary destination", value: dest, onChange: setDest, placeholder: "e.g. Lisbon, Portugal" },
          { label: "Start date", value: start, onChange: setStart, placeholder: "e.g. Jun 12, 2026" },
          { label: "End date", value: end, onChange: setEnd, placeholder: "e.g. Jun 24, 2026" },
        ].map((f) => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{f.label}</p>
            <input
              type="text"
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              placeholder={f.placeholder}
              style={{
                width: "100%", padding: "12px 14px",
                background: "#f9fafb", border: "1.5px solid #e5e7eb",
                borderRadius: 13, fontSize: 13, color: "#111",
                boxSizing: "border-box", outline: "none",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            />
          </div>
        ))}

        <div style={{ height: 8 }} />
        <PrimaryBtn label="Start my draft" onClick={onDone} disabled={!name} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DRAFT WORKSPACE
// ---------------------------------------------------------------------------
const DRAFT_TABS = [
  { id: "overview",    label: "Overview" },
  { id: "route",       label: "Route" },
  { id: "activities",  label: "Activities" },
  { id: "travelers",   label: "Travelers" },
  { id: "documents",   label: "Documents" },
  { id: "coverage",    label: "Coverage" },
  { id: "preview",     label: "Preview" },
  { id: "readiness",   label: "Readiness" },
];

const MATURITY_STATES = [
  { id: "initial",    label: "Initial capture" },
  { id: "route",      label: "Route building" },
  { id: "activity",   label: "Activity planning" },
  { id: "readiness",  label: "Readiness review" },
];

function DraftTabBar({ active, onChange }) {
  return (
    <div style={{ display: "flex", overflowX: "auto", gap: 4, padding: "10px 16px 0", flexShrink: 0, borderBottom: "1px solid #f0f0f0", background: "white" }}>
      {DRAFT_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            background: "none", border: "none",
            padding: "6px 10px 8px",
            borderBottom: active === t.id ? "2.5px solid #1e3a5f" : "2.5px solid transparent",
            fontSize: 12, fontWeight: active === t.id ? 700 : 500,
            color: active === t.id ? "#1e3a5f" : "#9ca3af",
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// --- Overview tab ---
function DraftOverviewTab({ tripType, maturityIdx }) {
  const mat = MATURITY_STATES[maturityIdx];
  const types = { solo: "Solo trip", group: "Group trip", corporate: "Corporate trip" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", borderRadius: 18, padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>New trip</p>
            <p style={{ fontSize: 19, fontWeight: 800, color: "white", margin: "0 0 2px", letterSpacing: "-0.3px" }}>Untitled Trip</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>Draft · not yet confirmed</p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: "white", background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "4px 10px", flexShrink: 0 }}>
            {types[tripType]}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {MATURITY_STATES.map((m, i) => (
            <div key={m.id} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= maturityIdx ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: 0 }}>{mat.label}</p>
      </div>

      {/* Draft mode notice */}
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L1.5 11h11L7 1z" fill="#f59e0b"/>
              <path d="M7 5v3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="7" cy="9.5" r="0.6" fill="white"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 2px" }}>Draft mode</p>
            <p style={{ fontSize: 11, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Some advanced analysis is unavailable until the trip is confirmed. Build your draft freely — nothing is locked or irreversible.</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#059669", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Available now</p>
            {["Route building", "Activity planning", "Document upload", "Incident capture"].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l3 3 7-6" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 10, color: "#374151" }}>{f}</span>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Unlocks after confirm</p>
            {["Deep scan", "Full coverage", "Claim routing", "Readiness check"].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="11" rx="2" stroke="#9ca3af" strokeWidth="1.8"/>
                  <path d="M8 11V7a4 4 0 018 0v4" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 10px" }}>Quick actions</p>
        {[
          { icon: "✈", label: "Add first route segment" },
          { icon: "📍", label: "Add an activity" },
          { icon: "👥", label: "Add travelers" },
          { icon: "📄", label: "Upload documents" },
          { icon: "🚨", label: "Start an incident" },
        ].map((a) => (
          <button key={a.label} style={{ width: "100%", background: "none", border: "none", padding: "9px 0", borderTop: "1px solid #f5f5f5", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
            <span style={{ fontSize: 14, width: 22 }}>{a.icon}</span>
            <span style={{ fontSize: 13, color: "#333", flex: 1 }}>{a.label}</span>
            <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
              <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Route tab ---
function DraftRouteTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Route segments</p>
        <div style={{ textAlign: "center", padding: "22px 0" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="6" cy="18" r="2.5" stroke="#9ca3af" strokeWidth="1.7"/>
              <circle cx="18" cy="6" r="2.5" stroke="#9ca3af" strokeWidth="1.7"/>
              <path d="M6 15.5V9a3 3 0 013-3h6" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 2px" }}>No segments yet</p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 14px" }}>Add flight, road, rail, or sea segments</p>
          <button style={{
            padding: "9px 18px", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
            border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "white", cursor: "pointer",
          }}>
            + Add segment
          </button>
        </div>
      </div>

      {/* Humane incident capture notice — not a blocker */}
      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 14, padding: "12px 14px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", margin: "0 0 3px" }}>Something happen on your trip?</p>
        <p style={{ fontSize: 11, color: "#0369a1", margin: "0 0 10px", lineHeight: 1.5 }}>
          You can start an incident and upload evidence now. Full claim routing becomes available once more trip details are confirmed.
        </p>
        <button style={{
          padding: "8px 16px", background: "none",
          border: "1.5px solid #0369a1", borderRadius: 10,
          fontSize: 12, fontWeight: 700, color: "#0369a1", cursor: "pointer",
        }}>
          Start an incident anyway
        </button>
      </div>
    </div>
  );
}

// --- Activities tab ---
function DraftActivitiesTab() {
  const suggestions = [
    { place: "Belém Tower", type: "Landmark", city: "Lisbon", note: "Book tickets in advance" },
    { place: "LX Factory", type: "Market", city: "Lisbon", note: "Sundays are best" },
    { place: "Douro Valley", type: "Wine tour", city: "Porto region", note: "Half-day tour" },
    { place: "Jerónimos Monastery", type: "Landmark", city: "Lisbon", note: "UNESCO site" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Suggestions at top */}
      <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>Suggested for your destination</p>
      {suggestions.map((s) => (
        <div key={s.place} style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>📍</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: "0 0 1px" }}>{s.place}</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{s.type} · {s.city}</p>
          </div>
          <button style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#059669", cursor: "pointer" }}>Add</button>
        </div>
      ))}

      {/* Small info strip */}
      <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 7 }}>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6" stroke="#9ca3af" strokeWidth="1.3"/>
          <path d="M7 6v4" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="7" cy="4.5" r="0.6" fill="#9ca3af"/>
        </svg>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Suggestions come from creator sources and narration. Subgroup assignment available for group trips.</p>
      </div>

      {/* Add manually pinned lower */}
      <button style={{
        width: "100%", padding: "11px 0", background: "none",
        border: "1.5px dashed #d1d5db", borderRadius: 14,
        fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer",
      }}>
        + Add activity manually
      </button>
    </div>
  );
}

// --- Add companion sheet ---
function AddCompanionSheet({ onDismiss }) {
  const [tab, setTab] = useState("email");
  const [emailVal, setEmailVal] = useState("");

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 800 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 801, padding: "0 18px 36px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "16px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#1d4ed8" }}>C</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>Add companion</p>
            </div>
            <button onClick={onDismiss} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1l-8 8" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Tab toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, background: "#f3f4f6", borderRadius: 12, padding: 3 }}>
            {[{ id: "email", label: "By email" }, { id: "contacts", label: "From contacts" }].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: "7px 0", border: "none", borderRadius: 9, cursor: "pointer",
                  background: tab === t.id ? "white" : "none",
                  fontSize: 12, fontWeight: 600,
                  color: tab === t.id ? "#111" : "#6b7280",
                  boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}
              >{t.label}</button>
            ))}
          </div>

          {tab === "email" ? (
            <div>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.5 }}>
                Enter your companion's email to add them as a placeholder. You can send a formal invite later from the Travelers tab.
              </p>
              <input
                type="email"
                value={emailVal}
                onChange={(e) => setEmailVal(e.target.value)}
                placeholder="companion@email.com"
                style={{
                  width: "100%", padding: "11px 13px",
                  background: "#f9fafb", border: "1.5px solid #e5e7eb",
                  borderRadius: 12, fontSize: 13, color: "#111",
                  boxSizing: "border-box", outline: "none", marginBottom: 12,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              />
              <button
                disabled={!emailVal.includes("@")}
                onClick={onDismiss}
                style={{
                  width: "100%", padding: "12px 0",
                  background: emailVal.includes("@") ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)" : "#e5e7eb",
                  border: "none", borderRadius: 13,
                  fontSize: 13, fontWeight: 700, color: emailVal.includes("@") ? "white" : "#9ca3af",
                  cursor: emailVal.includes("@") ? "pointer" : "default",
                }}
              >
                Add companion
              </button>
            </div>
          ) : (
            <div>
              <div style={{ background: "#f9fafb", border: "1.5px dashed #d1d5db", borderRadius: 14, padding: "28px 16px", textAlign: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.02 1.23a2 2 0 012-2.18h3A2 2 0 017 1.05c.29 1.55.78 3.06 1.43 4.5a2 2 0 01-.45 2.11L6.91 8.73a16 16 0 006.36 6.36l1.07-1.07a2 2 0 012.11-.45c1.44.65 2.95 1.14 4.5 1.43a2 2 0 011.05 2.92z" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>Import from contacts</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 14px", lineHeight: 1.5 }}>Access your phone or device contacts to quickly add a companion. This flow is coming soon.</p>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 20, padding: "3px 10px" }}>Coming soon</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// --- Travelers tab ---
function DraftTravelersTab({ tripType }) {
  const isSolo = tripType === "solo";
  const [addCompanionOpen, setAddCompanionOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
      {/* Organizer */}
      <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Organizer</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>JD</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>James Donovan</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>You · Full edit access · All segments</p>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 9px" }}>Organizer</span>
        </div>
      </div>

      {/* Future companions (solo) */}
      {isSolo && (
        <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Companions</p>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#1d4ed8" }}>C</div>
          </div>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 12px", lineHeight: 1.5 }}>Add placeholder companions for itinerary planning. You can fill in details later.</p>
          <button
            onClick={() => setAddCompanionOpen(true)}
            style={{ padding: "8px 14px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}
          >
            + Add companion
          </button>
        </div>
      )}

      {/* Group invite */}
      {!isSolo && (
        <>
          <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Invite travelers</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="email" placeholder="email@example.com" style={{ flex: 1, padding: "10px 12px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 12, outline: "none" }} />
              <button style={{ padding: "10px 14px", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "white", cursor: "pointer" }}>Invite</button>
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Or share a link · Roles assigned after they accept</p>
          </div>

          <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Companions</p>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#1d4ed8" }}>C</div>
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 10px" }}>Add placeholder travelers you plan to invite later</p>
            <button onClick={() => setAddCompanionOpen(true)} style={{ padding: "8px 14px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>+ Add companion</button>
          </div>

          <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Role reference</p>
            {[
              { role: "Organizer", badge: "#1d4ed8", badgeBg: "#eff6ff", badgeBorder: "#bfdbfe", desc: "Full edit. Creates trip, manages structure." },
              { role: "Co-organizer", badge: "#059669", badgeBg: "#f0fdf4", badgeBorder: "#bbf7d0", desc: "Paid tier. Can edit shared route and activities." },
              { role: "Participant", badge: "#6b7280", badgeBg: "#f3f4f6", badgeBorder: "#e5e7eb", desc: "Read-only by default. Free tier." },
            ].map((r) => (
              <div key={r.role} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: r.badge, background: r.badgeBg, border: `1px solid ${r.badgeBorder}`, borderRadius: 20, padding: "2px 8px", flexShrink: 0, marginTop: 1 }}>{r.role}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{r.desc}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Trusted ally / emergency contact */}
      <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Trusted ally / emergency contact</p>
          <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af", background: "#f3f4f6", borderRadius: 20, padding: "2px 8px" }}>Optional</span>
        </div>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 10px", lineHeight: 1.5 }}>Someone to notify or escalate to if something goes wrong. Not required to proceed.</p>
        <button style={{ padding: "8px 14px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>+ Add trusted ally</button>
      </div>

      {addCompanionOpen && <AddCompanionSheet onDismiss={() => setAddCompanionOpen(false)} />}
    </div>
  );
}

// --- Documents tab ---
function DocRow({ label, hint, abbr, onEmailImport }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(label);
  const [menuOpen, setMenuOpen] = useState(false);

  function saveEdit() {
    setEditing(false);
  }

  const abbrColors = {
    CE: { color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
    ER: { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
    RC: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    UC: { color: "#374151", bg: "#f3f4f6", border: "#e5e7eb" },
  };
  const abbrStyle = abbr ? abbrColors[abbr] || abbrColors.UC : null;

  return (
    <div style={{ background: "white", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "10px 13px", marginBottom: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {abbr ? (
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: abbrStyle.bg, border: `1px solid ${abbrStyle.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: abbrStyle.color, letterSpacing: "0.03em",
          }}>{abbr}</div>
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="2" width="16" height="20" rx="3" stroke="#9ca3af" strokeWidth="1.7"/>
              <path d="M8 9h8M8 13h5M8 17h3" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
        )}
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                autoFocus
                style={{ flex: 1, padding: "5px 8px", border: "1.5px solid #1d4ed8", borderRadius: 8, fontSize: 12, outline: "none" }}
              />
              <button onClick={saveEdit} style={{ padding: "5px 10px", background: "#1d4ed8", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "white", cursor: "pointer" }}>Save</button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 1px" }}>{editVal}</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{hint}</p>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <label style={{ padding: "5px 10px", background: "#f3f4f6", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" style={{ display: "none" }} onChange={() => {}} />
            Upload
          </label>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ width: 28, height: 28, background: "none", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="2.5" r="1.2" fill="#9ca3af"/>
                <circle cx="7" cy="7" r="1.2" fill="#9ca3af"/>
                <circle cx="7" cy="11.5" r="1.2" fill="#9ca3af"/>
              </svg>
            </button>
            {menuOpen && (
              <div style={{
                position: "absolute", right: 0, top: 32, zIndex: 50,
                background: "white", border: "1px solid #e5e7eb", borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 160, overflow: "hidden",
              }}>
                {[
                  { label: "Edit label", action: () => { setEditing(true); setMenuOpen(false); } },
                  { label: "Email import", action: () => { setMenuOpen(false); if (onEmailImport) onEmailImport(); } },
                  { label: "Forward to trip inbox", action: () => setMenuOpen(false) },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{ width: "100%", background: "none", border: "none", padding: "10px 14px", fontSize: 12, color: "#374151", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f5f5f5" }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionalDocRow({ label, hint, abbr, onEmailImport }) {
  const [editLabel, setEditLabel] = useState(label);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(label);

  const abbrColors = {
    CE: { color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
    ER: { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
    RC: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    UC: { color: "#374151", bg: "#f3f4f6", border: "#e5e7eb" },
  };
  const abbrStyle = abbr ? abbrColors[abbr] || abbrColors.UC : null;

  return (
    <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 12, padding: "9px 12px", marginBottom: 5, display: "flex", alignItems: "center", gap: 10 }}>
      {abbr ? (
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: abbrStyle.bg, border: `1px solid ${abbrStyle.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 800, color: abbrStyle.color,
        }}>{abbr}</div>
      ) : (
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="2" width="16" height="20" rx="3" stroke="#9ca3af" strokeWidth="1.7"/>
            <path d="M8 9h8M8 13h5M8 17h3" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>
      )}
      <div style={{ flex: 1 }}>
        {editing ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (() => { setEditLabel(editVal); setEditing(false); })()}
              autoFocus
              style={{ flex: 1, padding: "4px 8px", border: "1.5px solid #1d4ed8", borderRadius: 7, fontSize: 12, outline: "none" }}
            />
            <button onClick={() => { setEditLabel(editVal); setEditing(false); }} style={{ padding: "4px 9px", background: "#1d4ed8", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, color: "white", cursor: "pointer" }}>OK</button>
          </div>
        ) : (
          <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: 0 }}>{editLabel}</p>
        )}
        {hint && <p style={{ fontSize: 10, color: "#9ca3af", margin: "1px 0 0" }}>{hint}</p>}
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <label style={{ padding: "4px 9px", background: "#f3f4f6", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" style={{ display: "none" }} onChange={() => {}} />
          Upload
        </label>
        <button
          onClick={() => { if (onEmailImport) onEmailImport(); }}
          style={{ padding: "4px 9px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7, fontSize: 11, fontWeight: 600, color: "#0369a1", cursor: "pointer" }}
        >
          Email
        </button>
        <button onClick={() => setEditing(!editing)} style={{ width: 26, height: 26, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function DraftDocumentsTab() {
  const [emailConnectorOpen, setEmailConnectorOpen] = useState(false);

  const required = [
    { label: "Passport & ID", hint: "Upload PDF, photo, or scan" },
    { label: "Travel insurance or benefit guide", hint: "Policy card, PDF, or credit card guide" },
    { label: "Flight itinerary", hint: "Booking confirmation or e-ticket" },
    { label: "Visa & entry documents", hint: "Visa letter, e-visa, entry waiver", abbr: "ER" },
  ];

  const optional = [
    { label: "Activity confirmations", hint: "Tour, event, or attraction bookings", abbr: "CE" },
    { label: "Car rental confirmation", hint: "Rental agreement or booking", abbr: "RC" },
    { label: "Transportation bookings", hint: "Rail pass, ferry ticket, or other ground transport", abbr: "UC" },
    { label: "Receipts", hint: "Expense or reimbursement records" },
    { label: "Emergency files", hint: "Medical letters, prescriptions, contacts" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Security reminder */}
      <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "1px solid #86efac", borderRadius: 12, padding: "9px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "white", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" fill="#059669" opacity="0.15" stroke="#059669" strokeWidth="1.7"/>
            <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p style={{ fontSize: 11, color: "#166534", margin: 0, lineHeight: 1.5 }}>
          <strong>Reminder:</strong> All documents you upload are secured with 256-bit encryption and never shared without your consent.
        </p>
      </div>

      {/* Section 1: Required */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Required for readiness</p>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 20, padding: "1px 7px" }}>0 / 4</span>
        </div>
        {required.map((d) => (
          <DocRow key={d.label} label={d.label} hint={d.hint} abbr={d.abbr} onEmailImport={() => setEmailConnectorOpen(true)} />
        ))}
      </div>

      {/* Section 2: Import options info strip */}
      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", margin: "0 0 4px" }}>Import options</p>
        <p style={{ fontSize: 11, color: "#0369a1", margin: "0 0 8px", lineHeight: 1.5 }}>
          Each row supports file upload (PDF, JPG, PNG, text) and email import. Use the Upload button or three-dot menu, or tap Email on optional rows.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {["Upload PDF / JPG / PNG", "Email import", "Text file"].map((opt) => (
            <span key={opt} style={{ fontSize: 10, fontWeight: 600, color: "#0369a1", background: "#e0f2fe", borderRadius: 20, padding: "3px 9px" }}>{opt}</span>
          ))}
        </div>
      </div>

      {/* Section 3: Optional supporting documents */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Other trip documents</p>
        {optional.map((d) => (
          <OptionalDocRow key={d.label} label={d.label} hint={d.hint} abbr={d.abbr} onEmailImport={() => setEmailConnectorOpen(true)} />
        ))}
        <button style={{
          width: "100%", padding: "10px 0", background: "none",
          border: "1.5px dashed #d1d5db", borderRadius: 12,
          fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer", marginTop: 6,
        }}>
          + Add document
        </button>
      </div>

      {emailConnectorOpen && <EmailConnectorSheet onDismiss={() => setEmailConnectorOpen(false)} />}
    </div>
  );
}

// --- Coverage advisory tab ---
function DraftCoverageTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, padding: "14px" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M7 1L1.5 11h11L7 1z" fill="#f59e0b"/>
            <path d="M7 5v3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="7" cy="9.5" r="0.6" fill="white"/>
          </svg>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", margin: "0 0 2px" }}>Advisory panel — draft mode</p>
            <p style={{ fontSize: 11, color: "#b45309", margin: 0, lineHeight: 1.5 }}>
              Coverage analysis is informational only at this stage. No coverage has been activated or modified.
            </p>
          </div>
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 10px" }}>Coverage advisory</p>
        {[
          { type: "Medical & Emergency", note: "Verify limits for destination country" },
          { type: "Trip Cancellation", note: "Check policy purchase deadline" },
          { type: "Baggage Loss", note: "Confirm coverage with your carrier" },
          { type: "Flight Delay", note: "Often tied to credit card benefits" },
        ].map((c) => (
          <div key={c.type} style={{ borderTop: "1px solid #f5f5f5", padding: "9px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#111", margin: "0 0 1px" }}>{c.type}</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{c.note}</p>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>Advisory</span>
          </div>
        ))}
      </div>

      <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Confirm trip to unlock full coverage analysis</p>
        <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.5 }}>
          Complete the readiness checklist and confirm your trip to unlock detailed coverage alignment and gap analysis.
        </p>
        <button style={{ padding: "9px 16px", background: "none", border: "1.5px solid #1e3a5f", borderRadius: 10, fontSize: 12, fontWeight: 700, color: "#1e3a5f", cursor: "pointer" }}>
          Go to Readiness
        </button>
      </div>
    </div>
  );
}

// --- Preview tab ---
function DraftPreviewTab({ tripType }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", borderRadius: 18, padding: "18px" }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Trip preview</p>
        <p style={{ fontSize: 19, fontWeight: 800, color: "white", margin: "0 0 4px", letterSpacing: "-0.3px" }}>Untitled Trip</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0 }}>No dates set yet · {tripType === "solo" ? "Solo" : tripType === "group" ? "Group" : "Corporate"}</p>
      </div>
      <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "14px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 12px" }}>Draft summary</p>
        {[
          { label: "Route segments", value: "0 added", alert: true },
          { label: "Activities", value: "0 added", alert: false },
          { label: "Travelers", value: "1 (you)", alert: false },
          { label: "Documents", value: "0 / 4 required", alert: true },
          { label: "Coverage", value: "Advisory only", alert: false },
        ].map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f5f5f5", padding: "9px 0" }}>
            <span style={{ fontSize: 12, color: "#555" }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: r.alert ? "#d97706" : "#059669" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Readiness tab ---
function DraftReadinessTab() {
  const blockers = [
    { id: "route", label: "No route segments added", fix: "Go to Route tab" },
    { id: "docs", label: "Required documents missing (0 / 4)", fix: "Go to Documents tab" },
    { id: "dates", label: "Trip dates not set", fix: "Edit trip details" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 4px" }}>A few things to sort out first</p>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>Resolve the items below to confirm your trip and unlock full analysis and claim routing.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {blockers.map((b) => (
          <div key={b.id} style={{ background: "white", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6.5" fill="#dc2626"/>
                <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#111", margin: "0 0 1px" }}>{b.label}</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{b.fix}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 8 }} />
      <button
        style={{
          width: "100%", padding: "13px 0",
          background: "#e5e7eb",
          border: "none", borderRadius: 14,
          fontSize: 14, fontWeight: 700, color: "#9ca3af",
          cursor: "not-allowed",
        }}
        disabled
      >
        Confirm trip ready
      </button>
      <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: 0 }}>
        {blockers.length} item{blockers.length > 1 ? "s" : ""} remaining
      </p>
    </div>
  );
}

// --- Draft workspace shell ---
function DraftWorkspace({ tripType, onBack }) {
  const [activeTab, setActiveTab] = useState("overview");
  const maturityIdx = 0;

  const renderTab = () => {
    switch (activeTab) {
      case "overview":   return <DraftOverviewTab tripType={tripType} maturityIdx={maturityIdx} />;
      case "route":      return <DraftRouteTab />;
      case "activities": return <DraftActivitiesTab />;
      case "travelers":  return <DraftTravelersTab tripType={tripType} />;
      case "documents":  return <DraftDocumentsTab />;
      case "coverage":   return <DraftCoverageTab />;
      case "preview":    return <DraftPreviewTab tripType={tripType} />;
      case "readiness":  return <DraftReadinessTab />;
      default:           return <DraftOverviewTab tripType={tripType} maturityIdx={maturityIdx} />;
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: "white", padding: "10px 16px 0", borderBottom: "1px solid #f5f5f5", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button onClick={onBack} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="7" height="11" viewBox="0 0 8 12" fill="none">
              <path d="M6 1L2 6l4 5" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.2px" }}>Untitled Trip</p>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 20, padding: "2px 8px" }}>Draft</span>
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
              {tripType === "solo" ? "Solo" : tripType === "group" ? "Group" : "Corporate"} · Initial capture
            </p>
          </div>
        </div>
      </div>

      <DraftTabBar active={activeTab} onChange={setActiveTab} />

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 100px", background: "#f5f5f7" }}>
        {renderTab()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROOT FLOW CONTROLLER
// ---------------------------------------------------------------------------
export default function NewTripFlow({ onClose }) {
  const [step, setStep] = useState("type_select");
  const [tripType, setTripType] = useState(null);

  function selectType(type) {
    setTripType(type);
    if (type === "corporate") setStep("corporate_info");
    else if (type === "group") setStep("group_info");
    else setStep("build_method");
  }

  function selectBuildMethod(method) {
    if (method === "narrate") setStep("narrate");
    else if (method === "import") setStep("import");
    else if (method === "creators") setStep("build_method");
    else setStep("manual");
  }

  function goBack() {
    if (step === "narrate" || step === "import" || step === "manual") setStep("build_method");
    else if (step === "build_method") setStep(tripType === "group" ? "group_info" : tripType === "corporate" ? "corporate_info" : "type_select");
    else if (step === "group_info" || step === "corporate_info") setStep("type_select");
    else onClose();
  }

  if (step === "draft_workspace") {
    return <DraftWorkspace tripType={tripType} onBack={onClose} />;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "white" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {step === "type_select" && <TripTypeScreen onSelect={selectType} onClose={onClose} hasCorporate={false} />}
        {step === "group_info" && <GroupInfoScreen onContinue={() => setStep("build_method")} onBack={goBack} />}
        {step === "corporate_info" && <CorporateInfoScreen onContinue={() => setStep("build_method")} onBack={goBack} />}
        {step === "build_method" && <BuildMethodScreen onSelect={selectBuildMethod} onBack={goBack} />}
        {step === "narrate" && <NarrateScreen onDone={() => setStep("draft_workspace")} onBack={goBack} tripType={tripType} />}
        {step === "import" && <ImportScreen onDone={() => setStep("draft_workspace")} onBack={goBack} />}
        {step === "manual" && <ManualScreen onDone={() => setStep("draft_workspace")} onBack={goBack} />}
      </div>
    </div>
  );
}
