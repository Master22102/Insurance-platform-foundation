"use client";

import { useState, useEffect, useRef } from "react";
import EmergencySystem, { ACTIVE_TRIP } from "./EmergencySystem";
import AccountScreen from "./AccountScreen";
import SplashScreen from "./SplashScreen";
import { StatusBar, HomeIndicator, BottomTabBar } from "./screens/SharedShell";
import TripsScreen from "./screens/TripsScreen";
import RoutesScreen from "./screens/RoutesScreen";
import EventsScreen from "./screens/EventsScreen";
import TripOverviewScreen from "./screens/TripOverviewScreen";
import IncidentWorkspaceScreen from "./screens/IncidentWorkspaceScreen";
import ClaimBuilderScreen from "./screens/ClaimBuilderScreen";

// ---------------------------------------------------------------------------
// TRIP DATA MODEL — multi-leg / multi-city aware
// In production this comes from the trips table in Supabase.
// A single "trip" can have N legs, each with its own city, dates, bookings.
// ---------------------------------------------------------------------------
const TRIP = {
  ...ACTIVE_TRIP,
  name: "Portugal 2026",
  // Group travel: this account is the group leader for this trip.
  // In production, group membership is stored in trip_participants table.
  groupRole: "leader",  // "leader" | "participant" | null (solo)
  participants: [
    {
      id: "p1",
      name: "Jordan Davis",
      initials: "JD",
      role: "leader",
      avatarColor: "#2563eb",
      status: "active",
    },
    {
      id: "p2",
      name: "Maria Santos",
      initials: "MS",
      role: "participant",
      avatarColor: "#059669",
      status: "active",
    },
    {
      id: "p3",
      name: "Chris Lee",
      initials: "CL",
      role: "participant",
      avatarColor: "#d97706",
      status: "active",
    },
  ],
  legs: [
    {
      id: "leg-1",
      city: "Lisbon",
      country: "Portugal",
      countryCode: "PT",
      dateRange: "Jun 12 – Jun 18",
      nights: 6,
    },
    {
      id: "leg-2",
      city: "Porto",
      country: "Portugal",
      countryCode: "PT",
      dateRange: "Jun 18 – Jun 24",
      nights: 6,
    },
  ],
  bookings: [
    {
      id: "b1",
      type: "flight",
      title: "TAP Air Portugal · TP 205",
      subtitle: "JFK → LIS · Jun 12, 10:45 PM",
      detail: "Economy · Seat 24A · Confirmation: TAP7823",
      status: "confirmed",
      leg: "leg-1",
      heroImage: "https://images.pexels.com/photos/2026324/pexels-photo-2026324.jpeg?auto=compress&cs=tinysrgb&w=800",
      heroLabel: "John F. Kennedy International Airport",
    },
    {
      id: "b2",
      type: "hotel",
      title: "Bairro Alto Hotel",
      subtitle: "Check-in Jun 13 · 6 nights",
      detail: "Superior room · Reservation: BAH-4421",
      status: "confirmed",
      leg: "leg-1",
      heroImage: "https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=800",
      heroLabel: "Bairro Alto, Lisbon",
    },
    {
      id: "b3",
      type: "flight",
      title: "TAP Air Portugal · TP 782",
      subtitle: "LIS → OPO · Jun 18, 3:10 PM",
      detail: "Economy · Seat 12C · Confirmation: TAP9101",
      status: "confirmed",
      leg: "leg-2",
      heroImage: "https://images.pexels.com/photos/3063470/pexels-photo-3063470.jpeg?auto=compress&cs=tinysrgb&w=800",
      heroLabel: "Lisbon Humberto Delgado Airport",
    },
    {
      id: "b4",
      type: "hotel",
      title: "The Yeatman Hotel",
      subtitle: "Check-in Jun 18 · 6 nights",
      detail: "Classic room · Reservation: TY-8823",
      status: "confirmed",
      leg: "leg-2",
      heroImage: "https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&cs=tinysrgb&w=800",
      heroLabel: "Vila Nova de Gaia, Porto",
    },
  ],
  coverage: [
    {
      id: "cov-1",
      category: "Medical",
      value: "$250,000",
      icon: "medical",
      subItems: ["Emergency treatment", "Medical evacuation"],
      docLabel: "View policy document",
    },
    {
      id: "cov-3",
      category: "Trip cancellation",
      value: "$10,000",
      icon: "cancel",
      docLabel: "View policy document",
    },
    {
      id: "cov-4",
      category: "Baggage loss",
      value: "$2,500",
      icon: "baggage",
      docLabel: "View policy document",
    },
    {
      id: "cov-5",
      category: "Flight delay (4h+)",
      value: "$500",
      icon: "delay",
      docLabel: "View policy document",
    },
    {
      id: "cov-6",
      category: "Secondary card coverage",
      value: "Delay & baggage",
      icon: "card",
      docLabel: "View card benefits",
    },
  ],
};

