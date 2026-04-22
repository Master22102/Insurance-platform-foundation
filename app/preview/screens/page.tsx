"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DeviceFrame } from "@/components/mobile/DeviceFrame";
import PassportRestrictionAlert from "@/components/mobile/screens/PassportRestrictionAlert";
import OnboardingCompass from "@/components/mobile/screens/OnboardingCompass";
import ContextualIntelligenceNow from "@/components/mobile/screens/ContextualIntelligenceNow";
import TripPresenceModeAlert from "@/components/mobile/screens/TripPresenceModeAlert";
import GovernanceTrustPanel from "@/components/mobile/screens/GovernanceTrustPanel";
import SafetyCardScreen from "@/components/mobile/screens/SafetyCardScreen";
import TravelShieldPanel from "@/components/mobile/screens/TravelShieldPanel";

const TripsScreen = dynamic(() => import("@/components/screens/TripsScreen"), { ssr: false }) as any;
const RoutesScreen = dynamic(() => import("@/components/screens/RoutesScreen"), { ssr: false }) as any;
const EventsScreen = dynamic(() => import("@/components/screens/EventsScreen"), { ssr: false }) as any;
const TripOverviewScreen = dynamic(() => import("@/components/screens/TripOverviewScreen"), { ssr: false }) as any;
const IncidentWorkspaceScreen = dynamic(() => import("@/components/screens/IncidentWorkspaceScreen"), { ssr: false }) as any;
const ClaimBuilderScreen = dynamic(() => import("@/components/screens/ClaimBuilderScreen"), { ssr: false }) as any;
const AccountScreen = dynamic(() => import("@/components/AccountScreen"), { ssr: false }) as any;
const LockScreen = dynamic(() => import("@/components/LockScreen"), { ssr: false }) as any;
const EmergencySystem = dynamic(() => import("@/components/EmergencySystem"), { ssr: false }) as any;

type Status = "ready" | "needs-work" | "net-new";
type Surface = "mobile" | "web" | "shared";

type Entry = {
  id: string;
  name: string;
  category: string;
  surface: Surface;
  status: Status;
  source: string;
  route: string;
  tables: string[];
  doctrine: string[];
  render: () => JSX.Element;
};

const ENTRIES: Entry[] = [
  {
    id: "onboarding-compass",
    name: "Onboarding Compass",
    category: "Onboarding",
    surface: "mobile",
    status: "net-new",
    source: "new",
    route: "/onboarding",
    tables: ["onboarding_progress"],
    doctrine: ["F-6.5.2"],
    render: () => <OnboardingCompass />,
  },
  {
    id: "passport-restrictions",
    name: "Passport Restriction Alerts",
    category: "Pre-trip safety",
    surface: "mobile",
    status: "net-new",
    source: "new",
    route: "/trips/[id]/passport",
    tables: ["passport_restrictions", "trips"],
    doctrine: ["F-6.5.13", "\u00A73.6"],
    render: () => <PassportRestrictionAlert />,
  },
  {
    id: "contextual-now",
    name: "Contextual Intelligence \u2014 Now",
    category: "In-trip",
    surface: "mobile",
    status: "net-new",
    source: "new",
    route: "/trips/[id]/now",
    tables: ["contextual_signals"],
    doctrine: ["F-6.7.2", "F-6.7.3"],
    render: () => <ContextualIntelligenceNow />,
  },
  {
    id: "presence-alerts",
    name: "Trip Presence Mode Alerts",
    category: "In-trip",
    surface: "mobile",
    status: "net-new",
    source: "new",
    route: "/trips/[id]/presence",
    tables: ["presence_mode_settings", "trip_presence_events"],
    doctrine: ["F-6.5.8"],
    render: () => <TripPresenceModeAlert />,
  },
  {
    id: "travelshield-group",
    name: "TravelShield \u2014 Group",
    category: "In-trip",
    surface: "mobile",
    status: "ready",
    source: "html",
    route: "/trips/[id]#travelshield",
    tables: ["presence_mode_settings"],
    doctrine: ["F-6.5.8"],
    render: () => <TravelShieldPanel variant="group" />,
  },
  {
    id: "travelshield-solo",
    name: "TravelShield \u2014 Solo",
    category: "In-trip",
    surface: "mobile",
    status: "ready",
    source: "html",
    route: "/trips/[id]#travelshield",
    tables: ["presence_mode_settings"],
    doctrine: ["F-6.5.8"],
    render: () => <TravelShieldPanel variant="solo" />,
  },
  {
    id: "safety-card",
    name: "Safety Card + QR",
    category: "In-trip",
    surface: "mobile",
    status: "ready",
    source: "html",
    route: "/safety/[token]",
    tables: ["safety_cards"],
    doctrine: ["F-6.5.13"],
    render: () => <SafetyCardScreen />,
  },
  {
    id: "trust-panel",
    name: "Governance Trust Panel",
    category: "Account",
    surface: "mobile",
    status: "net-new",
    source: "new",
    route: "/account/trust-safety",
    tables: ["governance_posture_snapshots"],
    doctrine: ["\u00A73.0", "\u00A78.4", "\u00A78.9"],
    render: () => <GovernanceTrustPanel />,
  },
  {
    id: "trips-list",
    name: "Trips (Tab 1)",
    category: "Core navigation",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/trips",
    tables: ["trips"],
    doctrine: ["F-6.5.2"],
    render: () => <div className="w-full h-full"><TripsScreen /></div>,
  },
  {
    id: "trip-overview",
    name: "Trip Overview",
    category: "Core navigation",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/trips/[id]",
    tables: ["trips", "incidents"],
    doctrine: ["F-6.5.2"],
    render: () => <div className="w-full h-full"><TripOverviewScreen /></div>,
  },
  {
    id: "routes",
    name: "Segments (Tab 2)",
    category: "Core navigation",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/routes",
    tables: ["trips"],
    doctrine: ["F-6.5.2"],
    render: () => <div className="w-full h-full"><RoutesScreen /></div>,
  },
  {
    id: "incidents",
    name: "Incidents (Tab 3)",
    category: "Core navigation",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/incidents",
    tables: ["incidents"],
    doctrine: ["\u00A73.6"],
    render: () => <div className="w-full h-full"><EventsScreen /></div>,
  },
  {
    id: "incident-workspace",
    name: "Incident Workspace",
    category: "Claims",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/incidents/[id]",
    tables: ["incidents", "evidence"],
    doctrine: ["F-6.5.16"],
    render: () => <div className="w-full h-full"><IncidentWorkspaceScreen /></div>,
  },
  {
    id: "claim-builder",
    name: "Claim Builder",
    category: "Claims",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/claims/[id]/build",
    tables: ["claims"],
    doctrine: ["F-6.5.16"],
    render: () => <div className="w-full h-full"><ClaimBuilderScreen /></div>,
  },
  {
    id: "account",
    name: "Account (Tab 5)",
    category: "Account",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/account",
    tables: ["profiles"],
    doctrine: ["\u00A78.4"],
    render: () => <div className="w-full h-full"><AccountScreen /></div>,
  },
  {
    id: "lock",
    name: "Lock Screen",
    category: "Shell",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/lock",
    tables: [],
    doctrine: [],
    render: () => <div className="w-full h-full"><LockScreen /></div>,
  },
  {
    id: "emergency",
    name: "Emergency / SOS",
    category: "Safety",
    surface: "mobile",
    status: "ready",
    source: "zip",
    route: "/sos",
    tables: [],
    doctrine: ["F-6.5.8"],
    render: () => <div className="w-full h-full"><EmergencySystem /></div>,
  },
];

