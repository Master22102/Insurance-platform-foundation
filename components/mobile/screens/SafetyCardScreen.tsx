"use client";

import { QrCode, MapPin, Copy, Download, Share2 } from "lucide-react";
import { MobileShell } from "../MobileShell";

const ALLERGIES = [
  { en: "Penicillin", local: "\u30DA\u30CB\u30B7\u30EA\u30F3", tag: "Drug" },
  { en: "Shellfish", local: "\u7532\u6BBB\u985E", tag: "Food" },
  { en: "Peanuts", local: "\u30D4\u30FC\u30CA\u30C3\u30C4", tag: "Food" },
  { en: "Latex", local: "\u30E9\u30C6\u30C3\u30AF\u30B9", tag: "Material" },
];

const MEDS = [
  { en: "Metformin 500mg", local: "\u30E1\u30C8\u30DB\u30EB\u30DF\u30F3", purpose: "Type 2 diabetes", flag: null },
  {
    en: "Adderall",
    local: "\u30A2\u30F3\u30D5\u30A7\u30BF\u30DF\u30F3",
    purpose: "ADHD",
    flag: "Restricted in Japan \u2014 requires Yakkan Shoumei",
  },
];

export default function SafetyCardScreen() {
  return (
    <MobileShell title="Safety card" subtitle="Show to medical or border staff">
      <div className="rounded-[16px] overflow-hidden border-2" style={{ background: "#ffffff", borderColor: "#1A2B4A" }}>
        <div className="px-4 py-3 flex justify-between items-center" style={{ background: "#1A2B4A" }}>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Traveler safety card
            </p>
            <p className="text-[9px] text-white/40 mt-0.5">\u65C5\u884C\u8005\u5B89\u5168\u30AB\u30FC\u30C9</p>
          </div>
          <div className="w-10 h-10 bg-white rounded-[4px] flex items-center justify-center">
            <QrCode className="w-6 h-6" style={{ color: "#1A2B4A" }} />
          </div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: "#f1f5f9" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold" style={{ background: "#eef4ff", color: "#1A2B4A" }}>
              CR
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "#1A2B4A" }}>
                Christian Rayford
              </p>
              <p className="text-[10px]" style={{ color: "#64748b" }}>
                US &middot; \u30A2\u30E1\u30EA\u30AB
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: "#f1f5f9" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider mb-2 inline-block px-2 py-0.5 rounded" style={{ background: "#fffbeb", color: "#92400e" }}>
            Allergies &middot; \u30A2\u30EC\u30EB\u30AE\u30FC
          </p>
          <div className="space-y-1.5">
            {ALLERGIES.map((a) => (
              <div key={a.en} className="rounded-[8px] px-2.5 py-1.5 flex justify-between items-center" style={{ background: "#fffbeb", border: "0.5px solid #fde68a" }}>
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: "#92400e" }}>
                    {a.en}
                  </p>
                  <p className="text-[10px]" style={{ color: "#b45309" }}>
                    {a.local}
                  </p>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#fef3c7", color: "#92400e" }}>
                  {a.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: "#f1f5f9" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#0369a1" }}>
            Medications &middot; \u51E6\u65B9\u85AC
          </p>
          <div className="space-y-1.5">
            {MEDS.map((m) => (
              <div
                key={m.en}
                className="rounded-[8px] px-2.5 py-1.5"
                style={{
                  background: m.flag ? "#fef2f2" : "#f8fafc",
                  border: m.flag ? "1px solid #fecaca" : "0.5px solid #e5e7eb",
                }}
              >
                <p className="text-[12px] font-semibold" style={{ color: m.flag ? "#991b1b" : "#0f172a" }}>
                  {m.en}
                </p>
                <p className="text-[10px]" style={{ color: m.flag ? "#b45309" : "#64748b" }}>
                  {m.local}
                </p>
                <p className="text-[9px] mt-0.5" style={{ color: "#94a3b8" }}>
                  For: {m.purpose}
                </p>
                {m.flag && (
                  <div className="mt-1 rounded-[6px] px-2 py-1.5" style={{ background: "#fee2e2" }}>
                    <p className="text-[10px] font-semibold" style={{ color: "#991b1b" }}>
                      {m.flag}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: "#f1f5f9" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider mb-1 inline-block px-2 py-0.5 rounded" style={{ background: "#fffbeb", color: "#92400e" }}>
            Accommodation &middot; \u5BBF\u6CCA\u5148
          </p>
          <p className="text-[12px] font-semibold mt-1" style={{ color: "#1A2B4A" }}>
            Park Hyatt Tokyo
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[11px] flex-1" style={{ color: "#475569" }}>
              \u65B0\u5BBF\u533A\u897F\u65B0\u5BBF3-7-1-2
            </p>
            <button className="w-6 h-6 rounded-[6px] flex items-center justify-center" style={{ background: "#f0f9ff", border: "0.5px solid #bae6fd" }}>
              <MapPin className="w-3 h-3" style={{ color: "#0369a1" }} />
            </button>
            <button className="w-6 h-6 rounded-[6px] flex items-center justify-center" style={{ background: "#f8fafc", border: "0.5px solid #e5e7eb" }}>
              <Copy className="w-3 h-3" style={{ color: "#64748b" }} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 text-center" style={{ background: "#f9fafb" }}>
          <p className="text-[9px] mb-2" style={{ color: "#94a3b8" }}>
            Scan to view on any device
          </p>
          <div className="w-20 h-20 mx-auto rounded-[6px] flex items-center justify-center" style={{ background: "#1A2B4A" }}>
            <QrCode className="w-14 h-14 text-white" />
          </div>
          <p className="text-[9px] font-mono mt-2" style={{ color: "#94a3b8" }}>
            wayfarer.app/safety/c8b5f\u2026
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="rounded-[10px] py-2.5 text-[12px] font-semibold flex items-center justify-center gap-1.5" style={{ background: "#ffffff", color: "#1A2B4A", border: "0.5px solid #e5e7eb" }}>
          <Download className="w-3.5 h-3.5" /> Save as image
        </button>
        <button className="rounded-[10px] py-2.5 text-[12px] font-semibold flex items-center justify-center gap-1.5" style={{ background: "#1A2B4A", color: "#ffffff" }}>
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      </div>
    </MobileShell>
  );
}
