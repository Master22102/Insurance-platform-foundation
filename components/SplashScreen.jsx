"use client";

import { useEffect } from "react";

export default function SplashScreen({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2200);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(160deg, #0f2440 0%, #1e3a5f 60%, #2E5FA3 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 8,
      }}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 6v6c0 5 3.6 9.7 8 11 4.4-1.3 8-6 8-11V6L12 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <p style={{ fontSize: 28, fontWeight: 800, color: "white", margin: 0, letterSpacing: "-0.5px" }}>Wayfarer</p>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", margin: 0 }}>Travel protection intelligence</p>
      <div style={{
        position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)",
        width: 48, height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", background: "white", borderRadius: 2,
          animation: "splashLoad 1.8s ease-out forwards",
        }} />
      </div>
      <style>{`@keyframes splashLoad { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
