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
      <div
        className="rounded-[16px] overflow-hidden border-2"
        style={{ background: "var(--color-background-primary)", borderColor: "var(--color-brand-navy)" }}
      >
        <div className="px-4 py-3 flex justify-between items-center" style={{ background: "var(--color-brand-navy)" }}>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Traveler safety card
            </p>
            <p className="text-[9px] text-white/40 mt-0.5">\u65C5\u884C\u8005\u5B89\u5168\u30AB\u30FC\u30C9</p>
          </div>
          <div className="w-10 h-10 bg-white rounded-[4px] flex items-center justify-center">
            <QrCode className="w-6 h-6" style={{ color: "var(--color-brand-navy)" }} />
          </div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border-tertiary)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold"
              style={{ background: "var(--color-background-info)", color: "var(--color-brand-navy)" }}
            >
              CR
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--color-brand-navy)" }}>
                Christian Rayford
              </p>
              <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                US &middot; \u30A2\u30E1\u30EA\u30AB
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border-tertiary)" }}>
          <p
            className="text-[9px] font-semibold uppercase tracking-wider mb-2 inline-block px-2 py-0.5 rounded"
            style={{ background: "var(--color-background-warning)", color: "var(--color-text-warning)" }}
          >
            Allergies &middot; \u30A2\u30EC\u30EB\u30AE\u30FC
          </p>
          <div className="space-y-1.5">
            {ALLERGIES.map((a) => (
              <div
                key={a.en}
                className="rounded-[8px] px-2.5 py-1.5 flex justify-between items-center"
                style={{
                  background: "var(--color-background-warning)",
                  border: "0.5px solid var(--color-border-warning)",
                }}
              >
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--color-text-warning)" }}>
                    {a.en}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--color-text-warning)", opacity: 0.8 }}>
                    {a.local}
                  </p>
                </div>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "var(--color-border-warning)", color: "var(--color-text-warning)" }}
                >
                  {a.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border-tertiary)" }}>
          <p
            className="text-[9px] font-semibold uppercase tracking-wider mb-2 inline-block px-2 py-0.5 rounded"
            style={{ background: "var(--color-background-info)", color: "var(--color-text-info)" }}
          >
            Medications &middot; \u51E6\u65B9\u85AC
          </p>
          <div className="space-y-1.5">
            {MEDS.map((m) => (
              <div
                key={m.en}
                className="rounded-[8px] px-2.5 py-1.5"
                style={{
                  background: m.flag ? "var(--color-background-danger)" : "var(--color-background-secondary)",
                  border: m.flag
                    ? "1px solid var(--color-border-danger)"
                    : "0.5px solid var(--color-border-tertiary)",
                }}
              >
                <p
                  className="text-[12px] font-semibold"
                  style={{ color: m.flag ? "var(--color-text-danger)" : "var(--color-text-primary)" }}
                >
                  {m.en}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: m.flag ? "var(--color-text-warning)" : "var(--color-text-secondary)" }}
                >
                  {m.local}
                </p>
                <p className="text-[9px] mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                  For: {m.purpose}
                </p>
                {m.flag && (
                  <div
                    className="mt-1 rounded-[6px] px-2 py-1.5"
                    style={{ background: "var(--color-border-danger)" }}
                  >
                    <p className="text-[10px] font-semibold" style={{ color: "var(--color-text-danger)" }}>
                      {m.flag}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border-tertiary)" }}>
          <p
            className="text-[9px] font-semibold uppercase tracking-wider mb-1 inline-block px-2 py-0.5 rounded"
            style={{ background: "var(--color-background-warning)", color: "var(--color-text-warning)" }}
          >
            Accommodation &middot; \u5BBF\u6CCA\u5148
          </p>
          <p className="text-[12px] font-semibold mt-1" style={{ color: "var(--color-brand-navy)" }}>
            Park Hyatt Tokyo
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[11px] flex-1" style={{ color: "var(--color-text-secondary)" }}>
              \u65B0\u5BBF\u533A\u897F\u65B0\u5BBF3-7-1-2
            </p>
            <button
              className="w-6 h-6 rounded-[6px] flex items-center justify-center"
              style={{ background: "var(--color-background-info)", border: "0.5px solid var(--color-border-info)" }}
            >
              <MapPin className="w-3 h-3" style={{ color: "var(--color-text-info)" }} />
            </button>
            <button
              className="w-6 h-6 rounded-[6px] flex items-center justify-center"
              style={{
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-tertiary)",
              }}
            >
              <Copy className="w-3 h-3" style={{ color: "var(--color-text-secondary)" }} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 text-center" style={{ background: "var(--color-background-secondary)" }}>
          <p className="text-[9px] mb-2" style={{ color: "var(--color-text-tertiary)" }}>
            Scan to view on any device
          </p>
          <div
            className="w-20 h-20 mx-auto rounded-[6px] flex items-center justify-center"
            style={{ background: "var(--color-brand-navy)" }}
          >
            <QrCode className="w-14 h-14 text-white" />
          </div>
          <p className="text-[9px] font-mono mt-2" style={{ color: "var(--color-text-tertiary)" }}>
            wayfarer.app/safety/c8b5f\u2026
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="rounded-[10px] py-2.5 text-[12px] font-semibold flex items-center justify-center gap-1.5"
          style={{
            background: "var(--color-background-primary)",
            color: "var(--color-brand-navy)",
            border: "0.5px solid var(--color-border-tertiary)",
          }}
        >
          <Download className="w-3.5 h-3.5" /> Save as image
        </button>
        <button
          className="rounded-[10px] py-2.5 text-[12px] font-semibold flex items-center justify-center gap-1.5"
          style={{ background: "var(--color-brand-navy)", color: "#ffffff" }}
        >
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      </div>
    </MobileShell>
  );
}
