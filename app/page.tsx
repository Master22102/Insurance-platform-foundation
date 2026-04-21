"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration, start]);
  return value;
}

function InteractivePhone() {
  const [activeTab, setActiveTab] = useState<'trips' | 'coverage' | 'incidents'>('trips');
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 320, height: 693,
        borderRadius: 48,
        boxShadow: hovered
          ? "0 60px 120px rgba(0,0,0,0.55), 0 0 0 2px #2a2a2a, inset 0 0 0 1px rgba(255,255,255,0.08)"
          : "0 50px 100px rgba(0,0,0,0.45), 0 0 0 2px #2a2a2a, inset 0 0 0 1px rgba(255,255,255,0.08)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#f7f8fa",
        transform: hovered ? "translateY(-6px) scale(1.01)" : "translateY(0) scale(1)",
        transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease",
        fontFamily: "system-ui, -apple-system, sans-serif",
        cursor: "default",
        flexShrink: 0,
      }}
    >
      <div style={{ position: "absolute", left: -3, top: 130, width: 3, height: 32, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 172, width: 3, height: 50, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 230, width: 3, height: 50, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", right: -3, top: 160, width: 3, height: 65, background: "#3a3a3a", borderRadius: "0 2px 2px 0" }} />

      <div style={{ background: "#1A2B4A", padding: "48px 20px 16px", flexShrink: 0 }}>
        <div style={{ width: 126, height: 34, background: "#111", borderRadius: 20, position: "absolute", left: "50%", transform: "translateX(-50%)", top: 0 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "white", letterSpacing: "-0.3px" }}>Wayfarer</span>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "white" }}>JD</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          {[
            { key: 'trips', label: 'Trips' },
            { key: 'coverage', label: 'Coverage' },
            { key: 'incidents', label: 'Incidents' },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} style={{
              padding: "6px 13px", fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
              background: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "transparent",
              border: `1px solid ${activeTab === tab.key ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: 20, color: activeTab === tab.key ? "white" : "rgba(255,255,255,0.6)",
              cursor: "pointer",
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px" }}>
        {activeTab === 'trips' && (
          <>
            {[
              { name: "Lisbon & Porto", dest: "Portugal", status: "Planning", statusColor: "#2E5FA3", statusBg: "#eff4fc", statusBorder: "#bfdbfe", dates: "Jun 12 – Jun 28", policies: 2, incidents: 0 },
              { name: "Japan Spring", dest: "Japan & South Korea", status: "Active", statusColor: "#16a34a", statusBg: "#f0fdf4", statusBorder: "#bbf7d0", dates: "Mar 20 – Apr 8", policies: 3, incidents: 1 },
              { name: "Patagonia Trek", dest: "Argentina & Chile", status: "Resolved", statusColor: "#666", statusBg: "#f5f5f5", statusBorder: "#e5e5e5", dates: "Jan 5 – Jan 22", policies: 1, incidents: 0 },
            ].map((trip, i) => (
              <div key={i} style={{
                background: "white", border: "0.5px solid #e8e8e8", borderRadius: 12,
                padding: "14px 16px", marginBottom: 10,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2B4A", margin: "0 0 2px" }}>{trip.name}</p>
                    <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{trip.dest}</p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: trip.statusColor,
                    background: trip.statusBg, border: `1px solid ${trip.statusBorder}`,
                    borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap",
                  }}>
                    {trip.status}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{trip.dates}</span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#ddd", display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "#aaa" }}>{trip.policies} {trip.policies === 1 ? "policy" : "policies"}</span>
                  {trip.incidents > 0 && (
                    <>
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#fbbf24", display: "inline-block" }} />
                      <span style={{ fontSize: 11, color: "#92400e" }}>{trip.incidents} incident</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'coverage' && (
          <>
            {[
              { name: "Allianz Travel Plan", type: "Travel insurance", clauses: 12, families: ["Medical", "Cancellation", "Baggage"] },
              { name: "Chase Sapphire Reserve", type: "Credit card benefits", clauses: 7, families: ["Delay", "Interruption", "Liability"] },
              { name: "Norwegian Air Policy", type: "Carrier policy", clauses: 5, families: ["Delay", "Baggage"] },
            ].map((pol, i) => (
              <div key={i} style={{ background: "white", border: "0.5px solid #e8e8e8", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2B4A", margin: "0 0 2px" }}>{pol.name}</p>
                <p style={{ fontSize: 11, color: "#888", margin: "0 0 10px" }}>{pol.type} · {pol.clauses} clauses extracted</p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {pol.families.map((f) => (
                    <span key={f} style={{ fontSize: 10, fontWeight: 600, color: "#2E5FA3", background: "#eff4fc", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 8px" }}>{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'incidents' && (
          <>
            {[
              { title: "Flight delayed 4h — Seoul to Tokyo", type: "Flight delay", status: "Claim Routing Ready", statusColor: "#16a34a", statusBg: "#f0fdf4", statusBorder: "#bbf7d0", evidence: 3 },
              { title: "Checked bag delayed 18h in Lisbon", type: "Baggage delay", status: "Evidence Gathering", statusColor: "#92400e", statusBg: "#fffbeb", statusBorder: "#fde68a", evidence: 2 },
            ].map((inc, i) => (
              <div key={i} style={{ background: "white", border: "0.5px solid #e8e8e8", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1A2B4A", margin: 0, lineHeight: 1.4, flex: 1, paddingRight: 8 }}>{inc.title}</p>
                  <span style={{ fontSize: 10, fontWeight: 600, color: inc.statusColor, background: inc.statusBg, border: `1px solid ${inc.statusBorder}`, borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap" }}>{inc.status}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{inc.type}</span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#ddd", display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "#2E5FA3" }}>{inc.evidence} evidence items</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 72, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)",
        borderTop: "1px solid #eaeaea",
        display: "flex", alignItems: "flex-start", justifyContent: "space-around", paddingTop: 10,
      }}>
        {[
          { icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z", label: "Trips", active: activeTab === 'trips', onClick: () => setActiveTab('trips') },
          { icon: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z", label: "Incidents", active: activeTab === 'incidents', onClick: () => setActiveTab('incidents') },
          { icon: "M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z", label: "Coverage", active: activeTab === 'coverage', onClick: () => setActiveTab('coverage') },
        ].map((tab, i) => (
          <button key={i} onClick={tab.onClick} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            background: "none", border: "none", cursor: "pointer",
            flex: 1, padding: "2px 0",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d={tab.icon} stroke={tab.active ? "#2E5FA3" : "#bbb"} strokeWidth="1.7" fill={tab.active ? "#eff4fc" : "none"} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: tab.active ? 600 : 400, color: tab.active ? "#2E5FA3" : "#bbb" }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCounter({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = useCountUp(value, 2000, started);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ textAlign: "center" }}>
      <div style={{ fontSize: 42, fontWeight: 800, color: "white", letterSpacing: "-1px", lineHeight: 1 }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{label}</div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "white" }}>
      <MarketingNav />

      <section style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0d1b2a 0%, #0f2518 50%, #0d1b2a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 24px 80px",
        gap: 64,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(46,95,163,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(22,163,74,0.1) 0%, transparent 50%)",
          pointerEvents: "none",
        }} />

        <div style={{ textAlign: "center", maxWidth: 680, position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20, padding: "6px 14px", marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 8px #4ade80" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>
              Travel protection, reimagined
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 800, color: "white", margin: "0 0 20px",
            letterSpacing: "-1.5px", lineHeight: 1.1,
          }}>
            Know exactly what
            <br />
            <span style={{ color: "rgba(255,255,255,0.45)" }}>covers you.</span>
          </h1>
          <p style={{
            fontSize: "clamp(16px, 2vw, 19px)",
            color: "rgba(255,255,255,0.5)",
            margin: "0 0 36px", lineHeight: 1.65, maxWidth: 540, marginLeft: "auto", marginRight: "auto",
          }}>
            Wayfarer reads your insurance policies, credit card benefits, and airline contracts — then routes your claims when something goes wrong.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={{
              padding: "14px 30px", background: "white", color: "#1A2B4A",
              borderRadius: 12, textDecoration: "none", fontSize: 16, fontWeight: 700,
              letterSpacing: "-0.2px",
              boxShadow: "0 4px 20px rgba(255,255,255,0.15)",
              display: "inline-block",
            }}>
              Get started free
            </Link>
            <Link href="/features" style={{
              padding: "14px 30px",
              background: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12, textDecoration: "none", fontSize: 16, fontWeight: 600,
              display: "inline-block",
            }}>
              See how it works
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {mounted && <InteractivePhone />}
        </div>
      </section>

      <section style={{ background: "#0d1b2a", padding: "64px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 40,
          }}>
            {mounted && <StatCounter value={47000} suffix="+" label="Trips tracked" />}
            {mounted && <StatCounter value={12000} suffix="+" label="Incidents documented" />}
            {mounted && <StatCounter value={3800} suffix="+" label="Claims routed" />}
            {mounted && <StatCounter value={40} suffix="+" label="Countries covered" />}
          </div>
        </div>
      </section>

      <section style={{ padding: "96px 24px", background: "white" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#2E5FA3", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>
              Built for real travelers
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "#0d1b2a", margin: "0 0 16px", letterSpacing: "-0.8px" }}>
              Everything you need when things go wrong
            </h2>
            <p style={{ fontSize: 17, color: "#666", maxWidth: 540, margin: "0 auto", lineHeight: 1.65 }}>
              Most travelers discover their coverage gaps after the fact. Wayfarer makes sure you know before.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
          }}>
            {[
              {
                icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                iconColor: "#2E5FA3", iconBg: "#eff4fc", iconBorder: "#bfdbfe",
                title: "Trip management",
                desc: "Track all your trips in one place. Add destinations, dates, travelers, and travel mode. Know what's covered before you depart.",
                bullets: ["Multi-leg itinerary builder", "Visa requirement advisories", "Departure countdown"],
              },
              {
                icon: "M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z",
                iconColor: "#16a34a", iconBg: "#f0fdf4", iconBorder: "#bbf7d0",
                title: "Policy intelligence",
                desc: "Upload any policy document — insurance, credit card guide, airline contract — and get a plain-English breakdown of what's covered.",
                bullets: ["AI-powered clause extraction", "Coverage gap analysis", "Clause-level confidence scoring"],
              },
              {
                icon: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
                iconColor: "#92400e", iconBg: "#fffbeb", iconBorder: "#fde68a",
                title: "Incident tracking",
                desc: "Something went wrong? Start an incident immediately. Document what happened, when, and what the carrier told you — while the details are fresh.",
                bullets: ["Structured evidence capture", "Narration recording", "Timeline auto-generation"],
              },
              {
                icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z",
                iconColor: "#b45309", iconBg: "#fffbeb", iconBorder: "#fde68a",
                title: "Claim routing engine",
                desc: "Know exactly which policy covers your incident and where to send it. Wayfarer identifies all applicable coverage sources and assembles your evidence packet.",
                bullets: ["Multi-policy matching", "EU261 eligibility check", "Evidence packet assembly"],
              },
              {
                icon: "M9 11l3 3L22 4",
                iconColor: "#0369a1", iconBg: "#f0f9ff", iconBorder: "#bae6fd",
                title: "Claims record",
                desc: "Every claim you route is recorded with a full audit trail — status, amounts, recipients, and correspondence. Never lose track of where a claim stands.",
                bullets: ["Routing history", "Dispute tracking", "Status progression"],
              },
              {
                icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
                iconColor: "#4a7c59", iconBg: "#f0fdf4", iconBorder: "#bbf7d0",
                title: "Trust & security",
                desc: "Your travel records contain sensitive data. We protect it with row-level security, immutable audit logs, and jurisdiction-aware retention policies.",
                bullets: ["SOC 2 in progress", "GDPR-ready", "Zero cross-account access"],
              },
            ].map((feature, i) => (
              <div key={i} style={{
                background: "white", border: "1px solid #f0f0f0", borderRadius: 16,
                padding: "28px 28px",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
                className="feature-card"
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: feature.iconBg, border: `1px solid ${feature.iconBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 18,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d={feature.icon} stroke={feature.iconColor} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0d1b2a", margin: "0 0 10px", letterSpacing: "-0.2px" }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px", lineHeight: 1.65 }}>
                  {feature.desc}
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {feature.bullets.map((b) => (
                    <li key={b} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="1.5"/>
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "96px 24px", background: "#f7f8fa" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "#0d1b2a", margin: "0 0 16px", letterSpacing: "-0.6px" }}>
              How it works
            </h2>
            <p style={{ fontSize: 17, color: "#666", maxWidth: 480, margin: "0 auto", lineHeight: 1.65 }}>
              From planning to claim, Wayfarer guides you through every step.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
            <div style={{
              position: "absolute", left: 27, top: 54, bottom: 54,
              width: 2, background: "linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)",
              borderRadius: 2,
            }} />
            {[
              {
                step: "1", title: "Add your trip",
                desc: "Create a trip record with your destination, dates, and travel mode. Wayfarer generates visa advisories and a pre-trip checklist automatically.",
                color: "#2E5FA3", bg: "#eff4fc", border: "#bfdbfe",
              },
              {
                step: "2", title: "Upload your coverage documents",
                desc: "Drop in your travel insurance, credit card benefit guide, airline T&Cs, or any other policy. Our extraction engine reads it and maps every clause to a coverage category.",
                color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0",
              },
              {
                step: "3", title: "Track incidents as they happen",
                desc: "Something goes wrong mid-trip? Start an incident immediately. Add narration, upload receipts and carrier notices, and build your evidence file in real time.",
                color: "#92400e", bg: "#fffbeb", border: "#fde68a",
              },
              {
                step: "4", title: "Route your claim",
                desc: "When your incident is fully documented, the claim routing engine matches it against your policies and tells you exactly what to submit to each insurer, card, and carrier that applies — you take it from there.",
                color: "#b45309", bg: "#fff7ed", border: "#fed7aa",
              },
            ].map((step, i, arr) => (
              <div key={i} style={{ display: "flex", gap: 24, alignItems: "flex-start", paddingBottom: i < arr.length - 1 ? 40 : 0 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                  background: step.bg, border: `2px solid ${step.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1,
                }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: step.color }}>{step.step}</span>
                </div>
                <div style={{ paddingTop: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0d1b2a", margin: "0 0 8px", letterSpacing: "-0.2px" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 15, color: "#666", margin: 0, lineHeight: 1.65 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "96px 24px", background: "white" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "#0d1b2a", margin: "0 0 16px", letterSpacing: "-0.6px" }}>
              Trusted by frequent travelers
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {[
              { name: "Marcus W.", initials: "MW", role: "Digital nomad", quote: "I had no idea my Chase Sapphire covered baggage delay until Wayfarer extracted it. Filed my first claim in under 20 minutes." },
              { name: "Priya S.", initials: "PS", role: "Business traveler", quote: "My company trips across Asia involve 3–4 carriers and two insurance policies. Wayfarer keeps everything organized and tells me exactly what to file when something goes sideways." },
              { name: "James & Elena K.", initials: "JE", role: "Family travelers", quote: "We used to lose track of which policy covered what. Now we upload everything before we leave and have peace of mind the whole trip." },
            ].map((t, i) => (
              <div key={i} style={{
                background: "#f7f8fa", border: "1px solid #f0f0f0", borderRadius: 16, padding: "28px",
              }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <p style={{ fontSize: 15, color: "#333", margin: "0 0 20px", lineHeight: 1.7, fontStyle: "italic" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "linear-gradient(135deg, #2E5FA3 0%, #1A2B4A 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "white",
                  }}>
                    {t.initials}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1A2B4A", margin: 0 }}>{t.name}</p>
                    <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 24px", background: "#f7f8fa", borderTop: "1px solid #eaeaea" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="teams-grid">
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#fff7ed", border: "1px solid #fed7aa",
                borderRadius: 20, padding: "5px 14px", marginBottom: 20,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#b45309", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  For teams
                </span>
              </div>
              <h2 style={{ fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 800, color: "#0d1b2a", margin: "0 0 16px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
                Travel protection for your entire organization.
              </h2>
              <p style={{ fontSize: 16, color: "#666", margin: "0 0 32px", lineHeight: 1.7 }}>
                Managing employee travel means managing risk. Wayfarer gives your team a single place to document coverage, track incidents, and route claims — with central visibility for your travel or HR team.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
                {[
                  { icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", label: "Multi-user access with role permissions" },
                  { icon: "M9 17H7A5 5 0 017 7h2M15 7h2a5 5 0 015 5 5 5 0 01-5 5h-2", label: "Central billing and invoicing" },
                  { icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", label: "Custom data retention and jurisdiction settings" },
                  { icon: "M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z", label: "Dedicated account manager and onboarding" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "#fff7ed", border: "1px solid #fed7aa",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d={item.icon} stroke="#b45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 14, color: "#444", lineHeight: 1.6, paddingTop: 6 }}>{item.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="mailto:hello@wayfarer.travel?subject=Corporate%20inquiry" style={{
                  padding: "12px 24px", background: "#1A2B4A", color: "white",
                  borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 700,
                  display: "inline-block",
                }}>
                  Contact us
                </a>
                <Link href="/pricing" style={{
                  padding: "12px 20px", background: "white", color: "#1A2B4A",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600,
                  display: "inline-block",
                }}>
                  See all plans
                </Link>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{
                background: "white", border: "1px solid #e8e8e8", borderRadius: 20,
                padding: "32px 28px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
                width: "100%", maxWidth: 360,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#b45309" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="9" cy="7" r="4" stroke="#b45309" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#b45309" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2B4A", margin: 0 }}>Corporate</p>
                    <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Custom pricing · Per seat</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                  {[
                    { user: "AK", name: "Akira K.", trip: "Tokyo → NYC", status: "Active", color: "#16a34a" },
                    { user: "SR", name: "Sara R.", trip: "London → Berlin", status: "Planning", color: "#2E5FA3" },
                    { user: "MO", name: "Marcus O.", trip: "Dubai → Nairobi", status: "Incident", color: "#c2410c" },
                  ].map((member, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f7f8fa", borderRadius: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "linear-gradient(135deg, #2E5FA3 0%, #1A2B4A 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0,
                      }}>
                        {member.user}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1A2B4A", margin: 0 }}>{member.name}</p>
                        <p style={{ fontSize: 11, color: "#888", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.trip}</p>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: member.color,
                        background: member.color === "#c2410c" ? "#fff7ed" : member.color === "#16a34a" ? "#f0fdf4" : "#eff4fc",
                        border: `1px solid ${member.color === "#c2410c" ? "#fed7aa" : member.color === "#16a34a" ? "#bbf7d0" : "#bfdbfe"}`,
                        borderRadius: 20, padding: "3px 8px", whiteSpace: "nowrap",
                      }}>
                        {member.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: 12, color: "#888", margin: "0 0 2px" }}>Team incidents this month</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#1A2B4A", margin: 0, letterSpacing: "-0.5px" }}>3 <span style={{ fontSize: 12, fontWeight: 500, color: "#16a34a" }}>1 routed</span></p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 12, color: "#888", margin: "0 0 2px" }}>Policies on file</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: "#1A2B4A", margin: 0, letterSpacing: "-0.5px" }}>9</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "80px 24px", background: "#0d1b2a" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "white", margin: "0 0 16px", letterSpacing: "-0.8px" }}>
            Ready to protect your next trip?
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.5)", margin: "0 0 36px", lineHeight: 1.65 }}>
            Free to start. No credit card required. Know your coverage in minutes.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={{
              padding: "14px 32px", background: "white", color: "#1A2B4A",
              borderRadius: 12, textDecoration: "none", fontSize: 16, fontWeight: 700,
              display: "inline-block",
            }}>
              Get started free
            </Link>
            <Link href="/pricing" style={{
              padding: "14px 24px",
              background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12, textDecoration: "none", fontSize: 16, fontWeight: 600,
              display: "inline-block",
            }}>
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />

      <style>{`
        .feature-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.07);
          transform: translateY(-2px);
        }
        @media (max-width: 768px) {
          .teams-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </div>
  );
}
