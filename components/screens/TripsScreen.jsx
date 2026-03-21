"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import NewTripFlow from "../trips/NewTripFlow";

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
const TRIPS = [
  {
    id: "t1",
    name: "Portugal 2026",
    destination: "Lisbon · Porto",
    country: "PT",
    flag: "🇵🇹",
    dates: "Jun 12 – Jun 24",
    mode: "air",
    maturity: "active",
    incidentBadge: null,
    scanStatus: "deep_unlocked",
    coverageSnap: { policies: 3, gaps: 0 },
    incidentSnap: { open: 0, resolved: 1 },
    docSnap: { items: 5, pending: 0 },
    recentUpdate: "Deep scan completed · 4h ago",
    cta: { label: "Open trip", action: "open" },
    heroImage: "https://images.pexels.com/photos/3520167/pexels-photo-3520167.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "t2",
    name: "Tokyo Conference",
    destination: "Tokyo",
    country: "JP",
    flag: "🇯🇵",
    dates: "Aug 3 – Aug 10",
    mode: "air",
    maturity: "planning",
    incidentBadge: null,
    scanStatus: "quick_only",
    coverageWaived: true,
    coverageSnap: { policies: 1, gaps: 2 },
    incidentSnap: { open: 0, resolved: 0 },
    docSnap: { items: 2, pending: 1 },
    recentUpdate: "Coverage gap detected · 2d ago",
    cta: { label: "Continue planning", action: "plan" },
    heroImage: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "t3",
    name: "Kenya Safari",
    destination: "Nairobi · Maasai Mara",
    country: "KE",
    flag: "🇰🇪",
    dates: "Jul 4 – Jul 16",
    mode: "air",
    maturity: "ready",
    incidentBadge: null,
    scanStatus: "deep_unlocked",
    coverageSnap: { policies: 4, gaps: 0 },
    incidentSnap: { open: 0, resolved: 0 },
    docSnap: { items: 9, pending: 0 },
    recentUpdate: "All checks passed · 3h ago",
    cta: { label: "Confirm trip ready", action: "confirm" },
    heroImage: "https://images.pexels.com/photos/631317/pexels-photo-631317.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "t4",
    name: "NYC Weekend",
    destination: "New York",
    country: "US",
    flag: "🇺🇸",
    dates: "Sep 5 – Sep 7",
    mode: "road",
    maturity: "incident_open",
    incidentBadge: { count: 1, severity: "medium" },
    scanStatus: "deep_unlocked",
    coverageSnap: { policies: 2, gaps: 0 },
    incidentSnap: { open: 1, resolved: 0 },
    docSnap: { items: 3, pending: 2 },
    recentUpdate: "Incident opened · 6h ago",
    cta: { label: "Resume incident", action: "incident" },
    heroImage: "https://images.pexels.com/photos/802024/pexels-photo-802024.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "t5",
    name: "Amalfi Coast Drive",
    destination: "Naples · Positano · Ravello",
    country: "IT",
    flag: "🇮🇹",
    dates: "May 8 – May 17",
    mode: "road",
    maturity: "planning",
    incidentBadge: null,
    scanStatus: "quick_only",
    coverageSnap: { policies: 2, gaps: 1 },
    incidentSnap: { open: 0, resolved: 0 },
    docSnap: { items: 4, pending: 2 },
    recentUpdate: "Rental car coverage gap found · 1d ago",
    cta: { label: "Continue planning", action: "plan" },
    heroImage: "https://images.pexels.com/photos/1245523/pexels-photo-1245523.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "t6",
    name: "Barcelona Getaway",
    destination: "Barcelona",
    country: "ES",
    flag: "🇪🇸",
    dates: "Mar 20 – Mar 26",
    mode: "air",
    maturity: "resolved",
    incidentBadge: null,
    scanStatus: "deep_unlocked",
    coverageSnap: { policies: 3, gaps: 0 },
    incidentSnap: { open: 0, resolved: 2 },
    docSnap: { items: 6, pending: 0 },
    recentUpdate: "Claim resolved · 3w ago",
    cta: { label: "Review claim summary", action: "claim" },
    heroImage: "https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "t7",
    name: "Maldives Honeymoon",
    destination: "Malé · Baa Atoll",
    country: "MV",
    flag: "🇲🇻",
    dates: "Dec 14 – Dec 22",
    mode: "air",
    maturity: "planning",
    incidentBadge: null,
    scanStatus: "quick_only",
    coverageSnap: { policies: 0, gaps: 3 },
    incidentSnap: { open: 0, resolved: 0 },
    docSnap: { items: 1, pending: 3 },
    recentUpdate: "No policies attached · Just started",
    cta: { label: "Add coverage", action: "plan" },
    heroImage: "https://images.pexels.com/photos/1483053/pexels-photo-1483053.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];

const TRIP_INCIDENTS = {
  t1: [
    {
      id: "i1",
      title: "Flight delay — TAP TP205",
      state: "resolved",
      severity: "low",
      opened: "Jun 13 · 11:20",
      timeline: [
        { event: "Incident reported", time: "Jun 13 · 11:20", type: "report" },
        { event: "Evidence uploaded", time: "Jun 13 · 11:45", type: "evidence" },
        { event: "Airline contacted", time: "Jun 13 · 13:00", type: "contact" },
        { event: "Voucher offered", time: "Jun 13 · 14:30", type: "offer" },
        { event: "Claim path opened", time: "Jun 13 · 15:00", type: "claim" },
      ],
    },
  ],
  t4: [
    {
      id: "i2",
      title: "Baggage delayed — AA 342",
      state: "open",
      severity: "medium",
      opened: "Sep 5 · 09:15",
      timeline: [
        { event: "Incident reported", time: "Sep 5 · 09:15", type: "report" },
        { event: "Evidence uploaded", time: "Sep 5 · 09:40", type: "evidence" },
        { event: "Airline contacted", time: "Sep 5 · 10:00", type: "contact" },
      ],
    },
  ],
  t5: [
    {
      id: "i3",
      title: "Trip cancellation — weather",
      state: "resolved",
      severity: "high",
      opened: "Mar 18 · 08:00",
      timeline: [
        { event: "Incident reported", time: "Mar 18 · 08:00", type: "report" },
        { event: "Evidence uploaded", time: "Mar 18 · 08:30", type: "evidence" },
        { event: "Airline contacted", time: "Mar 18 · 10:15", type: "contact" },
        { event: "Voucher offered", time: "Mar 19 · 14:00", type: "offer" },
        { event: "Cause disputed", time: "Mar 20 · 09:00", type: "dispute" },
        { event: "Claim path opened", time: "Mar 21 · 11:30", type: "claim" },
      ],
    },
    {
      id: "i4",
      title: "Hotel overbooking",
      state: "resolved",
      severity: "low",
      opened: "Mar 22 · 19:00",
      timeline: [
        { event: "Incident reported", time: "Mar 22 · 19:00", type: "report" },
        { event: "Evidence uploaded", time: "Mar 22 · 19:20", type: "evidence" },
        { event: "Claim path opened", time: "Mar 23 · 09:00", type: "claim" },
      ],
    },
  ],
};

const TRIP_DOCS = {
  t1: [
    { id: "d1", type: "passport", label: "Passport", sub: "Expires Jun 2030", state: "ok" },
    { id: "d3", type: "visa", label: "Schengen Visa", sub: "Valid Jun 10 – Jul 10, 2026", state: "ok" },
    { id: "d4", type: "immunization", label: "Immunization record", sub: "COVID, Hep A", state: "ok" },
    { id: "d5", type: "insurance", label: "Travel insurance card", sub: "Policy #TPG-2026-4421", state: "ok" },
    { id: "d6", type: "flight", label: "Flight itinerary", sub: "JFK → LIS · Jun 12", state: "ok" },
  ],
  t2: [
    { id: "d7", type: "passport", label: "Passport", sub: "Expires Jun 2030", state: "ok" },
    { id: "d8", type: "visa", label: "Japan Tourist Visa", sub: "Pending approval", state: "pending" },
  ],
  t3: [
    { id: "d9", type: "passport", label: "Passport", sub: "Expires Jun 2030", state: "ok" },
    { id: "d10", type: "visa", label: "Morocco e-Visa", sub: "Valid Jun–Nov 2026", state: "ok" },
    { id: "d11", type: "immunization", label: "Immunization record", sub: "Yellow fever, Hep A+B", state: "ok" },
    { id: "d12", type: "insurance", label: "Travel insurance card", sub: "Policy #TPG-2026-8814", state: "ok" },
    { id: "d13", type: "flight", label: "Flight itinerary", sub: "JFK → CMN · Oct 15", state: "ok" },
    { id: "d14", type: "accommodation", label: "Hotel bookings", sub: "3 properties confirmed", state: "ok" },
    { id: "d15", type: "car_rental", label: "Car rental", sub: "Sixt · Marrakech pickup", state: "ok" },
    { id: "d16", type: "emergency", label: "Emergency contacts", sub: "2 contacts on file", state: "ok" },
  ],
  t4: [
    { id: "d17", type: "passport", label: "Passport", sub: "Expires Jun 2030", state: "ok" },
    { id: "d18", type: "insurance", label: "Travel insurance card", sub: "Pending upload", state: "pending" },
    { id: "d19", type: "accommodation", label: "Hotel confirmation", sub: "Pending upload", state: "pending" },
  ],
  t5: [
    { id: "d20", type: "passport", label: "Passport", sub: "Expires Jun 2030", state: "ok", expiryDate: "2030-06-15", tripEndDate: "2026-03-26" },
    { id: "d22", type: "visa", label: "Schengen Visa", sub: "Valid Mar 2026", state: "ok" },
    { id: "d23", type: "insurance", label: "Travel insurance card", sub: "Policy #TPG-2026-1103", state: "ok" },
    { id: "d24", type: "flight", label: "Flight itinerary", sub: "JFK → BCN · Mar 20", state: "ok" },
    { id: "d25", type: "accommodation", label: "Hotel bookings", sub: "Hotel Arts Barcelona", state: "ok" },
    { id: "d26", type: "emergency", label: "Emergency contacts", sub: "2 contacts on file", state: "ok" },
  ],
};

// ---------------------------------------------------------------------------
// MATURITY CONFIG
// ---------------------------------------------------------------------------
const MATURITY = {
  planning: { label: "Planning", color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
  ready: { label: "Ready", color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  active: { label: "Active", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  incident_open: { label: "Incident open", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  documentation: { label: "In progress", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  claim_routing: { label: "Claim routing", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  resolved: { label: "Resolved", color: "#374151", bg: "#f9fafb", border: "#f3f4f6" },
};

const SCAN_CONFIG = {
  quick_only: { label: "Basic", color: "#6b7280" },
  deep_unlocked: { label: "Unlocked", color: "#059669" },
  locked: { label: "Locked", color: "#d97706" },
};

const MODE_ICONS = {
  air: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#6b7280"/>
    </svg>
  ),
  road: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="20" height="12" rx="3" stroke="#6b7280" strokeWidth="1.8"/>
      <circle cx="7" cy="20" r="2" fill="#6b7280"/>
      <circle cx="17" cy="20" r="2" fill="#6b7280"/>
      <path d="M2 13h20" stroke="#6b7280" strokeWidth="1.4"/>
    </svg>
  ),
  rail: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="16" rx="3" stroke="#6b7280" strokeWidth="1.8"/>
      <path d="M4 10h16" stroke="#6b7280" strokeWidth="1.4"/>
      <path d="M8 22l2-4M16 22l-2-4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  sea: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M2 18s3-3 5 0 5 0 5 0 5-3 5 0" stroke="#6b7280" strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M5 14V9l7-6 7 6v5" stroke="#6b7280" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// DOC TYPE ICONS
// ---------------------------------------------------------------------------
function DocIcon({ type }) {
  const icons = {
    passport: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="3" stroke="#1d4ed8" strokeWidth="1.7"/>
        <circle cx="12" cy="10" r="3" stroke="#1d4ed8" strokeWidth="1.5"/>
        <path d="M7 17h10" stroke="#1d4ed8" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M8 14.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#1d4ed8" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    passport_copy: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="13" height="16" rx="2" stroke="#6b7280" strokeWidth="1.6"/>
        <rect x="8" y="2" width="13" height="16" rx="2" stroke="#6b7280" strokeWidth="1.6" fill="white"/>
        <path d="M11 8h7M11 11h7M11 14h5" stroke="#6b7280" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    visa: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="3" stroke="#059669" strokeWidth="1.7"/>
        <path d="M2 9h20" stroke="#059669" strokeWidth="1.3"/>
        <path d="M6 13h4M6 16h3" stroke="#059669" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="17" cy="14.5" r="2.5" stroke="#059669" strokeWidth="1.3"/>
        <path d="M16 14.5l.8.8 1.4-1.4" stroke="#059669" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    immunization: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 3l3 3-7 7-3-3 7-7z" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 6l6 6M6 12l6 6M15 9l-6 6" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M18 14l3 3-3 3-3-3 3-3z" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    insurance: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="#0369a1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="#0369a1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    flight: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#6b7280"/>
      </svg>
    ),
    accommodation: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#6b7280" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 22V12h6v10" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    car_rental: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="9" width="20" height="10" rx="3" stroke="#6b7280" strokeWidth="1.7"/>
        <circle cx="7" cy="19" r="2" fill="#6b7280"/>
        <circle cx="17" cy="19" r="2" fill="#6b7280"/>
        <path d="M5 9l2-4h10l2 4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    emergency: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.02 1.23a2 2 0 012-2.18h3A2 2 0 017 1.05c.29 1.55.78 3.06 1.43 4.5a2 2 0 01-.45 2.11L6.91 8.73a16 16 0 006.36 6.36l1.07-1.07a2 2 0 012.11-.45c1.44.65 2.95 1.14 4.5 1.43a2 2 0 011.05 2.92z" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  const bg = {
    passport: "#eff6ff", passport_copy: "#f9fafb", visa: "#f0fdf4",
    immunization: "#fef2f2", insurance: "#f0f9ff", flight: "#f9fafb",
    accommodation: "#f9fafb", car_rental: "#f9fafb", emergency: "#fffbeb",
  };
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
      background: bg[type] || "#f5f5f7",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {icons[type] || icons.accommodation}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TIMELINE EVENT TYPE
// ---------------------------------------------------------------------------
const TIMELINE_CONFIG = {
  report: { dot: "#6b7280", label: "Reported" },
  evidence: { dot: "#0369a1", label: "Evidence uploaded" },
  contact: { dot: "#d97706", label: "Airline contacted" },
  offer: { dot: "#059669", label: "Voucher offered" },
  dispute: { dot: "#dc2626", label: "Cause disputed" },
  claim: { dot: "#1d4ed8", label: "Claim path opened" },
};

// ---------------------------------------------------------------------------
// ASK AI BUTTON (inline, Apple-style)
// ---------------------------------------------------------------------------
function AskAIButton({ context }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)",
          border: "1px solid #bfdbfe",
          borderRadius: 22, padding: "8px 14px",
          cursor: "pointer", width: "100%",
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1zm1-8h-2V7h2v2z" fill="white"/>
          </svg>
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", margin: 0 }}>Ask about this incident</p>
          <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>Powered by built-in AI</p>
        </div>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          marginTop: 8, background: "white", border: "1px solid #e5e7eb",
          borderRadius: 14, overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f5f5f5" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", margin: 0 }}>Suggested questions</p>
          </div>
          {[
            "What documentation do I need to file a claim?",
            "What are my rights for this type of incident?",
            "Which of my policies covers this?",
            "What's the deadline to submit evidence?",
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => setOpen(false)}
              style={{
                width: "100%", background: "none", border: "none",
                borderBottom: i < 3 ? "1px solid #f5f5f5" : "none",
                padding: "11px 14px", textAlign: "left", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M5 12h14M12 5l7 7-7 7" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{q}</span>
            </button>
          ))}
          <div style={{ padding: "10px 14px", borderTop: "1px solid #f5f5f5", background: "#f9fafb" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                placeholder="Ask anything..."
                style={{
                  flex: 1, background: "white", border: "1px solid #e5e7eb",
                  borderRadius: 20, padding: "8px 13px", fontSize: 12, color: "#111",
                  outline: "none",
                }}
              />
              <button style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// INCIDENT DETAIL SHEET (opens from within the trip sheet)
// ---------------------------------------------------------------------------
function IncidentDetailSheet({ incident, onDismiss, onOpenWorkspace }) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const stateCfg = incident.state === "open"
    ? { color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Open" }
    : { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", label: "Resolved" };

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 401, height: "92%", display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "12px 18px 4px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 4px", letterSpacing: "-0.2px" }}>
              {incident.title}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: stateCfg.color,
                background: stateCfg.bg, border: `1px solid ${stateCfg.border}`,
                borderRadius: 20, padding: "2px 9px",
              }}>
                {stateCfg.label}
              </span>
              <span style={{ fontSize: 11, color: "#aaa" }}>Opened {incident.opened}</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 32px" }}>
          {/* Timeline mini-feed */}
          <p style={{ fontSize: 10, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
            Timeline
          </p>
          <div style={{ position: "relative", marginBottom: 18 }}>
            {/* Vertical line */}
            <div style={{
              position: "absolute", left: 7, top: 8, bottom: 8,
              width: 1, background: "#e5e7eb",
            }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {incident.timeline.map((step, i) => {
                const cfg = TIMELINE_CONFIG[step.type] || TIMELINE_CONFIG.report;
                const isLast = i === incident.timeline.length - 1;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: isLast ? 0 : 14 }}>
                    <div style={{
                      width: 15, height: 15, borderRadius: "50%",
                      background: cfg.dot, border: "2.5px solid white",
                      boxShadow: `0 0 0 2px ${cfg.dot}33`,
                      flexShrink: 0, marginTop: 1, position: "relative", zIndex: 1,
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: "0 0 1px" }}>{step.event}</p>
                      <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{step.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {incident.state === "open" && (
              <button
                onClick={() => { onDismiss(); onOpenWorkspace && onOpenWorkspace(incident); }}
                style={{
                  width: "100%", padding: "12px 0",
                  background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                  border: "none", borderRadius: 13,
                  fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer",
                }}
              >
                Add evidence
              </button>
            )}
            <button
              onClick={() => setGuidanceOpen(true)}
              style={{
                width: "100%", padding: "11px 0",
                background: "none", border: "1.5px solid #e5e7eb",
                borderRadius: 13, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
              }}
            >
              View guidance
            </button>
            <button
              onClick={() => { onDismiss(); onOpenWorkspace && onOpenWorkspace(incident); }}
              style={{
                width: "100%", padding: "11px 0",
                background: "none", border: "1.5px solid #bfdbfe",
                borderRadius: 13, fontSize: 13, fontWeight: 600, color: "#1d4ed8", cursor: "pointer",
              }}
            >
              Open incident details
            </button>
          </div>

          {guidanceOpen && (
            <div style={{ marginTop: 16, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>Claim routing guidance</p>
                <button onClick={() => setGuidanceOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#9ca3af", lineHeight: 1 }}>×</button>
              </div>
              {incident.state === "resolved" ? (
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>This incident was resolved. Review your claim history in the Coverage tab for submitted claim records.</p>
              ) : (
                [
                  { step: 1, text: "Document the incident — collect your boarding pass, receipts, and written statements from airline staff." },
                  { step: 2, text: "File with your primary insurer first. Use the Claim Builder to start your packet with the strongest coverage source." },
                  { step: 3, text: "Submit to remaining policies in order. The system will route your claim to each applicable policy based on your coverage stack." },
                ].map(({ step, text }) => (
                  <div key={step} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "white" }}>{step}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.6 }}>{text}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// INCIDENTS TAB CONTENT
// ---------------------------------------------------------------------------
function IncidentsTabContent({ trip, onOpenIncident }) {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const incidents = TRIP_INCIDENTS[trip.id] || [];

  if (incidents.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 0 20px", gap: 8 }}>
        <span style={{ fontSize: 36 }}>:)</span>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: 0 }}>No incidents on this trip</p>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, textAlign: "center", maxWidth: 200, lineHeight: 1.5 }}>
          Everything looks clear. Incidents will appear here if anything comes up.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {incidents.map((incident) => {
        const stateCfg = incident.state === "open"
          ? { color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Open" }
          : { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0", label: "Resolved" };
        const lastStep = incident.timeline[incident.timeline.length - 1];
        const lastCfg = TIMELINE_CONFIG[lastStep.type] || TIMELINE_CONFIG.report;

        return (
          <button
            key={incident.id}
            onClick={() => setSelectedIncident(incident)}
            style={{
              width: "100%", background: "white",
              border: `1px solid ${incident.state === "open" ? "#fde68a" : "#f0f0f0"}`,
              borderRadius: 14, padding: "12px 14px",
              cursor: "pointer", textAlign: "left",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: 0, flex: 1, paddingRight: 10 }}>{incident.title}</p>
              <span style={{
                fontSize: 10, fontWeight: 700, color: stateCfg.color,
                background: stateCfg.bg, border: `1px solid ${stateCfg.border}`,
                borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap",
              }}>
                {stateCfg.label}
              </span>
            </div>

            {/* Mini timeline preview */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 8 }}>
              {incident.timeline.map((step, i) => {
                const cfg = TIMELINE_CONFIG[step.type] || TIMELINE_CONFIG.report;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot }} />
                    {i < incident.timeline.length - 1 && (
                      <div style={{ width: 10, height: 1, background: "#e5e7eb" }} />
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: lastCfg.dot }} />
                <span style={{ fontSize: 11, color: "#6b7280" }}>{lastStep.event}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8" }}>View</span>
                <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
                  <path d="M1 1l3 3-3 3" stroke="#1d4ed8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </button>
        );
      })}

      {selectedIncident && (
        <IncidentDetailSheet incident={selectedIncident} onDismiss={() => setSelectedIncident(null)} onOpenWorkspace={onOpenIncident} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PASSPORT EXPIRY HELPER
// ---------------------------------------------------------------------------
function passportExpiryStatus(doc, tripEndDate) {
  if (!doc.expiryDate || !tripEndDate) return null;
  const expiry = new Date(doc.expiryDate);
  const tripEnd = new Date(tripEndDate);
  const msPerDay = 86400000;
  const daysAfterTrip = Math.floor((expiry - tripEnd) / msPerDay);
  if (daysAfterTrip >= 180) return { ok: true, label: `Valid ${Math.floor(daysAfterTrip / 30)}+ months after trip`, color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" };
  if (daysAfterTrip >= 90) return { ok: true, label: `Valid ~${Math.floor(daysAfterTrip / 30)} months after trip`, color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
  return { ok: false, label: `Only ${daysAfterTrip}d after trip — check destination rules`, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
}

// ---------------------------------------------------------------------------
// DOCUMENT PREVIEW SHEET
// ---------------------------------------------------------------------------
const DOC_PREVIEW_CONTENT = {
  passport: {
    title: "Passport",
    icon: "🛂",
    description: "Your passport is on file. In a real deployment, tapping here opens your uploaded PDF or image scan.",
    fields: [
      { label: "Document type", value: "US Passport" },
      { label: "Expires", value: "Jun 2030" },
      { label: "Traveler", value: "Account holder" },
    ],
    previewNote: "Passport scan stored securely. Tap to view full document.",
  },
  visa: {
    title: "Visa",
    icon: "🗺",
    description: "Your visa document is attached to this trip.",
    fields: [
      { label: "Document type", value: "Entry Visa" },
      { label: "Issued for", value: "Trip destination" },
    ],
    previewNote: "Visa document stored securely. Tap to view full document.",
  },
  immunization: {
    title: "Immunization Record",
    icon: "💉",
    description: "Your immunization certificate is on file for this trip.",
    fields: [
      { label: "Document type", value: "Health / Immunization" },
      { label: "Required for", value: "Destination entry" },
    ],
    previewNote: "Health document stored. Contact your provider for re-issuance if expired.",
  },
  insurance: {
    title: "Insurance Policy",
    icon: "🛡",
    description: "Your travel insurance policy card is attached. Coverage details are extracted and shown in the Coverage tab.",
    fields: [
      { label: "Document type", value: "Travel Insurance Policy" },
      { label: "Coverage scope", value: "See Coverage tab for breakdown" },
    ],
    previewNote: "Policy document on file. Deep scan has extracted clause-level coverage data.",
  },
  flight: {
    title: "Flight Itinerary",
    icon: "✈",
    description: "Your flight confirmation and itinerary are attached.",
    fields: [
      { label: "Document type", value: "Flight Itinerary / E-ticket" },
      { label: "Booking reference", value: "On file" },
    ],
    previewNote: "Itinerary extracted for segment mapping and delay coverage tracking.",
  },
  accommodation: {
    title: "Hotel Booking",
    icon: "🏨",
    description: "Your accommodation confirmation is on file.",
    fields: [
      { label: "Document type", value: "Hotel Confirmation" },
    ],
    previewNote: "Booking on file. Property details available in the itinerary.",
  },
  car_rental: {
    title: "Car Rental Agreement",
    icon: "🚗",
    description: "Your rental agreement is attached. Coverage clause extraction applies CDW and LDW terms.",
    fields: [
      { label: "Document type", value: "Rental Agreement" },
    ],
    previewNote: "Rental agreement on file. Collision damage coverage checked against card benefits.",
  },
  emergency: {
    title: "Emergency Contacts",
    icon: "📞",
    description: "Your emergency contacts are on file and accessible from the SOS panel.",
    fields: [
      { label: "Document type", value: "Emergency Contact List" },
      { label: "Contacts on file", value: "2" },
    ],
    previewNote: "Contacts available in the SOS screen during emergencies.",
  },
};

function DocPreviewSheet({ doc, onDismiss }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  const config = DOC_PREVIEW_CONTENT[doc.type] || { title: doc.label, icon: "📄", fields: [], previewNote: "Document on file." };

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600, opacity: mounted ? 1 : 0, transition: "opacity 0.22s ease" }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 601, maxHeight: "70%", display: "flex", flexDirection: "column",
        transform: mounted ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "4px 20px 14px", flexShrink: 0, borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
              {config.icon}
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.2px" }}>{doc.label}</p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{doc.sub}</p>
            </div>
          </div>
          <button onClick={onDismiss} style={{ width: 32, height: 32, borderRadius: 16, background: "#f3f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="#666" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 36px" }}>
          <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
            {config.fields.map((f) => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{f.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "#1e40af", margin: 0, lineHeight: 1.6 }}>{config.previewNote}</p>
          </div>
          <button
            onClick={() => { alert("In production, this opens the stored document file or connects to your document vault."); }}
            style={{
              width: "100%", padding: "13px 0",
              background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
              border: "none", borderRadius: 14,
              fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            View document
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DOCS TAB CONTENT
// ---------------------------------------------------------------------------
function DocRow({ doc, onPreview }) {
  const passportStatus = doc.type === "passport" ? passportExpiryStatus(doc, doc.tripEndDate) : null;
  const isPending = doc.state === "pending";

  const inner = (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{
        background: "white",
        border: `1px solid ${isPending ? "#fde68a" : "#f0f0f0"}`,
        borderRadius: passportStatus ? "13px 13px 0 0" : 13,
        padding: "11px 13px",
        display: "flex", alignItems: "center", gap: 11,
      }}>
        <DocIcon type={doc.type} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111", margin: "0 0 1px" }}>{doc.label}</p>
          <p style={{ fontSize: 11, color: isPending ? "#d97706" : "#9ca3af", margin: 0 }}>
            {isPending ? "Tap to upload" : doc.sub}
          </p>
        </div>
        {isPending ? (
          <span style={{
            fontSize: 9, fontWeight: 700, color: "#d97706",
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 20, padding: "2px 8px", flexShrink: 0,
          }}>
            Upload needed
          </span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
            <path d="M9 18l6-6-6-6" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      {passportStatus && (
        <div style={{
          background: passportStatus.bg, border: `1px solid ${passportStatus.border}`,
          borderTop: "none", borderRadius: "0 0 13px 13px", padding: "7px 13px",
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke={passportStatus.color} strokeWidth="1.6"/>
            <path d="M12 7v5l3 3" stroke={passportStatus.color} strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 11, color: passportStatus.color, fontWeight: 600 }}>{passportStatus.label}</span>
        </div>
      )}
    </div>
  );

  if (isPending) {
    return (
      <label key={doc.id} style={{ cursor: "pointer", display: "block" }}>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic" style={{ display: "none" }} onChange={() => {}} />
        {inner}
      </label>
    );
  }
  return (
    <div key={doc.id} style={{ cursor: "pointer" }} onClick={() => onPreview(doc)}>
      {inner}
    </div>
  );
}

function DocsTabContent({ trip }) {
  const allDocs = TRIP_DOCS[trip.id] || [];
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addDocType, setAddDocType] = useState("");
  const [addDocLabel, setAddDocLabel] = useState("");
  const [extraDocs, setExtraDocs] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);

  const IDENTITY_TYPES = ["passport", "visa", "immunization"];
  const TRIP_DOC_TYPES = ["insurance", "flight", "accommodation", "car_rental", "emergency"];

  const identityDocs = allDocs.filter((d) => IDENTITY_TYPES.includes(d.type));
  const tripDocs = [...allDocs.filter((d) => TRIP_DOC_TYPES.includes(d.type)), ...extraDocs];

  const DOC_TYPE_OPTIONS = [
    { value: "insurance", label: "Insurance policy" },
    { value: "flight", label: "Flight confirmation" },
    { value: "accommodation", label: "Hotel confirmation" },
    { value: "car_rental", label: "Car rental" },
    { value: "other", label: "Other" },
  ];

  const sectionHeader = (title, subtitle, action) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>{title}</p>
        {subtitle && <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0", lineHeight: 1.4 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Section A — Travel requirements */}
      <div style={{ marginBottom: 18 }}>
        {sectionHeader(
          "Travel requirements",
          `Based on your destination and home country`,
        )}
        {identityDocs.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>No identity documents on file.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {identityDocs.map((doc) => <DocRow key={doc.id} doc={doc} onPreview={setPreviewDoc} />)}
          </div>
        )}
        <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 10, padding: "8px 12px", marginTop: 8 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>
            Requirements shown are based on {trip.destination}. Update your home country in Account → Travel Profile.
          </p>
        </div>
      </div>

      {/* Section B — Trip documents */}
      <div>
        {sectionHeader(
          "Your documents",
          null,
          <button
            onClick={() => setAddDocOpen(true)}
            style={{
              background: "#111", border: "none", borderRadius: 20, padding: "4px 12px",
              fontSize: 11, fontWeight: 600, color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add
          </button>
        )}
        {tripDocs.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>No trip documents added yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tripDocs.map((doc) => <DocRow key={doc.id} doc={doc} onPreview={setPreviewDoc} />)}
          </div>
        )}
      </div>

      {/* Document preview sheet */}
      {previewDoc && <DocPreviewSheet doc={previewDoc} onDismiss={() => setPreviewDoc(null)} />}

      {/* Add document sheet */}
      {addDocOpen && (
        <>
          <div onClick={() => setAddDocOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "22px 22px 0 0", zIndex: 501, padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "0 auto 16px" }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 14px" }}>Add document</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Document type</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {DOC_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAddDocType(opt.value)}
                  style={{
                    padding: "6px 12px", border: `1.5px solid ${addDocType === opt.value ? "#1e3a5f" : "#e5e7eb"}`,
                    borderRadius: 20, background: addDocType === opt.value ? "#1e3a5f" : "white",
                    fontSize: 12, fontWeight: 600, color: addDocType === opt.value ? "white" : "#374151",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Label</p>
            <input
              value={addDocLabel}
              onChange={(e) => setAddDocLabel(e.target.value)}
              placeholder="e.g. Hotel confirmation — Lisbon"
              style={{
                width: "100%", padding: "10px 12px", border: "1.5px solid #e5e7eb",
                borderRadius: 10, fontSize: 13, color: "#111", outline: "none",
                fontFamily: "inherit", marginBottom: 14, boxSizing: "border-box",
              }}
            />
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              width: "100%", padding: "13px 0",
              background: addDocType && addDocLabel.trim() ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)" : "#e5e7eb",
              border: "none", borderRadius: 14,
              fontSize: 14, fontWeight: 600, color: addDocType && addDocLabel.trim() ? "white" : "#9ca3af",
              cursor: addDocType && addDocLabel.trim() ? "pointer" : "default",
            }}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic"
                style={{ display: "none" }}
                disabled={!addDocType || !addDocLabel.trim()}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0] && addDocType && addDocLabel.trim()) {
                    setExtraDocs((prev) => [...prev, {
                      id: `custom-${Date.now()}`,
                      type: addDocType,
                      label: addDocLabel.trim(),
                      sub: e.target.files[0].name,
                      state: "ok",
                    }]);
                    setAddDocOpen(false);
                    setAddDocType("");
                    setAddDocLabel("");
                  }
                }}
              />
              Choose file &amp; save
            </label>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GAP GUIDANCE SHEET
// ---------------------------------------------------------------------------
function GapGuidanceSheet({ gapLabel, onDismiss }) {
  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "22px 22px 0 0", zIndex: 401, padding: "20px 20px 40px" }}>
        <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "0 auto 16px" }} />
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", margin: "0 0 4px" }}>Coverage gap — {gapLabel}</p>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>None of your attached policies appear to cover this category for this trip. This may leave you exposed if something goes wrong.</p>
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>What you can do</p>
        {[
          "Add a travel insurance policy that covers this category — upload it in the Coverage tab.",
          "Check whether your credit card benefit guides include this coverage — upload them as policies.",
          "Consider purchasing supplemental coverage before your departure date.",
        ].map((tip, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>{i + 1}</span>
            </div>
            <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.5 }}>{tip}</p>
          </div>
        ))}
        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 12, lineHeight: 1.5 }}>This guidance is informational. It does not constitute insurance advice or a guarantee that any coverage will apply to your specific situation.</p>
        <button onClick={onDismiss} style={{ width: "100%", padding: "13px 0", background: "#1e3a5f", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "white", marginTop: 16, cursor: "pointer" }}>Got it</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DEEP SCAN SHEET
// ---------------------------------------------------------------------------
function DeepScanSheet({ trip, onDismiss }) {
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  function handleStart() {
    setScanning(true);
    setTimeout(() => { setScanning(false); setDone(true); }, 2200);
  }

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, padding: "0 18px 36px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "16px 0 0", textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", margin: "0 auto 12px",
            background: "linear-gradient(135deg, #0f2440 0%, #1e3a5f 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="1.8"/>
              <path d="M11 8v3l2 2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16.5 16.5L20 20" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>

          <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 4px", letterSpacing: "-0.2px" }}>
            {done ? "Deep scan complete" : "Deep scan"}
          </p>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 10px" }}>
            Itinerary: {trip.destination} · {trip.dates}
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 18px", lineHeight: 1.5 }}>
            {done
              ? "All clauses analyzed. Coverage intelligence updated for this trip."
              : "Analyzes every clause in your attached policies against your specific itinerary — dates, routes, destinations, and connection buffers. Surfaces hidden exclusions, coverage gaps, and claim triggers before you travel."}
          </p>

          {done ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "10px 14px", textAlign: "left" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#059669", margin: "0 0 2px" }}>Scan results ready</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Coverage intelligence updated. Review your coverage tab for details.</p>
              </div>
              <button
                onClick={onDismiss}
                style={{
                  width: "100%", padding: "13px 0",
                  background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                  border: "none", borderRadius: 14,
                  fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer",
                }}
              >
                View coverage report
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {scanning && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 14px", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      border: "2px solid #1d4ed8", borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>Analyzing policy clauses...</span>
                  </div>
                </div>
              )}
              <button
                onClick={handleStart}
                disabled={scanning}
                style={{
                  width: "100%", padding: "13px 0",
                  background: scanning ? "#e5e7eb" : "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                  border: "none", borderRadius: 14,
                  fontSize: 14, fontWeight: 600, color: scanning ? "#9ca3af" : "white", cursor: scanning ? "default" : "pointer",
                }}
              >
                {scanning ? "Scanning..." : "Run deep scan"}
              </button>
              <button
                onClick={onDismiss}
                style={{
                  width: "100%", padding: "11px 0",
                  background: "none", border: "1.5px solid #e5e7eb",
                  borderRadius: 14, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// TRIP CARD DETAIL SHEET
// ---------------------------------------------------------------------------
function TripDetailSheet({ trip, onDismiss, onContinuePlanning, onOpenIncident }) {
  const [activeView, setActiveView] = useState("overview");
  const [deepScanOpen, setDeepScanOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [gapDetailOpen, setGapDetailOpen] = useState(null);
  const matCfg = MATURITY[trip.maturity] || MATURITY.planning;

  const views = ["Overview", "Coverage", "Incidents", "Docs"];

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 201, display: "flex", flexDirection: "column", height: "92%",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Pull handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        {/* Hero image */}
        <div style={{ position: "relative", height: 120, overflow: "hidden", margin: "10px 16px 0", borderRadius: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- mock / external hero URLs in prototype */}
          <img src={trip.heroImage} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 60%)" }} />
          <div style={{ position: "absolute", bottom: 10, left: 14 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "white", margin: "0 0 2px", letterSpacing: "-0.3px" }}>{trip.name}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>{trip.destination} · {trip.dates}</p>
          </div>
          <div style={{ position: "absolute", top: 10, right: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: matCfg.color,
              background: "rgba(255,255,255,0.9)", border: `1px solid ${matCfg.border}`,
              borderRadius: 20, padding: "3px 9px",
            }}>
              {matCfg.label}
            </span>
          </div>
        </div>

        {/* Tab pills */}
        <div style={{ display: "flex", gap: 6, padding: "12px 16px 0", overflowX: "auto" }}>
          {views.map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v.toLowerCase())}
              style={{
                background: activeView === v.toLowerCase() ? "#1d4ed8" : "#f3f4f6",
                color: activeView === v.toLowerCase() ? "white" : "#6b7280",
                border: "none", borderRadius: 20, padding: "6px 14px",
                fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {v}
              {v === "Incidents" && (TRIP_INCIDENTS[trip.id] || []).filter(i => i.state === "open").length > 0 && (
                <span style={{
                  marginLeft: 5, background: "#d97706", color: "white",
                  borderRadius: "50%", fontSize: 9, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 14, height: 14,
                }}>
                  {(TRIP_INCIDENTS[trip.id] || []).filter(i => i.state === "open").length}
                </span>
              )}
              {v === "Docs" && (TRIP_DOCS[trip.id] || []).filter(d => d.state === "pending").length > 0 && (
                <span style={{
                  marginLeft: 5, background: "#f59e0b", color: "white",
                  borderRadius: "50%", fontSize: 9, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 14, height: 14,
                }}>
                  {(TRIP_DOCS[trip.id] || []).filter(d => d.state === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 28px", position: "relative" }}>
          {activeView === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Policies", value: trip.coverageSnap.policies, sub: trip.coverageSnap.gaps > 0 ? `${trip.coverageSnap.gaps} gap` : "No gaps", alert: trip.coverageSnap.gaps > 0 },
                  { label: "Incidents", value: trip.incidentSnap.open + trip.incidentSnap.resolved, sub: trip.incidentSnap.open > 0 ? `${trip.incidentSnap.open} open` : "All closed", alert: trip.incidentSnap.open > 0 },
                  { label: "Docs", value: trip.docSnap.items, sub: trip.docSnap.pending > 0 ? `${trip.docSnap.pending} pending` : "Up to date", alert: trip.docSnap.pending > 0 },
                ].map((s) => (
                  <div key={s.label} style={{ background: s.alert ? "#fffbeb" : "#f9fafb", border: `1px solid ${s.alert ? "#fde68a" : "#f0f0f0"}`, borderRadius: 12, padding: "10px 10px 8px", textAlign: "center" }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>{s.value}</p>
                    <p style={{ fontSize: 9, color: "#999", margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: s.alert ? "#d97706" : "#6b7280", margin: 0, fontWeight: s.alert ? 600 : 400 }}>{s.sub}</p>
                  </div>
                ))}
              </div>
              {trip.coverageWaived && (
                <div style={{
                  background: "#fff7ed", border: "1.5px solid #fed7aa",
                  borderRadius: 12, padding: "10px 12px",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 8v5M12 16h.01" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#c2410c", margin: "0 0 2px" }}>Coverage not fully verified</p>
                    <p style={{ fontSize: 11, color: "#9a3412", margin: 0, lineHeight: 1.5 }}>
                      This trip was started without attaching all policy documents. The traveler waived the verification requirement. Coverage gaps may exist.
                    </p>
                  </div>
                </div>
              )}
              <div style={{ background: "#f5f5f7", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#9ca3af" strokeWidth="1.6"/>
                  <path d="M12 7v5l3 3" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 12, color: "#555" }}>{trip.recentUpdate}</span>
              </div>
              {confirmed ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: "14px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#059669", margin: "0 0 2px" }}>Trip confirmed. You&apos;re all set.</p>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Your trip is now active and ready to go.</p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (trip.cta.action === "plan" && onContinuePlanning) {
                      onDismiss();
                      onContinuePlanning(trip);
                    } else if (trip.cta.action === "confirm") {
                      setConfirmed(true);
                    } else if (trip.cta.action === "open" || trip.cta.action === "incident") {
                      onDismiss();
                      onContinuePlanning && onContinuePlanning(trip);
                    }
                  }}
                  style={{
                    width: "100%", padding: "13px 0",
                    background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                    border: "none", borderRadius: 14,
                    fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer",
                  }}
                >
                  {trip.cta.label}
                </button>
              )}
              {trip.scanStatus === "deep_unlocked" && trip.maturity !== "resolved" && (
                <button
                  onClick={() => setDeepScanOpen(true)}
                  style={{
                    width: "100%", padding: "11px 0",
                    background: "none", border: "1.5px solid #1d4ed8",
                    borderRadius: 14, fontSize: 13, fontWeight: 600, color: "#1d4ed8", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="#1d4ed8" strokeWidth="1.8"/>
                    <path d="M11 8v3l2 2" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16.5 16.5L20 20" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Run deep scan
                </button>
              )}
            </div>
          )}

          {activeView === "coverage" && (() => {
            const COVERAGE_BY_TRIP = {
              t1: [
                { label: "Medical & Emergency", limit: "$250,000", gap: false, source: "Allianz Travel Policy #TPG-2026-4421" },
                { label: "Trip Cancellation", limit: "$10,000", gap: false, source: "Allianz Travel Policy #TPG-2026-4421" },
                { label: "Baggage Loss", limit: "$2,500", gap: false, source: "Chase Sapphire Reserve" },
                { label: "Flight Delay (4h+)", limit: "$500/leg", gap: false, source: "Chase Sapphire Reserve" },
                { label: "Travel Accident", limit: "$100,000", gap: false, source: "Allianz Travel Policy #TPG-2026-4421" },
                { label: "Rental Car Damage", limit: "Primary", gap: false, source: "Chase Sapphire Reserve" },
              ],
              t2: [
                { label: "Medical & Emergency", limit: "$100,000", gap: false, source: "GeoBlue Traveler Policy" },
                { label: "Trip Cancellation", limit: "Not covered", gap: true, source: null },
                { label: "Baggage Loss", limit: "Not covered", gap: true, source: null },
                { label: "Flight Delay", limit: "Not covered", gap: true, source: null },
              ],
              t3: [
                { label: "Medical & Emergency", limit: "$500,000", gap: false, source: "IMG Global Medical Policy" },
                { label: "Medical Evacuation", limit: "Unlimited", gap: false, source: "IMG Global Medical Policy" },
                { label: "Trip Cancellation", limit: "$15,000", gap: false, source: "World Nomads Explorer" },
                { label: "Baggage Loss", limit: "$3,000", gap: false, source: "World Nomads Explorer" },
                { label: "Flight Delay (6h+)", limit: "$400/leg", gap: false, source: "World Nomads Explorer" },
                { label: "Rental Car Damage", limit: "Secondary", gap: false, source: "Chase Sapphire Preferred" },
              ],
              t4: [
                { label: "Medical & Emergency", limit: "$250,000", gap: false, source: "Allianz Travel Policy" },
                { label: "Baggage Loss", limit: "$1,500", gap: false, source: "Amex Platinum" },
                { label: "Flight Delay (2h+)", limit: "$200/leg", gap: false, source: "Amex Platinum" },
                { label: "Trip Cancellation", limit: "Not covered", gap: true, source: null },
              ],
              t5: [
                { label: "Medical & Emergency", limit: "$100,000", gap: false, source: "GeoBlue Traveler Policy" },
                { label: "Trip Cancellation", limit: "$5,000", gap: false, source: "Chase Sapphire Preferred" },
                { label: "Baggage Loss", limit: "$1,500", gap: false, source: "Chase Sapphire Preferred" },
                { label: "Rental Car Damage", limit: "Not covered", gap: true, source: null },
              ],
              t6: [
                { label: "Medical & Emergency", limit: "$250,000", gap: false, source: "Allianz Travel Policy" },
                { label: "Trip Cancellation", limit: "$10,000", gap: false, source: "Allianz Travel Policy" },
                { label: "Baggage Loss", limit: "$2,500", gap: false, source: "Chase Sapphire Reserve" },
              ],
              t7: [
                { label: "Medical & Emergency", limit: "Not covered", gap: true, source: null },
                { label: "Trip Cancellation", limit: "Not covered", gap: true, source: null },
                { label: "Baggage Loss", limit: "Not covered", gap: true, source: null },
              ],
            };
            const items = COVERAGE_BY_TRIP[trip.id] || [];
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map(({ label, limit, gap, source }) => (
                  <div
                    key={label}
                    onClick={gap ? () => setGapDetailOpen(label) : undefined}
                    style={{
                      background: "#f9fafb", border: `1px solid ${gap ? "#fecaca" : "#f0f0f0"}`,
                      borderRadius: 12, padding: "12px 14px",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                      cursor: gap ? "pointer" : "default",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 13, color: "#333", margin: "0 0 2px" }}>{label}</p>
                      {!gap && source && <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>{source}</p>}
                      {!gap && <p style={{ fontSize: 10, color: "#6b7280", margin: "2px 0 0" }}>Up to {limit}</p>}
                      {gap && <p style={{ fontSize: 10, color: "#dc2626", margin: 0 }}>Tap to see options</p>}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, flexShrink: 0, marginLeft: 8,
                      color: gap ? "#dc2626" : "#059669",
                      background: gap ? "#fef2f2" : "#f0fdf4",
                      border: `1px solid ${gap ? "#fecaca" : "#bbf7d0"}`,
                      borderRadius: 20, padding: "2px 8px",
                    }}>
                      {gap ? "Gap" : trip.maturity === "resolved" ? "Was covered" : "Active"}
                    </span>
                  </div>
                ))}
                {items.length === 0 && (
                  <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>No coverage data available. Add policies in the Docs tab.</p>
                )}
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", margin: "0 0 4px" }}>Policy questions</p>
                  <p style={{ fontSize: 12, color: "#374151", margin: "0 0 6px", lineHeight: 1.5 }}>Ask anything about your coverage. For now, your extracted policy clauses are shown above.</p>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#0369a1", background: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: 20, padding: "2px 8px" }}>Coming soon</span>
                </div>
              </div>
            );
          })()}

          {activeView === "incidents" && <IncidentsTabContent trip={trip} onOpenIncident={onOpenIncident} />}
          {activeView === "docs" && <DocsTabContent trip={trip} />}
        </div>
      </div>

      {deepScanOpen && <DeepScanSheet trip={trip} onDismiss={() => setDeepScanOpen(false)} />}
      {gapDetailOpen && <GapGuidanceSheet gapLabel={gapDetailOpen} onDismiss={() => setGapDetailOpen(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// TRIP CARD
// ---------------------------------------------------------------------------
function TripCard({ trip, onOpen, onOpenTrip }) {
  const matCfg = MATURITY[trip.maturity] || MATURITY.planning;
  const scanCfg = SCAN_CONFIG[trip.scanStatus] || SCAN_CONFIG.quick_only;
  const modeIcon = MODE_ICONS[trip.mode] || null;
  const incidents = TRIP_INCIDENTS[trip.id] || [];
  const openIncidents = incidents.filter((i) => i.state === "open").length;
  const resolvedIncidents = incidents.filter((i) => i.state === "resolved").length;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #f0f0f0",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        cursor: "pointer",
        transition: "transform 0.15s",
      }}
    >
      <div onClick={() => onOpen(trip)} style={{ position: "relative", height: 88, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- mock / external hero URLs in prototype */}
        <img src={trip.heroImage} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.55))" }} />

        <div style={{ position: "absolute", top: 8, left: 10, display: "flex", gap: 5 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: matCfg.color,
            background: "rgba(255,255,255,0.92)", border: `1px solid ${matCfg.border}`,
            borderRadius: 20, padding: "2px 8px",
          }}>
            {matCfg.label}
          </span>
          {trip.incidentBadge && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#d97706",
              background: "rgba(255,255,255,0.92)", border: "1px solid #fde68a",
              borderRadius: 20, padding: "2px 8px",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M4 1L1 6.5h6L4 1z" fill="#d97706"/>
              </svg>
              {trip.incidentBadge.count} incident
            </span>
          )}
        </div>

        <div style={{ position: "absolute", bottom: 8, left: 10, right: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "white", margin: 0, letterSpacing: "-0.2px" }}>{trip.name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
              {modeIcon}
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)" }}>{trip.destination}</span>
            </div>
          </div>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.65)" }}>{trip.flag}</span>
        </div>
      </div>

      <div style={{ padding: "10px 12px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { icon: "🛡", v: `${trip.coverageSnap.policies}`, label: "policies" },
            { icon: "⚠", v: `${trip.incidentSnap.open}`, label: "open" },
            { icon: "📄", v: `${trip.docSnap.items}`, label: "docs" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }} onClick={() => onOpen(trip)}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>{s.v}</p>
              <p style={{ fontSize: 8, color: "#aaa", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => onOpenTrip ? onOpenTrip(trip) : onOpen(trip)}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1d4ed8" }}>Open trip</span>
          <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
            <path d="M1 1l3 3-3 3" stroke="#1d4ed8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Incident summary row */}
      <div style={{ padding: "0 12px 10px", borderTop: "1px solid #f5f5f5" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Incidents</p>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: openIncidents > 0 ? "#d97706" : "#9ca3af" }}>
                {openIncidents} open
              </span>
              <span style={{ fontSize: 10, color: "#d1d5db" }}>·</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: resolvedIncidents > 0 ? "#059669" : "#9ca3af" }}>
                {resolvedIncidents} resolved
              </span>
            </div>
          </div>
          <button
            onClick={() => onOpenTrip ? onOpenTrip(trip) : onOpen(trip)}
            style={{ background: "none", border: "none", fontSize: 11, fontWeight: 600, color: "#1d4ed8", cursor: "pointer", padding: 0 }}
          >
            + Add new
          </button>
        </div>
        <p style={{ fontSize: 10, color: "#bbb", margin: "3px 0 0" }}>{trip.dates}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TOP ACTIONS BAR
// ---------------------------------------------------------------------------
function TopActions({ onNewTrip, onImport, activeTrips, onResumeTrip }) {
  const [resumeTooltip, setResumeTooltip] = useState(false);
  const tooltipTimer = useRef(null);
  const resumeTrip = TRIPS.filter(t => t.maturity === "active" || t.maturity === "incident_open")[0] || null;
  const lastWorkedTrip = resumeTrip;

  function showTooltip() {
    tooltipTimer.current = setTimeout(() => setResumeTooltip(true), 300);
  }
  function hideTooltip() {
    clearTimeout(tooltipTimer.current);
    setResumeTooltip(false);
  }

  return (
    <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", overflowX: "auto" }}>
      {/* New trip */}
      <button onClick={onNewTrip} style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
        border: "none", borderRadius: 20, padding: "7px 13px",
        display: "flex", alignItems: "center", gap: 5,
        fontSize: 12, fontWeight: 600, color: "white",
        cursor: "pointer", flexShrink: 0,
        boxShadow: "0 4px 12px rgba(30,58,95,0.35)",
      }}>
        <span style={{ fontSize: 13 }}>+</span>
        New trip
      </button>

      {/* Import */}
      <button onClick={onImport} style={{
        background: "#111", border: "none", borderRadius: 20, padding: "7px 13px",
        display: "flex", alignItems: "center", gap: 5,
        fontSize: 12, fontWeight: 600, color: "white",
        cursor: "pointer", flexShrink: 0,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Import confirmation
      </button>

      {/* Resume with tooltip — only shown when an active/incident_open trip exists */}
      {resumeTrip && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => onResumeTrip && onResumeTrip(resumeTrip)}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onTouchStart={showTooltip}
            onTouchEnd={hideTooltip}
            style={{
              background: "#111", border: "none", borderRadius: 20, padding: "7px 13px",
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 600, color: "white",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            }}
          >
            <svg width="11" height="12" viewBox="0 0 24 24" fill="none">
              <polygon points="5 3 19 12 5 21 5 3" fill="white"/>
            </svg>
            Resume
          </button>

          {resumeTooltip && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(17,17,17,0.92)",
              backdropFilter: "blur(10px)",
              borderRadius: 10, padding: "7px 11px",
              whiteSpace: "nowrap", zIndex: 50,
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "white", margin: 0 }}>Resume last worked-on trip</p>
              {lastWorkedTrip && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", margin: "2px 0 0" }}>{lastWorkedTrip.name} · {lastWorkedTrip.recentUpdate}</p>
              )}
              <div style={{
                position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
                width: 0, height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid rgba(17,17,17,0.92)",
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SECTION HEADER
// ---------------------------------------------------------------------------
function SectionRow({ label, count }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 8px 2px" }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.1px" }}>{label}</p>
      {count != null && <span style={{ fontSize: 11, color: "#aaa" }}>{count}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IMPORT CONFIRMATION SHEET
// ---------------------------------------------------------------------------
const OTHER_EMAIL_PROVIDERS = [
  { name: "Outlook / Hotmail", color: "#0078d4", url: "https://outlook.live.com/mail/0/" },
  { name: "Apple Mail", color: "#111", url: "https://www.icloud.com/mail" },
  { name: "ProtonMail", color: "#6d4aff", url: "https://mail.proton.me/" },
  { name: "AOL Mail", color: "#ff0b37", url: "https://mail.aol.com/" },
  { name: "Zoho Mail", color: "#e4502a", url: "https://mail.zoho.com/" },
  { name: "Fastmail", color: "#0060a0", url: "https://app.fastmail.com/" },
];

function ImportConfirmationSheet({ onDismiss }) {
  const [step, setStep] = useState("choose");
  const [dragging, setDragging] = useState(false);
  const [connectedEmails, setConnectedEmails] = useState([
    { id: "gmail", name: "Gmail", email: "james.donovan@gmail.com", icon: "G", color: "#ea4335", connected: true },
  ]);
  const [showOtherProviders, setShowOtherProviders] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState(null);

  function handleRevoke(id) {
    setConnectedEmails((prev) => prev.filter((e) => e.id !== id));
    setRevokeConfirm(null);
  }

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 201, padding: "0 0 36px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
        maxHeight: "88%", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "14px 20px 0", flexShrink: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 4px", letterSpacing: "-0.3px" }}>Import travel confirmation</p>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 16px" }}>Connect your email or upload a file — we&apos;ll extract your itinerary automatically.</p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>

          {/* Connected accounts */}
          {connectedEmails.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Connected accounts</p>
              {connectedEmails.map((acct) => (
                <div key={acct.id} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: acct.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "white" }}>{acct.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>{acct.name}</p>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: "1px 0 0" }}>{acct.email}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
                    <button
                      onClick={() => setRevokeConfirm(acct.id)}
                      style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 8, padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "#dc2626", cursor: "pointer" }}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Email provider options */}
          <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Connect email</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <a
              href="https://mail.google.com/mail/u/0/#search/travel+confirmation"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "white", border: "1.5px solid #e5e7eb", borderRadius: 14,
                padding: "12px 14px", textDecoration: "none", cursor: "pointer",
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="#ea4335" strokeWidth="1.5"/>
                  <path d="M2 6l10 7 10-7" stroke="#ea4335" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>Import from Gmail</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Opens Gmail — search for travel confirmations</p>
              </div>
              <svg width="5" height="9" viewBox="0 0 5 9" fill="none"><path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>

            <a
              href="https://mail.yahoo.com/d/search/keyword=travel%20confirmation"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "white", border: "1.5px solid #e5e7eb", borderRadius: 14,
                padding: "12px 14px", textDecoration: "none", cursor: "pointer",
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f5f0ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 4l7 9v7h4v-7l7-9H3z" stroke="#7c3aed" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>Import from Yahoo Mail</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Opens Yahoo Mail — search for travel confirmations</p>
              </div>
              <svg width="5" height="9" viewBox="0 0 5 9" fill="none"><path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>

            <button
              onClick={() => setShowOtherProviders(!showOtherProviders)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "white", border: "1.5px solid #e5e7eb", borderRadius: 14,
                padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%",
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="1.5" fill="#6b7280"/>
                  <circle cx="5" cy="12" r="1.5" fill="#6b7280"/>
                  <circle cx="19" cy="12" r="1.5" fill="#6b7280"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>Import from other email</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>Outlook, Apple Mail, ProtonMail, and more</p>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showOtherProviders ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                <path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {showOtherProviders && (
              <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden", marginTop: -4 }}>
                {OTHER_EMAIL_PROVIDERS.map((p, i) => (
                  <a
                    key={p.name}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", textDecoration: "none",
                      borderBottom: i < OTHER_EMAIL_PROVIDERS.length - 1 ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: p.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="white" strokeWidth="1.6"/>
                        <path d="M2 6l10 7 10-7" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#111", flex: 1 }}>{p.name}</span>
                    <svg width="5" height="9" viewBox="0 0 5 9" fill="none"><path d="M1 1l3 3.5L1 8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
            <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>or upload a file</span>
            <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
          </div>

          {/* Drop zone */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); setStep("processing"); setTimeout(() => setStep("done"), 1800); }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 10, padding: "24px 20px",
              background: dragging ? "#eff6ff" : "#f9fafb",
              border: `2px dashed ${dragging ? "#1d4ed8" : "#e5e7eb"}`,
              borderRadius: 16, cursor: "pointer", marginBottom: 14,
              transition: "all 0.15s",
            }}
          >
            <input type="file" accept=".pdf,.eml,.html,.txt,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={() => { setStep("processing"); setTimeout(() => setStep("done"), 1800); }} />
            {step === "processing" ? (
              <>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid #1d4ed8", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8", margin: 0 }}>Extracting itinerary...</p>
              </>
            ) : step === "done" ? (
              <>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 7" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#059669", margin: 0 }}>Itinerary extracted</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>Review and confirm below</p>
              </>
            ) : (
              <>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>Drop file here or tap to browse</p>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>PDF, email, image, or text file</p>
              </>
            )}
          </label>

          {step === "done" && (
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px", marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Extracted itinerary</p>
              {[
                { label: "Trip name", value: "Tokyo Conference 2026" },
                { label: "Dates", value: "Aug 3 – Aug 10, 2026" },
                { label: "Outbound", value: "JFK → NRT · NH 1010 · Aug 3" },
                { label: "Return", value: "NRT → JFK · NH 1009 · Aug 10" },
                { label: "Hotel", value: "Park Hyatt Tokyo · 7 nights" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: "#111", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {step === "done" && (
              <button onClick={onDismiss} style={{ width: "100%", padding: "13px 0", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer" }}>
                Add to trips
              </button>
            )}
            <button onClick={onDismiss} style={{ width: "100%", padding: "11px 0", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 14, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Revoke confirm dialog */}
      {revokeConfirm && (
        <>
          <div onClick={() => setRevokeConfirm(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300 }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 301,
            background: "white", borderRadius: "20px 20px 0 0", padding: "20px 20px 32px",
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
            </div>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/><path d="M10.3 3.6L2 20h20L13.7 3.6a2 2 0 00-3.4 0z" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 6px", textAlign: "center" }}>Revoke email access?</p>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 20px", textAlign: "center", lineHeight: 1.5 }}>TripGuard will no longer be able to read emails from this account. You can reconnect at any time.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setRevokeConfirm(null)} style={{ flex: 1, padding: "12px 0", background: "#f3f4f6", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                Keep access
              </button>
              <button onClick={() => handleRevoke(revokeConfirm)} style={{ flex: 1, padding: "12px 0", background: "#dc2626", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
                Revoke access
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export default function TripsScreen({ onOpenTrip, onOpenIncident }) {
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [newTripOpen, setNewTripOpen] = useState(false);
  const [planningTrip, setPlanningTrip] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const active = TRIPS.filter((t) => t.maturity === "active" || t.maturity === "incident_open");
  const upcoming = TRIPS.filter((t) => t.maturity === "planning" || t.maturity === "ready");
  const past = TRIPS.filter((t) => t.maturity === "resolved");

  if (newTripOpen || planningTrip) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "white" }}>
        <NewTripFlow onClose={() => { setNewTripOpen(false); setPlanningTrip(null); }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      <div style={{ padding: "8px 20px 0", background: "#f5f5f7", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Trips</p>
        </div>
      </div>

      <TopActions onNewTrip={() => setNewTripOpen(true)} onImport={() => setImportOpen(true)} activeTrips={active} onResumeTrip={(trip) => onOpenTrip && onOpenTrip(trip)} />

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 106px" }}>
        {active.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionRow label="Active" count={active.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {active.map((t) => <TripCard key={t.id} trip={t} onOpen={setSelectedTrip} onOpenTrip={onOpenTrip} />)}
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionRow label="Upcoming" count={upcoming.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map((t) => <TripCard key={t.id} trip={t} onOpen={setSelectedTrip} onOpenTrip={onOpenTrip} />)}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <SectionRow label="Past" count={past.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {past.map((t) => <TripCard key={t.id} trip={t} onOpen={setSelectedTrip} onOpenTrip={onOpenTrip} />)}
            </div>
          </div>
        )}
      </div>

      {selectedTrip && (
        <TripDetailSheet
          trip={selectedTrip}
          onDismiss={() => setSelectedTrip(null)}
          onContinuePlanning={(t) => { setSelectedTrip(null); setPlanningTrip(t); }}
          onOpenIncident={(inc) => { setSelectedTrip(null); onOpenIncident && onOpenIncident(inc); }}
        />
      )}

      {importOpen && <ImportConfirmationSheet onDismiss={() => setImportOpen(false)} />}
    </div>
  );
}