const CATEGORIES = [
  "All",
  "Onboarding",
  "Pre-trip safety",
  "In-trip",
  "Core navigation",
  "Claims",
  "Account",
  "Safety",
  "Shell",
];

export default function PreviewScreensPage() {
  const [category, setCategory] = useState("All");
  const [surface, setSurface] = useState<Surface | "all">("all");
  const [activeId, setActiveId] = useState<string>(ENTRIES[0].id);

  const visible = useMemo(() => {
    return ENTRIES.filter((e) => (category === "All" || e.category === category) && (surface === "all" || e.surface === surface));
  }, [category, surface]);

  const active = ENTRIES.find((e) => e.id === activeId) ?? ENTRIES[0];

  return (
    <div className="min-h-screen" style={{ background: "#eef0f3" }}>
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Design preview</div>
            <div className="text-base font-semibold text-neutral-900">Wayfarer mobile &mdash; all screens</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-100 rounded-md p-1">
              {(["all", "mobile", "web", "shared"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSurface(s)}
                  className={`text-[11px] px-3 py-1.5 rounded capitalize transition ${
                    surface === s ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <a href="/preview" className="text-[11px] text-neutral-500 hover:text-neutral-900 underline-offset-2 hover:underline">
              FOCL preview &rarr;
            </a>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto px-6 pb-3 flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition ${
                category === c
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-400 px-1">
            {visible.length} screens
          </div>
          <div className="space-y-1.5">
            {visible.map((e) => (
              <button
                key={e.id}
                onClick={() => setActiveId(e.id)}
                className={`w-full text-left rounded-lg p-3 border transition ${
                  activeId === e.id ? "bg-white border-neutral-900 shadow-sm" : "bg-white/60 border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-neutral-900 truncate">{e.name}</span>
                  <StatusPill status={e.status} />
                </div>
                <div className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1.5">
                  <SurfacePill surface={e.surface} />
                  <span className="text-neutral-300">&middot;</span>
                  <span>{e.category}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-9 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-neutral-900">{active.name}</h2>
                  <StatusPill status={active.status} />
                  <SurfacePill surface={active.surface} />
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Source: <span className="font-mono">{active.source}</span> &middot; Route: <span className="font-mono">{active.route}</span>
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {active.tables.map((t) => (
                    <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      {t}
                    </span>
                  ))}
                  {active.doctrine.map((d) => (
                    <span key={d} className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-8">
            <div className="flex items-start justify-center gap-10 flex-wrap">
              <DeviceFrame platform="ios" label={active.name}>{active.render()}</DeviceFrame>
              <DeviceFrame platform="android" label={active.name}>{active.render()}</DeviceFrame>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; bg: string; color: string; border: string }> = {
    ready: { label: "Ready", bg: "#ecfdf5", color: "#059669", border: "#bbf7d0" },
    "needs-work": { label: "Needs work", bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    "net-new": { label: "Net-new", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  };
  const m = map[status];
  return (
    <span
      className="text-[9px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ background: m.bg, color: m.color, borderColor: m.border }}
    >
      {m.label}
    </span>
  );
}

function SurfacePill({ surface }: { surface: Surface }) {
  const map: Record<Surface, { label: string; bg: string; color: string }> = {
    mobile: { label: "Mobile", bg: "#f1f5f9", color: "#0f172a" },
    web: { label: "Web", bg: "#fef3c7", color: "#92400e" },
    shared: { label: "Shared", bg: "#e0e7ff", color: "#3730a3" },
  };
  const m = map[surface];
  return (
    <span
      className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
      style={{ background: m.bg, color: m.color }}
    >
      {m.label}
    </span>
  );
}
