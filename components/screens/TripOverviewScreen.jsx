"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
const TRIP_OVERVIEW_DATA = {
  t1: {
    name: "Portugal 2026",
    subtitle: "Lisbon → Porto",
    dates: "Jun 12 – Jun 24",
    flag: "🇵🇹",
    segments: [
      { id: "s1", origin: "JFK", dest: "LIS", carrier: "TAP Air Portugal", flight: "TP205", depart: "Jun 12 · 22:45", arrive: "Jun 13 · 10:30", mode: "air" },
      { id: "s2", origin: "LIS", dest: "OPO", carrier: "TAP Air Portugal", flight: "TP782", depart: "Jun 18 · 15:10", arrive: "Jun 18 · 16:00", mode: "air" },
      { id: "s3", origin: "OPO", dest: "JFK", carrier: "TAP Air Portugal", flight: "TP235", depart: "Jun 24 · 11:30", arrive: "Jun 24 · 15:45", mode: "air" },
    ],
    incidents: [
      { id: "inc-1", title: "Flight Delay", ref: "AC780", detected: "Jun 13", status: "resolved" },
    ],
  },
  t2: {
    name: "Tokyo Conference",
    subtitle: "Tokyo",
    dates: "Aug 3 – Aug 10",
    flag: "🇯🇵",
    segments: [
      { id: "s4", origin: "JFK", dest: "NRT", carrier: "Japan Airlines", flight: "JL004", depart: "Aug 3 · 11:30", arrive: "Aug 4 · 14:50", mode: "air" },
      { id: "s5", origin: "NRT", dest: "JFK", carrier: "Japan Airlines", flight: "JL003", depart: "Aug 10 · 16:10", arrive: "Aug 10 · 14:30", mode: "air" },
    ],
    incidents: [],
  },
  t3: {
    name: "Morocco Road Trip",
    subtitle: "Marrakech · Fes · Casablanca",
    dates: "Oct 15 – Oct 28",
    flag: "🇲🇦",
    segments: [
      { id: "s6", origin: "JFK", dest: "CMN", carrier: "Royal Air Maroc", flight: "AT203", depart: "Oct 15 · 23:00", arrive: "Oct 16 · 10:45", mode: "air" },
    ],
    incidents: [],
  },
  t4: {
    name: "NYC Weekend",
    subtitle: "New York",
    dates: "Sep 5 – Sep 7",
    flag: "🇺🇸",
    segments: [
      { id: "s7", origin: "BOS", dest: "JFK", carrier: "American Airlines", flight: "AA342", depart: "Sep 5 · 07:00", arrive: "Sep 5 · 08:20", mode: "air" },
      { id: "s8", origin: "JFK", dest: "BOS", carrier: "American Airlines", flight: "AA345", depart: "Sep 7 · 18:00", arrive: "Sep 7 · 19:15", mode: "air" },
    ],
    incidents: [
      { id: "inc-2", title: "Baggage Delayed", ref: "AA342", detected: "Sep 5", status: "open" },
    ],
  },
  t5: {
    name: "Barcelona Getaway",
    subtitle: "Barcelona",
    dates: "Mar 20 – Mar 26",
    flag: "🇪🇸",
    segments: [
      { id: "s9", origin: "JFK", dest: "BCN", carrier: "Iberia", flight: "IB6253", depart: "Mar 20 · 22:10", arrive: "Mar 21 · 11:30", mode: "air" },
      { id: "s10", origin: "BCN", dest: "JFK", carrier: "Iberia", flight: "IB6254", depart: "Mar 26 · 14:45", arrive: "Mar 26 · 17:50", mode: "air" },
    ],
    incidents: [
      { id: "inc-3", title: "Trip Cancellation", ref: "Weather", detected: "Mar 18", status: "resolved" },
      { id: "inc-4", title: "Hotel Overbooking", ref: "Hotel Arts", detected: "Mar 22", status: "resolved" },
    ],
  },
};

