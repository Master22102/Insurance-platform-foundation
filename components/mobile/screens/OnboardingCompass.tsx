"use client";

import { useEffect, useRef, useState } from "react";

const COORDS = [
  "48°N 2°E", "41°N 14°E", "40°N 3°W", "43°N 12°E", "51°N 0°W",
  "35°N 14°E", "44°N 26°E", "59°N 10°E", "LAT 41.9", "LON 12.5",
  "FIX 48.8", "REF 40.4", "→ 43.3°N", "→ 2.1°W", "∘ 41.1°N", "∘ 14.3°E",
];

const PARSE_COPY = [
  "Plotting the good stuff…",
  "Watching your back already.",
  "On it. Don\u2019t worry.",
  "Making sense of the adventure.",
  "Sorting out the details.",
  "Building your world.",
  "Planning a great time.",
  "Organizing so you don\u2019t have to.",
];

type State = "idle" | "recording" | "parsing";

export default function OnboardingCompass() {
  const [state, setState] = useState<State>("idle");
  const [label, setLabel] = useState("Tap to start your final round");
  const [labelColor, setLabelColor] = useState<string | undefined>(undefined);
  const [blips, setBlips] = useState<{ id: number; left: number; top: number; dur: number; text: string }[]>([]);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const blipIdRef = useRef(0);
  const copyIndexRef = useRef(Math.floor(Math.random() * PARSE_COPY.length));
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearAll = () => {
    timersRef.current.forEach(clearTimeout);
    intervalsRef.current.forEach(clearInterval);
    timersRef.current = [];
    intervalsRef.current = [];
  };

  const spawnBlip = (fast: boolean) => {
    const side = Math.random() > 0.5;
    const left = side ? Math.random() * 90 + 10 : Math.random() * 70 + 160;
    const top = Math.random() * 140 + 12;
    const dur = fast ? Math.random() * 0.9 + 0.7 : Math.random() * 2.2 + 1.4;
    const id = ++blipIdRef.current;
    const text = COORDS[Math.floor(Math.random() * COORDS.length)];
    setBlips((prev) => [...prev, { id, left, top, dur, text }]);
    const t = setTimeout(() => setBlips((prev) => prev.filter((b) => b.id !== id)), dur * 1000);
    timersRef.current.push(t);
  };

  useEffect(() => clearAll, []);

  const handleTap = () => {
    if (state === "idle") {
      setState("recording");
      setLabel("Listening\u2026 tap again to stop");
      setLabelColor("rgba(180,210,255,0.85)");
      const iv = setInterval(() => spawnBlip(false), 680);
      intervalsRef.current.push(iv);
      spawnBlip(false);
    } else if (state === "recording") {
      setState("parsing");
      setLabel("");
      setLabelColor("rgba(120,210,255,0.8)");
      const iv = setInterval(() => spawnBlip(true), 260);
      intervalsRef.current.push(iv);
      const showCopy = () => {
        const msg = PARSE_COPY[copyIndexRef.current % PARSE_COPY.length];
        copyIndexRef.current += 1;
        setCopyMsg(msg);
        const t = setTimeout(() => setCopyMsg(null), 2000);
        timersRef.current.push(t);
      };
      showCopy();
      const iv2 = setInterval(showCopy, 2100);
      intervalsRef.current.push(iv2);
      const done = setTimeout(() => {
        clearAll();
        setBlips([]);
        setCopyMsg(null);
        setState("idle");
        setLabel("\u2713 Got it.");
        setLabelColor("rgba(100,220,150,0.9)");
        const reset = setTimeout(() => {
          setLabel("Tap to start your final round");
          setLabelColor(undefined);
        }, 1800);
        timersRef.current.push(reset);
      }, 2600);
      timersRef.current.push(done);
    } else {
      clearAll();
      setBlips([]);
      setCopyMsg(null);
      setState("idle");
      setLabel("Tap to start your final round");
      setLabelColor(undefined);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto" style={{ background: "var(--color-background-secondary)", fontFamily: "var(--font-sans)" }}>
      <div style={{ height: 50 }} />
      <div style={{ padding: "0 14px 18px" }}>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 12px", textAlign: "center" }}>
          Tap &rarr; record &rarr; tap again &rarr; parse
        </p>

        <div style={{ background: "var(--color-background-primary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
          <div style={{ background: "var(--color-background-secondary)", padding: "10px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>Wayfarer</span>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>step 2 of 2</span>
          </div>

          <div style={{ padding: "16px 18px 10px" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 3px" }}>Last one</p>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px", letterSpacing: "-0.3px" }}>Anything else to add?</h2>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
              This is your last round &mdash; or confirm and we&rsquo;ll get started.
            </p>
          </div>

          <div style={{ margin: "0 18px 12px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "10px 13px" }}>
            <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 7px" }}>So far we have</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                ["Places", "Europe \u00b7 Italy \u00b7 France \u00b7 Spain"],
                ["My Thing", "surfing \u00b7 cooking \u00b7 pub crawl"],
                ["Food", "shrimp \u00b7 pasta \u00b7 Italian cuisine"],
                ["Style", "group \u00b7 experiential \u00b7 ROC"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", minWidth: 66 }}>{k}</span>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ margin: "0 18px 14px", borderRadius: 16, overflow: "hidden", position: "relative", background: "var(--color-compass-night)", minHeight: 184 }}>
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
              <div style={{ position: "absolute", top: "15%", left: "-25%", right: "-25%", height: "40%", background: "linear-gradient(180deg, transparent, rgba(99,102,241,0.09) 45%, rgba(16,185,129,0.07) 75%, transparent)", filter: "blur(10px)", animation: "aurora1 14s ease-in-out infinite", borderRadius: "50%" }} />
              <div style={{ position: "absolute", top: "25%", left: "-20%", right: "-20%", height: "30%", background: "linear-gradient(180deg, transparent, rgba(56,189,248,0.06) 50%, transparent)", filter: "blur(8px)", animation: "aurora2 18s ease-in-out infinite 4s", borderRadius: "50%" }} />
            </div>

            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 2, pointerEvents: "none" }} preserveAspectRatio="none" viewBox="0 0 284 184">
              <defs>
                <linearGradient id="hg3" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="30%" stopColor="white" stopOpacity="0.5" />
                  <stop offset="70%" stopColor="white" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="vg3" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="30%" stopColor="white" stopOpacity="0.5" />
                  <stop offset="70%" stopColor="white" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="vig3" cx="50%" cy="50%" r="50%">
                  <stop offset="35%" stopColor="white" stopOpacity="1" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
                <mask id="vm3"><rect width="284" height="184" fill="url(#vig3)" /></mask>
              </defs>
              <g mask="url(#vm3)" opacity="0.5">
                <path d="M0,30 Q142,25 284,30" stroke="url(#hg3)" strokeWidth="0.4" fill="none" />
                <path d="M0,62 Q142,58 284,62" stroke="url(#hg3)" strokeWidth="0.4" fill="none" />
                <path d="M0,92 Q142,90 284,92" stroke="url(#hg3)" strokeWidth="0.5" fill="none" />
                <path d="M0,122 Q142,118 284,122" stroke="url(#hg3)" strokeWidth="0.4" fill="none" />
                <path d="M0,154 Q142,150 284,154" stroke="url(#hg3)" strokeWidth="0.4" fill="none" />
                <path d="M46,0 Q42,92 46,184" stroke="url(#vg3)" strokeWidth="0.4" fill="none" />
                <path d="M94,0 Q88,92 94,184" stroke="url(#vg3)" strokeWidth="0.4" fill="none" />
                <path d="M142,0 Q142,92 142,184" stroke="url(#vg3)" strokeWidth="0.5" fill="none" />
                <path d="M190,0 Q196,92 190,184" stroke="url(#vg3)" strokeWidth="0.4" fill="none" />
                <path d="M238,0 Q244,92 238,184" stroke="url(#vg3)" strokeWidth="0.4" fill="none" />
              </g>
            </svg>

            {/* Tile grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "92px 92px", position: "relative", zIndex: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: "0.5px solid rgba(255,255,255,0.04)", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 22, display: "inline-block", animation: "globeSpin 8s linear infinite", ["--dy" as any]: "-4px" }}>🌍</span>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(215,228,244,0.7)", letterSpacing: "0.01em" }}>Places</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 20, color: "rgba(215,228,244,0.85)", animation: "floatDrift 4.4s ease-in-out infinite 0.6s", display: "inline-block", ["--dy" as any]: "-5px" }}>✦</span>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(215,228,244,0.7)" }}>My Thing</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: "0.5px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 20, animation: "floatDrift 3.2s ease-in-out infinite 1.1s", display: "inline-block", ["--dy" as any]: "-3px" }}>🍽️</span>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(215,228,244,0.7)" }}>Food</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ position: "relative", width: 36, height: 28, display: "flex", alignItems: "center", justifyContent: "center", animation: "floatDrift 4.1s ease-in-out infinite 0.3s", ["--dy" as any]: "-4px" }}>
                    <span style={{ fontSize: 18, zIndex: 2, position: "relative" }}>👥</span>
                    <div style={{ position: "absolute", width: 6, height: 6, borderRadius: "50%", background: "rgba(210,228,255,0.75)", animation: "orbitA 2.4s linear infinite", boxShadow: "0 0 4px rgba(200,220,255,0.4)" }} />
                    <div style={{ position: "absolute", width: 4, height: 4, borderRadius: "50%", background: "rgba(180,210,255,0.4)", animation: "orbitB 3.6s linear infinite" }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 500, color: "rgba(215,228,244,0.7)" }}>Companions</span>
                </div>
              </div>
            </div>

            {/* Coord blips */}
            {blips.map((b) => (
              <div
                key={b.id}
                style={{ position: "absolute", fontSize: 8, fontFamily: "monospace", color: "rgba(255,255,255,0.55)", pointerEvents: "none", zIndex: 3, left: b.left, top: b.top, whiteSpace: "nowrap", letterSpacing: "0.03em", opacity: 0.85, transition: `opacity ${b.dur}s linear` }}
              >
                {b.text}
              </div>
            ))}

            {/* Compass rose */}
            <div style={{ position: "absolute", top: "50%", left: "50%", width: 210, height: 210, animation: state === "recording" ? "none" : state === "parsing" ? "compassSpin 5s linear infinite" : "compassSpin 28s linear infinite", pointerEvents: "none", zIndex: 4, opacity: state === "idle" ? 0.28 : 0.22, transition: "opacity 0.5s", transform: "translate(-50%, -50%)" }}>
              <svg width="210" height="210" viewBox="0 0 210 210">
                <circle cx="105" cy="105" r="96" stroke="rgba(255,255,255,0.38)" strokeWidth="0.5" fill="none" />
                <circle cx="105" cy="105" r="72" stroke="rgba(255,255,255,0.2)" strokeWidth="0.35" fill="none" />
                <circle cx="105" cy="105" r="46" stroke="rgba(255,255,255,0.13)" strokeWidth="0.3" fill="none" strokeDasharray="3 5" />
                <circle cx="105" cy="105" r="24" stroke="rgba(255,255,255,0.08)" strokeWidth="0.25" fill="none" />
                <path d="M89,10.8 A96,96 0 0,1 121,10.8" stroke="rgba(251,191,36,1)" strokeWidth="2.5" fill="none" strokeLinecap="round" style={{ animation: "northGold 3s ease-in-out infinite" }} />
                <line x1="105" y1="9" x2="105" y2="201" stroke="rgba(255,255,255,0.38)" strokeWidth="0.6" />
                <line x1="9" y1="105" x2="201" y2="105" stroke="rgba(255,255,255,0.38)" strokeWidth="0.6" />
                <line x1="37" y1="37" x2="173" y2="173" stroke="rgba(255,255,255,0.13)" strokeWidth="0.3" />
                <line x1="173" y1="37" x2="37" y2="173" stroke="rgba(255,255,255,0.13)" strokeWidth="0.3" />
                <line x1="105" y1="9" x2="105" y2="22" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6" />
                <line x1="105" y1="188" x2="105" y2="201" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" />
                <line x1="9" y1="105" x2="22" y2="105" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" />
                <line x1="188" y1="105" x2="201" y2="105" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" />
                <polygon points="105,11 101,105 105,88 109,105" fill="rgba(255,255,255,0.55)" />
                <polygon points="105,199 101,105 105,122 109,105" fill="rgba(255,255,255,0.28)" />
                <polygon points="199,105 178,101 190,105 178,109" fill="rgba(255,255,255,0.18)" />
                <polygon points="11,105 32,101 20,105 32,109" fill="rgba(255,255,255,0.18)" />
                <circle cx="105" cy="105" r="4.5" fill="rgba(255,255,255,0.6)" />
                <circle cx="105" cy="105" r="2" fill="rgba(255,255,255,0.4)" />
                <text x="105" y="16" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.85)" fontSize="12" fontFamily="system-ui,sans-serif" fontWeight="700">N</text>
                <text x="105" y="197" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.38)" fontSize="11" fontFamily="system-ui,sans-serif" fontWeight="500">S</text>
                <text x="197" y="105" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.38)" fontSize="11" fontFamily="system-ui,sans-serif" fontWeight="500">E</text>
                <text x="13" y="105" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.38)" fontSize="11" fontFamily="system-ui,sans-serif" fontWeight="500">W</text>
              </svg>
            </div>

            {/* Ripple rings (idle only) */}
            {state === "idle" && [0, 0.8, 1.6].map((delay, i) => (
              <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: 62, height: 62, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", animation: `micRipple 2.4s ease-out ${delay}s infinite`, pointerEvents: "none", zIndex: 6 }} />
            ))}

            {/* Vignette */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 88% 88% at 50% 50%, transparent 36%, rgba(3,5,13,0.72) 100%)", pointerEvents: "none", zIndex: 8, borderRadius: 16 }} />

            {/* Mic button */}
            <button
              type="button"
              onClick={handleTap}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 62,
                height: 62,
                borderRadius: "50%",
                background: state === "recording" ? "rgba(2,4,12,0.96)" : "rgba(3,5,12,0.93)",
                border: state === "recording" ? "1px solid rgba(180,210,255,0.3)" : "1px solid rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 3,
                zIndex: 20,
                cursor: "pointer",
                animation: state === "idle" ? "micBreathe 3s ease-in-out infinite" : "none",
              }}
            >
              {state === "idle" && (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M19 11a7 7 0 01-14 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M12 18v3M8 21h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>Tap</span>
                </>
              )}
              {state === "recording" && (
                <div style={{ display: "flex", alignItems: "center", gap: 2, height: 20 }}>
                  {[
                    { dur: 0.55, mh: 16, delay: 0 },
                    { dur: 0.4, mh: 11, delay: 0.08 },
                    { dur: 0.65, mh: 18, delay: 0.03 },
                    { dur: 0.45, mh: 10, delay: 0.12 },
                    { dur: 0.5, mh: 14, delay: 0.18 },
                  ].map((b, i) => (
                    <div key={i} style={{ width: 2, background: "rgba(210,235,255,0.85)", borderRadius: 1, animation: `waveBar ${b.dur}s ease-in-out infinite ${b.delay}s`, ["--mh" as any]: `${b.mh}px` }} />
                  ))}
                </div>
              )}
              {state === "parsing" && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(120,210,255,0.85)", boxShadow: "0 0 8px rgba(100,200,255,0.6)" }} />
              )}
            </button>

            {copyMsg && (
              <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontSize: 10, color: "rgba(120,210,255,0.8)", zIndex: 25, pointerEvents: "none", letterSpacing: "0.01em" }}>
                {copyMsg}
              </div>
            )}
          </div>

          <div style={{ textAlign: "center", marginBottom: 10, minHeight: 18 }}>
            <span style={{ fontSize: 11, color: labelColor ?? "var(--color-text-tertiary)", transition: "color 0.3s" }}>{label}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 18px 14px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.2), 0 0 8px rgba(34,197,94,0.35)" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.2), 0 0 8px rgba(34,197,94,0.35)" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1A2B4A", boxShadow: "0 0 0 3px rgba(26,43,74,0.3)" }} />
            <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginLeft: 2 }}>Round 3 of 3 &mdash; last one</span>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#2E5FA3", cursor: "pointer", fontWeight: 500 }}>Type instead</span>
          </div>

          <div style={{ margin: "0 18px 8px" }}>
            <button type="button" style={{ width: "100%", padding: "12px 0", background: "linear-gradient(180deg, #2E5FA3 0%, #1A2B4A 100%)", color: "white", border: "none", borderRadius: "var(--border-radius-md)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              I&rsquo;m good &mdash; confirm my profile
            </button>
          </div>
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", textDecoration: "underline", cursor: "pointer" }}>Skip this step</span>
          </div>
        </div>
      </div>
    </div>
  );
}
