"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
const TRIPS_FOR_ROUTES = [
  { id: "t1", name: "Portugal 2026", flag: "🇵🇹", dates: "Jun 12 – Jun 24", active: true },
  { id: "t2", name: "Japan 2027", flag: "🇯🇵", dates: "Mar 4 – Mar 18", active: false },
  { id: "t3", name: "Toronto 2025", flag: "🇨🇦", dates: "Oct 9 – Oct 14", active: false },
  { id: "t4", name: "Berlin Summit 2026", flag: "🇩🇪", dates: "Sep 15 – Sep 20", active: false, groupSize: 10, tripType: "business" },
];

const ARCHIVED_TRIPS = [
  { id: "a1", name: "NYC Weekend", flag: "🇺🇸", dates: "Sep 5 – Sep 7, 2024", archived: true },
  { id: "a2", name: "Tokyo Conference", flag: "🇯🇵", dates: "Aug 3 – Aug 10, 2024", archived: true },
];

const TRIP_TRAVELERS = {
  t1: [
    { id: "tr1", name: "James Donovan", initials: "JD", color: "#1d4ed8", role: "primary", joinSegment: 1 },
    { id: "tr2", name: "Maria Santos", initials: "MS", color: "#059669", role: "joining", joinSegment: 3, joinNote: "Joining in Porto (Jun 18) for the final leg" },
  ],
  t2: [
    { id: "tr1", name: "James Donovan", initials: "JD", color: "#1d4ed8", role: "primary", joinSegment: 1 },
  ],
  t3: [
    { id: "tr1", name: "James Donovan", initials: "JD", color: "#1d4ed8", role: "primary", joinSegment: 1 },
  ],
  t4: [
    { id: "tr1", name: "James Donovan", initials: "JD", color: "#1d4ed8", role: "primary", joinSegment: 1 },
    { id: "tr2", name: "Sarah Kim", initials: "SK", color: "#059669", role: "joining", joinSegment: 1, joinNote: "All segments" },
    { id: "tr3", name: "Marcus Allen", initials: "MA", color: "#d97706", role: "joining", joinSegment: 1, joinNote: "All segments" },
    { id: "tr4", name: "Priya Nair", initials: "PN", color: "#dc2626", role: "joining", joinSegment: 1, joinNote: "All segments" },
    { id: "tr5", name: "Tom Eriksson", initials: "TE", color: "#7c3aed", role: "joining", joinSegment: 1, joinNote: "All segments" },
    { id: "tr6", name: "Yuki Tanaka", initials: "YT", color: "#0891b2", role: "joining", joinSegment: 1, joinNote: "All segments" },
    { id: "tr7", name: "Aisha Okafor", initials: "AO", color: "#be185d", role: "joining", joinSegment: 1, joinNote: "All segments" },
    { id: "tr8", name: "Ben Carter", initials: "BC", color: "#065f46", role: "joining", joinSegment: 1, joinNote: "All segments" },
    { id: "tr9", name: "Leila Razavi", initials: "LR", color: "#92400e", role: "joining", joinSegment: 2, joinNote: "Joining Frankfurt (Sep 16)" },
    { id: "tr10", name: "Dmitri Volkov", initials: "DV", color: "#374151", role: "joining", joinSegment: 2, joinNote: "Joining Frankfurt (Sep 16)" },
  ],
};

