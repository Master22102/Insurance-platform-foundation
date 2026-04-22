"use client";

import { Compass, Plane, Users, Shield, Bell, Check } from "lucide-react";

const STEPS = [
  { id: "welcome", label: "Welcome", done: true, Icon: Compass },
  { id: "archetype", label: "Traveler type", done: true, Icon: Plane },
  { id: "circle", label: "Travel circle", done: false, Icon: Users, active: true },
  { id: "coverage", label: "Coverage intro", done: false, Icon: Shield },
  { id: "permissions", label: "Permissions", done: false, Icon: Bell },
];

const ARCHETYPES = [
  { id: "solo", label: "Solo traveler", copy: "I mostly travel alone and want a quiet safety net." },
  { id: "family", label: "Family trips", copy: "I plan with partners, kids, or multi-generation groups." },
  { id: "business", label: "Business + leisure", copy: "Flights I can\u2019t miss. Coverage that follows the itinerary." },
  { id: "adventure", label: "Off-grid", copy: "Long legs, thin signal, more presence and SOS." },
];

export default function OnboardingCompass() {
  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#0b1220" }}>
      <div style={{ height: 50, flexShrink: 0 }} />
      <div className="relative px-5 pt-2 pb-5">
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full opacity-30" style={{ background: "radial-gradient(circle at 30% 30%, #3b82f6, transparent 60%)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/50">
            <Compass className="w-3.5 h-3.5" /> Onboarding compass &middot; step 3 of 5
          </div>
          <h1 className="text-[26px] font-semibold text-white leading-tight mt-2">
            How do you travel?
          </h1>
          <p className="text-[13px] text-white/60 mt-1 leading-relaxed">
            Wayfarer tunes coverage, alerts, and presence to your travel style. You can change this later in Account.
          </p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center justify-between">
          {STEPS.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center border"
                style={{
                  background: s.done ? "#1d4ed8" : s.active ? "#ffffff" : "transparent",
                  borderColor: s.done ? "#1d4ed8" : s.active ? "#ffffff" : "rgba(255,255,255,0.25)",
                }}
              >
                {s.done ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <s.Icon className="w-4 h-4" style={{ color: s.active ? "#0b1220" : "rgba(255,255,255,0.5)" }} />
                )}
              </div>
              <span className="text-[9px] uppercase tracking-wider" style={{ color: s.active ? "#ffffff" : "rgba(255,255,255,0.45)" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-3">
        {ARCHETYPES.map((a, i) => (
          <button
            key={a.id}
            className="w-full text-left rounded-[16px] p-4 transition"
            style={{
              background: i === 1 ? "#ffffff" : "rgba(255,255,255,0.06)",
              border: i === 1 ? "1px solid #ffffff" : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold" style={{ color: i === 1 ? "#0b1220" : "#ffffff" }}>
                {a.label}
              </p>
              {i === 1 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#1d4ed8", color: "white" }}>
                  Selected
                </span>
              )}
            </div>
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: i === 1 ? "#475569" : "rgba(255,255,255,0.6)" }}>
              {a.copy}
            </p>
          </button>
        ))}
      </div>

      <div className="px-4 pt-3 pb-6 flex items-center gap-3" style={{ background: "rgba(11,18,32,0.9)" }}>
        <button className="flex-1 rounded-[12px] py-3 text-[13px] font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "white" }}>
          Back
        </button>
        <button className="flex-[2] rounded-[12px] py-3 text-[13px] font-semibold" style={{ background: "#1d4ed8", color: "white" }}>
          Continue
        </button>
      </div>
    </div>
  );
}