const STATUS_CONFIG = {
  open: { label: "OPEN", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  resolved: { label: "RESOLVED", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
};

const MODE_ICONS = {
  air: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M21 16v-2l-8-5V4.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#6b7280"/>
    </svg>
  ),
  road: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="8" rx="2" stroke="#6b7280" strokeWidth="1.6"/>
      <path d="M8 11V7a4 4 0 018 0v4" stroke="#6b7280" strokeWidth="1.6"/>
      <circle cx="8" cy="17" r="1" fill="#6b7280"/>
      <circle cx="16" cy="17" r="1" fill="#6b7280"/>
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// REPORT INCIDENT SHEET
// ---------------------------------------------------------------------------
function ReportIncidentSheet({ tripName, prefillFlight, prefillRoute, onDismiss, onSubmit }) {
  const [type, setType] = useState("");
  const [flight, setFlight] = useState(prefillFlight || "");
  const [notes, setNotes] = useState("");

  const incidentTypes = [
    "Flight delay", "Flight cancellation", "Baggage delay",
    "Baggage lost", "Denied boarding", "Hotel issue",
    "Medical emergency", "Other",
  ];

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, maxHeight: "85%", display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "10px 18px 0", flexShrink: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.2px" }}>Report Incident</p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 14px" }}>{tripName}</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 28px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Incident type</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
            {incidentTypes.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: "9px 10px", background: type === t ? "#eff6ff" : "#f9fafb",
                  border: `1.5px solid ${type === t ? "#bfdbfe" : "#e5e7eb"}`,
                  borderRadius: 10, fontSize: 12, fontWeight: 600,
                  color: type === t ? "#1d4ed8" : "#374151", cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Flight / reference</p>
          <input
            value={flight}
            onChange={(e) => setFlight(e.target.value)}
            placeholder="e.g. AC780"
            style={{
              width: "100%", padding: "10px 12px", boxSizing: "border-box",
              background: "#f9fafb", border: "1.5px solid #e5e7eb",
              borderRadius: 10, fontSize: 13, color: "#111",
              outline: "none", fontFamily: "system-ui, sans-serif", marginBottom: 14,
            }}
          />
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what happened..."
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", boxSizing: "border-box",
              background: "#f9fafb", border: "1.5px solid #e5e7eb",
              borderRadius: 10, fontSize: 13, color: "#111",
              resize: "none", fontFamily: "system-ui, sans-serif",
              lineHeight: 1.6, outline: "none", marginBottom: 16,
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={!type}
              onClick={() => { onSubmit && onSubmit({ type, flight, notes }); onDismiss(); }}
              style={{
                flex: 1, padding: "13px 0",
                background: type ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)" : "#f3f4f6",
                border: "none", borderRadius: 13,
                fontSize: 14, fontWeight: 600,
                color: type ? "white" : "#9ca3af", cursor: type ? "pointer" : "default",
              }}
            >
              Create incident
            </button>
            <button
              onClick={onDismiss}
              style={{ padding: "13px 16px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SEGMENT DETAIL SHEET
// ---------------------------------------------------------------------------
function SegmentDetailSheet({ segment, onDismiss, onReportDisruption }) {
  const modeIcon = MODE_ICONS[segment.mode] || MODE_ICONS.air;
  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, padding: "0 0 32px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "8px 18px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {modeIcon}
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>{segment.origin} → {segment.dest}</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{segment.carrier} · {segment.flight}</p>
            </div>
          </div>
          <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 13px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Departs</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0 }}>{segment.depart}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Arrives</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0 }}>{segment.arrive}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { onDismiss(); onReportDisruption(segment); }}
            style={{
              width: "100%", padding: "13px 0",
              background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              border: "none", borderRadius: 13,
              fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer",
              marginBottom: 8,
            }}
          >
            Report disruption
          </button>
          <button
            onClick={onDismiss}
            style={{ width: "100%", padding: "11px 0", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TRIP OVERVIEW SCREEN
// ---------------------------------------------------------------------------
export default function TripOverviewScreen({ tripId, tripName, onBack, onOpenIncident }) {
  const trip = TRIP_OVERVIEW_DATA[tripId] || TRIP_OVERVIEW_DATA.t1;
  const [reportOpen, setReportOpen] = useState(false);
  const [prefillFlight, setPrefillFlight] = useState("");
  const [segmentDetail, setSegmentDetail] = useState(null);
  const [incidents, setIncidents] = useState(trip.incidents);

  function handleReportSubmit(data) {
    const newInc = {
      id: `inc-${Date.now()}`,
      title: data.type || "New incident",
      ref: data.flight || "",
      detected: "Just now",
      status: "open",
      route: "",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      timeline: [{ time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), label: "Incident reported" }],
      evidence: [],
      airlineActions: [],
      coverage: [],
      claimOrder: [],
    };
    setIncidents((prev) => [...prev, newInc]);
    setReportOpen(false);
    onOpenIncident && onOpenIncident(newInc);
  }

  function handleReportDisruption(segment) {
    setPrefillFlight(segment.flight);
    setReportOpen(true);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "8px 16px 0", flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", padding: "0 0 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6l5 5" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>Trips</span>
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>{trip.name}</p>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>{trip.subtitle}</p>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "1px 0 0" }}>{trip.dates}</p>
          </div>
          <span style={{ fontSize: 18, marginTop: 4 }}>{trip.flag}</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 106px" }}>
        {/* Quick Actions */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Actions</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {[
              {
                label: "+ Report incident",
                primary: true,
                onClick: () => { setPrefillFlight(""); setReportOpen(true); },
              },
              {
                label: "Add document",
                icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#374151" strokeWidth="1.6" strokeLinejoin="round"/><path d="M14 2v6h6M12 11v6M9 14h6" stroke="#374151" strokeWidth="1.6" strokeLinecap="round"/></svg>,
                onClick: () => {},
              },
              {
                label: "Scan receipts",
                icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" stroke="#374151" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
                onClick: () => {},
              },
              {
                label: "View coverage",
                icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4v5c0 5-4 9-8 10-4-1-8-5-8-10V7l8-4z" stroke="#374151" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
                onClick: () => {},
              },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.onClick}
                style={{
                  padding: "10px 11px",
                  background: btn.primary ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)" : "#f3f4f6",
                  border: btn.primary ? "none" : "1px solid #e5e7eb",
                  borderRadius: 11, fontSize: 12, fontWeight: 600,
                  color: btn.primary ? "white" : "#374151",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  justifyContent: "center",
                }}
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Segments */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Trip Segments</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {trip.segments.map((seg) => {
              const modeIcon = MODE_ICONS[seg.mode] || MODE_ICONS.air;
              return (
                <button
                  key={seg.id}
                  onClick={() => setSegmentDetail(seg)}
                  style={{
                    width: "100%", padding: "11px 12px",
                    background: "#f9fafb", border: "1px solid #e5e7eb",
                    borderRadius: 11, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "white", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {modeIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>{seg.origin} → {seg.dest}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{seg.carrier} {seg.flight}</p>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: "1px 0 0" }}>{seg.depart}</p>
                  </div>
                  <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
                    <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        {/* Incidents */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Incidents</p>
            <button
              onClick={() => { setPrefillFlight(""); setReportOpen(true); }}
              style={{ background: "none", border: "none", fontSize: 12, fontWeight: 700, color: "#1d4ed8", cursor: "pointer", padding: 0 }}
            >
              + Report incident
            </button>
          </div>

          {incidents.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No incidents on this trip</p>
              <button
                onClick={() => { setPrefillFlight(""); setReportOpen(true); }}
                style={{ marginTop: 8, padding: "8px 16px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}
              >
                Report one now
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {incidents.map((inc) => {
                const stCfg = STATUS_CONFIG[inc.status] || STATUS_CONFIG.open;
                return (
                  <button
                    key={inc.id}
                    onClick={() => onOpenIncident && onOpenIncident(inc)}
                    style={{
                      width: "100%", padding: "11px 12px",
                      background: "#f9fafb", border: "1px solid #e5e7eb",
                      borderRadius: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: stCfg.color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>{inc.title}</p>
                      <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{inc.ref} · Detected {inc.detected}</p>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: stCfg.color,
                      background: stCfg.bg, border: `1px solid ${stCfg.border}`,
                      borderRadius: 20, padding: "2px 7px", flexShrink: 0,
                    }}>
                      {stCfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {reportOpen && (
        <ReportIncidentSheet
          tripName={trip.name}
          prefillFlight={prefillFlight}
          onDismiss={() => setReportOpen(false)}
          onSubmit={handleReportSubmit}
        />
      )}

      {segmentDetail && (
        <SegmentDetailSheet
          segment={segmentDetail}
          onDismiss={() => setSegmentDetail(null)}
          onReportDisruption={handleReportDisruption}
        />
      )}
    </div>
  );
}
