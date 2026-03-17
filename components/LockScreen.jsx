"use client";

import { useState, useRef, useCallback } from "react";
import EmergencySystem, { ACTIVE_TRIP, BottomSheet } from "./EmergencySystem";

// Multi-leg trip data — mirrors what's in TripHomeScreen
// In production, comes from the active trip in Supabase.
const TRIP_LEGS = [
  { city: "Lisbon", country: "Portugal", countryCode: "PT", dateRange: "Jun 12 – Jun 18" },
  { city: "Porto", country: "Portugal", countryCode: "PT", dateRange: "Jun 18 – Jun 24" },
];
// Simulate being on leg 0 (Lisbon) right now
const CURRENT_LEG_INDEX = 0;
const CURRENT_LEG = TRIP_LEGS[CURRENT_LEG_INDEX];
const NEXT_LEG = TRIP_LEGS[CURRENT_LEG_INDEX + 1] || null;

// Country code → country name (flags rendered via flagcdn.com image)
const COUNTRY_FLAGS = {
  PT: { name: "Portugal" },
  ES: { name: "Spain" },
  FR: { name: "France" },
  GB: { name: "United Kingdom" },
  DE: { name: "Germany" },
  US: { name: "United States" },
  IT: { name: "Italy" },
  JP: { name: "Japan" },
  AU: { name: "Australia" },
  NZ: { name: "New Zealand" },
  TH: { name: "Thailand" },
  SG: { name: "Singapore" },
  AE: { name: "United Arab Emirates" },
  MX: { name: "Mexico" },
  BR: { name: "Brazil" },
  CA: { name: "Canada" },
};

function CountryFlag({ countryCode, size = 20 }) {
  const code = (countryCode || "").toUpperCase();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: "rgba(255,255,255,0.18)",
      border: "1px solid rgba(255,255,255,0.28)",
      borderRadius: 4,
      padding: "1px 5px",
      fontSize: Math.round(size * 0.5),
      fontWeight: 700,
      color: "rgba(255,255,255,0.95)",
      letterSpacing: "0.04em",
      lineHeight: 1,
      minWidth: size,
      height: Math.round(size * 0.67),
    }}>
      {code}
    </span>
  );
}

// Trip health status → dot color
const TRIP_HEALTH = {
  ok: { dot: "#4ade80", glow: "#4ade80", label: "Protected" },
  warning: { dot: "#fbbf24", glow: "#fbbf24", label: "Review needed" },
  alert: { dot: "#f87171", glow: "#f87171", label: "Incident open" },
};
// Current leg health — set to "ok" if no issues, "warning" or "alert" otherwise
const CURRENT_HEALTH = "ok";

// Location display modes
const LOCATION_MODES = [
  { key: "city", label: "City only" },
  { key: "country", label: "Country only" },
  { key: "flag-city", label: "Flag + city" },
];

function LocationChip({ trip, mode }) {
  const meta = COUNTRY_FLAGS[trip.countryCode] || { name: trip.country };
  const health = TRIP_HEALTH[CURRENT_HEALTH] || TRIP_HEALTH.ok;

  let content;
  if (mode === "city") {
    content = (
      <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>
        {trip.city}
      </span>
    );
  } else if (mode === "country") {
    content = (
      <>
        <CountryFlag countryCode={trip.countryCode} size={18} />
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>
          {meta.name}
        </span>
      </>
    );
  } else {
    content = (
      <>
        <CountryFlag countryCode={trip.countryCode} size={18} />
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>
          {trip.city}
        </span>
      </>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "rgba(255,255,255,0.15)",
      backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: 20, padding: "6px 14px",
    }}>
      {content}
      <div style={{
        width: 5, height: 5, borderRadius: "50%",
        background: health.dot,
        boxShadow: `0 0 6px ${health.glow}`,
        marginLeft: 2,
      }} />
    </div>
  );
}

