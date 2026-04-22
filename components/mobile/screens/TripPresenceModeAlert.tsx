"use client";

import { MapPin, CircleAlert as AlertCircle, Moon, Radio, UserCheck, ArrowRight } from "lucide-react";
import { MobileShell } from "../MobileShell";

const MODES = [
  { id: "standard", label: "Standard", active: false },
  { id: "buddy", label: "Buddy", active: true },
  { id: "silent", label: "Silent", active: false },
  { id: "sos", label: "SOS", active: false },
];

const ALERTS = [
  {
    severity: "critical",
    Icon: AlertCircle,
    accent: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    title: "Maria missed her 14:00 check-in",
    body: "Last seen near Alfama, Lisbon at 12:42. No response to two requests.",
    cta: "Escalate now",
    time: "42 min overdue",
  },
  {
    severity: "warning",
    Icon: Radio,
    accent: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    title: "You left the safe zone",
    body: "You&rsquo;re 0.8 mi outside the evening geofence for Lisbon. Presence mode switched to alert.",
    cta: "Acknowledge",
    time: "Just now",
  },
  {
    severity: "info",
    Icon: UserCheck,
    accent: "#059669",
    bg: "#ecfdf5",
    border: "#bbf7d0",
    title: "Chris back online",
    body: "TravelShield partner reconnected after 6 min offline near Porto station.",
    cta: "Request check-in",
    time: "2 min ago",
  },
];

export default function TripPresenceModeAlert() {
  return (
    <MobileShell title="Presence alerts" subtitle="Portugal 2026 &middot; Buddy mode">
      <div className="rounded-[14px] border p-2 flex items-center gap-1" style={{ background: "#ffffff", borderColor: "#e5e7eb" }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            className="flex-1 py-2 rounded-[10px] text-[12px] font-semibold transition"
            style={{
              background: m.active ? "#1A2B4A" : "transparent",
              color: m.active ? "#ffffff" : "#64748b",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-[14px] p-3 border flex items-center gap-3" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#0369a1" }}>
          <Moon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-semibold" style={{ color: "#0369a1" }}>
            Silent hours start in 3h 12m
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#0c4a6e" }}>
            22:00 &ndash; 07:00 Lisbon. Non-critical alerts will be deferred.
          </p>
        </div>
      </div>

      {ALERTS.map((a) => (
        <div key={a.title} className="rounded-[14px] border p-3" style={{ background: a.bg, borderColor: a.border }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#ffffff" }}>
              <a.Icon className="w-4 h-4" style={{ color: a.accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold" style={{ color: a.accent }}>
                  {a.title}
                </p>
                <span className="text-[10px]" style={{ color: a.accent }}>
                  {a.time}
                </span>
              </div>
              <p className="text-[12px] mt-1 leading-[1.5]" style={{ color: "#334155" }} dangerouslySetInnerHTML={{ __html: a.body }} />
              <button
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold rounded-[8px] px-3 py-1.5"
                style={{ background: "#ffffff", color: a.accent, border: `0.5px solid ${a.border}` }}
              >
                {a.cta}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-[14px] p-3 border flex items-center gap-2" style={{ background: "#ffffff", borderColor: "#e5e7eb" }}>
        <MapPin className="w-4 h-4" style={{ color: "#64748b" }} />
        <p className="text-[12px]" style={{ color: "#475569" }}>
          Geofence: Baixa &amp; Alfama &middot; 2 partners inside
        </p>
      </div>
    </MobileShell>
  );
}
