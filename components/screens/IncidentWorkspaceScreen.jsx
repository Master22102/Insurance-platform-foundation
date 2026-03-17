"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
const MOCK_INCIDENTS = [
  {
    id: "inc-1",
    type: "flight_delay",
    title: "Flight Delay",
    flightNum: "AC780",
    route: "Toronto → Boston",
    date: "Oct 9",
    tripName: "Portugal 2026",
    status: "open",
    timeline: [
      { time: "08:00", label: "Scheduled departure" },
      { time: "08:15", label: "Delay announced — mechanical issue" },
      { time: "09:10", label: "Gate change to C14" },
      { time: "10:40", label: "Further delay — new ETD 12:30" },
    ],
    evidence: [
      { id: "ev1", label: "BoardingPass_AC780.pdf", type: "document", uploaded: "Oct 9" },
      { id: "ev2", label: "Gate_Delay_Notice.jpg", type: "photo", uploaded: "Oct 9" },
    ],
    airlineActions: [
      { id: "aa1", label: "Meal voucher provided", value: "$15" },
    ],
    coverage: [
      { id: "c1", type: "airline", label: "Airline compensation", payout: "$600", eligible: true },
      { id: "c2", type: "card", label: "Credit card trip delay", payout: "$500", eligible: true },
      { id: "c3", type: "insurance", label: "Travel insurance", payout: "Eligible for reimbursement", eligible: true },
    ],
    claimOrder: [
      "Submit airline compensation claim (EU261 / DOT)",
      "If denied or insufficient → file credit card trip delay claim",
      "Submit travel insurance claim for remaining out-of-pocket expenses",
    ],
  },
  {
    id: "inc-2",
    type: "baggage_delay",
    title: "Baggage Delayed",
    flightNum: "AA342",
    route: "New York → Boston",
    date: "Sep 5",
    tripName: "NYC Weekend",
    status: "open",
    timeline: [
      { time: "09:15", label: "Baggage not on carousel after 45 min" },
      { time: "09:40", label: "Filed PIR with airline" },
      { time: "10:00", label: "Airline confirmed bag in JFK" },
    ],
    evidence: [
      { id: "ev3", label: "PIR_AA342.pdf", type: "document", uploaded: "Sep 5" },
    ],
    airlineActions: [],
    coverage: [
      { id: "c4", type: "card", label: "Credit card baggage delay", payout: "$500", eligible: true },
      { id: "c5", type: "insurance", label: "Travel insurance", payout: "Up to $200 essential items", eligible: true },
    ],
    claimOrder: [
      "Keep all receipts for essential items purchased",
      "File credit card baggage delay claim with PIR and receipts",
      "File travel insurance claim if delay exceeds 24 hours",
    ],
  },
];

const STATUS_STEPS = ["Detected", "Documenting", "Routing ready", "Filed", "Resolved"];

