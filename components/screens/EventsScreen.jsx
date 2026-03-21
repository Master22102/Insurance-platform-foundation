"use client";

import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
const EVENTS = [
  {
    id: "e1",
    type: "denied_boarding",
    typeLabel: "Denied Boarding",
    severity: "high",
    trip: "NYC Weekend",
    tripFlag: "🇺🇸",
    location: "JFK Terminal 5, Gate B22",
    timestamp: "Sep 5, 2025 · 07:34",
    status: "open",
    evidenceStatus: "incomplete",
    nextAction: "Submit carrier's written denial form",
    what: "Passenger denied boarding on JetBlue B6 1044 despite confirmed reservation. Gate agent cited oversold flight.",
    where: "JFK International Airport, Terminal 5, Gate B22, New York, NY",
    whoReported: "Self-reported by traveler",
    timeline: [
      { time: "07:20", event: "Arrived at gate (standard boarding time)" },
      { time: "07:34", event: "Gate agent denied boarding, cited oversale" },
      { time: "07:40", event: "Airline offered next flight at 14:00 — declined, required earlier arrival" },
      { time: "07:52", event: "Incident recorded in TripGuard" },
    ],
    artifacts: [
      { type: "photo", label: "Gate boarding pass screenshot", status: "uploaded" },
      { type: "document", label: "Written denial form", status: "pending" },
      { type: "note", label: "Incident narration", status: "uploaded" },
    ],
    evidenceChecklist: [
      { label: "Written denial from airline", required: true, complete: false },
      { label: "Boarding pass (digital or paper)", required: true, complete: true },
      { label: "Proof of original booking", required: true, complete: true },
      { label: "Receipts for consequential expenses", required: false, complete: false },
      { label: "Airline compensation offer (if any)", required: false, complete: false },
    ],
    actionChecklist: [
      { label: "Request written denial statement from gate agent", complete: false },
      { label: "Document all resulting expenses (hotel, meals, transport)", complete: false },
      { label: "File complaint with DOT if US carrier (within 45 days)", complete: false },
      { label: "Submit to card travel insurance if applicable", complete: false },
    ],
    escalation: null,
  },
  {
    id: "e2",
    type: "customs_delay",
    typeLabel: "Customs Delay",
    severity: "medium",
    trip: "Portugal 2026",
    tripFlag: "🇵🇹",
    location: "Lisbon Humberto Delgado Airport, Arrivals",
    timestamp: "Jun 13, 2026 · 11:15",
    status: "resolved",
    evidenceStatus: "complete",
    nextAction: null,
    what: "Detained for secondary screening at Lisbon customs due to random selection. Held for 48 minutes. All documentation accepted, released without issue.",
    where: "Lisbon Humberto Delgado Airport, International Arrivals Hall, Lisbon, Portugal",
    whoReported: "Self-reported by traveler",
    timeline: [
      { time: "10:52", event: "Landed at LIS, cleared passport control normally" },
      { time: "11:15", event: "Selected for secondary customs screening" },
      { time: "11:22", event: "Baggage scanned and inspected" },
      { time: "12:03", event: "Released from screening — no issues found" },
      { time: "12:08", event: "Incident recorded. Delay of 48 minutes documented." },
    ],
    artifacts: [
      { type: "note", label: "Incident narration", status: "uploaded" },
      { type: "photo", label: "Baggage claim receipt", status: "uploaded" },
    ],
    evidenceChecklist: [
      { label: "Travel narration of event", required: true, complete: true },
      { label: "Boarding pass showing arrival time", required: true, complete: true },
      { label: "Receipts for missed connections (if any)", required: false, complete: false },
    ],
    actionChecklist: [
      { label: "Document time in and time out of secondary screening", complete: true },
      { label: "Retain all boarding passes and baggage receipts", complete: true },
      { label: "Note officer badge number if possible", complete: false },
    ],
    escalation: null,
  },
  {
    id: "e3",
    type: "security_hold",
    typeLabel: "Security Hold",
    severity: "high",
    trip: "Tokyo Conference",
    tripFlag: "🇯🇵",
    location: "NRT Terminal 1, Security",
    timestamp: "Aug 5, 2025 · 04:10",
    status: "open",
    evidenceStatus: "incomplete",
    nextAction: "Contact airline to document hold duration",
    what: "Enhanced security screening triggered at Narita Airport. Traveler held for 35 minutes, missed tight connection to domestic transfer.",
    where: "Narita International Airport, Terminal 1 Security, Tokyo, Japan",
    whoReported: "Self-reported by traveler",
    timeline: [
      { time: "03:40", event: "Arrived at NRT after long-haul flight" },
      { time: "04:10", event: "Flagged for enhanced security screening" },
      { time: "04:45", event: "Released from screening" },
      { time: "04:52", event: "Missed original domestic transfer departure" },
    ],
    artifacts: [
      { type: "note", label: "Incident narration", status: "uploaded" },
    ],
    evidenceChecklist: [
      { label: "Security screening documentation (if provided)", required: true, complete: false },
      { label: "Boarding passes for original and replacement flight", required: true, complete: false },
      { label: "Receipts for any rebooking fees", required: false, complete: false },
    ],
    actionChecklist: [
      { label: "Request screening documentation from airport authority", complete: false },
      { label: "Get airline statement of missed connection", complete: false },
      { label: "Document rebooking costs", complete: false },
    ],
    escalation: {
      type: "group",
      note: "This traveler is part of a group trip. Group leader Jordan Davis has been notified.",
    },
  },
];

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const TYPE_CONFIG = {
  denied_boarding: { icon: "✈", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Denied Boarding" },
  security_hold: { icon: "🔒", color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Security Hold" },
  customs_delay: { icon: "🛂", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", label: "Customs Delay" },
  border_closure: { icon: "🚧", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Border Closure" },
  visa_issue: { icon: "📋", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", label: "Visa Issue" },
  secondary_screening: { icon: "🔍", color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Secondary Screening" },
  airport_access: { icon: "🚫", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Airport Access" },
};

const TRIPS_FOR_EVENTS = [
  { id: "t1", name: "Portugal 2026", flag: "🇵🇹", dates: "Jun 12 – Jun 24" },
  { id: "t2", name: "NYC Weekend", flag: "🇺🇸", dates: "Sep 5 – Sep 7" },
  { id: "t3", name: "Tokyo Conference", flag: "🇯🇵", dates: "Aug 3 – Aug 10" },
  { id: "t4", name: "Berlin Summit 2026", flag: "🇩🇪", dates: "Sep 15 – Sep 20" },
];

const STATUS_CONFIG = {
  open: { label: "Open", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  resolved: { label: "Resolved", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  escalated: { label: "Escalated", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

const EVIDENCE_CONFIG = {
  complete: { label: "Evidence complete", color: "#059669", dot: "#22c55e" },
  incomplete: { label: "Evidence needed", color: "#d97706", dot: "#f59e0b" },
  not_required: { label: "No evidence needed", color: "#6b7280", dot: "#9ca3af" },
};

// ---------------------------------------------------------------------------
// EVENT DETAIL SHEET
// ---------------------------------------------------------------------------
function EventDetailSheet({ event, onDismiss }) {
  const [tab, setTab] = useState("what");
  const typeCfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.security_hold;
  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.open;
  const evidCfg = EVIDENCE_CONFIG[event.evidenceStatus] || EVIDENCE_CONFIG.incomplete;
  const tabs = ["What", "Timeline", "Evidence", "Actions"];

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 400 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 401, display: "flex", flexDirection: "column", maxHeight: "90%",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        {/* Pull handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: "12px 18px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, background: typeCfg.bg, border: `1.5px solid ${typeCfg.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0,
                }}>
                  {typeCfg.icon}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.2px" }}>{event.typeLabel}</p>
                  <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{event.tripFlag} {event.trip} · {event.timestamp}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`, borderRadius: 20, padding: "2px 8px" }}>
                  {statusCfg.label}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: evidCfg.color, borderRadius: 20, padding: "2px 0" }}>
                  · {evidCfg.label}
                </span>
              </div>
            </div>
          </div>

          {/* Next action banner */}
          {event.nextAction && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "9px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M22 4L12 14.01l-3-3" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>Next: {event.nextAction}</span>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 0, borderBottom: "1px solid #f0f0f0", paddingBottom: 0 }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t.toLowerCase())}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 10px 10px",
                  fontSize: 12, fontWeight: 600,
                  color: tab === t.toLowerCase() ? "#1d4ed8" : "#9ca3af",
                  borderBottom: `2px solid ${tab === t.toLowerCase() ? "#1d4ed8" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ overflowY: "auto", padding: "14px 18px 28px" }}>
          {tab === "what" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>What happened</p>
                <p style={{ fontSize: 13, color: "#333", margin: 0, lineHeight: 1.6 }}>{event.what}</p>
              </div>
              <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Where</p>
                <p style={{ fontSize: 13, color: "#333", margin: 0, lineHeight: 1.5 }}>{event.where}</p>
              </div>
              <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Reported by</p>
                <p style={{ fontSize: 13, color: "#333", margin: 0 }}>{event.whoReported}</p>
              </div>
              {event.escalation && (
                <div style={{ background: "#eff4fc", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "#1d4ed8", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Escalation context</p>
                  <p style={{ fontSize: 13, color: "#1e40af", margin: 0, lineHeight: 1.5 }}>{event.escalation.note}</p>
                </div>
              )}
            </div>
          )}

          {tab === "timeline" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {event.timeline.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1d4ed8", flexShrink: 0, marginTop: 4 }} />
                    {i < event.timeline.length - 1 && (
                      <div style={{ width: 1.5, flex: 1, background: "#e5e7eb", minHeight: 24, margin: "3px 0" }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < event.timeline.length - 1 ? 8 : 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", margin: "2px 0 2px", letterSpacing: "0.04em" }}>{item.time}</p>
                    <p style={{ fontSize: 13, color: "#333", margin: 0, lineHeight: 1.5 }}>{item.event}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "evidence" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Evidence checklist</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {event.evidenceChecklist.map((item, i) => (
                    <div key={i} style={{
                      background: "white", border: `1px solid ${item.complete ? "#bbf7d0" : "#f0f0f0"}`,
                      borderRadius: 12, padding: "10px 12px",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        background: item.complete ? "#f0fdf4" : "#f9fafb",
                        border: `1.5px solid ${item.complete ? "#22c55e" : "#d1d5db"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {item.complete && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5 4-4" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, color: "#333" }}>{item.label}</span>
                        {item.required && !item.complete && (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, color: "#0369a1", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 20, padding: "1px 6px" }}>Commonly requested</span>
                        )}
                        {!item.required && !item.complete && (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, color: "#6b7280", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 20, padding: "1px 6px" }}>Helpful to have</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Uploaded artifacts</p>
                {event.artifacts.map((a, i) => (
                  <div key={i} style={{
                    background: "white", border: "1px solid #f0f0f0",
                    borderRadius: 12, padding: "10px 12px", marginBottom: 6,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontSize: 12, color: "#333" }}>{a.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: a.status === "uploaded" ? "#059669" : "#d97706",
                      background: a.status === "uploaded" ? "#f0fdf4" : "#fffbeb",
                      border: `1px solid ${a.status === "uploaded" ? "#bbf7d0" : "#fde68a"}`,
                      borderRadius: 20, padding: "2px 7px",
                    }}>
                      {a.status === "uploaded" ? "Uploaded" : "Pending"}
                    </span>
                  </div>
                ))}
                <button style={{
                  width: "100%", padding: "10px 0",
                  background: "none", border: "1.5px dashed #d1d5db",
                  borderRadius: 12, fontSize: 12, fontWeight: 500, color: "#9ca3af",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <span>+</span> Add artifact
                </button>
              </div>
            </div>
          )}

          {tab === "actions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Action checklist</p>
              {event.actionChecklist.map((item, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{
                    background: "white", border: `1px solid ${item.complete ? "#bbf7d0" : "#f0f0f0"}`,
                    borderRadius: 12, padding: "11px 12px",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      background: item.complete ? "#f0fdf4" : "#f9fafb",
                      border: `1.5px solid ${item.complete ? "#22c55e" : "#d1d5db"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {item.complete && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5 4-4" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "#333", lineHeight: 1.4 }}>{item.label}</span>
                  </div>
                  {item.label.includes("DOT") && (
                    <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 4px", paddingLeft: 4, lineHeight: 1.5 }}>
                      EU travelers: equivalent complaint may be filed with the relevant national enforcement body under EC 261/2004.
                    </p>
                  )}
                </div>
              ))}
              {event.escalation === null && (
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "11px 13px", marginTop: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", margin: "0 0 3px" }}>Group trip</p>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                    If other travelers in your group were affected, each person should document their own incident separately to support individual claims.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// EVENT CARD
// ---------------------------------------------------------------------------
function EventCard({ event, onOpen }) {
  const typeCfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.security_hold;
  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.open;
  const evidCfg = EVIDENCE_CONFIG[event.evidenceStatus] || EVIDENCE_CONFIG.incomplete;

  return (
    <div
      onClick={() => onOpen(event)}
      style={{
        background: "white", border: `1.5px solid ${event.status === "open" ? typeCfg.border : "#f0f0f0"}`,
        borderRadius: 18, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)", cursor: "pointer",
      }}
    >
      <div style={{ padding: "14px 14px 12px" }}>
        {/* Type icon + header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, background: typeCfg.bg, border: `1.5px solid ${typeCfg.border}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
            }}>
              {typeCfg.icon}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.1px" }}>{event.typeLabel}</p>
              <p style={{ fontSize: 10, color: "#888", margin: 0 }}>{event.tripFlag} {event.trip}</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: statusCfg.color,
              background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
              borderRadius: 20, padding: "2px 8px",
            }}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* Location + time */}
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: "#555", margin: "0 0 2px" }}>{event.location}</p>
          <p style={{ fontSize: 10, color: "#aaa", margin: 0 }}>{event.timestamp}</p>
        </div>

        {/* Evidence + next action */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: evidCfg.dot }} />
            <span style={{ fontSize: 10, color: evidCfg.color, fontWeight: 600 }}>{evidCfg.label}</span>
          </div>
          {event.nextAction ? (
            <span style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 600 }}>Action needed →</span>
          ) : (
            <span style={{ fontSize: 10, color: "#9ca3af" }}>View details →</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NARRATE SHEET — full screen, transcription, save flow
// ---------------------------------------------------------------------------
function NarrateSheet({ context, eventTitle, onDismiss, onSave }) {
  const [phase, setPhase] = useState("idle");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [bars, setBars] = useState(Array.from({ length: 24 }, () => 8));
  const [micError, setMicError] = useState(false);
  const [fallbackText, setFallbackText] = useState("");
  const timerRef = useRef(null);
  const barTimerRef = useRef(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    setMicError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); };
      recorder.start();
      mediaRef.current = recorder;
      setPhase("recording");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      barTimerRef.current = setInterval(() => {
        setBars(Array.from({ length: 24 }, () => Math.random() * 28 + 4));
      }, 120);
    } catch {
      setMicError(true);
    }
  }

  function stopRecording() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    clearInterval(timerRef.current);
    clearInterval(barTimerRef.current);
    setPhase("transcribing");
    setTimeout(() => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const savedDuration = duration;
      const mins = Math.floor(savedDuration / 60);
      const secs = savedDuration % 60;
      setTranscript(`[Voice narration recorded — ${mins}:${secs.toString().padStart(2, "0")}. Transcription pending.]`);
      setPhase("review");
    }, 800);
  }

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(barTimerRef.current);
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
        mediaRef.current.stream && mediaRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  function formatDuration(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <>
      <div onClick={phase === "idle" ? onDismiss : undefined} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, display: "flex", flexDirection: "column",
        maxHeight: phase === "review" ? "92%" : "72%",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
        transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Narration</p>
            {phase === "idle" && (
              <button onClick={onDismiss} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
          {eventTitle && (
            <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>{eventTitle}</p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 28px" }}>
          {micError && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 12px", margin: "12px 0 0", fontSize: 12, color: "#92400e", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" stroke="#d97706" strokeWidth="1.6"/><path d="M12 8v4M12 16h.01" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round"/></svg>
              Microphone access denied. Use the text field below.
            </div>
          )}
          {(phase === "idle" || phase === "recording") && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 28, gap: 20 }}>
              {/* Mic button */}
              <div style={{ position: "relative" }}>
                {phase === "recording" && (
                  <>
                    <div style={{ position: "absolute", inset: -16, borderRadius: "50%", background: "rgba(220,38,38,0.08)", animation: "ping 1.2s ease-in-out infinite" }} />
                    <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: "rgba(220,38,38,0.12)", animation: "ping 1.2s ease-in-out infinite 0.3s" }} />
                  </>
                )}
                <button
                  onClick={phase === "idle" ? startRecording : stopRecording}
                  style={{
                    width: 82, height: 82, borderRadius: "50%", border: "none",
                    background: phase === "recording"
                      ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
                      : "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", position: "relative", zIndex: 1,
                    boxShadow: phase === "recording"
                      ? "0 0 0 3px rgba(220,38,38,0.3), 0 8px 24px rgba(220,38,38,0.35)"
                      : "0 4px 20px rgba(0,0,0,0.25)",
                    transition: "all 0.25s",
                  }}
                >
                  {phase === "recording" ? (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="5" width="14" height="14" rx="2" fill="white"/>
                    </svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                      <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M12 19v3M9 22h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>

              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: phase === "recording" ? "#dc2626" : "#111", margin: "0 0 4px" }}>
                  {phase === "recording" ? "Recording — tap to stop" : "Tap to record"}
                </p>
                {phase === "idle" && (
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Describe what happened in your own words</p>
                )}
                {phase === "recording" && (
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                    {formatDuration(duration)}
                  </p>
                )}
              </div>

              {phase === "recording" && (
                <div style={{ display: "flex", gap: 2.5, alignItems: "center", height: 40, padding: "0 4px" }}>
                  {bars.map((h, i) => (
                    <div key={i} style={{
                      width: 3, background: "linear-gradient(to top, #dc2626, #f87171)",
                      borderRadius: 2, height: h,
                      transition: "height 0.12s ease",
                    }} />
                  ))}
                </div>
              )}

              {phase === "idle" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                    <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
                    <span style={{ fontSize: 11, color: "#bbb", fontWeight: 500 }}>or type instead</span>
                    <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
                  </div>
                  <textarea
                    value={fallbackText}
                    onChange={(e) => setFallbackText(e.target.value)}
                    placeholder="Describe what happened in your own words..."
                    rows={4}
                    style={{
                      width: "100%", padding: "12px 14px",
                      background: "#f9fafb", border: "1.5px solid #e5e7eb",
                      borderRadius: 14, fontSize: 13, color: "#111",
                      resize: "none", fontFamily: "system-ui, -apple-system, sans-serif",
                      lineHeight: 1.6, boxSizing: "border-box", outline: "none",
                    }}
                  />
                  {fallbackText.trim() ? (
                    <button onClick={() => { onSave && onSave(fallbackText); onDismiss(); }} style={{ width: "100%", padding: "13px 0", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, color: "white", cursor: "pointer" }}>
                      Save note
                    </button>
                  ) : (
                    <button onClick={onDismiss} style={{ width: "100%", padding: "11px 0", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 14, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {phase === "transcribing" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid #1d4ed8", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>Transcribing...</p>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, textAlign: "center" }}>This may take a moment depending on length</p>
            </div>
          )}

          {phase === "review" && (
            <div style={{ paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Transcription</p>
                <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", borderRadius: 20, padding: "2px 8px" }}>{duration}s recorded</span>
              </div>
              <div style={{
                background: "#f9fafb", border: "1.5px solid #e5e7eb",
                borderRadius: 14, padding: "14px",
                marginBottom: 14, position: "relative",
              }}>
                <p style={{ fontSize: 13, color: "#111", margin: 0, lineHeight: 1.7 }}>{transcript}</p>
                <button style={{
                  position: "absolute", top: 10, right: 10,
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 10, fontWeight: 600, color: "#1d4ed8",
                }}>
                  Edit
                </button>
              </div>

              <div style={{
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 12, padding: "10px 12px", marginBottom: 14,
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="9" stroke="#059669" strokeWidth="1.6"/>
                  <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p style={{ fontSize: 12, color: "#059669", margin: 0, fontWeight: 600 }}>
                  Narration ready — will be saved under this event
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => { onSave && onSave(transcript); onDismiss(); }}
                  style={{
                    width: "100%", padding: "14px 0",
                    background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                    border: "none", borderRadius: 14,
                    fontSize: 14, fontWeight: 700, color: "white", cursor: "pointer",
                    letterSpacing: "-0.1px",
                  }}
                >
                  Save Narration
                </button>
                <button
                  onClick={() => setPhase("idle")}
                  style={{
                    width: "100%", padding: "11px 0",
                    background: "none", border: "1.5px solid #e5e7eb",
                    borderRadius: 14, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer",
                  }}
                >
                  Re-record
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ping { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// LOG EVENT MENU SHEET
// ---------------------------------------------------------------------------
function LogEventMenu({ onDismiss, onNarrate }) {
  const [selectedTrip, setSelectedTrip] = useState(TRIPS_FOR_EVENTS[0]);
  const [tripPickerOpen, setTripPickerOpen] = useState(false);

  const eventTypes = [
    { type: "denied_boarding", icon: "✈", label: "Denied Boarding" },
    { type: "security_hold", icon: "🔒", label: "Security Hold" },
    { type: "customs_delay", icon: "🛂", label: "Customs Delay" },
    { type: "border_closure", icon: "🚧", label: "Border Closure" },
    { type: "visa_issue", icon: "📋", label: "Visa Issue" },
    { type: "secondary_screening", icon: "🔍", label: "Secondary Screening" },
  ];

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 301, padding: "0 0 28px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
        maxHeight: "85%", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 0" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 12px", letterSpacing: "-0.2px" }}>Log event</p>

          {/* Trip selector */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Attach to trip</p>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setTripPickerOpen(!tripPickerOpen)}
                style={{
                  width: "100%", background: "#f9fafb", border: "1.5px solid #e5e7eb",
                  borderRadius: 13, padding: "11px 13px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                }}
              >
                <span style={{ fontSize: 18 }}>{selectedTrip.flag}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0 }}>{selectedTrip.name}</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{selectedTrip.dates}</p>
                </div>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: tripPickerOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path d="M1 1l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {tripPickerOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  background: "white", border: "1px solid #e5e7eb", borderRadius: 13, overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10,
                }}>
                  {TRIPS_FOR_EVENTS.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTrip(t); setTripPickerOpen(false); }}
                      style={{
                        width: "100%", background: t.id === selectedTrip.id ? "#f0f6ff" : "none",
                        border: "none", borderTop: i > 0 ? "1px solid #f5f5f5" : "none",
                        padding: "11px 13px", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{t.flag}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0 }}>{t.name}</p>
                        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{t.dates}</p>
                      </div>
                      {t.id === selectedTrip.id && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M4 12l5 5L20 7" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Narrate CTA — prominent */}
          <button
            onClick={onNarrate}
            style={{
              width: "100%", marginBottom: 14,
              background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
              border: "none", borderRadius: 16, padding: "14px 16px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              boxShadow: "0 4px 16px rgba(30,58,95,0.3)",
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 19v3M9 22h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "white", margin: "0 0 1px" }}>Narrate what happened</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>Speak — we&apos;ll log and transcribe it</p>
            </div>
          </button>

          {/* Event type list */}
          <p style={{ fontSize: 10, fontWeight: 600, color: "#aaa", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Or choose event type</p>
          <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, overflow: "hidden" }}>
            {eventTypes.map((et, i) => (
              <button
                key={et.type}
                onClick={onDismiss}
                style={{
                  width: "100%", background: "none", border: "none",
                  padding: "11px 13px",
                  borderBottom: i < eventTypes.length - 1 ? "1px solid #f5f5f5" : "none",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16, width: 24 }}>{et.icon}</span>
                <span style={{ fontSize: 13, color: "#333" }}>{et.label}</span>
                <svg width="5" height="8" viewBox="0 0 5 8" fill="none" style={{ marginLeft: "auto" }}>
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
// EVENT TYPES ACCORDION
// ---------------------------------------------------------------------------
const EVENT_TYPE_DESCRIPTIONS = {
  denied_boarding: "Carrier refuses to allow a confirmed passenger to board due to overbooking or operational reasons.",
  security_hold: "Traveler is detained or held at a security checkpoint beyond standard screening times.",
  customs_delay: "Extended delay at customs or immigration, including random secondary inspection.",
  border_closure: "A land, air, or sea border is temporarily or permanently closed to passage.",
  visa_issue: "A visa is rejected, revoked, or found insufficient for the destination country.",
  secondary_screening: "Enhanced screening selected either randomly or due to a flagged item or profile.",
  airport_access: "Inability to enter or move through an airport due to security, strikes, or policy.",
};

function EventTypesAccordion() {
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null);

  return (
    <div style={{ marginBottom: 8, background: "white", border: "1px solid #f0f0f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "12px 14px", display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0, flex: 1, textAlign: "left" }}>Event types tracked</p>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", flexShrink: 0 }}
        >
          <path d="M3 5l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #f0f0f0" }}>
          {Object.entries(TYPE_CONFIG).map(([key, cfg], i, arr) => (
            <div key={key} style={{
              padding: "10px 14px",
              borderBottom: i < arr.length - 1 ? "1px solid #f5f5f5" : "none",
              display: "flex", alignItems: "center", gap: 10, position: "relative",
            }}>
              <span style={{ fontSize: 14 }}>{cfg.icon}</span>
              <span style={{ fontSize: 12, color: "#333", flex: 1 }}>{cfg.label}</span>
              <div style={{ position: "relative" }}>
                <button
                  onMouseEnter={() => setTooltip(key)}
                  onMouseLeave={() => setTooltip(null)}
                  onTouchStart={() => setTooltip(tooltip === key ? null : key)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: 2, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#9ca3af" strokeWidth="1.5"/>
                    <path d="M12 8v1M12 11v5" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>
                {tooltip === key && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 6px)", right: 0,
                    background: "rgba(17,17,17,0.92)", borderRadius: 10, padding: "8px 11px",
                    width: 200, zIndex: 20,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                    pointerEvents: "none",
                  }}>
                    <p style={{ fontSize: 11, color: "white", margin: 0, lineHeight: 1.5 }}>
                      {EVENT_TYPE_DESCRIPTIONS[key] || cfg.label}
                    </p>
                    <div style={{
                      position: "absolute", top: "100%", right: 10,
                      width: 0, height: 0,
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderTop: "5px solid rgba(17,17,17,0.92)",
                    }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EVENTS SCREEN
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GLOBAL INCIDENTS DASHBOARD (replaces EventsScreen)
// ---------------------------------------------------------------------------
const ALL_INCIDENTS = [
  {
    id: "inc-1",
    type: "flight_delay",
    title: "Flight delay detected",
    ref: "AC780",
    route: "Toronto → Boston",
    tripName: "Portugal 2026",
    tripFlag: "🇵🇹",
    date: "Oct 9",
    status: "open",
    evidenceStatus: "incomplete",
  },
  {
    id: "inc-2",
    type: "baggage_delay",
    title: "Baggage delayed",
    ref: "AA342",
    route: "New York → Boston",
    tripName: "NYC Weekend",
    tripFlag: "🇺🇸",
    date: "Sep 5",
    status: "open",
    evidenceStatus: "incomplete",
  },
  {
    id: "inc-3",
    type: "denied_boarding",
    title: "Denied boarding",
    ref: "JB 1044",
    route: "JFK → BOS",
    tripName: "NYC Weekend",
    tripFlag: "🇺🇸",
    date: "Sep 5",
    status: "open",
    evidenceStatus: "complete",
  },
  {
    id: "inc-4",
    type: "trip_cancellation",
    title: "Trip cancellation — weather",
    ref: "Weather event",
    route: "JFK → BCN",
    tripName: "Barcelona Getaway",
    tripFlag: "🇪🇸",
    date: "Mar 18",
    status: "resolved",
    evidenceStatus: "complete",
  },
  {
    id: "inc-5",
    type: "hotel_issue",
    title: "Hotel overbooking",
    ref: "Hotel Arts",
    route: "Barcelona",
    tripName: "Barcelona Getaway",
    tripFlag: "🇪🇸",
    date: "Mar 22",
    status: "resolved",
    evidenceStatus: "complete",
  },
];

const INC_TYPE_CONFIG = {
  flight_delay: { color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: "✈" },
  baggage_delay: { color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", icon: "🧳" },
  denied_boarding: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "✈" },
  trip_cancellation: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "✖" },
  hotel_issue: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", icon: "🏨" },
  customs_delay: { color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", icon: "🛂" },
  security_hold: { color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: "🔒" },
};

const INC_STATUS = {
  open: { label: "OPEN", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  resolved: { label: "RESOLVED", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
};

function IncidentCard({ incident, onOpenWorkspace, onResolve }) {
  const typeCfg = INC_TYPE_CONFIG[incident.type] || INC_TYPE_CONFIG.flight_delay;
  const statusCfg = INC_STATUS[incident.status] || INC_STATUS.open;

  return (
    <div style={{
      background: "white", border: "1px solid #f0f0f0",
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{ padding: "12px 13px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: typeCfg.bg, border: `1px solid ${typeCfg.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, flexShrink: 0,
            }}>
              {typeCfg.icon}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>{incident.title}</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "1px 0 0" }}>{incident.ref} · {incident.route}</p>
            </div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700,
            color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
            borderRadius: 20, padding: "2px 7px", flexShrink: 0, marginLeft: 6,
          }}>
            {statusCfg.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 12 }}>{incident.tripFlag}</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Trip: {incident.tripName}</span>
          <span style={{ fontSize: 10, color: "#d1d5db" }}>·</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{incident.date}</span>
        </div>

        <div style={{ display: "flex", gap: 7 }}>
          <button
            onClick={() => onOpenWorkspace && onOpenWorkspace(incident)}
            style={{
              flex: 1, padding: "8px 0",
              background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
              border: "none", borderRadius: 9,
              fontSize: 12, fontWeight: 600, color: "white", cursor: "pointer",
            }}
          >
            Open workspace
          </button>
          {incident.status === "open" && (
            <button
              onClick={() => onResolve && onResolve(incident.id)}
              style={{
                flex: 1, padding: "8px 0",
                background: "none", border: "1.5px solid #e5e7eb",
                borderRadius: 9, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer",
              }}
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EventsScreen({ onOpenWorkspace }) {
  const [logMenuOpen, setLogMenuOpen] = useState(false);
  const [narrateOpen, setNarrateOpen] = useState(false);
  const [incidents, setIncidents] = useState(ALL_INCIDENTS);

  const openInc = incidents.filter((i) => i.status === "open");
  const resolvedInc = incidents.filter((i) => i.status === "resolved");

  function handleResolve(id) {
    setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, status: "resolved" } : i));
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      <div style={{ padding: "8px 16px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Incidents</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setNarrateOpen(true)}
              style={{
                background: "none", border: "1.5px solid #e5e7eb", borderRadius: 20,
                padding: "6px 11px", fontSize: 12, fontWeight: 600, color: "#374151",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="#374151"/>
                <path d="M5 10a7 7 0 0014 0" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 19v3M9 22h6" stroke="#374151" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Narrate
            </button>
            <button
              onClick={() => setLogMenuOpen(true)}
              style={{
                background: "#111", border: "none", borderRadius: 20,
                padding: "7px 13px", fontSize: 12, fontWeight: 600, color: "white",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <span>+</span> Log incident
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Travel incidents across your trips</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 106px" }}>
        {openInc.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Open</p>
              <span style={{ fontSize: 11, color: "#aaa" }}>{openInc.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {openInc.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  onOpenWorkspace={onOpenWorkspace}
                  onResolve={handleResolve}
                />
              ))}
            </div>
          </div>
        )}

        {resolvedInc.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Resolved</p>
              <span style={{ fontSize: 11, color: "#aaa" }}>{resolvedInc.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resolvedInc.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  onOpenWorkspace={onOpenWorkspace}
                  onResolve={handleResolve}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {logMenuOpen && (
        <LogEventMenu
          onDismiss={() => setLogMenuOpen(false)}
          onNarrate={() => { setLogMenuOpen(false); setNarrateOpen(true); }}
        />
      )}

      {narrateOpen && (
        <NarrateSheet
          context="Describe the incident in your own words"
          onDismiss={() => setNarrateOpen(false)}
          onSave={(text) => {
            const newInc = {
              id: `inc-narrate-${Date.now()}`,
              title: "Voice-narrated incident",
              ref: "",
              route: "",
              date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              tripFlag: "",
              tripName: "Current trip",
              status: "open",
              type: "other",
              description: text,
            };
            setIncidents((prev) => [newInc, ...prev]);
          }}
        />
      )}
    </div>
  );
}
