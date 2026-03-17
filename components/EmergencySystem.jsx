import { useState, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// TRIP DATA — single source of truth shared across lock screen + in-app
// In production this comes from the user's active trip record in Supabase.
// Any trip extension / date change flows from here automatically.
// ---------------------------------------------------------------------------
export const ACTIVE_TRIP = {
  city: "Lisbon",
  country: "Portugal",
  countryCode: "PT",          // ISO 3166-1 alpha-2
  departs: "Jun 12",
  returns: "Jun 24",
  duration: "12 days",
  isProtected: true,
};

// ---------------------------------------------------------------------------
// EMBASSY REGISTRY
// Tiered lookup: exact city match → country match → regional fallback → global
// Last-known GPS coordinates resolve to the nearest entry.
// In production this table is seeded from the State Dept. directory and
// refreshed nightly via a Supabase edge function.
// When network is unavailable the app serves from locally cached data.
// ---------------------------------------------------------------------------
const EMBASSY_REGISTRY = [
  {
    country: "Portugal",
    countryCode: "PT",
    cities: ["Lisbon"],
    label: "US Embassy Lisbon",
    number: "+351 217 273 300",
    note: "Consular emergency line · Lisbon",
    tier: 1,
  },
  {
    country: "Portugal",
    countryCode: "PT",
    cities: ["Porto", "Faro"],
    label: "US Consulate Porto",
    number: "+351 222 043 800",
    note: "Consular emergency line · Porto",
    tier: 2,
  },
  {
    country: "Spain",
    countryCode: "ES",
    cities: ["Madrid"],
    label: "US Embassy Madrid",
    number: "+34 91 587 2200",
    note: "Consular emergency line · Madrid",
    tier: 1,
  },
  {
    country: "France",
    countryCode: "FR",
    cities: ["Paris"],
    label: "US Embassy Paris",
    number: "+33 1 43 12 22 22",
    note: "Consular emergency line · Paris",
    tier: 1,
  },
  {
    country: "United Kingdom",
    countryCode: "GB",
    cities: ["London"],
    label: "US Embassy London",
    number: "+44 20 7499 9000",
    note: "Consular emergency line · London",
    tier: 1,
  },
  {
    country: "Germany",
    countryCode: "DE",
    cities: ["Berlin"],
    label: "US Embassy Berlin",
    number: "+49 30 8305 0",
    note: "Consular emergency line · Berlin",
    tier: 1,
  },
  {
    countryCode: "__GLOBAL__",
    label: "US State Dept. (global)",
    number: "+1-202-501-4444",
    note: "Global 24/7 emergency line",
    tier: 99,
  },
];

// Resolve the best embassy entry for a given city / country.
// Priority: city match (tier 1) → city match (tier 2) → country match → global.
function resolveEmbassy(city, countryCode) {
  const cityMatch = EMBASSY_REGISTRY.filter(
    (e) => e.countryCode === countryCode && e.cities && e.cities.includes(city)
  ).sort((a, b) => a.tier - b.tier)[0];

  if (cityMatch) return { ...cityMatch, resolved: "city" };

  const countryMatch = EMBASSY_REGISTRY.filter(
    (e) => e.countryCode === countryCode && e.tier === 1
  )[0];

  if (countryMatch) return { ...countryMatch, resolved: "country" };

  return {
    ...EMBASSY_REGISTRY.find((e) => e.countryCode === "__GLOBAL__"),
    resolved: "global",
  };
}

// ---------------------------------------------------------------------------
// LOCAL EMERGENCY NUMBERS by country
// In production this table is much larger and auto-updates from SIM MCC/MNC.
// ---------------------------------------------------------------------------
const LOCAL_EMERGENCY = {
  PT: { ambulance: "112", police: "213 421 634", policeNote: "Lisbon metropolitan police" },
  ES: { ambulance: "112", police: "091", policeNote: "Spain national police" },
  FR: { ambulance: "15 / 112", police: "17", policeNote: "French national police" },
  GB: { ambulance: "999", police: "999", policeNote: "UK emergency services" },
  DE: { ambulance: "112", police: "110", policeNote: "German federal police" },
  US: { ambulance: "911", police: "911", policeNote: "Local emergency services" },
  __DEFAULT__: { ambulance: "112", police: "112", policeNote: "International emergency" },
};

function getLocalEmergency(countryCode) {
  return LOCAL_EMERGENCY[countryCode] || LOCAL_EMERGENCY["__DEFAULT__"];
}

// ---------------------------------------------------------------------------
// BUILD CALL BUTTONS dynamically from trip location
// ---------------------------------------------------------------------------
function buildCallButtons(trip) {
  const local = getLocalEmergency(trip.countryCode);
  const embassy = resolveEmbassy(trip.city, trip.countryCode);

  return [
    {
      id: "ambulance",
      label: "Ambulance / All emergency",
      number: local.ambulance,
      note: `${trip.country} · works across EU & most countries`,
      color: "#dc2626",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 4h4l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v4a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2z"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: "police",
      label: "Police (local)",
      number: local.police,
      note: local.policeNote,
      color: "#1d4ed8",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: "claims",
      label: "Travel insurance claims",
      number: "+1-800-284-8300",
      note: "Your primary travel plan · 24/7 claims line",
      color: "#059669",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="18" height="13" rx="2" stroke="white" strokeWidth="2"/>
          <path d="M3 10h18" stroke="white" strokeWidth="2"/>
          <rect x="6" y="13" width="5" height="2" rx="1" fill="white"/>
        </svg>
      ),
    },
    {
      id: "embassy",
      label: embassy.label,
      number: embassy.number,
      note: embassy.note,
      color: "#b45309",
      resolvedBy: embassy.resolved,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 21V7l9-4 9 4v14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 21v-6h6v6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 21h20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// SAFETY CARD DATA
// ---------------------------------------------------------------------------
function buildSafetyTabs(trip) {
  const local = getLocalEmergency(trip.countryCode);
  const embassy = resolveEmbassy(trip.city, trip.countryCode);

  return {
    numbers: [
      { label: `All emergency (${trip.countryCode === "GB" ? "UK" : "EU"})`, value: local.ambulance, isCall: true },
      { label: `Police · ${trip.city}`, value: local.police, isCall: true },
      { label: "Travel insurance claims", value: "+1-800-284-8300", isCall: true },
      { label: embassy.label, value: embassy.number, isCall: true, resolvedBy: embassy.resolved },
    ],
    coverage: [
      { label: "Medical emergency", value: "$250,000" },
      { label: "Medical evacuation", value: "Included" },
      { label: "Trip cancellation", value: "$10,000" },
      { label: "Baggage loss", value: "$2,500" },
      { label: "Flight delay (4h+)", value: "$500" },
      { label: "Secondary card coverage", value: "Delay & baggage" },
    ],
  };
}

// ---------------------------------------------------------------------------
// RESOLUTION BADGE
// ---------------------------------------------------------------------------
function ResolutionBadge({ resolvedBy }) {
  if (!resolvedBy) return null;
  const labels = {
    city: { text: "City match", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
    country: { text: "Country match", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    global: { text: "Global fallback", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  };
  const s = labels[resolvedBy] || labels.city;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color: s.color,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 20, padding: "2px 7px",
    }}>
      {s.text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BOTTOM SHEET — with auto-dismiss (5s for SOS view) and drag-to-dismiss
// ---------------------------------------------------------------------------
function BottomSheet({ view, onDismiss, trip }) {
  const [safetyTab, setSafetyTab] = useState("numbers");
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);

  useEffect(() => {
    if (view) {
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
      setDragY(0);
    }
  }, [view]);

  const handlePointerDown = (e) => {
    dragStart.current = e.clientY;
  };

  const handlePointerMove = (e) => {
    if (dragStart.current === null) return;
    const delta = e.clientY - dragStart.current;
    if (delta > 0) setDragY(delta);
  };

  const handlePointerUp = () => {
    if (dragY > 80) {
      onDismiss();
    } else {
      setDragY(0);
    }
    dragStart.current = null;
  };

  if (!view) return null;

  const isSOS = view === "sos";
  const sheetStyle = {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    background: "white",
    borderRadius: isSOS ? "0" : "20px 20px 0 0",
    zIndex: 100,
    transform: mounted ? `translateY(${dragY}px)` : "translateY(100%)",
    transition: dragY > 0 ? "none" : "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
    height: isSOS ? "100%" : undefined,
    maxHeight: isSOS ? "100%" : "78%",
    top: isSOS ? 0 : undefined,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 -4px 32px rgba(0,0,0,0.12)",
    touchAction: "none",
  };

  return (
    <>
      <div
        onClick={onDismiss}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 99,
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
      />
      <div
        style={sheetStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0, cursor: "grab" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        {view === "sos" && <SOSContent onDismiss={onDismiss} trip={trip} />}
        {view === "card" && (
          <SafetyCardContent
            activeTab={safetyTab}
            onTabChange={setSafetyTab}
            onDismiss={onDismiss}
            trip={trip}
          />
        )}
        {view === "protected" && <ProtectedContent onDismiss={onDismiss} trip={trip} />}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SOS CONTENT
// ---------------------------------------------------------------------------
function SOSContent({ onDismiss, trip, cancelAutoTimer }) {
  const callButtons = buildCallButtons(trip);

  return (
    <>
      <div style={{ padding: "6px 20px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#fef2f2",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M10 3v7" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round"/>
              <circle cx="10" cy="14.5" r="1.3" fill="#dc2626"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.2px" }}>
              Get help now
            </p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Tap a number to dial immediately</p>
          </div>
        </div>

        {/* Last-known location indicator */}
        <div style={{
          marginTop: 10,
          display: "flex", alignItems: "center", gap: 6,
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 8, padding: "7px 12px",
        }}>
          <svg width="11" height="13" viewBox="0 0 12 14" fill="none">
            <path d="M6 0C3.79 0 2 1.79 2 4c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4zm0 5.5C5.17 5.5 4.5 4.83 4.5 4S5.17 2.5 6 2.5 7.5 3.17 7.5 4 6.83 5.5 6 5.5z" fill="#16a34a"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 500, color: "#15803d" }}>
            Last known location: {trip.city}, {trip.country}
          </span>
          <span style={{ fontSize: 10, color: "#4ade80", marginLeft: "auto", fontWeight: 500 }}>Live</span>
        </div>
      </div>

      <div style={{ overflowY: "auto", padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {callButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => { if (cancelAutoTimer) cancelAutoTimer(); window.open(`tel:${btn.number}`); onDismiss(); }}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "white", border: "1.5px solid #f0f0f0",
              borderRadius: 14, padding: "14px 16px",
              cursor: "pointer", textAlign: "left", width: "100%",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: btn.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              {btn.icon}
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#666", margin: 0 }}>{btn.label}</p>
                {btn.resolvedBy && <ResolutionBadge resolvedBy={btn.resolvedBy} />}
              </div>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.3px", lineHeight: 1.1 }}>
                {btn.number}
              </p>
              <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{btn.note}</p>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: btn.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h4l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v4a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2z" fill="white"/>
              </svg>
            </div>
          </button>
        ))}

        <button
          onClick={onDismiss}
          style={{
            width: "100%", marginTop: 4, background: "none",
            border: "1.5px solid #e5e5e5", borderRadius: 12,
            color: "#888", fontSize: 14, cursor: "pointer",
            padding: "12px 0", fontWeight: 500,
          }}
        >
          Dismiss
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SAFETY CARD CONTENT
// ---------------------------------------------------------------------------
function SafetyCardContent({ activeTab, onTabChange, onDismiss, trip }) {
  const safetyTabs = buildSafetyTabs(trip);

  return (
    <>
      <div style={{ padding: "6px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.2px" }}>
              Trip safety card
            </p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
              {trip.city} · {trip.departs}–{trip.returns}
            </p>
          </div>
        </div>

        <div style={{
          display: "flex", gap: 4,
          background: "#f3f4f6", borderRadius: 10, padding: 3,
          marginBottom: 14,
        }}>
          {[
            { key: "numbers", label: "Emergency numbers" },
            { key: "coverage", label: "Your coverage" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                flex: 1, padding: "7px 0", border: "none", cursor: "pointer",
                borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: activeTab === tab.key ? "white" : "transparent",
                color: activeTab === tab.key ? "#111" : "#888",
                boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowY: "auto", padding: "0 16px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {safetyTabs[activeTab].map((row, i) => (
            <div
              key={i}
              onClick={row.isCall ? () => window.open(`tel:${row.value}`) : undefined}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "11px 14px",
                background: "#f9f9f9",
                borderRadius: 10,
                cursor: row.isCall ? "pointer" : "default",
                border: "1px solid #f0f0f0",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, color: "#555", fontWeight: 400 }}>{row.label}</span>
                {row.resolvedBy && <ResolutionBadge resolvedBy={row.resolvedBy} />}
                {activeTab === "coverage" && (
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>Allianz Travel · Policy #TPG-2026-4421</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: row.isCall ? "#2563eb" : "#111" }}>
                  {row.value}
                </span>
                {row.isCall && (
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: "#eff6ff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                      <path d="M4 4h4l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v4a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2z" fill="#2563eb"/>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          style={{
            width: "100%", marginTop: 12, background: "none",
            border: "1.5px solid #e5e5e5", borderRadius: 12,
            color: "#888", fontSize: 14, cursor: "pointer",
            padding: "12px 0", fontWeight: 500,
          }}
        >
          Close
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PROTECTED CONTENT — shown when user taps the "Protected" pill on lock screen
// No insurer names. Just confirms protection is active.
// ---------------------------------------------------------------------------
function ProtectedContent({ onDismiss, trip }) {
  return (
    <>
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
            border: "2px solid #4ade80",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
                fill="rgba(34,197,94,0.2)" stroke="#16a34a" strokeWidth="1.8"/>
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: "0 0 4px", letterSpacing: "-0.3px" }}>
              Trip is protected
            </p>
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
              {trip.city}, {trip.country} · {trip.departs} – {trip.returns}
            </p>
          </div>
        </div>

        <div style={{ margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Medical emergency", icon: "🏥", value: "Covered" },
            { label: "Medical evacuation", icon: "🚁", value: "Covered" },
            { label: "Trip cancellation", icon: "✈️", value: "Covered" },
            { label: "Baggage & delay", icon: "🧳", value: "Covered" },
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px",
              background: "#f9fafb", borderRadius: 10, border: "1px solid #f0f0f0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{row.icon}</span>
                <span style={{ fontSize: 13, color: "#444", fontWeight: 400 }}>{row.label}</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#16a34a",
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 20, padding: "3px 9px",
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <button
          onClick={onDismiss}
          style={{
            width: "100%", background: "none",
            border: "1.5px solid #e5e5e5", borderRadius: 12,
            color: "#888", fontSize: 14, cursor: "pointer",
            padding: "12px 0", fontWeight: 500,
          }}
        >
          Close
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// EMERGENCY SYSTEM — main export
// Props:
//   lockScreen       boolean  — renders the pill in lock screen style
//   onProtectedTap   fn       — optional callback when protected badge is tapped
//   externalView     string   — controlled sheet view (lock screen uses this to hoist)
//   onViewChange     fn       — callback when pill buttons are clicked (lock screen uses this)
// ---------------------------------------------------------------------------
export { BottomSheet };

export default function EmergencySystem({ lockScreen = false, onProtectedTap, externalView, onViewChange }) {
  const [internalView, setInternalView] = useState(null);
  const trip = ACTIVE_TRIP;

  const isControlled = typeof onViewChange === "function";
  const view = isControlled ? externalView : internalView;

  function toggle(target) {
    const next = view === target ? null : target;
    if (isControlled) {
      onViewChange(next);
    } else {
      setInternalView(next);
    }
  }

  function closeSheet() {
    if (isControlled) {
      onViewChange(null);
    } else {
      setInternalView(null);
    }
  }

  const pillStyle = lockScreen
    ? {
        position: "absolute",
        bottom: 22, left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex", alignItems: "center",
        borderRadius: 50,
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        overflow: "hidden",
        height: 50,
      }
    : {
        position: "absolute",
        bottom: 90, left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex", alignItems: "center",
        background: "white",
        borderRadius: 50,
        boxShadow: "0 4px 20px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)",
        overflow: "hidden",
        height: 46,
      };

  const safetyCardBg = lockScreen
    ? (view === "card" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.14)")
    : (view === "card" ? "#f3f4f6" : "white");

  const safetyCardTextColor = lockScreen ? "white" : "#333";
  const safetyCardIconStroke = lockScreen ? "rgba(255,255,255,0.9)" : "#444";
  const safetyCardIconFill = lockScreen ? "rgba(255,255,255,0.9)" : "#444";

  return (
    <>
      <div style={pillStyle}>
        <button
          onClick={() => toggle("sos")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: lockScreen ? "0 20px 0 16px" : "0 18px 0 14px",
            height: "100%",
            background: "#dc2626",
            border: "none", cursor: "pointer",
            borderRight: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
              <path d="M10 3v7" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="10" cy="14.5" r="1.5" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: lockScreen ? 14 : 13, fontWeight: 700, color: "white", letterSpacing: "0.04em" }}>SOS</span>
        </button>

        <div style={{ width: 1, height: "60%", background: lockScreen ? "rgba(255,255,255,0.25)" : "#e5e5e5" }} />

        <button
          onClick={() => toggle("card")}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: lockScreen ? "0 18px 0 16px" : "0 16px 0 14px",
            height: "100%",
            background: safetyCardBg,
            backdropFilter: lockScreen ? "blur(12px)" : "none",
            border: "none", cursor: "pointer",
          }}
        >
          <svg width="15" height="12" viewBox="0 0 18 14" fill="none">
            <rect x="1" y="1" width="16" height="12" rx="2" stroke={safetyCardIconStroke} strokeWidth="1.5"/>
            <line x1="1" y1="5" x2="17" y2="5" stroke={safetyCardIconStroke} strokeWidth="1.5"/>
            <rect x="3" y="8" width="5" height="1.5" rx="0.75" fill={safetyCardIconFill}/>
          </svg>
          <span style={{ fontSize: lockScreen ? 14 : 13, fontWeight: 600, color: safetyCardTextColor }}>Safety card</span>
        </button>
      </div>

      {!onViewChange && <BottomSheet view={view} onDismiss={closeSheet} trip={trip} />}
    </>
  );
}
