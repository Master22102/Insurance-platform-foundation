"use client";

export function StatusBar() {
  return (
    <div style={{
      height: 50, background: "#f5f5f7",
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      padding: "0 28px 10px", flexShrink: 0, position: "relative", zIndex: 10,
    }}>
      <div style={{
        width: 126, height: 34, background: "#1a1a1a", borderRadius: 20,
        position: "absolute", left: "50%", transform: "translateX(-50%)", top: 0,
      }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "#111", zIndex: 1 }}>9:41</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center", zIndex: 1 }}>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <rect x="0" y="3" width="3" height="9" rx="1" fill="#111"/>
          <rect x="4.5" y="2" width="3" height="10" rx="1" fill="#111"/>
          <rect x="9" y="0" width="3" height="12" rx="1" fill="#111"/>
          <rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="#111" opacity="0.3"/>
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path d="M7.5 2C9.6 2 11.4 2.9 12.7 4.3L13.9 3C12.2 1.2 9.9 0 7.5 0C5.1 0 2.8 1.2 1.1 3L2.3 4.3C3.6 2.9 5.4 2 7.5 2Z" fill="#111"/>
          <path d="M7.5 5C8.8 5 10 5.5 10.8 6.4L12 5.1C10.8 3.9 9.2 3.1 7.5 3.1C5.8 3.1 4.2 3.9 3 5.1L4.2 6.4C5 5.5 6.2 5 7.5 5Z" fill="#111"/>
          <circle cx="7.5" cy="9.5" r="1.5" fill="#111"/>
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="#111" strokeOpacity="0.35"/>
          <rect x="2" y="2" width="16" height="8" rx="2" fill="#111"/>
          <path d="M23 4v4a2 2 0 000-4z" fill="#111" fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

export function HomeIndicator() {
  return (
    <div style={{ height: 28, background: "rgba(245,245,247,0.92)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: 134, height: 5, background: "#111", borderRadius: 3, opacity: 0.15 }} />
    </div>
  );
}

const TAB_DEFS = [
  { label: "Trips", icon: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={c} stroke={c} strokeWidth="0.5"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  )},
  { label: "Segments", icon: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="18" r="2.5" stroke={c} strokeWidth="1.7"/>
      <circle cx="18" cy="6" r="2.5" stroke={c} strokeWidth="1.7"/>
      <path d="M6 15.5V9a3 3 0 013-3h6" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )},
  { label: "Incidents", icon: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M12 9v4M12 17h.01" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )},
  { label: "Coverage", icon: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 4v5c0 5-4 9-8 10-4-1-8-5-8-10V7l8-4z" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 12l2 2 4-4" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { label: "Account", icon: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.7"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )},
];

export function BottomTabBar({ activeTab, onTabChange }) {
  return (
    <div style={{
      position: "absolute", bottom: 28, left: 0, right: 0, height: 54,
      background: "rgba(245,245,247,0.97)", backdropFilter: "blur(16px)",
      borderTop: "0.5px solid rgba(0,0,0,0.1)",
      display: "flex", alignItems: "flex-start", justifyContent: "space-around",
      paddingTop: 8, zIndex: 50,
    }}>
      {TAB_DEFS.map((tab) => {
        const isActive = tab.label === activeTab;
        const color = isActive ? "#1d4ed8" : "#aaa";
        return (
          <button
            key={tab.label}
            onClick={() => onTabChange && onTabChange(tab.label)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: "none", border: "none", cursor: "pointer", minWidth: 0, padding: "0 2px",
            }}
          >
            {tab.icon(color)}
            <span style={{ fontSize: 8, fontWeight: isActive ? 700 : 400, color, letterSpacing: "-0.01em" }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