const SEGMENTS = {
  t1: [
    {
      id: "s1", num: 1,
      origin: "New York (JFK)", dest: "Lisbon (LIS)",
      depart: "Jun 12 · 22:45", arrive: "Jun 13 · 10:30",
      mode: "air", carrier: "TAP Air Portugal", flightNum: "TP 205",
      buffer: "2h 15m to hotel check-in (taxi/rideshare from LIS)",
      validation: "ok",
      notes: null,
      weather: { icon: "☀", summary: "Clear · 75°F", impact: null },
      travelers: ["tr1"],
    },
    {
      id: "s2", num: 2,
      origin: "Hotel Lisbon", dest: "Lisbon (LIS)",
      depart: "Jun 18 · 13:00", arrive: "Jun 18 · 14:00",
      mode: "road", carrier: "Taxi / Rideshare", flightNum: null,
      buffer: "2h 10m connection window at LIS (tight — intl check-in requires 2h)",
      validation: "warning",
      warningText: "Tight connection — allow extra time for check-in",
      notes: "LIS requires 2h for intl check-in. Current buffer is 2h 10m.",
      weather: { icon: "🌤", summary: "Partly cloudy · 72°F", impact: null },
      travelers: ["tr1"],
    },
    {
      id: "s3", num: 3,
      origin: "Lisbon (LIS)", dest: "Porto (OPO)",
      depart: "Jun 18 · 15:10", arrive: "Jun 18 · 16:00",
      mode: "air", carrier: "TAP Air Portugal", flightNum: "TP 782",
      buffer: "30m transfer to hotel (approx. 12 km from OPO airport)",
      validation: "ok",
      notes: null,
      weather: { icon: "⛅", summary: "Light cloud · 66°F", impact: null },
      travelers: ["tr1", "tr2"],
      joiningHere: ["tr2"],
    },
    {
      id: "s4", num: 4,
      origin: "Porto (OPO)", dest: "New York (JFK)",
      depart: "Jun 24 · 09:00", arrive: "Jun 24 · 11:45",
      mode: "air", carrier: "United Airlines", flightNum: "UA 59",
      buffer: null,
      validation: "blocked",
      warningText: "Date conflicts with segment 3 return date",
      notes: "Departure at 09:00 requires overnight stay arranged. Verify hotel checkout.",
      weather: { icon: "🌧", summary: "Rain expected · 59°F", impact: "Minor ground delays possible" },
      travelers: ["tr1"],
    },
  ],
  t2: [
    {
      id: "s1", num: 1,
      origin: "New York (JFK)", dest: "Tokyo (NRT)",
      depart: "Mar 4 · 23:55", arrive: "Mar 6 · 03:40",
      mode: "air", carrier: "ANA", flightNum: "NH 1010",
      buffer: "1h 20m layover at NRT (same terminal — tight on arrival)",
      validation: "warning",
      warningText: "Short layover — connection at NRT may be tight on arrival",
      notes: null,
      weather: { icon: "☁", summary: "Overcast · 46°F", impact: null },
      travelers: ["tr1"],
    },
    {
      id: "s2", num: 2,
      origin: "Tokyo (NRT)", dest: "New York (JFK)",
      depart: "Mar 18 · 10:00", arrive: "Mar 18 · 08:30",
      mode: "air", carrier: "ANA", flightNum: "NH 1009",
      buffer: null,
      validation: "ok",
      notes: null,
      weather: { icon: "☀", summary: "Clear · 43°F", impact: null },
      travelers: ["tr1"],
    },
  ],
  t4: [
    {
      id: "s1", num: 1,
      origin: "New York (JFK)", dest: "Frankfurt (FRA)",
      depart: "Sep 15 · 19:30", arrive: "Sep 16 · 09:10",
      mode: "air", carrier: "Lufthansa", flightNum: "LH 405",
      buffer: "2h 30m layover at FRA (terminal transfer required)",
      validation: "ok",
      notes: null,
      weather: { icon: "⛅", summary: "Partly cloudy · 63°F", impact: null },
      travelers: ["tr1","tr2","tr3","tr4","tr5","tr6","tr7","tr8"],
    },
    {
      id: "s2", num: 2,
      origin: "Frankfurt (FRA)", dest: "Berlin (BER)",
      depart: "Sep 16 · 11:45", arrive: "Sep 16 · 12:50",
      mode: "air", carrier: "Lufthansa", flightNum: "LH 190",
      buffer: "45m transfer to hotel (approx. 22 km from BER airport)",
      validation: "ok",
      notes: null,
      weather: { icon: "🌤", summary: "Mostly clear · 59°F", impact: null },
      travelers: ["tr1","tr2","tr3","tr4","tr5","tr6","tr7","tr8","tr9","tr10"],
      joiningHere: ["tr9","tr10"],
    },
    {
      id: "s3", num: 3,
      origin: "Berlin (BER)", dest: "New York (JFK)",
      depart: "Sep 20 · 14:20", arrive: "Sep 20 · 17:30",
      mode: "air", carrier: "United Airlines", flightNum: "UA 94",
      buffer: null,
      validation: "warning",
      warningText: "Group check-in — allow 90m extra at BER for 10 passengers",
      notes: "Group booking reference: UG-8840. Check-in opens T-24h.",
      weather: { icon: "☀", summary: "Clear · 55°F", impact: null },
      travelers: ["tr1","tr2","tr3","tr4","tr5","tr6","tr7","tr8","tr9","tr10"],
    },
  ],
  t3: [
    {
      id: "s1", num: 1,
      origin: "Boston (BOS)", dest: "Toronto (YYZ)",
      depart: "Oct 9 · 08:00", arrive: "Oct 9 · 09:20",
      mode: "air", carrier: "Air Canada", flightNum: "AC 780",
      buffer: "Early arrival — hotel check-in from 15:00 (approx. 28 km from YYZ)",
      validation: "ok",
      notes: null,
      weather: { icon: "🌤", summary: "Partly cloudy · 54°F", impact: null },
      travelers: ["tr1"],
    },
    {
      id: "s2", num: 2,
      origin: "Toronto (YYZ)", dest: "Boston (BOS)",
      depart: "Oct 14 · 18:30", arrive: "Oct 14 · 19:50",
      mode: "air", carrier: "Air Canada", flightNum: "AC 789",
      buffer: null,
      validation: "ok",
      notes: null,
      weather: { icon: "☀", summary: "Clear · 57°F", impact: null },
      travelers: ["tr1"],
    },
  ],
};

