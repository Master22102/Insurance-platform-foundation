"use client";

import { useState } from "react";

export default function ClaimBuilderScreen({ incident, coverage, onBack }) {
  const [step, setStep] = useState("review");
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [packetOpen, setPacketOpen] = useState(false);

  const incData = incident || {
    title: "Flight Delay",
    flightNum: "AC780",
    route: "Toronto → Boston",
    date: "Oct 9, 2025",
    delayLength: "2 hours 40 minutes",
    expenses: "$47.50 (meal at airport)",
    evidence: ["BoardingPass_AC780.pdf", "Gate_Delay_Notice.jpg"],
  };

  const covData = coverage || {
    label: "Credit card trip delay",
    payout: "$500",
    type: "card",
  };

  const claimSummary = `Incident: ${incData.title}
Flight: ${incData.flightNum} — ${incData.route}
Date: ${incData.date}
Delay: ${incData.delayLength}
Out-of-pocket: ${incData.expenses}
Coverage type: ${covData.label}
Coverage limit: ${covData.payout}
Evidence: ${(incData.evidence || []).join(", ")}`;

  function handleGenerate() {
    setStep("generating");
    setTimeout(() => setStep("done"), 1800);
  }

  function handleCopySummary() {
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f5f7", position: "relative" }}>
      <div style={{ padding: "8px 16px 12px", flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", padding: "0 0 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6l5 5" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>Incident Workspace</span>
        </button>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Build Claim</p>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{covData.label}</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px" }}>
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Claim details</p>
          {[
            { label: "Incident type", value: incData.title },
            { label: "Flight number", value: incData.flightNum },
            { label: "Route", value: incData.route },
            { label: "Date", value: incData.date },
            { label: "Delay length", value: incData.delayLength },
            { label: "Expenses", value: incData.expenses },
            { label: "Coverage type", value: covData.label },
            { label: "Coverage limit", value: covData.payout },
          ].map((field) => (
            <div key={field.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f5f5f5" }}>
              <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{field.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#111", textAlign: "right", maxWidth: "55%" }}>{field.value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Evidence files</span>
            <div style={{ textAlign: "right" }}>
              {(incData.evidence || []).map((f) => (
                <p key={f} style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8", margin: "0 0 2px" }}>{f}</p>
              ))}
            </div>
          </div>
        </div>

        {step === "review" && (
          <button
            onClick={handleGenerate}
            style={{
              width: "100%", padding: "14px 0",
              background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
              border: "none", borderRadius: 14,
              fontSize: 14, fontWeight: 600, color: "white", cursor: "pointer",
              boxShadow: "0 4px 16px rgba(30,58,95,0.3)",
            }}
          >
            Generate claim packet
          </button>
        )}

        {step === "generating" && (
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "24px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #1e3a5f", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: "0 0 4px" }}>Preparing your claim packet...</p>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Compiling evidence and organizing documentation</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {step === "done" && (
          <>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 13px", marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="9" stroke="#059669" strokeWidth="1.6"/>
                <path d="M9 12l2 2 4-4" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#059669", margin: 0 }}>
                Claim packet ready
              </p>
            </div>

            {/* Structured claim packet sections */}
            <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 12px" }}>Coverage reference</p>
              {[
                { label: "Coverage type", value: covData.label },
                { label: "Coverage limit", value: covData.payout },
                { label: "Incident category", value: incData.title },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 10px" }}>Documentation checklist</p>
              {[
                { label: "Boarding pass", done: true },
                { label: "Delay notification or gate notice", done: true },
                { label: "Receipts for out-of-pocket expenses", done: false },
                { label: "Airline denial or compensation letter (if issued)", done: false },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                    background: item.done ? "#f0fdf4" : "#f9fafb",
                    border: `1.5px solid ${item.done ? "#22c55e" : "#d1d5db"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {item.done && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4l2 2 3-3" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "#333" }}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 10px" }}>Timeline of events</p>
              {[
                { time: incData.date, label: "Flight delayed — " + incData.delayLength },
                { time: incData.date, label: "Out-of-pocket expenses incurred: " + incData.expenses },
                { time: "Evidence collected", label: (incData.evidence || []).join(", ") },
              ].map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < 2 ? 10 : 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 10, flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1e3a5f", marginTop: 3 }} />
                    {i < 2 && <div style={{ width: 1.5, flex: 1, background: "#e5e7eb", minHeight: 14, margin: "3px 0" }} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "2px 0 2px" }}>{ev.time}</p>
                    <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.4 }}>{ev.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "white", borderRadius: 14, border: "1px solid #f0f0f0", padding: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Sequencing notes</p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
                File with the coverage source that requires the least documentation first. Retain all receipts and evidence regardless of which claim is filed first, as secondary claims may require the full record.
              </p>
            </div>

            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
                This packet is a decision-support tool only. It does not constitute a claim submission, legal advice, or guarantee of coverage or reimbursement.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={handleCopySummary}
                style={{
                  width: "100%", padding: "13px 0",
                  background: copiedSummary ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                  border: "none", borderRadius: 13,
                  fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                {copiedSummary ? "Copied to clipboard" : "Copy claim summary"}
              </button>
              <button
                onClick={() => setPacketOpen(true)}
                style={{
                  width: "100%", padding: "13px 0",
                  background: "none", border: "1.5px solid #e5e7eb",
                  borderRadius: 13, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
                }}
              >
                View packet
              </button>
            </div>
          </>
        )}
      </div>

      {packetOpen && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={() => setPacketOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: "22px 22px 0 0", width: "100%", maxHeight: "85%", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }}
          >
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
            </div>
            <div style={{ padding: "12px 18px 0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: 0 }}>Full claim packet</p>
              <button onClick={() => setPacketOpen(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 28px" }}>
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 14px" }}>
                <pre style={{ fontSize: 11, color: "#374151", margin: 0, whiteSpace: "pre-wrap", fontFamily: "system-ui, sans-serif", lineHeight: 1.7 }}>
                  {claimSummary}
                </pre>
              </div>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "14px 0 0", lineHeight: 1.6 }}>
                This packet is a decision-support tool only. It does not constitute a claim submission, legal advice, or guarantee of coverage or reimbursement.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