const STATUS_CONFIG = {
  open: { label: "Open", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  reviewing: { label: "Reviewing", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  ready: { label: "Ready to claim", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  submitted: { label: "Claim submitted", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  resolved: { label: "Resolved", color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
};

const EVIDENCE_ICONS = {
  document: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#6b7280" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M14 2v6h6M9 13h6M9 17h4" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  photo: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="#6b7280" strokeWidth="1.6"/>
      <circle cx="12" cy="12" r="3" stroke="#6b7280" strokeWidth="1.6"/>
      <circle cx="17" cy="8" r="1" fill="#6b7280"/>
    </svg>
  ),
  receipt: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" stroke="#6b7280" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M9 9h6M9 13h4" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
};

const AIRLINE_ACTION_OPTIONS = [
  "Meal voucher",
  "Hotel provided",
  "Rebooked flight",
  "Denied compensation",
  "Cash offered",
  "Travel credit offered",
];

// ---------------------------------------------------------------------------
// EVIDENCE LOCKER
// ---------------------------------------------------------------------------
function EvidenceLocker({ evidence, onAdd }) {
  return (
    <div>
      {evidence.map((ev) => (
        <div
          key={ev.id}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", background: "#f9fafb",
            border: "1px solid #e5e7eb", borderRadius: 10,
            marginBottom: 6,
          }}
        >
          <div style={{ flexShrink: 0 }}>{EVIDENCE_ICONS[ev.type] || EVIDENCE_ICONS.document}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.label}</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "1px 0 0" }}>Uploaded {ev.uploaded}</p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#059669", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 7px", flexShrink: 0 }}>
            Saved
          </span>
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
        <button
          onClick={onAdd}
          style={{ padding: "9px 10px", background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="#374151" strokeWidth="1.6"/><circle cx="12" cy="12" r="3" stroke="#374151" strokeWidth="1.6"/></svg>
          Upload photo
        </button>
        <label style={{ padding: "9px 10px", background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" stroke="#374151" strokeWidth="1.6" strokeLinejoin="round"/></svg>
          Scan receipt
          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { if (e.target.files && e.target.files[0]) onAdd(e.target.files[0]); }} />
        </label>
        <button
          onClick={onAdd}
          style={{ padding: "9px 10px", background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="#374151" strokeWidth="1.6"/><path d="M3 7l9 6 9-6" stroke="#374151" strokeWidth="1.6" strokeLinecap="round"/></svg>
          Attach email
        </button>
        <button
          onClick={onAdd}
          style={{ padding: "9px 10px", background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#374151" strokeWidth="1.6" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="#374151" strokeWidth="1.6"/></svg>
          Upload document
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COVERAGE ELIGIBILITY CARDS
// ---------------------------------------------------------------------------
function CoverageEligibility({ coverage, onStartClaim }) {
  const icons = {
    airline: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 16v-2l-8-5V4.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#1d4ed8"/></svg>,
    card: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#059669" strokeWidth="1.7"/><path d="M2 10h20" stroke="#059669" strokeWidth="1.7"/><path d="M6 15h4" stroke="#059669" strokeWidth="1.7" strokeLinecap="round"/></svg>,
    insurance: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4v5c0 5-4 9-8 10-4-1-8-5-8-10V7l8-4z" stroke="#d97706" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="#d97706" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {coverage.map((cov) => (
        <div
          key={cov.id}
          style={{
            background: "white", border: "1px solid #f0f0f0",
            borderRadius: 12, padding: "12px 13px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icons[cov.type]}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{cov.label}</p>
              <p style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, margin: "0 0 4px" }}>Coverage limit: {cov.payout}</p>
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: "#0369a1", background: "#f0f9ff", border: "1px solid #bae6fd",
                borderRadius: 20, padding: "2px 7px",
              }}>
                May apply
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button style={{ flex: 1, padding: "8px 0", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
              View requirements
            </button>
            <button
              onClick={() => onStartClaim(cov)}
              style={{ flex: 1, padding: "8px 0", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "white", cursor: "pointer" }}
            >
              Start claim
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADD AIRLINE ACTION SHEET
// ---------------------------------------------------------------------------
function AddAirlineActionSheet({ onAdd, onDismiss }) {
  const [selected, setSelected] = useState(null);
  const [value, setValue] = useState("");
  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 601, padding: "0 0 32px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "8px 18px 0" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 12px" }}>Add airline action</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {AIRLINE_ACTION_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSelected(opt)}
                style={{
                  padding: "10px 13px", background: selected === opt ? "#eff6ff" : "#f9fafb",
                  border: `1.5px solid ${selected === opt ? "#bfdbfe" : "#e5e7eb"}`,
                  borderRadius: 10, fontSize: 13, fontWeight: 600,
                  color: selected === opt ? "#1d4ed8" : "#374151",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          {selected && (
            <input
              placeholder="Amount or notes (optional)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", boxSizing: "border-box",
                background: "#f9fafb", border: "1.5px solid #e5e7eb",
                borderRadius: 10, fontSize: 13, color: "#111",
                outline: "none", fontFamily: "system-ui, sans-serif", marginBottom: 12,
              }}
            />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {selected && (
              <button
                onClick={() => { onAdd({ label: selected, value }); onDismiss(); }}
                style={{ flex: 1, padding: "12px 0", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}
              >
                Save action
              </button>
            )}
            <button
              onClick={onDismiss}
              style={{ flex: selected ? 0 : 1, padding: "12px 16px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
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
// INCIDENT WORKSPACE SCREEN
// ---------------------------------------------------------------------------
export default function IncidentWorkspaceScreen({ incident: incidentProp, onBack, onStartClaim }) {
  const fallback = MOCK_INCIDENTS[0];
  const incident = {
    id: incidentProp?.id || fallback.id,
    title: incidentProp?.title || fallback.title,
    flightNum: incidentProp?.flightNum || incidentProp?.ref || fallback.flightNum,
    route: incidentProp?.route || "",
    date: incidentProp?.date || incidentProp?.detected || fallback.date,
    status: incidentProp?.status || "open",
    tripName: incidentProp?.tripName || "",
    timeline: Array.isArray(incidentProp?.timeline) ? incidentProp.timeline :
              incidentProp?.id ? [{ time: incidentProp?.detected || "Now", label: "Incident reported" }] : fallback.timeline,
    evidence: Array.isArray(incidentProp?.evidence) ? incidentProp.evidence : [],
    airlineActions: Array.isArray(incidentProp?.airlineActions) ? incidentProp.airlineActions : [],
    coverage: Array.isArray(incidentProp?.coverage) ? incidentProp.coverage : fallback.coverage,
    claimOrder: Array.isArray(incidentProp?.claimOrder) ? incidentProp.claimOrder : fallback.claimOrder,
  };
  const [airlineActions, setAirlineActions] = useState(incident.airlineActions || []);
  const [showAddAction, setShowAddAction] = useState(false);
  const [expandedSection, setExpandedSection] = useState("timeline");

  const statusCfg = STATUS_CONFIG[incident.status] || STATUS_CONFIG.open;
  const stepIndex = incident.status === "open" ? 0
    : incident.status === "reviewing" ? 1
    : incident.status === "ready" ? 2
    : incident.status === "submitted" ? 3
    : 4;

  function toggleSection(key) {
    setExpandedSection((prev) => prev === key ? null : key);
  }

  const sections = [
    { key: "timeline", label: "Timeline", count: incident.timeline.length },
    { key: "evidence", label: "Evidence", count: incident.evidence.length },
    { key: "airline", label: "Carrier responses", count: airlineActions.length },
    { key: "coverage", label: "Coverage", count: incident.coverage.length },
    { key: "routing", label: "Filing order", count: null },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "8px 16px 12px", flexShrink: 0, background: "#f5f5f7" }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", padding: "0 0 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6l5 5" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>Incidents</span>
        </button>

        <div style={{ background: "white", borderRadius: 16, padding: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.3px" }}>{incident.title}</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{incident.flightNum} · {incident.route} · {incident.date}</p>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, color: statusCfg.color,
              background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
              borderRadius: 20, padding: "3px 10px", flexShrink: 0,
            }}>
              {statusCfg.label.toUpperCase()}
            </span>
          </div>

          {/* Status progress */}
          <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
            {STATUS_STEPS.map((step, i) => (
              <div key={step} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{
                  height: 3, width: "100%", borderRadius: 2,
                  background: i <= stepIndex ? "#1e3a5f" : "#e5e7eb",
                }} />
                <span style={{ fontSize: 8, color: i <= stepIndex ? "#1e3a5f" : "#9ca3af", fontWeight: i === stepIndex ? 700 : 400, textAlign: "center", lineHeight: 1.2 }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 106px" }}>
        {sections.map((sec) => (
          <div key={sec.key} style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", marginBottom: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <button
              onClick={() => toggleSection(sec.key)}
              style={{
                width: "100%", padding: "13px 14px",
                background: "none", border: "none", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>{sec.label}</p>
                {sec.count !== null && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", borderRadius: 20, padding: "1px 7px" }}>
                    {sec.count}
                  </span>
                )}
              </div>
              <svg
                width="10" height="6" viewBox="0 0 10 6" fill="none"
                style={{ transition: "transform 0.2s", transform: expandedSection === sec.key ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                <path d="M1 1l4 4 4-4" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {expandedSection === sec.key && (
              <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f5f5f5" }}>
                {sec.key === "timeline" && (
                  <div style={{ paddingTop: 10 }}>
                    {incident.timeline.map((ev, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < incident.timeline.length - 1 ? 12 : 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, width: 14, flexShrink: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: i === incident.timeline.length - 1 ? "#d97706" : "#1e3a5f", flexShrink: 0, marginTop: 3 }} />
                          {i < incident.timeline.length - 1 && <div style={{ width: 2, flex: 1, background: "#e5e7eb", minHeight: 20 }} />}
                        </div>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>{ev.time}</span>
                          <p style={{ fontSize: 12, color: "#374151", margin: "2px 0 0" }}>{ev.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sec.key === "evidence" && (
                  <div style={{ paddingTop: 10 }}>
                    <EvidenceLocker evidence={incident.evidence} onAdd={() => {}} />
                  </div>
                )}

                {sec.key === "airline" && (
                  <div style={{ paddingTop: 10 }}>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.5 }}>Record what happened with the carrier.</p>
                    {airlineActions.length === 0 && (
                      <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 10px" }}>No carrier responses recorded yet.</p>
                    )}
                    {airlineActions.map((aa, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: 0 }}>{aa.label}</p>
                        {aa.value && <span style={{ fontSize: 12, color: "#6b7280" }}>{aa.value}</span>}
                      </div>
                    ))}
                    <button
                      onClick={() => setShowAddAction(true)}
                      style={{ width: "100%", padding: "9px 0", background: "none", border: "1.5px dashed #d1d5db", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}
                    >
                      + Add airline action
                    </button>
                  </div>
                )}

                {sec.key === "coverage" && (
                  <div style={{ paddingTop: 10 }}>
                    <CoverageEligibility
                      coverage={incident.coverage}
                      onStartClaim={(cov) => onStartClaim && onStartClaim({ incident, coverage: cov })}
                    />
                  </div>
                )}

                {sec.key === "routing" && (
                  <div style={{ paddingTop: 12 }}>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>
                      Suggested filing order — based on your coverage sources and the disruption type.
                    </p>
                    {incident.claimOrder.map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "white" }}>{i + 1}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "#374151", margin: "2px 0 0", lineHeight: 1.5 }}>{step}</p>
                      </div>
                    ))}
                    <button
                      onClick={() => onStartClaim && onStartClaim({ incident, coverage: incident.coverage[0] })}
                      style={{
                        width: "100%", marginTop: 6,
                        padding: "12px 0",
                        background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                        border: "none", borderRadius: 12,
                        fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer",
                      }}
                    >
                      Start claim
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showAddAction && (
        <AddAirlineActionSheet
          onAdd={(action) => setAirlineActions((prev) => [...prev, action])}
          onDismiss={() => setShowAddAction(false)}
        />
      )}
    </div>
  );
}

export { MOCK_INCIDENTS };