const VALIDATION_CONFIG = {
  ok:      { label: "Clear",    color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e" },
  warning: { label: "Advisory", color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  blocked: { label: "Blocked",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca", dot: "#ef4444" },
};

const MODE_ICON = ({ mode, size = 13, color = "#6b7280" }) => {
  if (mode === "air") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>
  );
  if (mode === "road") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="20" height="11" rx="3" stroke={color} strokeWidth="1.8"/>
      <circle cx="7" cy="19" r="2" fill={color}/>
      <circle cx="17" cy="19" r="2" fill={color}/>
    </svg>
  );
  if (mode === "rail") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="14" rx="3" stroke={color} strokeWidth="1.8"/>
      <path d="M4 9h16" stroke={color} strokeWidth="1.4"/>
      <path d="M8 22l2-4M16 22l-2-4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  return <span style={{ fontSize: size * 0.8, color }}>·</span>;
};

// ---------------------------------------------------------------------------
// TRIP SWITCHER DROPDOWN
// ---------------------------------------------------------------------------
function TripSwitcherDropdown({ activeTrip, onSelect, onDismiss }) {
  const others = TRIPS_FOR_ROUTES.filter((t) => t.id !== activeTrip.id);

  return (
    <>
      <div onClick={onDismiss} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
      <div style={{
        position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6,
        background: "white", borderRadius: 16, zIndex: 101,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        border: "1px solid #f0f0f0", overflow: "hidden",
      }}>
        <div style={{ padding: "8px 14px 6px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Switch trip</p>
        </div>
        {others.map((t, i) => (
          <button
            key={t.id}
            onClick={() => { onSelect(t.id); onDismiss(); }}
            style={{
              width: "100%", background: "none", border: "none",
              borderTop: "1px solid #f5f5f5",
              padding: "11px 14px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10, textAlign: "left",
            }}
          >
            <span style={{ fontSize: 18 }}>{t.flag}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0 }}>{t.name}</p>
              <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{t.dates}</p>
            </div>
            {t.tripType === "business" && (
              <span style={{ fontSize: 9, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 7px" }}>
                Group · {t.groupSize}
              </span>
            )}
          </button>
        ))}

        <div style={{ background: "#fafafa", borderTop: "1px solid #f0f0f0", padding: "6px 14px 4px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Archived trips</p>
        </div>
        {ARCHIVED_TRIPS.map((t) => (
          <button
            key={t.id}
            onClick={onDismiss}
            style={{
              width: "100%", background: "#fafafa", border: "none",
              borderTop: "1px solid #f5f5f5",
              padding: "11px 14px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 10, textAlign: "left",
              opacity: 0.6,
            }}
          >
            <span style={{ fontSize: 18 }}>{t.flag}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#555", margin: 0 }}>{t.name}</p>
              <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{t.dates}</p>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, color: "#aaa", background: "#ebebeb", borderRadius: 20, padding: "2px 7px" }}>Archived</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ROUTE HEALTH PANEL
// ---------------------------------------------------------------------------
function RouteHealthPanel({ segments }) {
  const blockers = segments.filter((s) => s.validation === "blocked");
  const advisories = segments.filter((s) => s.validation === "warning");
  const [expanded, setExpanded] = useState(false);

  if (blockers.length === 0 && advisories.length === 0) {
    return (
      <div style={{
        background: "#f0fdf4", border: "1px solid #bbf7d0",
        borderRadius: 14, padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7l3.5 3.5 5.5-6" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#059669", margin: "0 0 1px" }}>Route healthy</p>
          <p style={{ fontSize: 11, color: "#16a34a", margin: 0 }}>All segments validated. No conflicts detected.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: blockers.length > 0 ? "#fef2f2" : "#fffbeb",
      border: `1px solid ${blockers.length > 0 ? "#fecaca" : "#fde68a"}`,
      borderRadius: 14, overflow: "hidden", marginBottom: 12,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", background: "none", border: "none",
          padding: "12px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        }}
      >
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Route health</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {blockers.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6.5" fill="#dc2626"/>
                  <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
                  {blockers.length} blocker{blockers.length > 1 ? "s" : ""}
                </span>
              </div>
            )}
            {advisories.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5L1 12h12L7 1.5z" fill="#f59e0b"/>
                  <path d="M7 5.5v3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="7" cy="10" r="0.8" fill="white"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#d97706" }}>
                  {advisories.length} advisor{advisories.length > 1 ? "ies" : "y"}
                </span>
              </div>
            )}
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s", flexShrink: 0 }}
        >
          <path d="M3 5l4 4 4-4" stroke="#aaa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${blockers.length > 0 ? "#fecaca" : "#fde68a"}` }}>
          {blockers.map((s) => (
            <div key={s.id} style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="7" cy="7" r="6.5" fill="#dc2626"/>
                <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", margin: "0 0 2px" }}>
                  Segment {s.num} blocked
                </p>
                <p style={{ fontSize: 11, color: "#991b1b", margin: 0, lineHeight: 1.5 }}>{s.warningText}</p>
              </div>
            </div>
          ))}
          {advisories.map((s) => (
            <div key={s.id} style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M7 1.5L1 12h12L7 1.5z" fill="#f59e0b"/>
                <path d="M7 5.5v3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="7" cy="10" r="0.8" fill="white"/>
              </svg>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#d97706", margin: "0 0 2px" }}>
                  Segment {s.num} advisory
                </p>
                <p style={{ fontSize: 11, color: "#92400e", margin: 0, lineHeight: 1.5 }}>{s.warningText}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRAVELER AVATARS STRIP
// ---------------------------------------------------------------------------
function TravelerAvatars({ travelerIds, allTravelers, size = 18 }) {
  if (!travelerIds || travelerIds.length === 0) return null;
  const travelers = travelerIds.map((id) => allTravelers.find((t) => t.id === id)).filter(Boolean);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {travelers.map((t, i) => (
        <div key={t.id} style={{
          width: size, height: size, borderRadius: "50%",
          background: t.color, border: "2px solid white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.floor(size * 0.44), fontWeight: 700, color: "white",
          marginLeft: i > 0 ? -Math.floor(size * 0.3) : 0,
          flexShrink: 0, zIndex: travelers.length - i, position: "relative",
        }}>
          {t.initials}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NARRATE SHEET
// ---------------------------------------------------------------------------
function NarrateSheet({ context, onDismiss }) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [micError, setMicError] = useState(false);
  const [note, setNote] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  /* Cleanup reads latest recorder/timer at unmount; refs are the source of truth for MediaRecorder. */
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: clear interval id stored in ref at unmount
      const timer = timerRef.current;
      if (timer) clearInterval(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: stop active recorder held in ref at unmount
      const rec = mediaRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
        rec.stream && rec.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function toggleRecord() {
    if (recorded) return;
    if (!recording) {
      setMicError(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); };
        recorder.start();
        mediaRef.current = recorder;
        setRecording(true);
      } catch {
        setMicError(true);
      }
    } else {
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      setRecorded(true);
    }
  }

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, padding: "0 0 32px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "12px 20px 0" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.2px" }}>Narrate Segment</p>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 14px" }}>{context}</p>

          {micError && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12, color: "#92400e", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" stroke="#d97706" strokeWidth="1.6"/><path d="M12 8v4M12 16h.01" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round"/></svg>
              Microphone access denied. Use the text field below.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <button
              onClick={toggleRecord}
              style={{
                width: 72, height: 72, borderRadius: "50%", border: "none", cursor: recorded ? "default" : "pointer",
                background: recorded
                  ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                  : recording
                    ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
                    : "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: recording ? "0 0 0 10px rgba(220,38,38,0.12), 0 0 0 18px rgba(220,38,38,0.06)" : "0 4px 16px rgba(0,0,0,0.2)",
                transition: "all 0.2s",
              }}
            >
              {recorded ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                  <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 19v3M9 22h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <p style={{ fontSize: 13, fontWeight: 600, color: recorded ? "#059669" : recording ? "#dc2626" : "#374151", margin: 0 }}>
              {recorded ? "Narration saved" : recording ? "Recording — tap to stop" : "Tap to record"}
            </p>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Or type your note here…"
            style={{
              width: "100%", minHeight: 72, resize: "none", border: "1.5px solid #e5e7eb",
              borderRadius: 12, padding: "10px 12px", fontSize: 13, color: "#111",
              fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            {(recorded || note.trim()) && (
              <button onClick={onDismiss} style={{ flex: 1, padding: "13px 0", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer" }}>
                Save narration
              </button>
            )}
            <button onClick={onDismiss} style={{ flex: (recorded || note.trim()) ? 0 : 1, padding: "13px 16px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 14, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ADD SEGMENT SHEET
// ---------------------------------------------------------------------------
function AddSegmentSheet({ onDismiss, onNarrate }) {
  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 301, padding: "0 0 28px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "12px 16px 0" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 14px", letterSpacing: "-0.2px" }}>Add route</p>

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
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
                <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 19v3M9 22h6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "white", margin: "0 0 1px" }}>Narrate segment details</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>Speak your flight or route info</p>
            </div>
          </button>

          <p style={{ fontSize: 10, fontWeight: 600, color: "#aaa", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Or enter manually</p>
          <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, overflow: "hidden" }}>
            {[
              { icon: "✈", label: "Air — Flight" },
              { icon: "🚗", label: "Road — Car / Taxi" },
              { icon: "🚆", label: "Rail — Train" },
              { icon: "🚢", label: "Sea — Ferry / Cruise" },
            ].map((opt, i, arr) => (
              <button
                key={opt.label}
                onClick={onDismiss}
                style={{
                  width: "100%", background: "none", border: "none",
                  padding: "11px 13px",
                  borderBottom: i < arr.length - 1 ? "1px solid #f5f5f5" : "none",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16, width: 24 }}>{opt.icon}</span>
                <span style={{ fontSize: 13, color: "#333" }}>{opt.label}</span>
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
// MINI CALENDAR PICKER
// ---------------------------------------------------------------------------
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function MiniCalendar({ value, onSelect, onDismiss, highlightRange }) {
  const today = new Date();
  const initDate = value ? new Date(value) : today;
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(value ? initDate.getDate() : null);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }
  function isToday(d) {
    return d && viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();
  }
  function isHighlighted(d) {
    if (!d || !highlightRange) return false;
    const cell = new Date(viewYear, viewMonth, d);
    return cell >= highlightRange.start && cell <= highlightRange.end;
  }

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, zIndex: 400 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "20px 20px 0 0",
        zIndex: 401, padding: "14px 18px 28px",
        boxShadow: "0 -6px 30px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}>
            <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M7 1L1 6.5 7 12" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: 0 }}>{MONTH_NAMES[viewMonth]} {viewYear}</p>
          <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}>
            <svg width="8" height="13" viewBox="0 0 8 13" fill="none"><path d="M1 1l6 5.5L1 12" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
          {DAY_NAMES.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9ca3af", paddingBottom: 4 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((d, i) => (
            <button
              key={i}
              onClick={() => { if (d) { setSelectedDay(d); onSelect(new Date(viewYear, viewMonth, d)); } }}
              style={{
                aspectRatio: "1", border: "none", borderRadius: "50%", cursor: d ? "pointer" : "default",
                background: d === selectedDay && viewMonth === initDate.getMonth() ? "#1e3a5f"
                  : isToday(d) ? "#eff6ff"
                  : isHighlighted(d) ? "#dbeafe"
                  : "transparent",
                color: d === selectedDay && viewMonth === initDate.getMonth() ? "white"
                  : isToday(d) ? "#1d4ed8"
                  : d ? "#111" : "transparent",
                fontSize: 12, fontWeight: isToday(d) ? 700 : 400,
                outline: isToday(d) && d !== selectedDay ? "1.5px solid #bfdbfe" : "none",
              }}
            >
              {d || ""}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// AIRPORT SEARCH BAR
// ---------------------------------------------------------------------------
const AIRPORT_SUGGESTIONS = [
  "New York (JFK) — John F. Kennedy",
  "New York (LGA) — LaGuardia",
  "Newark (EWR) — Newark Liberty",
  "Los Angeles (LAX)",
  "Chicago (ORD) — O'Hare",
  "San Francisco (SFO)",
  "Miami (MIA)",
  "Boston (BOS) — Logan",
  "Lisbon (LIS) — Humberto Delgado",
  "Porto (OPO) — Francisco de Sá Carneiro",
  "London (LHR) — Heathrow",
  "London (LGW) — Gatwick",
  "Paris (CDG) — Charles de Gaulle",
  "Frankfurt (FRA)",
  "Berlin (BER) — Brandenburg",
  "Tokyo (NRT) — Narita",
  "Tokyo (HND) — Haneda",
  "Toronto (YYZ) — Pearson",
  "Amsterdam (AMS) — Schiphol",
  "Madrid (MAD) — Barajas",
  "Barcelona (BCN) — El Prat",
];

function AirportSearchField({ label, value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [focused, setFocused] = useState(false);
  const filtered = query.length > 0
    ? AIRPORT_SUGGESTIONS.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#f9fafb", border: `1.5px solid ${focused ? "#1e3a5f" : "#e5e7eb"}`,
        borderRadius: 10, padding: "9px 12px", transition: "border-color 0.15s",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" stroke="#9ca3af" strokeWidth="2"/>
          <path d="M21 21l-4.35-4.35" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="City or airport code"
          style={{
            flex: 1, border: "none", background: "transparent", outline: "none",
            fontSize: 13, color: "#111", fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        />
        {query.length > 0 && (
          <button onClick={() => { setQuery(""); onChange(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        )}
      </div>
      {focused && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "white", border: "1px solid #e5e7eb", borderRadius: 10, marginTop: 4,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden",
        }}>
          {filtered.map((s) => {
            const code = s.match(/\(([A-Z]{3})\)/)?.[1];
            return (
              <button
                key={s}
                onMouseDown={() => { setQuery(s.split(" — ")[0] || s); onChange(s.split(" — ")[0] || s); setFocused(false); }}
                style={{
                  width: "100%", background: "none", border: "none", padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  borderBottom: "1px solid #f5f5f5", textAlign: "left",
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#1d4ed8" }}>{code}</span>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#111", margin: 0 }}>{s.split(" — ")[0]}</p>
                  {s.includes(" — ") && <p style={{ fontSize: 10, color: "#888", margin: "1px 0 0" }}>{s.split(" — ")[1]}</p>}
                </div>
                <svg width="5" height="8" viewBox="0 0 5 8" fill="none" style={{ marginLeft: "auto" }}><path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SEGMENT EDIT SHEET
// ---------------------------------------------------------------------------
function SegmentEditSheet({ segment, onDismiss }) {
  const [depart, setDepart] = useState(segment.depart);
  const [arrive, setArrive] = useState(segment.arrive);
  const [origin, setOrigin] = useState(segment.origin);
  const [dest, setDest] = useState(segment.dest);
  const [carrier, setCarrier] = useState(segment.carrier);
  const [notes, setNotes] = useState(segment.notes || "");
  const [calendarFor, setCalendarFor] = useState(null);

  const tripRange = { start: new Date(2026, 5, 12), end: new Date(2026, 5, 24) };

  function handleDateSelect(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const timeStr = calendarFor === "depart"
      ? (depart.includes("·") ? depart.split("·")[1].trim() : "12:00")
      : (arrive.includes("·") ? arrive.split("·")[1].trim() : "12:00");
    const monthName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()];
    const formatted = `${monthName} ${date.getDate()} · ${timeStr}`;
    if (calendarFor === "depart") setDepart(formatted);
    else setArrive(formatted);
    setCalendarFor(null);
  }

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 301, maxHeight: "90%", display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ overflowY: "auto", padding: "0 18px 28px" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 14px", letterSpacing: "-0.2px" }}>
            Edit route {segment.num}
          </p>

          {[
            { label: "Departure date & time", value: depart, key: "depart" },
            { label: "Arrival date & time", value: arrive, key: "arrive" },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</p>
              <button
                onClick={() => setCalendarFor(f.key)}
                style={{
                  width: "100%", background: "#f9fafb", border: "1.5px solid #e5e7eb",
                  borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#111",
                  textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span>{f.value}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="3" stroke="#9ca3af" strokeWidth="1.8"/>
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}

          <AirportSearchField label="Origin" value={origin} onChange={setOrigin} />
          <AirportSearchField label="Destination" value={dest} onChange={setDest} />

          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Carrier / operator</p>
            <input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              style={{
                width: "100%", background: "#f9fafb", border: "1px solid #e5e7eb",
                borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#111",
                outline: "none", boxSizing: "border-box",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="No notes added"
              style={{
                width: "100%", background: "#f9fafb", border: "1px solid #e5e7eb",
                borderRadius: 10, padding: "10px 12px", fontSize: 13, color: notes ? "#111" : "#aaa",
                minHeight: 56, resize: "none", outline: "none", boxSizing: "border-box",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            />
          </div>

          <button style={{ width: "100%", padding: "13px 0", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer" }}>
            Save changes
          </button>
        </div>

        {calendarFor && (
          <MiniCalendar
            value={null}
            onSelect={handleDateSelect}
            onDismiss={() => setCalendarFor(null)}
            highlightRange={tripRange}
          />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// REORDER SEGMENTS SCREEN (sheet)
// ---------------------------------------------------------------------------
function ReorderSegmentsSheet({ segments, onDismiss }) {
  const [order, setOrder] = useState(segments.map((s) => s.id));

  function moveUp(idx) {
    if (idx === 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
  }

  function moveDown(idx) {
    if (idx === order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next);
  }

  const orderedSegs = order.map((id) => segments.find((s) => s.id === id)).filter(Boolean);

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 401, padding: "0 0 32px", maxHeight: "90%",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.22)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "12px 18px 0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.2px" }}>Reorder routes</p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Drag or tap arrows to reorder</p>
          </div>
          <button onClick={onDismiss} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orderedSegs.map((seg, idx) => {
              const vCfg = VALIDATION_CONFIG[seg.validation];
              return (
                <div key={seg.id} style={{
                  background: "white", border: "1.5px solid #f0f0f0",
                  borderRadius: 14, padding: "11px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}>
                  <div style={{
                    width: 6, display: "flex", flexDirection: "column", gap: 2, cursor: "grab", flexShrink: 0,
                  }}>
                    {[0,1,2].map((r) => (
                      <div key={r} style={{ display: "flex", gap: 2 }}>
                        <div style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: "#d1d5db" }} />
                        <div style={{ width: 2.5, height: 2.5, borderRadius: "50%", background: "#d1d5db" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: vCfg.bg, border: `1.5px solid ${vCfg.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: vCfg.color,
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {seg.origin.split(" (")[0]} → {seg.dest.split(" (")[0]}
                    </p>
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{seg.depart}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      style={{ background: idx === 0 ? "#f9fafb" : "#f3f4f6", border: "none", borderRadius: 6, padding: "3px 6px", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.4 : 1 }}
                    >
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 5l3-4 3 4" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === orderedSegs.length - 1}
                      style={{ background: idx === orderedSegs.length - 1 ? "#f9fafb" : "#f3f4f6", border: "none", borderRadius: 6, padding: "3px 6px", cursor: idx === orderedSegs.length - 1 ? "default" : "pointer", opacity: idx === orderedSegs.length - 1 ? 0.4 : 1 }}
                    >
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 1l3 4 3-4" stroke="#555" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "0 18px", flexShrink: 0, display: "flex", gap: 8 }}>
          <button onClick={onDismiss} style={{ flex: 1, padding: "13px 0", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer" }}>
            Save order
          </button>
          <button onClick={onDismiss} style={{ padding: "13px 16px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 14, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SEGMENT ROW — collapsed: route + airline + times + status + traveler initials
// ---------------------------------------------------------------------------
function SegmentRow({ segment, onEdit, allTravelers, onReportDisruption }) {
  const vCfg = VALIDATION_CONFIG[segment.validation];
  const [expanded, setExpanded] = useState(false);
  const joiningTravelers = (segment.joiningHere || [])
    .map((id) => allTravelers.find((t) => t.id === id))
    .filter(Boolean);

  const originCode = segment.origin.match(/\(([^)]+)\)/)?.[1] || segment.origin.split(" ")[0];
  const destCode = segment.dest.match(/\(([^)]+)\)/)?.[1] || segment.dest.split(" ")[0];
  const departTime = segment.depart.split("·")[1]?.trim() || segment.depart;
  const arriveTime = segment.arrive.split("·")[1]?.trim() || segment.arrive;
  const departDate = segment.depart.split("·")[0]?.trim() || "";

  return (
    <div style={{
      background: "white",
      border: `1.5px solid ${segment.validation === "blocked" ? "#fecaca" : segment.validation === "warning" ? "#fde68a" : "#f0f0f0"}`,
      borderRadius: 16, overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      {joiningTravelers.length > 0 && (
        <div style={{
          background: "linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)",
          borderBottom: "1px solid #bbf7d0",
          padding: "5px 14px",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="#059669" strokeWidth="1.8"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#059669" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M19 11l2 2-2 2" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#059669" }}>
            {joiningTravelers.map((t) => t.name).join(", ")} joining here
          </span>
        </div>
      )}

      {/* Collapsed header */}
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "11px 14px", cursor: "pointer" }}>
        {/* Route line */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#111", letterSpacing: "-0.3px" }}>{originCode}</span>
          <svg width="28" height="10" viewBox="0 0 28 10" fill="none" style={{ flexShrink: 0 }}>
            <path d="M0 5h24M20 1l4 4-4 4" stroke="#d1d5db" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#111", letterSpacing: "-0.3px" }}>{destCode}</span>
          <div style={{ flex: 1 }} />
          <span style={{
            fontSize: 9, fontWeight: 700, color: vCfg.color,
            background: vCfg.bg, border: `1px solid ${vCfg.border}`,
            borderRadius: 20, padding: "2px 8px", flexShrink: 0,
          }}>
            {vCfg.label}
          </span>
        </div>

        {/* Carrier + date + times + travelers */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MODE_ICON mode={segment.mode} size={11} color="#9ca3af" />
          <span style={{ fontSize: 11, color: "#9ca3af", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {segment.carrier}{segment.flightNum ? ` ${segment.flightNum}` : ""} · {departDate} · {departTime}–{arriveTime}
          </span>
          <TravelerAvatars travelerIds={segment.travelers} allTravelers={allTravelers} size={17} />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid #f5f5f5", padding: "10px 14px", background: "#fafafa" }}>
          {segment.buffer && (() => {
            const b = segment.buffer;
            const isConnection = b.toLowerCase().includes("connection") || b.toLowerCase().includes("layover") || b.toLowerCase().includes("connect");
            const isTransfer = b.toLowerCase().includes("transfer") || b.toLowerCase().includes("hotel") || b.toLowerCase().includes("check");
            const label = isConnection ? "Connection time" : isTransfer ? "Transfer time" : "Time buffer";
            const iconColor = isConnection ? "#d97706" : "#6b7280";
            return (
              <div style={{ background: isConnection ? "#fffbeb" : "#f5f5f7", borderRadius: 10, padding: "7px 10px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="9" stroke={iconColor} strokeWidth="1.7"/>
                  <path d="M12 7v5l3 3" stroke={iconColor} strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: isConnection ? "#92400e" : "#9ca3af", margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                  <p style={{ fontSize: 12, color: isConnection ? "#78350f" : "#374151", margin: 0, fontWeight: 500 }}>{b}</p>
                  {isTransfer && b.toLowerCase().includes("transfer") && (
                    <p style={{ fontSize: 10, color: "#9ca3af", margin: "2px 0 0" }}>Estimated ground transit time from arrival point</p>
                  )}
                </div>
              </div>
            );
          })()}
          {segment.notes && (
            <div style={{ background: segment.validation === "blocked" ? "#fef2f2" : "#fffbeb", borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: segment.validation === "blocked" ? "#991b1b" : "#92400e", margin: 0, lineHeight: 1.5 }}>{segment.notes}</p>
            </div>
          )}
          <div style={{ background: "#f5f5f7", borderRadius: 10, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>{segment.weather.icon}</span>
              <span style={{ fontSize: 11, color: "#555" }}>{segment.weather.summary}</span>
            </div>
            {segment.weather.impact && <span style={{ fontSize: 10, color: "#d97706", fontWeight: 600 }}>{segment.weather.impact}</span>}
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button
              onClick={() => onEdit(segment)}
              style={{ flex: 1, padding: "9px 0", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#374151" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#374151" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Edit route
            </button>
            <button
              onClick={() => onReportDisruption && onReportDisruption(segment)}
              style={{ flex: 1, padding: "9px 0", background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
              Report disruption
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRAVELER LEGEND PANEL
// ---------------------------------------------------------------------------
function TravelerLegend({ travelers }) {
  if (!travelers || travelers.length <= 1) return null;
  return <TravelerLegendInner travelers={travelers} />;
}

function TravelerLegendInner({ travelers }) {
  const [expanded, setExpanded] = useState(false);
  const isLargeGroup = travelers.length > 5;
  const displayed = isLargeGroup && !expanded ? travelers.slice(0, 4) : travelers;

  return (
    <div style={{
      background: "white", border: "1px solid #f0f0f0",
      borderRadius: 14, padding: "10px 14px", marginBottom: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "#aaa", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>Travelers on this trip</p>
        {isLargeGroup && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 8px" }}>
            Group · {travelers.length} people
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {displayed.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>
              {t.initials}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0 }}>{t.name}</p>
              {t.role === "joining" && t.joinNote && (
                <p style={{ fontSize: 11, color: "#059669", margin: 0 }}>{t.joinNote}</p>
              )}
              {t.role === "primary" && (
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Trip organizer · all segments</p>
              )}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: t.role === "joining" ? "#059669" : "#1d4ed8",
              background: t.role === "joining" ? "#f0fdf4" : "#eff6ff",
              border: `1px solid ${t.role === "joining" ? "#bbf7d0" : "#bfdbfe"}`,
              borderRadius: 20, padding: "2px 8px",
            }}>
              {t.role === "joining" ? "Joining" : "Primary"}
            </span>
          </div>
        ))}
        {isLargeGroup && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontSize: 12, fontWeight: 600, color: "#1d4ed8", textAlign: "left" }}
          >
            + {travelers.length - 4} more travelers
          </button>
        )}
        {isLargeGroup && expanded && (
          <button
            onClick={() => setExpanded(false)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontSize: 12, fontWeight: 600, color: "#6b7280", textAlign: "left" }}
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROUTES SCREEN
// ---------------------------------------------------------------------------
export default function RoutesScreen({ onReportIncident }) {
  const [activeTripId, setActiveTripId] = useState("t1");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editSegment, setEditSegment] = useState(null);
  const [addSegmentOpen, setAddSegmentOpen] = useState(false);
  const [narrateOpen, setNarrateOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [disruptionSegment, setDisruptionSegment] = useState(null);

  function handleReportDisruption(segment) {
    if (onReportIncident) {
      onReportIncident({ flight: segment.flightNum || segment.carrier, route: `${segment.origin} → ${segment.dest}` });
    } else {
      setDisruptionSegment(segment);
    }
  }

  const trip = TRIPS_FOR_ROUTES.find((t) => t.id === activeTripId) || TRIPS_FOR_ROUTES[0];
  const segments = SEGMENTS[trip.id] || [];
  const travelers = TRIP_TRAVELERS[trip.id] || [];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "8px 16px 0", flexShrink: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: "0 0 10px", letterSpacing: "-0.3px" }}>Segments</p>

        {/* Active trip button */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              background: "#111", color: "white",
              border: "none", borderRadius: 22,
              padding: "7px 14px 7px 10px",
              fontSize: 13, fontWeight: 700,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }}>{trip.flag}</span>
            <span>{trip.name}</span>
            {trip.tripType === "business" && (
              <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "2px 7px" }}>
                Group · {trip.groupSize}
              </span>
            )}
            <svg
              width="10" height="6" viewBox="0 0 10 6" fill="none"
              style={{ marginLeft: 2, transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
            >
              <path d="M1 1l4 4 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {dropdownOpen && (
            <TripSwitcherDropdown
              activeTrip={trip}
              onSelect={(id) => { setActiveTripId(id); setDropdownOpen(false); }}
              onDismiss={() => setDropdownOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 106px" }}>
        {/* Route health panel — replaces per-segment warnings */}
        <RouteHealthPanel segments={segments} />

        {/* Traveler legend */}
        <TravelerLegend travelers={travelers} />

        {/* Routes */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>All Routes</p>
            <span style={{ fontSize: 11, color: "#aaa" }}>{segments.length} routes</span>
          </div>

          <div style={{ position: "relative" }}>
            {segments.map((seg, i) => (
              <div key={seg.id} style={{ position: "relative", marginBottom: i < segments.length - 1 ? 8 : 0 }}>
                {i < segments.length - 1 && (
                  <div style={{ position: "absolute", left: 25, top: "100%", width: 2, height: 8, background: "linear-gradient(to bottom, #e5e7eb, transparent)", zIndex: 1 }} />
                )}
                <SegmentRow segment={seg} onEdit={setEditSegment} allTravelers={travelers} onReportDisruption={handleReportDisruption} />
              </div>
            ))}
          </div>
        </div>

        {/* Route actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Segment Actions</p>

          {/* Add segment — primary CTA, full-width prominent */}
          <button
            onClick={() => setAddSegmentOpen(true)}
            style={{
              width: "100%", padding: "13px 14px",
              background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
              border: "none", borderRadius: 14,
              fontSize: 14, fontWeight: 700, color: "white",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(30,58,95,0.3)",
            }}
          >
            <span style={{ fontSize: 16 }}>+</span>
            Add route
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="rgba(255,255,255,0.7)"/>
                <path d="M5 10a7 7 0 0014 0" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              or Narrate
            </span>
          </button>

          {/* Secondary actions */}
          <button
            onClick={() => setReorderOpen(true)}
            style={{
              width: "100%", padding: "11px 14px",
              background: "white", border: "1px solid #e5e7eb",
              borderRadius: 12, fontSize: 13, fontWeight: 600,
              color: "#1e3a5f", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 9h13M3 15h13M17 6l3 3-3 3M17 12l3 3-3 3" stroke="#1e3a5f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Reorder routes
            <svg width="5" height="8" viewBox="0 0 5 8" fill="none" style={{ marginLeft: "auto" }}>
              <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {[
            { label: "Check readiness", icon: "✓" },
            { label: "Confirm trip ready", icon: "🚀" },
          ].map((a) => (
            <button key={a.label} style={{
              width: "100%", padding: "11px 14px",
              background: "white", border: "1px solid #f0f0f0",
              borderRadius: 12, fontSize: 13, fontWeight: 500,
              color: "#333", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <span style={{ fontSize: 14 }}>{a.icon}</span>
              {a.label}
              <svg width="5" height="8" viewBox="0 0 5 8" fill="none" style={{ marginLeft: "auto" }}>
                <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      </div>

      {editSegment && <SegmentEditSheet segment={editSegment} onDismiss={() => setEditSegment(null)} />}

      {addSegmentOpen && (
        <AddSegmentSheet
          onDismiss={() => setAddSegmentOpen(false)}
          onNarrate={() => { setAddSegmentOpen(false); setNarrateOpen(true); }}
        />
      )}

      {narrateOpen && (
        <NarrateSheet
          context="Speak your segment details — origin, destination, carrier, departure time"
          onDismiss={() => setNarrateOpen(false)}
        />
      )}

      {reorderOpen && (
        <ReorderSegmentsSheet segments={segments} onDismiss={() => setReorderOpen(false)} />
      )}

      {disruptionSegment && (
        <>
          <div onClick={() => setDisruptionSegment(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600 }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "white", borderRadius: "22px 22px 0 0",
            zIndex: 601, padding: "0 0 32px",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
            </div>
            <div style={{ padding: "8px 18px 0" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Report Disruption</p>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 16px" }}>
                {disruptionSegment.origin} → {disruptionSegment.dest} · {disruptionSegment.flightNum || disruptionSegment.carrier}
              </p>
              <p style={{ fontSize: 12, color: "#374151", margin: "0 0 16px", lineHeight: 1.6 }}>
                This will create a new incident pre-filled with this segment&apos;s flight details. You can add evidence and start a claim from the Incidents tab.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setDisruptionSegment(null)}
                  style={{ flex: 1, padding: "13px 0", background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", border: "none", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}
                >
                  Create incident
                </button>
                <button
                  onClick={() => setDisruptionSegment(null)}
                  style={{ padding: "13px 16px", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
