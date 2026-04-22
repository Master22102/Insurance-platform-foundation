"use client";

import { ReactNode } from "react";

type Platform = "ios" | "android";

export function DeviceFrame({
  platform,
  children,
  label,
}: {
  platform: Platform;
  children: ReactNode;
  label?: string;
}) {
  const isIOS = platform === "ios";
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative overflow-hidden shadow-2xl"
        style={{
          width: isIOS ? 390 : 412,
          height: isIOS ? 844 : 915,
          borderRadius: isIOS ? 56 : 42,
          background: "#0b0b0c",
          padding: isIOS ? 12 : 10,
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: isIOS ? 46 : 32,
            background: "#f5f5f7",
          }}
        >
          {isIOS ? <IOSNotch /> : <AndroidPunchHole />}
          <div className="absolute inset-0 overflow-hidden">{children}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-neutral-500">
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: isIOS ? "#0ea5e9" : "#10b981" }} />
        {platform === "ios" ? "iOS · iPhone 15" : "Android · Pixel 8"}
        {label && <span className="text-neutral-400">&middot; {label}</span>}
      </div>
    </div>
  );
}

function IOSNotch() {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 top-2 pointer-events-none"
      style={{ width: 126, height: 34, background: "#0b0b0c", borderRadius: 20, zIndex: 30 }}
    />
  );
}

function AndroidPunchHole() {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ top: 14, left: "50%", transform: "translateX(-50%)", width: 14, height: 14, background: "#0b0b0c", borderRadius: "50%", zIndex: 30 }}
    />
  );
}