export default function LockScreen() {
  const trip = ACTIVE_TRIP;
  const currentLeg = CURRENT_LEG;
  const nextLeg = NEXT_LEG;

  const [locationMode, setLocationMode] = useState("flag-city");
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [protectedOpen, setProtectedOpen] = useState(false);
  const [emergencyView, setEmergencyView] = useState(null);

  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const handlePressStart = useCallback(() => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setModePickerOpen(true);
    }, 500);
  }, []);

  const handlePressEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* Background photo */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(
            180deg,
            rgba(10,20,40,0.52) 0%,
            rgba(10,20,40,0.18) 35%,
            rgba(10,20,40,0.10) 55%,
            rgba(10,20,40,0.72) 100%
          ),
          url('https://images.pexels.com/photos/2225442/pexels-photo-2225442.jpeg?auto=compress&cs=tinysrgb&w=800')
        `,
        backgroundSize: "cover",
        backgroundPosition: "center 40%",
        zIndex: 0,
      }} />

      {/* Status bar */}
      <div style={{
        position: "relative", zIndex: 5,
        height: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        padding: "0 28px 10px", flexShrink: 0,
      }}>
        <div style={{
          width: 126, height: 34, background: "#1a1a1a", borderRadius: 20,
          position: "absolute", left: "50%", transform: "translateX(-50%)", top: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "white", zIndex: 1 }}>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center", zIndex: 1 }}>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <rect x="0" y="3" width="3" height="9" rx="1" fill="white"/>
            <rect x="4.5" y="2" width="3" height="10" rx="1" fill="white"/>
            <rect x="9" y="0" width="3" height="12" rx="1" fill="white"/>
            <rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="white" opacity="0.4"/>
          </svg>
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
            <path d="M7.5 2C9.6 2 11.4 2.9 12.7 4.3L13.9 3C12.2 1.2 9.9 0 7.5 0C5.1 0 2.8 1.2 1.1 3L2.3 4.3C3.6 2.9 5.4 2 7.5 2Z" fill="white"/>
            <path d="M7.5 5C8.8 5 10 5.5 10.8 6.4L12 5.1C10.8 3.9 9.2 3.1 7.5 3.1C5.8 3.1 4.2 3.9 3 5.1L4.2 6.4C5 5.5 6.2 5 7.5 5Z" fill="white"/>
            <circle cx="7.5" cy="9.5" r="1.5" fill="white"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="white" strokeOpacity="0.5"/>
            <rect x="2" y="2" width="16" height="8" rx="2" fill="white"/>
            <path d="M23 4v4a2 2 0 000-4z" fill="white" fillOpacity="0.5"/>
          </svg>
        </div>
      </div>

      {/* Time & date */}
      <div style={{
        position: "relative", zIndex: 5,
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 40, flexShrink: 0,
      }}>
        <p style={{ fontSize: 80, fontWeight: 200, color: "white", margin: 0, letterSpacing: "-2px", lineHeight: 1 }}>
          9:41
        </p>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.75)", margin: "6px 0 0", fontWeight: 400 }}>
          {/* Date is bound to trip departure — shows dynamic context */}
          Tuesday, {trip.departs}
        </p>

        {/* Location chip — hold to change display setting */}
        <div style={{ marginTop: 18, position: "relative" }}>
          <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressEnd}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", WebkitUserSelect: "none", userSelect: "none" }}
          >
            <LocationChip trip={currentLeg} mode={locationMode} />
          </button>

          {/* Mode picker dropdown — opens on long press */}
          {modePickerOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(20,20,30,0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 14, overflow: "hidden",
              minWidth: 160, zIndex: 20,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}>
              <p style={{
                fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "10px 14px 4px", margin: 0,
              }}>
                Display setting
              </p>
              {LOCATION_MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => { setLocationMode(m.key); setModePickerOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "10px 14px",
                    background: locationMode === m.key ? "rgba(255,255,255,0.08)" : "transparent",
                    border: "none", cursor: "pointer",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "white", fontWeight: locationMode === m.key ? 600 : 400 }}>
                    {m.label}
                  </span>
                  {locationMode === m.key && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5l3.5 3.5L11 1" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Invisible full-screen dismiss layer when picker is open */}
        {modePickerOpen && (
          <div
            onClick={() => setModePickerOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 19 }}
          />
        )}
      </div>

      <div style={{ flex: 1, position: "relative", zIndex: 5 }} />

      {/* Trip context + protected pill */}
      <div style={{
        position: "relative", zIndex: 5,
        padding: "0 20px 0",
        display: "flex", flexDirection: "column", gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 16, padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Left: shield icon + current city + next stop */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "rgba(34,197,94,0.25)",
              border: "1px solid rgba(34,197,94,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
                  fill="rgba(74,222,128,0.3)" stroke="#4ade80" strokeWidth="1.8"/>
                <path d="M9 12l2 2 4-4" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "white", margin: 0 }}>
                {currentLeg.city}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: 0 }}>
                {nextLeg
                  ? `Next stop: ${nextLeg.city}`
                  : `Returns ${trip.returns}`}
              </p>
            </div>
          </div>

          {/* Right: tappable Protected badge → opens coverage summary */}
          <button
            onClick={() => setProtectedOpen(true)}
            style={{
              fontSize: 10, fontWeight: 600, color: "#4ade80",
              background: "rgba(34,197,94,0.18)",
              border: "1px solid rgba(34,197,94,0.35)",
              padding: "5px 10px", borderRadius: 20,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            Protected
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M2 3l2 2 2-2" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* SOS + Safety card pill — pill only; sheet is hoisted to lock screen root */}
      <div style={{ position: "relative", zIndex: 5, height: 80, flexShrink: 0 }}>
        <EmergencySystem lockScreen externalView={emergencyView} onViewChange={setEmergencyView} />
      </div>

      {/* Protected info sheet */}
      {protectedOpen && (
        <ProtectedSheet trip={trip} onDismiss={() => setProtectedOpen(false)} />
      )}

      {/* Emergency sheet — hoisted to lock screen root so it covers full height */}
      <BottomSheet view={emergencyView} onDismiss={() => setEmergencyView(null)} trip={trip} />

      {/* Swipe hint */}
      <div style={{
        position: "relative", zIndex: 5,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 6, paddingBottom: 10, flexShrink: 0,
      }}>
        <svg width="24" height="10" viewBox="0 0 24 10" fill="none" opacity="0.4">
          <path d="M4 8l8-6 8 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 400, letterSpacing: "0.02em" }}>
          Swipe up to unlock
        </span>
      </div>

      {/* Home indicator */}
      <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 5 }}>
        <div style={{ width: 134, height: 5, background: "white", borderRadius: 3, opacity: 0.25 }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROTECTED SHEET — no insurer names, just benefit categories
// ---------------------------------------------------------------------------
function ProtectedSheet({ trip, onDismiss }) {
  const [mounted, setMounted] = useState(false);

  useState(() => {
    requestAnimationFrame(() => setMounted(true));
  });

  return (
    <>
      <div
        onClick={onDismiss}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 99,
        }}
      />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "20px 20px 0 0",
        zIndex: 100, maxHeight: "72%",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "8px 20px 0", overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
              border: "2px solid #4ade80",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
                  fill="rgba(34,197,94,0.2)" stroke="#16a34a" strokeWidth="1.8"/>
                <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 3px", letterSpacing: "-0.2px" }}>
                Trip is protected
              </p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                {trip.city}, {trip.country} · {trip.departs} – {trip.returns}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
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

        <div style={{ padding: "0 20px 20px", flexShrink: 0 }}>
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
      </div>
    </>
  );
}