// ---------------------------------------------------------------------------
// BOOKING TYPE CONFIG
// ---------------------------------------------------------------------------
const BOOKING_ICONS = {
  flight: {
    bg: "#f0f4ff",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#2563eb"/>
      </svg>
    ),
  },
  hotel: {
    bg: "#fff7ed",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M3 21V7l9-4 9 4v14" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 21v-6h6v6" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  car: {
    bg: "#f5f3ff",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M5 17H3v-5l2-6h14l2 6v5h-2" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="7.5" cy="17" r="2" stroke="#7c3aed" strokeWidth="1.6"/>
        <circle cx="16.5" cy="17" r="2" stroke="#7c3aed" strokeWidth="1.6"/>
      </svg>
    ),
  },
  activity: {
    bg: "#fdf2f8",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#be185d" strokeWidth="1.8"/>
        <path d="M12 7v5l3 3" stroke="#be185d" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
};

const COVERAGE_ICONS = {
  medical: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#16a34a" strokeWidth="1.6"/>
      <path d="M12 8v8M8 12h8" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  evacuation: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 12h3m3-6l3-3 3 3m-3-3v12" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="18" cy="17" r="4" stroke="#16a34a" strokeWidth="1.4"/>
    </svg>
  ),
  cancel: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#16a34a"/>
    </svg>
  ),
  baggage: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="8" width="12" height="13" rx="2" stroke="#16a34a" strokeWidth="1.6"/>
      <path d="M9 8V6a3 3 0 016 0v2" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  delay: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.6"/>
      <path d="M12 7v5l3 3" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  card: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="14" rx="2.5" stroke="#16a34a" strokeWidth="1.6"/>
      <path d="M2 10h20" stroke="#16a34a" strokeWidth="1.5"/>
      <rect x="5" y="14" width="6" height="2" rx="1" fill="#16a34a"/>
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// SECTION HEADER — collapsible
// ---------------------------------------------------------------------------
function SectionHeader({ label, open, onToggle, count }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%", background: "none", border: "none", padding: "0 0 8px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        {count !== undefined && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#999",
            background: "#f0f0f0", borderRadius: 20,
            padding: "1px 7px",
          }}>
            {count}
          </span>
        )}
      </div>
      <svg
        width="14" height="14" viewBox="0 0 14 14" fill="none"
        style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s ease" }}
      >
        <path d="M3 5l4 4 4-4" stroke="#bbb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// BOOKING ITEM — expandable
