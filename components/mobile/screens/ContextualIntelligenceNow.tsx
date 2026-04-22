"use client";

import { CloudRain, Clock3, MapPin, Plane, Users, Sparkles } from "lucide-react";
import { MobileShell } from "../MobileShell";

const SIGNALS = [
  {
    kind: "flight",
    Icon: Plane,
    accent: "#1d4ed8",
    bg: "#eff6ff",
    title: "TP205 now boarding",
    body: "Gate B22 &middot; Boarding 22:15. Estimated 11 min walk from your current location.",
    time: "in 14 min",
  },
  {
    kind: "weather",
    Icon: CloudRain,
    accent: "#0369a1",
    bg: "#f0f9ff",
    title: "Rain expected on arrival",
    body: "Lisbon 19&deg;C, showers 06:00\u201410:00. Consider arranging airport transfer in advance.",
    time: "tomorrow",
  },
  {
    kind: "partner",
    Icon: Users,
    accent: "#059669",
    bg: "#ecfdf5",
    title: "Maria landed in LIS",
    body: "TravelShield partner Maria Santos checked in 3 minutes ago. Shared ETA 16:40.",
    time: "3 min ago",
  },
  {
    kind: "restriction",
    Icon: Sparkles,
    accent: "#b45309",
    bg: "#fffbeb",
    title: "Carry medication documentation",
    body: "Your Adderall prescription will be required at JP customs next week. Generate your Yakkan Shoumei letter now.",
    time: "6 days out",
  },
];

export default function ContextualIntelligenceNow() {
  return (
    <MobileShell title="Right now" subtitle="Portugal 2026 &middot; next 6 hours">
      <div className="rounded-[16px] p-4" style={{ background: "linear-gradient(135deg, #1A2B4A 0%, #1d4ed8 100%)" }}>
        <div className="flex items-center gap-2 text-white/60 text-[10px] uppercase tracking-[0.14em]">
          <Clock3 className="w-3 h-3" /> Live intelligence
        </div>
        <p className="text-white text-[17px] font-semibold mt-1 leading-snug">
          2 things need you before boarding.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-white/80">
            <MapPin className="w-3 h-3" /> JFK T5 &middot; 22:01
          </div>
          <span className="text-white/30">&middot;</span>
          <div className="text-[11px] text-white/80">3 partners online</div>
        </div>
      </div>

      {SIGNALS.map((s) => (
        <div
          key={s.title}
          className="rounded-[14px] p-3 border"
          style={{ background: "#ffffff", borderColor: "#e5e7eb" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg }}
            >
              <s.Icon className="w-4 h-4" style={{ color: s.accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold" style={{ color: "#0f172a" }}>
                  {s.title}
                </p>
                <span className="text-[10px] flex-shrink-0" style={{ color: s.accent }}>
                  {s.time}
                </span>
              </div>
              <p className="text-[12px] mt-1 leading-[1.5]" style={{ color: "#475569" }} dangerouslySetInnerHTML={{ __html: s.body }} />
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-[14px] p-3 border" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#64748b" }}>
          Quiet window
        </p>
        <p className="text-[13px] mt-1" style={{ color: "#0f172a" }}>
          Next 2 hours in-flight. Wayfarer will resume notifications on landing.
        </p>
      </div>
    </MobileShell>
  );
}