// ---------------------------------------------------------------------------
function BookingItem({ booking }) {
  const [open, setOpen] = useState(false);
  const cfg = BOOKING_ICONS[booking.type] || BOOKING_ICONS.activity;

  return (
    <div style={{
      background: "white", borderRadius: 14,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      overflow: "hidden",
      border: "1px solid #f0f0f0",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "13px 14px", display: "flex", alignItems: "center", gap: 11,
          textAlign: "left",
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: cfg.bg, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {cfg.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: "0 0 1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {booking.title}
          </p>
          <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{booking.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: 9, fontWeight: 600, color: "#16a34a",
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 20, padding: "2px 7px",
          }}>
            {booking.status}
          </span>
          <svg
            width="6" height="11" viewBox="0 0 6 11" fill="none"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
          >
            <path d="M1 1l4 4.5L1 10" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #f5f5f5" }}>
          {booking.heroImage && (
            <div style={{
              height: 110, overflow: "hidden",
              background: "#f0f0f0",
              position: "relative",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- booking hero URL may be external */}
              <img
                src={booking.heroImage}
                alt={booking.heroLabel || booking.title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {booking.heroLabel && (
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
                  padding: "18px 12px 8px",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>
                    {booking.heroLabel}
                  </span>
                </div>
              )}
            </div>
          )}
          <div style={{ padding: "10px 14px 13px 14px" }}>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 10px" }}>{booking.detail}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                fontSize: 11, fontWeight: 500, color: "#2563eb",
                background: "#eff6ff", border: "1px solid #bfdbfe",
                borderRadius: 8, padding: "5px 11px", cursor: "pointer",
              }}>
                View confirmation
              </button>
              <button style={{
                fontSize: 11, fontWeight: 500, color: "#555",
                background: "#f5f5f5", border: "1px solid #e5e5e5",
                borderRadius: 8, padding: "5px 11px", cursor: "pointer",
              }}>
                Add note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// COVERAGE ITEM — tapping opens policy document viewer
// ---------------------------------------------------------------------------
function CoverageItem({ item, onViewDoc }) {
  return (
    <button
      onClick={() => onViewDoc(item)}
      style={{
        width: "100%", background: "white",
        border: "1px solid #f0f0f0", borderRadius: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        padding: "11px 14px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 11,
        textAlign: "left",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: "#f0fdf4", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {COVERAGE_ICONS[item.icon] || COVERAGE_ICONS.card}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#333", margin: "0 0 2px" }}>{item.category}</p>
        {item.subItems && (
          <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>
            {item.subItems.join(" · ")}
          </p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{item.value}</span>
        <svg width="5" height="9" viewBox="0 0 5 9" fill="none">
          <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ITINERARY LEG — multi-city
// ---------------------------------------------------------------------------
function ItineraryLeg({ leg, index, total }) {
  const isLast = index === total - 1;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 3 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: "#2563eb",
          border: "2px solid white",
          boxShadow: "0 0 0 1.5px #2563eb",
        }} />
        {!isLast && (
          <div style={{
            width: 1.5, height: 32,
            background: "linear-gradient(to bottom, #2563eb, #bfdbfe)",
            margin: "3px 0",
          }} />
        )}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: "0 0 1px" }}>
            {leg.city}
          </p>
          <span style={{ fontSize: 11, color: "#888" }}>{leg.nights} nights</span>
        </div>
        <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{leg.dateRange}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRAVELERS ROW — compact group member display
// ---------------------------------------------------------------------------
function TravelersRow({ participants, isLeader }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: "white", borderRadius: 14,
      border: "1px solid #f0f0f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "13px 16px",
          display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        }}
      >
        <div style={{ display: "flex", marginRight: 2 }}>
          {participants.slice(0, 3).map((p, i) => (
            <div key={p.id} style={{
              width: 28, height: 28, borderRadius: "50%",
              background: p.avatarColor,
              border: "2px solid white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "white",
              marginLeft: i === 0 ? 0 : -8,
              zIndex: 3 - i,
              position: "relative",
            }}>
              {p.initials}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: "0 0 1px" }}>
            {participants.length} traveler{participants.length !== 1 ? "s" : ""}
          </p>
          <p style={{ fontSize: 11, color: "#888", margin: 0 }}>
            {isLeader ? "You're leading this trip" : "Group trip"}
          </p>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s ease" }}
        >
          <path d="M3 5l4 4 4-4" stroke="#bbb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid #f5f5f5" }}>
          {participants.map((p, i) => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 16px",
              borderTop: i === 0 ? "none" : "1px solid #f9f9f9",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: p.avatarColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0,
              }}>
                {p.initials}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#111", margin: 0 }}>{p.name}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {p.role === "leader" && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: "#2563eb",
                    background: "#eff6ff", border: "1px solid #bfdbfe",
                    borderRadius: 20, padding: "2px 8px",
                  }}>
                    Leader
                  </span>
                )}
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: p.status === "active" ? "#22c55e" : "#d1d5db",
                  display: "inline-block",
                }} />
              </div>
            </div>
          ))}

          {isLeader && (
            <div style={{ padding: "10px 16px 14px" }}>
              <button style={{
                width: "100%", background: "none",
                border: "1.5px dashed #d1d5db",
                borderRadius: 10, padding: "9px 0",
                fontSize: 12, fontWeight: 500, color: "#9ca3af",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 2v8M2 6h8" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                Invite traveler
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NARRATION / NOTE SHEET
// User can dictate a note or type one. Voice goes to the transcription system.
// ---------------------------------------------------------------------------
function NarrationSheet({ onDismiss }) {
  const [mode, setMode] = useState(null); // null = choose, "voice" = recording, "text" = typing
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [micError, setMicError] = useState(false);
  const timerRef = useRef(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
        mediaRef.current.stream && mediaRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = async () => {
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
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setMicError(true);
      setMode("text");
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setRecorded(true);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => { onDismiss(); }, 1200);
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      <div
        onClick={onDismiss}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200 }}
      />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "20px 20px 0 0",
        zIndex: 201,
        transform: mounted ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
        maxHeight: "85%",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: "12px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.2px" }}>
              Add note
            </p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Attach to Portugal 2026</p>
          </div>
          {mode && (
            <button
              onClick={() => { setMode(null); setRecording(false); setRecorded(false); setSeconds(0); setText(""); setSaved(false); setMicError(false); }}
              style={{ background: "#f3f4f6", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, color: "#666", cursor: "pointer", fontWeight: 500 }}
            >
              Back
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 24px" }}>

          {saved && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              padding: "32px 0", gap: 12,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "#f0fdf4", border: "2px solid #bbf7d0",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5 9-9" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#111", margin: 0 }}>Note saved</p>
            </div>
          )}

          {micError && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#92400e", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" stroke="#d97706" strokeWidth="1.6"/><path d="M12 8v4M12 16h.01" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round"/></svg>
              Microphone access was denied. Use the text field below to add your note.
            </div>
          )}

          {/* Mode chooser */}
          {!mode && !saved && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => setMode("voice")}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "white", border: "1.5px solid #f0f0f0",
                  borderRadius: 16, padding: "16px 18px", cursor: "pointer", textAlign: "left",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                  border: "1px solid #fca5a5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="2" width="6" height="12" rx="3" stroke="#dc2626" strokeWidth="1.8"/>
                    <path d="M5 10a7 7 0 0014 0" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="12" y1="17" x2="12" y2="21" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="9" y1="21" x2="15" y2="21" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: "0 0 2px" }}>Voice narration</p>
                  <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Dictate — we&apos;ll transcribe it</p>
                </div>
                <svg width="5" height="9" viewBox="0 0 5 9" fill="none" style={{ marginLeft: "auto", flexShrink: 0 }}>
                  <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <button
                onClick={() => setMode("text")}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "white", border: "1.5px solid #f0f0f0",
                  borderRadius: 16, padding: "16px 18px", cursor: "pointer", textAlign: "left",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                  border: "1px solid #93c5fd",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 20h9" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: "0 0 2px" }}>Type a note</p>
                  <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Write it yourself</p>
                </div>
                <svg width="5" height="9" viewBox="0 0 5 9" fill="none" style={{ marginLeft: "auto", flexShrink: 0 }}>
                  <path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}

          {/* Voice mode */}
          {mode === "voice" && !saved && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              {/* Waveform visualization */}
              <div style={{
                width: "100%", height: 64,
                background: "#fafafa", borderRadius: 12, border: "1px solid #f0f0f0",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                overflow: "hidden",
              }}>
                {recording ? (
                  Array.from({ length: 32 }).map((_, i) => (
                    <div key={i} style={{
                      width: 3, borderRadius: 2,
                      background: "#dc2626",
                      height: `${12 + Math.abs(Math.sin(i * 0.6)) * 32}px`,
                      animation: `pulse ${0.3 + (i % 3) * 0.1}s ease-in-out infinite alternate`,
                      opacity: 0.7 + Math.sin(i) * 0.3,
                    }} />
                  ))
                ) : recorded ? (
                  Array.from({ length: 32 }).map((_, i) => (
                    <div key={i} style={{
                      width: 3, borderRadius: 2,
                      background: "#16a34a",
                      height: `${10 + Math.abs(Math.sin(i * 0.9)) * 28}px`,
                      opacity: 0.8,
                    }} />
                  ))
                ) : (
                  <p style={{ fontSize: 12, color: "#bbb", fontWeight: 500 }}>Ready to record</p>
                )}
              </div>

              {/* Timer */}
              <p style={{ fontSize: 28, fontWeight: 300, color: recording ? "#dc2626" : "#111", margin: 0, letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>
                {formatTime(seconds)}
              </p>

              {/* Record button */}
              {!recorded && (
                <button
                  onPointerDown={startRecording}
                  onPointerUp={stopRecording}
                  style={{
                    width: 72, height: 72, borderRadius: "50%",
                    background: recording
                      ? "#dc2626"
                      : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    border: recording ? "4px solid #fca5a5" : "4px solid #fee2e2",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", boxShadow: recording ? "0 0 0 8px rgba(220,38,38,0.15)" : "0 4px 16px rgba(220,38,38,0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {recording ? (
                    <div style={{ width: 22, height: 22, borderRadius: 4, background: "white" }} />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="2" width="6" height="12" rx="3" fill="white"/>
                      <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                      <line x1="12" y1="17" x2="12" y2="21" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              )}

              {!recording && !recorded && (
                <p style={{ fontSize: 12, color: "#bbb", margin: "-12px 0 0", textAlign: "center" }}>
                  Hold to record, release to stop
                </p>
              )}

              {recorded && (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                    borderRadius: 10, padding: "10px 14px",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6.5" fill="#dcfce7" stroke="#bbf7d0"/>
                      <path d="M4.5 7l2 2 3-3" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500 }}>
                      Recorded {formatTime(seconds)} · Will be transcribed
                    </span>
                  </div>
                  <button
                    onClick={handleSave}
                    style={{
                      width: "100%", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                      border: "none", borderRadius: 12,
                      fontSize: 14, fontWeight: 600, color: "white",
                      padding: "13px 0", cursor: "pointer",
                    }}
                  >
                    Save note
                  </button>
                  <button
                    onClick={() => { setRecorded(false); setSeconds(0); }}
                    style={{
                      width: "100%", background: "none",
                      border: "1.5px solid #e5e5e5", borderRadius: 12,
                      fontSize: 13, color: "#888", padding: "11px 0",
                      cursor: "pointer", fontWeight: 500,
                    }}
                  >
                    Record again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Text mode */}
          {mode === "text" && !saved && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <textarea
                placeholder="What do you want to note?"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                style={{
                  width: "100%", minHeight: 130,
                  border: "1.5px solid #e5e5e5", borderRadius: 12,
                  padding: "12px 14px", fontSize: 14, color: "#111",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  resize: "none", outline: "none", lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: 11, color: "#bbb", margin: "-4px 0 0", textAlign: "right" }}>
                {text.length} characters
              </p>
              <button
                onClick={handleSave}
                disabled={text.trim().length === 0}
                style={{
                  width: "100%",
                  background: text.trim().length > 0
                    ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)"
                    : "#e5e7eb",
                  border: "none", borderRadius: 12,
                  fontSize: 14, fontWeight: 600,
                  color: text.trim().length > 0 ? "white" : "#9ca3af",
                  padding: "13px 0", cursor: text.trim().length > 0 ? "pointer" : "not-allowed",
                  transition: "all 0.15s ease",
                }}
              >
                Save note
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// POLICY DOCUMENT SHEET
// In production this deep-links to the document viewer screen.
// For now it's a bottom sheet simulating "navigating" to the doc.
// ---------------------------------------------------------------------------
function PolicyDocSheet({ item, onDismiss }) {
  return (
    <>
      <div
        onClick={onDismiss}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }}
      />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "20px 20px 0 0",
        zIndex: 201, maxHeight: "60%",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "10px 20px 24px", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              {COVERAGE_ICONS[item.icon] || COVERAGE_ICONS.card}
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.2px" }}>
                {item.category}
              </p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Coverage: {item.value}</p>
            </div>
          </div>

          {item.clauses && item.clauses.length > 0 ? (
            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 12, padding: "14px 16px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                  <rect x="1" y="1" width="12" height="14" rx="2" stroke="#64748b" strokeWidth="1.4"/>
                  <path d="M4 5h6M4 8h6M4 11h3" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Extracted clauses</span>
              </div>
              {item.clauses.map((clause, i) => (
                <div key={i} style={{
                  borderTop: i > 0 ? "1px solid #f0f4f8" : "none",
                  paddingTop: i > 0 ? 10 : 0, marginBottom: 10,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#334155", margin: "0 0 3px" }}>{clause.title}</p>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{clause.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: "#f8fafc", border: "1.5px dashed #cbd5e1",
              borderRadius: 12, padding: "22px 16px", marginBottom: 16,
              display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 12,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="#94a3b8" strokeWidth="1.6"/>
                  <path d="M9 9h6M9 12h6M9 15h4" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="18" cy="6" r="4" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.2"/>
                  <path d="M18 4.5v3M16.5 6h3" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", margin: "0 0 6px" }}>
                No clauses extracted yet
              </p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 16px", lineHeight: 1.55 }}>
                Extracted clauses for <strong style={{ color: "#64748b" }}>{item.category}</strong> will appear here once you upload and process your policy document.
              </p>
              <button
                onClick={onDismiss}
                style={{
                  background: "#1d4ed8", color: "white",
                  border: "none", borderRadius: 10, cursor: "pointer",
                  fontSize: 13, fontWeight: 600, padding: "10px 22px",
                }}
              >
                Upload a policy
              </button>
            </div>
          )}

          <button
            onClick={onDismiss}
            style={{
              width: "100%", background: "none",
              border: "1.5px solid #e5e5e5", borderRadius: 10,
              color: "#888", fontSize: 13, cursor: "pointer",
              padding: "11px 0", fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// INCIDENTS TAB (stub — uses existing EmergencySystem context within trip)
// ---------------------------------------------------------------------------
function IncidentsTabScreen() {
  const trip = TRIP;
  const [docItem, setDocItem] = useState(null);
  const [narrationOpen, setNarrationOpen] = useState(false);
  const isGroupTrip = trip.participants && trip.participants.length > 1;
  const isLeader = trip.groupRole === "leader";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      <div style={{ padding: "8px 16px 12px", flexShrink: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Incidents</p>
        <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
          {trip.name} · Travelers &amp; coverage incidents
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 106px" }}>
        {/* Travelers */}
        {isGroupTrip && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Travelers</p>
            <TravelersRow participants={trip.participants} isLeader={isLeader} />
          </div>
        )}

        {/* Incident list */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Open incidents</p>
            <button style={{
              background: "#111", border: "none", borderRadius: 20,
              padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "white", cursor: "pointer",
            }}>
              + New
            </button>
          </div>
          <div style={{
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 14, padding: "14px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="#059669" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M22 4L12 14.01l-3-3" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 13, color: "#166534" }}>No open incidents on this trip</span>
          </div>
        </div>

        {/* Coverage snapshot */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Coverage snapshot</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trip.coverage.map((item) => (
              <CoverageItem key={item.id} item={item} onViewDoc={setDocItem} />
            ))}
          </div>
        </div>
      </div>

      <EmergencySystem />

      <button
        onClick={() => setNarrationOpen(true)}
        style={{
          position: "absolute", bottom: 94, right: 16, zIndex: 20,
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
          border: "none", borderRadius: 22, height: 40, padding: "0 16px",
          display: "flex", alignItems: "center", gap: 7,
          boxShadow: "0 4px 16px rgba(15,36,64,0.35)", cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.3"/>
          <path d="M4 7h6M7 4v6" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: "white" }}>Add note</span>
      </button>

      {docItem && <PolicyDocSheet item={docItem} onDismiss={() => setDocItem(null)} />}
      {narrationOpen && <NarrationSheet onDismiss={() => setNarrationOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CLAIMS TAB (stub)
// ---------------------------------------------------------------------------
function ClaimsTabScreen() {
  const trip = TRIP;
  const CLAIM_STATES = [
    { id: "c1", title: "Delayed baggage — TAP TP 205", state: "routing", trip: "Portugal 2026", updated: "Jun 14 · 10:22", policy: "Amex Platinum Travel" },
    { id: "c2", title: "Trip cancellation partial — Barcelona", state: "resolved", trip: "Barcelona Getaway", updated: "Apr 2 · 08:45", policy: "Chase Sapphire Reserve" },
  ];

  const STATE_CFG = {
    routing: { label: "Claim routing", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
    documentation: { label: "Documentation", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
    submitted: { label: "Submitted", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    resolved: { label: "Resolved", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      <div style={{ padding: "8px 16px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Claims</p>
          <button style={{
            background: "#111", border: "none", borderRadius: 20,
            padding: "7px 13px", fontSize: 12, fontWeight: 600, color: "white", cursor: "pointer",
          }}>
            + New claim
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 106px" }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Active claims</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CLAIM_STATES.map((claim) => {
              const cfg = STATE_CFG[claim.state] || STATE_CFG.routing;
              return (
                <div key={claim.id} style={{
                  background: "white", border: "1px solid #f0f0f0",
                  borderRadius: 16, padding: "14px 14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0, flex: 1, paddingRight: 8, letterSpacing: "-0.1px" }}>{claim.title}</p>
                    <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "#888", margin: "0 0 4px" }}>{claim.trip}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#aaa" }}>{claim.policy}</span>
                    <span style={{ fontSize: 11, color: "#aaa" }}>{claim.updated}</span>
                  </div>
                  <button style={{
                    marginTop: 10, width: "100%", padding: "9px 0",
                    background: "none", border: "1.5px solid #e5e7eb",
                    borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#374151",
                    cursor: "pointer",
                  }}>
                    {claim.state === "resolved" ? "View claim steps" : "Continue claim"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Itinerary */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Trip itinerary</p>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            {trip.legs.map((leg, i) => (
              <ItineraryLeg key={leg.id} leg={leg} index={i} total={trip.legs.length} />
            ))}
          </div>
        </div>

        {/* Bookings */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Bookings ({trip.bookings.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {trip.bookings.map((b) => <BookingItem key={b.id} booking={b} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// POLICY ASK PANEL
// ---------------------------------------------------------------------------
const SUGGESTED_QUESTIONS = [
  "Am I covered if my flight is cancelled?",
  "What's my baggage delay coverage limit?",
  "Does my policy cover pre-existing conditions?",
  "How do I file a medical emergency claim?",
];

const MOCK_ANSWERS = {
  "Am I covered if my flight is cancelled?": "Yes — your Chase Sapphire Reserve benefit covers trip cancellation up to $10,000 per trip for covered reasons including carrier-caused cancellations, severe weather, and illness. You must have paid for the trip with the card. Submit within 20 days of the event with your booking confirmation and carrier's cancellation notice.",
  "What's my baggage delay coverage limit?": "Your Amex Platinum benefit reimburses up to $500 per trip for essential purchases (clothing, toiletries) when baggage is delayed more than 6 hours. Keep all receipts. Your Chase Sapphire Reserve also provides $100/day up to 5 days for delays over 6 hours.",
  "Does my policy cover pre-existing conditions?": "Coverage for pre-existing conditions depends on when you purchased your policy. Amex Platinum requires the policy be purchased within 14 days of your initial trip deposit and you must be medically stable at time of purchase. Your ACIS plan uses a look-back period of 60 days.",
  "How do I file a medical emergency claim?": "For a medical emergency: 1) Call the 24/7 assistance line on your card/policy immediately. 2) Keep all medical records, receipts, and discharge papers. 3) Submit the claim form within 90 days. Your Chase Sapphire Reserve covers up to $2,500 for medical evacuation. Call 1-800-350-4956.",
};

function PolicyAskPanel() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(null);
  const inputRef = useRef(null);

  function handleAsk(q) {
    const question = q || query.trim();
    if (!question) return;
    setAsked(question);
    setAnswer(null);
    setLoading(true);
    setQuery("");
    setTimeout(() => {
      const mock = MOCK_ANSWERS[question] || "Based on your active policies, this specific scenario may require manual review. Your Chase Sapphire Reserve and Amex Platinum benefits each contain relevant provisions. Tap a policy document above to read the exact clause, or contact your insurer's 24/7 line for authoritative guidance.";
      setAnswer(mock);
      setLoading(false);
    }, 1400);
  }

  return (
    <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8"/>
            <path d="M12 8v4M12 16h.01" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>Ask about your coverage</p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "1px 0 0" }}>Questions answered from your active policies</p>
        </div>
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
          placeholder="e.g. Am I covered if my flight is delayed?"
          style={{
            flex: 1, padding: "10px 12px",
            background: "#f9fafb", border: "1.5px solid #e5e7eb",
            borderRadius: 10, fontSize: 13, color: "#111",
            outline: "none", fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        />
        <button
          onClick={() => handleAsk()}
          disabled={!query.trim()}
          style={{
            padding: "10px 14px",
            background: query.trim() ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)" : "#f3f4f6",
            border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 600,
            color: query.trim() ? "white" : "#9ca3af",
            cursor: query.trim() ? "pointer" : "default",
            transition: "all 0.15s", flexShrink: 0,
          }}
        >
          Ask
        </button>
      </div>

      {/* Suggested questions */}
      {!answer && !loading && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleAsk(q)}
              style={{
                background: "#f3f4f6", border: "1px solid #e5e7eb",
                borderRadius: 20, padding: "5px 10px",
                fontSize: 11, fontWeight: 500, color: "#374151",
                cursor: "pointer", textAlign: "left",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #1e3a5f", borderTopColor: "transparent", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Checking your policies...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Answer */}
      {answer && (
        <div>
          <div style={{ background: "#f5f7fa", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Your question</p>
            <p style={{ fontSize: 13, color: "#374151", margin: 0, fontStyle: "italic" }}>{asked}</p>
          </div>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="9" stroke="#0369a1" strokeWidth="1.7"/>
                <path d="M9 12l2 2 4-4" stroke="#0369a1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: 13, color: "#0c4a6e", margin: 0, lineHeight: 1.6 }}>{answer}</p>
            </div>
          </div>
          <button
            onClick={() => { setAnswer(null); setAsked(null); inputRef.current?.focus(); }}
            style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "#1e3a5f", cursor: "pointer", padding: 0 }}
          >
            Ask another question
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// COVERAGE TAB SCREEN
// ---------------------------------------------------------------------------
const ALL_TRIP_COVERAGE = [
  {
    tripId: "portugal-2026",
    tripName: "Portugal 2026",
    destination: "Lisbon · Porto",
    flag: "🇵🇹",
    dates: "Jun 12 – Jun 24",
    status: "active",
    coverageVerified: true,
    policies: 3,
    coverage: [
      { id: "cov-1", category: "Medical", value: "$250,000", icon: "medical", subItems: ["Emergency treatment", "Medical evacuation"], docLabel: "View policy document" },
      { id: "cov-2", category: "Trip cancellation", value: "$10,000", icon: "cancel", docLabel: "View policy document" },
      { id: "cov-3", category: "Baggage loss", value: "$2,500", icon: "baggage", docLabel: "View policy document" },
      { id: "cov-4", category: "Flight delay (4h+)", value: "$500 / leg", icon: "delay", subItems: ["TAP TP 205 · JFK→LIS", "TAP TP 782 · LIS→OPO"], docLabel: "View card benefits" },
      { id: "cov-5", category: "Travel accident", value: "$100,000", icon: "medical", docLabel: "View policy document" },
      { id: "cov-6", category: "Secondary card coverage", value: "Delay & baggage", icon: "card", docLabel: "View card benefits" },
    ],
  },
  {
    tripId: "tokyo-conf",
    tripName: "Tokyo Conference",
    destination: "Tokyo",
    flag: "🇯🇵",
    dates: "Aug 3 – Aug 10",
    status: "planning",
    coverageVerified: false,
    coverageWaived: true,
    policies: 1,
    coverage: [
      { id: "t2-cov-1", category: "Medical", value: "$100,000", icon: "medical", docLabel: "View policy document" },
      { id: "t2-cov-2", category: "Baggage loss", value: "Gap — not covered", icon: "baggage", badge: "Gap", docLabel: null },
      { id: "t2-cov-3", category: "Trip cancellation", value: "Gap — not covered", icon: "cancel", badge: "Gap", docLabel: null },
    ],
  },
  {
    tripId: "nyc-weekend",
    tripName: "NYC Weekend",
    destination: "New York",
    flag: "🇺🇸",
    dates: "Sep 5 – Sep 7",
    status: "incident_open",
    coverageVerified: true,
    policies: 2,
    coverage: [
      { id: "n1-cov-1", category: "Medical", value: "$250,000", icon: "medical", docLabel: "View policy document" },
      { id: "n1-cov-2", category: "Baggage loss", value: "$1,500", icon: "baggage", docLabel: "View policy document" },
      { id: "n1-cov-3", category: "Flight delay (2h+)", value: "$200 / leg", icon: "delay", docLabel: "View card benefits" },
    ],
  },
];

const TRIP_STATUS_LABELS = {
  active: { label: "Active", color: "#059669", bg: "#d1fae5" },
  planning: { label: "Planning", color: "#d97706", bg: "#fef3c7" },
  ready: { label: "Ready", color: "#2563eb", bg: "#dbeafe" },
  incident_open: { label: "Incident open", color: "#dc2626", bg: "#fee2e2" },
  resolved: { label: "Resolved", color: "#6b7280", bg: "#f3f4f6" },
};

function CoverageTabScreen() {
  const [selectedTripId, setSelectedTripId] = useState("portugal-2026");
  const [docItem, setDocItem] = useState(null);

  const tripData = ALL_TRIP_COVERAGE.find((t) => t.tripId === selectedTripId) || ALL_TRIP_COVERAGE[0];
  const statusCfg = TRIP_STATUS_LABELS[tripData.status] || TRIP_STATUS_LABELS.planning;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      <div style={{ padding: "8px 16px 12px", flexShrink: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Coverage</p>
        <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>Policy intelligence by trip</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 106px" }}>

        {/* Trip selector pills */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          {ALL_TRIP_COVERAGE.map((t) => (
            <button
              key={t.tripId}
              onClick={() => setSelectedTripId(t.tripId)}
              style={{
                flexShrink: 0,
                background: selectedTripId === t.tripId ? "#1e3a5f" : "white",
                border: selectedTripId === t.tripId ? "1.5px solid #1e3a5f" : "1.5px solid #e5e7eb",
                borderRadius: 20, padding: "7px 14px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                color: selectedTripId === t.tripId ? "white" : "#374151",
                display: "flex", alignItems: "center", gap: 6,
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: 14 }}>{t.flag}</span>
              {t.tripName}
              {!t.coverageVerified && (
                <span style={{ width: 7, height: 7, borderRadius: 4, background: "#f59e0b", flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>

        {/* Coverage not verified / waived warning */}
        {tripData.coverageWaived && (
          <div style={{
            background: "#fff7ed", border: "1.5px solid #fed7aa",
            borderRadius: 12, padding: "12px 14px", marginBottom: 14,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8v5M12 16h.01" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#c2410c", margin: "0 0 3px" }}>Coverage not fully verified</p>
              <p style={{ fontSize: 12, color: "#9a3412", margin: 0, lineHeight: 1.55 }}>
                This trip was created without attaching all required policy documents. Coverage gaps exist and the traveler acknowledged and waived the verification requirement at trip creation.
              </p>
            </div>
          </div>
        )}

        {/* Active trip card */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
          borderRadius: 16, padding: "16px 18px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 3px" }}>
                {tripData.destination} · {tripData.dates}
              </p>
              <p style={{ fontSize: 17, fontWeight: 800, color: "white", margin: 0, letterSpacing: "-0.3px" }}>
                {tripData.flag} {tripData.tripName}
              </p>
            </div>
            <span style={{
              background: statusCfg.bg, color: statusCfg.color,
              fontSize: 10, fontWeight: 700, borderRadius: 8, padding: "3px 8px",
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              {statusCfg.label}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tripData.coverage.filter((c) => !c.badge).slice(0, 4).map((c) => (
              <div key={c.id} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 10px" }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{c.category.split(" ")[0]} </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: "white" }}>{c.value.replace(",000", "K").replace("$100K", "$100K").replace("$250K", "$250K")}</span>
              </div>
            ))}
            {tripData.coverage.some((c) => c.badge === "Gap") && (
              <div style={{ background: "rgba(220,38,38,0.3)", borderRadius: 8, padding: "4px 10px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#fca5a5" }}>
                  {tripData.coverage.filter((c) => c.badge === "Gap").length} gap{tripData.coverage.filter((c) => c.badge === "Gap").length > 1 ? "s" : ""} detected
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Policy count */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Policy benefits</p>
          <span style={{ background: "#e0e7ff", color: "#3730a3", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>
            {tripData.policies} {tripData.policies === 1 ? "policy" : "policies"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
          {tripData.coverage.map((item) => (
            <CoverageItem key={item.id} item={item} onViewDoc={setDocItem} />
          ))}
        </div>

        <PolicyAskPanel />
      </div>

      {docItem && <PolicyDocSheet item={docItem} onDismiss={() => setDocItem(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN SCREEN — Shell with tab routing + deep navigation stack
// ---------------------------------------------------------------------------
export default function TripHomeScreen() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState("Trips");
  const [tripOverview, setTripOverview] = useState(null);
  const [incidentWorkspace, setIncidentWorkspace] = useState(null);
  const [claimBuilder, setClaimBuilder] = useState(null);

  function handleTabChange(tab) {
    setActiveTab(tab);
    setTripOverview(null);
    setIncidentWorkspace(null);
    setClaimBuilder(null);
  }

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (activeTab === "Account") {
    return <AccountScreen onBack={handleTabChange} />;
  }

  if (claimBuilder) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        <StatusBar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", background: "#f5f5f7" }}>
          <ClaimBuilderScreen
            incident={claimBuilder.incident}
            coverage={claimBuilder.coverage}
            onBack={() => setClaimBuilder(null)}
          />
          <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
        <HomeIndicator />
      </div>
    );
  }

  if (incidentWorkspace) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        <StatusBar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", background: "#f5f5f7" }}>
          <IncidentWorkspaceScreen
            incident={incidentWorkspace}
            onBack={() => setIncidentWorkspace(null)}
            onStartClaim={(data) => setClaimBuilder(data)}
          />
          <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
        <HomeIndicator />
      </div>
    );
  }

  if (tripOverview) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        <StatusBar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", background: "#f5f5f7" }}>
          <TripOverviewScreen
            tripId={tripOverview.id}
            tripName={tripOverview.name}
            onBack={() => setTripOverview(null)}
            onOpenIncident={(inc) => setIncidentWorkspace(inc)}
          />
          <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
        <HomeIndicator />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "Trips":
        return <TripsScreen onOpenTrip={(trip) => setTripOverview(trip)} onOpenIncident={(inc) => setIncidentWorkspace(inc)} />;
      case "Segments":
        return <RoutesScreen />;
      case "Incidents":
        return <EventsScreen onOpenWorkspace={(inc) => setIncidentWorkspace(inc)} />;
      case "Coverage":
        return <CoverageTabScreen />;
      default:
        return <TripsScreen onOpenTrip={(trip) => setTripOverview(trip)} onOpenIncident={(inc) => setIncidentWorkspace(inc)} />;
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <StatusBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", background: "#f5f5f7" }}>
        {renderContent()}
        <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
      <HomeIndicator />
    </div>
  );
}
