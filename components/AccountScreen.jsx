"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BottomTabBar as SharedBottomTabBar } from "./screens/SharedShell";

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
const MOCK_USER = {
  displayName: "James Donovan",
  email: "james@tripguard.io",
  initials: "JD",
  memberSince: "Jan 2025",
  tier: "PREMIUM",
  mfaEnabled: true,
  homeCountry: "United States",
  nationality: "American",
  tripCount: 8,
  isGroupLeader: true,
  activeGroups: 2,
};

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
  "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
  "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
  "Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt",
  "El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon",
  "Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
  "Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
  "Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos",
  "Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi",
  "Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova",
  "Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands",
  "New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau",
  "Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania",
  "Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent","Samoa","San Marino","Sao Tome","Saudi Arabia","Senegal",
  "Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea",
  "South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan",
  "Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu",
  "Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela",
  "Vietnam","Yemen","Zambia","Zimbabwe"
];

const NATIONALITIES = [
  "Afghan","Albanian","Algerian","American","Andorran","Angolan","Antiguan","Argentine","Armenian","Australian",
  "Austrian","Azerbaijani","Bahamian","Bahraini","Bangladeshi","Barbadian","Belarusian","Belgian","Belizean","Beninese",
  "Bhutanese","Bolivian","Bosnian","Botswanan","Brazilian","British","Bruneian","Bulgarian","Burkinabe","Burundian",
  "Cambodian","Cameroonian","Canadian","Cape Verdean","Central African","Chadian","Chilean","Chinese","Colombian","Comorian",
  "Congolese","Costa Rican","Croatian","Cuban","Cypriot","Czech","Danish","Djiboutian","Dominican","Ecuadorian",
  "Egyptian","Emirati","Eritrean","Estonian","Ethiopian","Fijian","Finnish","French","Gabonese","Gambian",
  "Georgian","German","Ghanaian","Greek","Grenadian","Guatemalan","Guinean","Guyanese","Haitian","Honduran",
  "Hungarian","Icelander","Indian","Indonesian","Iranian","Iraqi","Irish","Israeli","Italian","Jamaican",
  "Japanese","Jordanian","Kazakhstani","Kenyan","Kiribati","Kuwaiti","Kyrgyz","Laotian","Latvian","Lebanese",
  "Liberian","Libyan","Lithuanian","Luxembourgish","Malagasy","Malawian","Malaysian","Maldivian","Malian","Maltese",
  "Mauritanian","Mauritian","Mexican","Moldovan","Mongolian","Montenegrin","Moroccan","Mozambican","Myanmar","Namibian",
  "Nepali","New Zealander","Nicaraguan","Nigerian","Norwegian","Omani","Pakistani","Panamanian","Papua New Guinean","Paraguayan",
  "Peruvian","Filipino","Polish","Portuguese","Qatari","Romanian","Russian","Rwandan","Salvadoran","Saudi",
  "Senegalese","Serbian","Seychellois","Sierra Leonean","Singaporean","Slovak","Slovenian","Somali","South African","South Korean",
  "Spanish","Sri Lankan","Sudanese","Surinamese","Swedish","Swiss","Syrian","Taiwanese","Tajik","Tanzanian",
  "Thai","Timorese","Togolese","Tongan","Trinidadian","Tunisian","Turkish","Turkmen","Ugandan","Ukrainian",
  "Uruguayan","Uzbek","Venezuelan","Vietnamese","Yemeni","Zambian","Zimbabwean"
];

const LANGUAGES = [
  "Afrikaans","Albanian","Amharic","Arabic","Armenian","Azerbaijani","Basque","Belarusian","Bengali","Bosnian",
  "Bulgarian","Catalan","Chinese (Simplified)","Chinese (Traditional)","Croatian","Czech","Danish","Dutch","English","Estonian",
  "Finnish","French","Galician","Georgian","German","Greek","Gujarati","Haitian Creole","Hebrew","Hindi",
  "Hungarian","Icelandic","Indonesian","Irish","Italian","Japanese","Javanese","Kannada","Kazakh","Korean",
  "Kurdish","Kyrgyz","Lao","Latvian","Lithuanian","Luxembourgish","Macedonian","Malay","Maltese","Maori",
  "Marathi","Mongolian","Nepali","Norwegian","Pashto","Persian","Polish","Portuguese","Punjabi","Romanian",
  "Russian","Serbian","Sindhi","Sinhala","Slovak","Slovenian","Somali","Spanish","Swahili","Swedish",
  "Tagalog","Tajik","Tamil","Telugu","Thai","Turkish","Turkmen","Ukrainian","Urdu","Uzbek",
  "Vietnamese","Welsh","Xhosa","Yoruba","Zulu"
];

const TIER_CONFIG = {
  FREE: {
    label: "Free",
    color: "#6b7280",
    bg: "#f3f4f6",
    border: "#e5e7eb",
    features: ["5 scans / month", "Up to 3 trips", "2 policies per trip", "Standard support"],
    description: "Basic protection visibility",
  },
  STANDARD: {
    label: "Standard",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
    features: ["Unlimited basic scans", "10 deep scans / month", "Up to 20 trips", "Data export"],
    description: "For frequent travelers",
  },
  PREMIUM: {
    label: "Power Traveler",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    features: ["Power Traveler"],
    description: "Power Traveler",
  },
  CORPORATE: {
    label: "Corporate",
    color: "#2E5FA3",
    bg: "#eff4fc",
    border: "#bfdbfe",
    features: ["Unlimited everything", "API access", "Multi-user workspaces", "Custom integrations", "Dedicated support"],
    description: "Multi-user workspaces",
  },
};

// ---------------------------------------------------------------------------
// SUBCOMPONENTS
// ---------------------------------------------------------------------------
function TierBadge({ tier }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.FREE;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: "2px 9px", letterSpacing: "0.03em",
    }}>
      {cfg.label}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 600, color: "#aaa",
      textTransform: "uppercase", letterSpacing: "0.08em",
      margin: "0 0 8px 2px",
    }}>
      {children}
    </p>
  );
}

function SettingsCard({ children }) {
  return (
    <div style={{
      background: "white",
      border: "1px solid #f0f0f0",
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      {children}
    </div>
  );
}

function SettingsRow({ label, value, chevron = false, badge, danger = false, last = false, onTap, sub }) {
  return (
    <button
      onClick={onTap}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: sub ? "10px 14px" : "12px 14px",
        background: "none", border: "none", cursor: onTap ? "pointer" : "default",
        borderBottom: last ? "none" : "1px solid #f5f5f5",
        textAlign: "left",
      }}
    >
      <div>
        <span style={{ fontSize: 13, color: danger ? "#dc2626" : "#333", fontWeight: 400, display: "block" }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: "#aaa", display: "block", marginTop: 1 }}>{sub}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {badge}
        {value && <span style={{ fontSize: 12, color: "#999", fontWeight: 400 }}>{value}</span>}
        {chevron && (
          <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
            <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </button>
  );
}

function StatusPill({ on }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      color: on ? "#16a34a" : "#9ca3af",
      background: on ? "#f0fdf4" : "#f3f4f6",
      border: `1px solid ${on ? "#bbf7d0" : "#e5e7eb"}`,
      borderRadius: 20, padding: "2px 8px",
    }}>
      {on ? "On" : "Off"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SCROLL PICKER SHEET
// ---------------------------------------------------------------------------
function ScrollPickerSheet({ title, options, current, onSelect, onDismiss }) {
  const [selected, setSelected] = useState(current);

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 600 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 601, height: "70%", display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "12px 18px 0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: 0 }}>{title}</p>
          <button onClick={onDismiss} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 0 28px" }}>
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { setSelected(opt); onSelect(opt); onDismiss(); }}
              style={{
                width: "100%", background: selected === opt ? "#f0f9ff" : "none",
                border: "none", padding: "12px 18px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                borderBottom: "1px solid #f5f5f5", cursor: "pointer",
                fontSize: 14, color: selected === opt ? "#1d4ed8" : "#333",
                fontWeight: selected === opt ? 600 : 400,
                textAlign: "left",
              }}
            >
              {opt}
              {selected === opt && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7l3.5 3.5L11.5 3.5" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// LANGUAGE CONFIRM SHEET
// ---------------------------------------------------------------------------
function LanguageConfirmSheet({ language, onConfirm, onDismiss }) {
  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 700 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 701, padding: "0 18px 32px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f0f9ff", border: "1.5px solid #bae6fd", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#0369a1" strokeWidth="1.7"/>
              <path d="M12 3c-2 4-2 14 0 18M12 3c2 4 2 14 0 18M3 12h18" stroke="#0369a1" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>Change language?</p>
            <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Your app language will be set to {language}</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#555", margin: "0 0 18px", lineHeight: 1.6 }}>
          The entire app interface will switch to <strong>{language}</strong>. You can change this any time in Preferences.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onDismiss}
            style={{ flex: 1, padding: "12px 0", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "12px 0", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TRUSTED ALLY SHEET
// ---------------------------------------------------------------------------
function TrustedAllySheet({ onDismiss }) {
  const [primaryAlly, setPrimaryAlly] = useState({ name: "", email: "", phone: "" });
  const [tripToggle, setTripToggle] = useState("all");
  const [saved, setSaved] = useState(false);

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, height: "88%", display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "12px 18px 0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0 }}>Trusted ally</p>
          <button onClick={onDismiss} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 32px" }}>
          {saved ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0 20px", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", border: "1.5px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12l5 5L20 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: 0 }}>Trusted ally saved</p>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 14, padding: "12px 16px", width: "100%", boxSizing: "border-box" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", margin: "0 0 2px" }}>Primary trusted ally</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: "0 0 1px" }}>{primaryAlly.name}</p>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{primaryAlly.email}</p>
              </div>
              <p style={{ fontSize: 12, color: "#888", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
                This is your default trusted ally for{" "}
                {tripToggle === "all" ? "all trips" : "specific trips only"}.
                You can update this any time.
              </p>
              <button onClick={onDismiss} style={{ marginTop: 8, padding: "11px 28px", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ background: "#f9fafb", border: "1px solid #f0f0f0", borderRadius: 14, padding: "12px 14px", marginBottom: 18 }}>
                <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.6 }}>
                  Your primary trusted ally is your default emergency contact — someone to notify or escalate to if something goes wrong on any trip. You can also restrict this to specific trips.
                </p>
              </div>

              <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Primary trusted ally</p>

              {[
                { label: "Full name", placeholder: "e.g. Sarah Donovan", key: "name" },
                { label: "Email", placeholder: "sarah@example.com", key: "email" },
                { label: "Phone (optional)", placeholder: "+1 555 000 0000", key: "phone" },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{f.label}</p>
                  <input
                    type="text"
                    value={primaryAlly[f.key]}
                    onChange={(e) => setPrimaryAlly(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "12px 14px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 13, color: "#111", boxSizing: "border-box", outline: "none", fontFamily: "system-ui, -apple-system, sans-serif" }}
                  />
                </div>
              ))}

              <div style={{ marginTop: 18, marginBottom: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#111", margin: "0 0 8px" }}>Trip availability</p>
                <div style={{ display: "flex", gap: 0, background: "#f3f4f6", borderRadius: 20, padding: 2 }}>
                  {[
                    { value: "all", label: "All trips (default)" },
                    { value: "specific", label: "Specific trips only" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTripToggle(opt.value)}
                      style={{
                        flex: 1, background: tripToggle === opt.value ? "white" : "none",
                        border: "none", borderRadius: 18, padding: "7px 10px",
                        fontSize: 11, fontWeight: tripToggle === opt.value ? 700 : 500,
                        color: tripToggle === opt.value ? "#111" : "#9ca3af",
                        cursor: "pointer",
                        boxShadow: tripToggle === opt.value ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                        transition: "all 0.15s", whiteSpace: "nowrap",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {tripToggle === "specific" && (
                  <div style={{ marginTop: 10, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 13px" }}>
                    <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.5 }}>
                      You can toggle which trips this ally applies to from within each trip&apos;s Travelers tab.
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => primaryAlly.name && primaryAlly.email && setSaved(true)}
                style={{
                  width: "100%", padding: "13px 0",
                  background: (primaryAlly.name && primaryAlly.email)
                    ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)"
                    : "#f3f4f6",
                  border: "none", borderRadius: 14,
                  fontSize: 14, fontWeight: 600,
                  color: (primaryAlly.name && primaryAlly.email) ? "white" : "#aaa",
                  cursor: (primaryAlly.name && primaryAlly.email) ? "pointer" : "default",
                  transition: "all 0.15s",
                }}
              >
                Save trusted ally
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// MEMBER SENSE CARD (near top, below profile hero)
// ---------------------------------------------------------------------------
function MemberSenseCard() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f2440 0%, #1e3a5f 100%)",
      borderRadius: 16, padding: "14px 16px", marginBottom: 18,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", right: -12, top: -12, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "white", margin: 0 }}>Member Sense</p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", margin: 0 }}>Your traveler intelligence profile</p>
          </div>
        </div>
        <button onClick={() => setOpen(!open)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>
          {open ? "Close" : "View"}
        </button>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Trips completed", value: "8" },
            { label: "Active policies", value: "4" },
            { label: "Incidents documented", value: "3" },
            { label: "Claims filed", value: "1" },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SERVICE STATUS ROW
// ---------------------------------------------------------------------------
function ServiceStatusRow() {
  return (
    <div style={{ marginBottom: 18 }}>
      <SectionLabel>Platform status</SectionLabel>
      <div style={{
        background: "white", border: "1px solid #f0f0f0",
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          padding: "12px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>All systems operational</span>
          </div>
          <svg width="5" height="8" viewBox="0 0 5 8" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TRIP UNLOCK SHEET
// ---------------------------------------------------------------------------
function TripUnlockSheet({ onDismiss }) {
  const features = [
    "Full coverage analysis for this trip",
    "Incident workspace and documentation",
    "Claim packet builder",
    "Filing order recommendations",
  ];

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "20px 20px 0 0",
        zIndex: 301, maxHeight: "80%",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "16px 18px 0" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px", letterSpacing: "-0.2px" }}>Unlock this trip</p>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>One-time access for a single trip</p>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 18px 28px" }}>
          <div style={{
            border: "1.5px solid #bae6fd", background: "#f0f9ff",
            borderRadius: 16, padding: "16px 18px", marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#0c4a6e", margin: "0 0 2px" }}>Trip Unlock</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#0369a1", margin: 0 }}>$14.99 <span style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>per trip</span></p>
              </div>
              <button style={{
                background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                color: "white", border: "none", borderRadius: 10,
                padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                Unlock
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {features.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5.5" fill="#dbeafe" stroke="#93c5fd"/>
                    <path d="M3.5 6l2 2 3-3" stroke="#1d4ed8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 12, color: "#0c4a6e" }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.6, textAlign: "center" }}>
            Unlocks apply to one trip only. Each trip is unlocked independently.
          </p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TRIP LABEL DISPLAY PREFERENCE ROW
// ---------------------------------------------------------------------------
function TripLabelDisplayRow() {
  const [mode, setMode] = useState("flag");
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: "1px solid #f5f5f5" }}>
      <div>
        <p style={{ fontSize: 13, color: "#333", margin: "0 0 1px", fontWeight: 400 }}>Trip label display</p>
        <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>How trips appear in selector chips</p>
      </div>
      <div style={{ display: "flex", gap: 0, background: "#f3f4f6", borderRadius: 20, padding: 2 }}>
        {[{ value: "flag", label: "Flag only" }, { value: "flag_name", label: "Flag + name" }].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            style={{
              background: mode === opt.value ? "white" : "none",
              border: "none", borderRadius: 18, padding: "5px 10px",
              fontSize: 11, fontWeight: mode === opt.value ? 700 : 500,
              color: mode === opt.value ? "#111" : "#9ca3af",
              cursor: "pointer",
              boxShadow: mode === opt.value ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DISPLAY PREFERENCES ACCORDION
// ---------------------------------------------------------------------------
function DisplayPreferencesRow({ onOpenCountry, onOpenNationality, onOpenLanguage, homeCountry, nationality, language, units, onUnitsChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "none", border: "none",
          padding: "12px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: open ? "1px solid #f0f0f0" : "none",
        }}
      >
        <span style={{ fontSize: 13, color: "#333" }}>Display</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ background: "#fafafa" }}>
          <TripLabelDisplayRow />
          <SettingsRow label="Document display mode" value="Standard" chevron sub="How policy documents render" />
          <SettingsRow
            label="Language"
            value={language}
            chevron
            onTap={onOpenLanguage}
          />
          <SettingsRow
            label="Home country"
            value={homeCountry}
            chevron
            onTap={onOpenCountry}
          />
          <SettingsRow
            label="Nationality"
            value={nationality}
            chevron
            onTap={onOpenNationality}
          />
          <div style={{ padding: "11px 14px", borderTop: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 13, color: "#333", margin: 0 }}>Units of measurement</p>
              <p style={{ fontSize: 11, color: "#aaa", margin: "2px 0 0" }}>Temperature, distance, weight</p>
            </div>
            <div style={{ display: "flex", background: "#f0f0f0", borderRadius: 20, padding: 2, gap: 2 }}>
              {["imperial", "metric"].map((u) => (
                <button
                  key={u}
                  onClick={() => onUnitsChange(u)}
                  style={{
                    padding: "5px 12px", borderRadius: 18, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    background: units === u ? "white" : "transparent",
                    color: units === u ? "#111" : "#888",
                    boxShadow: units === u ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {u === "imperial" ? "°F / mi" : "°C / km"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HELP CENTER SHEET
// ---------------------------------------------------------------------------
const FAQ_ITEMS = [
  {
    q: "How do I add a trip?",
    a: "Tap the + button on the Trips screen. You can import a travel confirmation email, narrate your trip details by voice, or enter them manually.",
  },
  {
    q: "What does 'deep scan' do?",
    a: "Deep scan analyzes your travel policies — credit card benefits, airline contracts, travel insurance — and maps every coverage clause to your trip. It surfaces protections you may not know you have.",
  },
  {
    q: "How do I file an incident?",
    a: "Open your trip, tap the Incidents tab, then tap 'New incident'. Describe what happened, attach evidence (photos, receipts, screenshots), and TripGuard will route it to the right claim channel automatically.",
  },
  {
    q: "What is the Segments tab?",
    a: "Segments shows every leg of your journey — flights, trains, car transfers — in sequence. Each segment is validated for connection times, weather, and coverage gaps.",
  },
  {
    q: "Can I use TripGuard for group trips?",
    a: "Yes. When creating a trip, set it as a Group / Business trip and add participants. Each person's coverage and status is tracked independently.",
  },
  {
    q: "How does the narrate feature work?",
    a: "Tap the microphone icon anywhere in the app. Speak naturally — 'My flight from JFK to Lisbon on June 12th at 10 PM on TAP Air' — and TripGuard transcribes and extracts the structured data automatically.",
  },
  {
    q: "Is my data secure?",
    a: "All trip and policy data is encrypted at rest and in transit. Only you can access your account. You can export or delete your data at any time from Settings → Data & Privacy.",
  },
];

function HelpCenterSheet({ onDismiss }) {
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "bot", text: "Hi! I'm the TripGuard assistant. You can ask me anything — how to use the app, what a coverage means, how to file a claim, or anything about your trip protections." },
  ]);
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const BOT_RESPONSES = {
    default: "That's a great question. TripGuard covers a wide range of scenarios. For the most accurate answer specific to your policies, try opening a trip and running a deep scan — it'll map exactly what you're covered for.",
    claim: "To file a claim, open your trip, go to the Incidents tab, and tap 'New incident'. Describe what happened, attach any evidence, and TripGuard will route it to the right channel.",
    scan: "Deep scan reads your travel policies — credit card benefits, airline contracts, insurance documents — and surfaces every coverage clause relevant to your trip.",
    trip: "To add a trip, tap the + on the Trips screen. You can import a confirmation email, narrate your trip by voice, or fill in details manually.",
    segment: "Segments are the individual legs of your journey. Open the Segments tab from the bottom navigation to see your flights, trains, and transfers in sequence.",
    insurance: "TripGuard integrates with your existing travel insurance policies. Upload your policy document via the scan feature and we'll extract all coverage details automatically.",
  };

  function getBotReply(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes("claim") || lower.includes("incident") || lower.includes("reimburse")) return BOT_RESPONSES.claim;
    if (lower.includes("scan") || lower.includes("coverage") || lower.includes("benefit")) return BOT_RESPONSES.scan;
    if (lower.includes("trip") || lower.includes("add") || lower.includes("create")) return BOT_RESPONSES.trip;
    if (lower.includes("segment") || lower.includes("flight") || lower.includes("route")) return BOT_RESPONSES.segment;
    if (lower.includes("insurance") || lower.includes("policy")) return BOT_RESPONSES.insurance;
    return BOT_RESPONSES.default;
  }

  function sendMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setChatInput("");
    setTyping(true);
    setTimeout(() => {
      setChatMessages((prev) => [...prev, { role: "bot", text: getBotReply(trimmed) }]);
      setTyping(false);
    }, 1200);
  }

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, height: "92%", display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
        transform: mounted ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "14px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderBottom: "1px solid #f0f0f0" }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Help Center</p>
            <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>Answers, guides & live support</p>
          </div>
          <button onClick={onDismiss} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 100px" }}>

          <div style={{
            background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
            borderRadius: 16, padding: "16px 18px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.8"/>
                <path d="M9.5 9.5C9.5 8.1 10.6 7 12 7s2.5 1.1 2.5 2.5c0 1.4-1 2-2 2.5-.5.3-.5.7-.5 1" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="12" cy="16.5" r="0.75" fill="white"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "white", margin: "0 0 3px" }}>Frequently asked questions</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: 0, lineHeight: 1.4 }}>Quick answers to the most common questions about TripGuard</p>
            </div>
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Common questions</p>

          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, marginBottom: 8, overflow: "hidden" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", background: "none", border: "none", padding: "13px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111", flex: 1, paddingRight: 10 }}>{item.q}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                  <path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f5f5f5" }}>
                  <p style={{ fontSize: 13, color: "#555", margin: "10px 0 0", lineHeight: 1.6 }}>{item.a}</p>
                </div>
              )}
            </div>
          ))}

          <div style={{ height: 1, background: "#f0f0f0", margin: "20px 0 16px" }} />

          <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Still need help?</p>
          <div style={{ background: "#f9fafb", borderRadius: 14, padding: "14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>Chat with our bot 24/7</p>
              <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Ask anything about coverage, claims, or how to use the app</p>
            </div>
            <button onClick={() => setChatOpen(true)} style={{ background: "#1e3a5f", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "white", cursor: "pointer" }}>
              Chat
            </button>
          </div>
        </div>

        {chatOpen && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "white", borderRadius: "20px 20px 0 0",
            zIndex: 10, height: "85%", display: "flex", flexDirection: "column",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
            </div>
            <div style={{ padding: "10px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.8"/>
                    <path d="M9.5 9.5C9.5 8.1 10.6 7 12 7s2.5 1.1 2.5 2.5c0 1.4-1 2-2 2.5-.5.3-.5.7-.5 1" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    <circle cx="12" cy="16.5" r="0.75" fill="white"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: 0 }}>TripGuard Assistant</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                    <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Online · 24/7</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "bot" && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                        <path d="M9.5 9.5C9.5 8.1 10.6 7 12 7s2.5 1.1 2.5 2.5c0 1.4-1 2-2 2.5-.5.3-.5.7-.5 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="12" cy="16.5" r="0.75" fill="white"/>
                      </svg>
                    </div>
                  )}
                  <div style={{
                    maxWidth: "75%",
                    background: m.role === "user" ? "#1e3a5f" : "#f3f4f6",
                    borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    padding: "10px 13px",
                  }}>
                    <p style={{ fontSize: 13, color: m.role === "user" ? "white" : "#111", margin: 0, lineHeight: 1.5 }}>{m.text}</p>
                  </div>
                </div>
              ))}
              {typing && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                      <path d="M9.5 9.5C9.5 8.1 10.6 7 12 7s2.5 1.1 2.5 2.5c0 1.4-1 2-2 2.5-.5.3-.5.7-.5 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="12" cy="16.5" r="0.75" fill="white"/>
                    </svg>
                  </div>
                  <div style={{ background: "#f3f4f6", borderRadius: "18px 18px 18px 4px", padding: "10px 14px", display: "flex", gap: 4 }}>
                    {[0, 1, 2].map((d) => (
                      <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#aaa", animation: `bounce 1s ${d * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: "12px 16px 20px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, flexShrink: 0 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask anything about TripGuard..."
                style={{
                  flex: 1, padding: "11px 14px",
                  background: "#f5f5f7", border: "1px solid #e5e7eb",
                  borderRadius: 22, fontSize: 13, color: "#111", outline: "none",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              />
              <button
                onClick={sendMessage}
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: chatInput.trim() ? "#1e3a5f" : "#e5e7eb",
                  border: "none", cursor: chatInput.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.15s", flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke={chatInput.trim() ? "white" : "#aaa"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke={chatInput.trim() ? "white" : "#aaa"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// TERMS & BOUNDARIES SCREEN (sheet)
// ---------------------------------------------------------------------------
const TERMS_SECTIONS = [
  {
    title: "1. Agreement to Terms",
    body: "By accessing or using Wayfarer (\"the Platform\"), you agree to be bound by these Terms and Boundaries (\"Terms\"). These Terms apply to all users, including travelers, group leaders, and guests. If you disagree with any part of these Terms, you may not use the Platform. These Terms are effective as of the date you first access the Platform.",
  },
  {
    title: "2. Platform Description",
    body: "Wayfarer is a travel protection intelligence platform designed to help you understand, organize, and act on your existing travel coverage. The Platform reads and synthesizes policy documents, credit card benefit guides, airline contracts of carriage, and other travel-related documents you upload or authorize us to access. Wayfarer does not sell insurance and is not an insurance company, broker, or licensed insurance advisor in any jurisdiction.",
  },
  {
    title: "3. Coverage Intelligence — Not Insurance Advice",
    body: "All coverage summaries, gap analyses, clause extractions, and claim routing guidance provided by the Platform are informational only. They are generated through automated document analysis and should not be construed as legal, financial, or insurance advice. Coverage eligibility for a given incident is always determined by your insurer, credit card issuer, or carrier — not by Wayfarer. You are solely responsible for verifying your coverage before relying on any information provided by the Platform.",
  },
  {
    title: "4. Coverage Acknowledgment and Waiver",
    body: "When creating a trip, you will be prompted to attach applicable policy documents. If you choose to proceed without attaching a valid policy, you acknowledge that: (a) Wayfarer cannot provide coverage intelligence for unattached policies; (b) you are traveling without verified coverage intelligence; and (c) a \"Coverage not verified\" notice will be displayed on your trip. By continuing past this prompt, you explicitly waive any claim against Wayfarer arising from the absence of coverage information.",
  },
  {
    title: "5. User Accounts and Membership",
    body: "You must create an account to use the Platform. You are responsible for maintaining the security of your account credentials. Wayfarer offers free and paid membership tiers. Paid tier features including Deep Scan, incident routing, and group travel are available only under an active paid membership. Membership fees are non-refundable except as required by applicable law. Wayfarer reserves the right to modify tier benefits with 30 days written notice.",
  },
  {
    title: "6. Document Uploads and Data Processing",
    body: "When you upload documents, you grant Wayfarer a limited, non-exclusive license to process and analyze those documents solely for the purpose of providing the Platform's features to you. Wayfarer uses automated extraction pipelines and may use third-party AI services to process document content. Uploaded documents are encrypted at rest and in transit. You retain full ownership of your documents. You may request deletion of your data at any time via Account > Delete account.",
  },
  {
    title: "7. Incident Recording and Claim Routing",
    body: "The incident workspace and claim routing features are organizational tools only. Wayfarer does not submit claims on your behalf and is not a party to any claim or dispute between you and a coverage provider. Wayfarer's routing guidance is based on document analysis and does not guarantee claim approval or any specific outcome. Time-sensitive claims are your responsibility to initiate directly with your insurer or carrier.",
  },
  {
    title: "8. Emergency Features",
    body: "The SOS and Emergency features are intended as organizational aids — they provide contact information and guidance summaries from your stored documents. The Platform does not connect you directly to emergency services. In any emergency, always contact local emergency services (e.g., 911, 112, 999) directly. Wayfarer is not liable for any harm arising from reliance on the Emergency feature in place of contacting emergency services.",
  },
  {
    title: "9. Group Travel",
    body: "Group leaders who add participants to a trip accept responsibility for ensuring participants are informed that their travel information will be visible to the group leader within the Platform. Participants may request removal from a trip at any time. Wayfarer does not facilitate participant consent on behalf of group leaders.",
  },
  {
    title: "10. Prohibited Uses",
    body: "You may not use the Platform to: (a) upload fraudulent, falsified, or altered documents; (b) fabricate or misrepresent incidents or claims; (c) reverse-engineer or scrape the Platform's systems or outputs; (d) share your account credentials with others; (e) use the Platform for any commercial purpose without express written authorization from Wayfarer. Violation of these prohibitions may result in immediate account termination.",
  },
  {
    title: "11. Intellectual Property",
    body: "All Platform content, interfaces, algorithms, extraction models, and brand assets are the intellectual property of Wayfarer Technologies, Inc. The Wayfarer name, shield mark, and \"Travel protection intelligence\" tagline are trademarks of Wayfarer Technologies, Inc. You may not use these marks without prior written consent. Your uploaded documents and personal data remain your property.",
  },
  {
    title: "12. Limitation of Liability",
    body: "To the maximum extent permitted by applicable law, Wayfarer, its affiliates, officers, and employees shall not be liable for: (a) any indirect, incidental, or consequential damages arising from your use of the Platform; (b) errors or omissions in coverage intelligence or extracted clauses; (c) your reliance on Platform guidance in connection with any insurance claim or coverage dispute; (d) loss of data due to circumstances outside Wayfarer's reasonable control. Our aggregate liability to you shall not exceed the fees you paid to Wayfarer in the 12 months preceding the claim.",
  },
  {
    title: "13. Indemnification",
    body: "You agree to indemnify and hold harmless Wayfarer Technologies, Inc. and its affiliates from any claims, damages, or expenses (including reasonable legal fees) arising from: (a) your violation of these Terms; (b) your misuse of the Platform; (c) any misrepresentation you make to a coverage provider based on Platform output; or (d) any third-party claims related to content you upload to the Platform.",
  },
  {
    title: "14. Privacy",
    body: "Your use of the Platform is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Platform, you consent to the collection and processing of your data as described in the Privacy Policy. You may review or request deletion of your data at any time via Account > Data & Privacy.",
  },
  {
    title: "15. Modifications to Terms",
    body: "Wayfarer reserves the right to update these Terms at any time. Material changes will be communicated via in-app notification and/or email at least 14 days before they take effect. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms. If you do not agree to a material change, you may close your account before the change takes effect.",
  },
  {
    title: "16. Governing Law and Disputes",
    body: "These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law provisions. Any disputes arising from these Terms shall be resolved through binding arbitration under the rules of the American Arbitration Association, except where prohibited by applicable consumer protection law. You waive the right to participate in class action proceedings against Wayfarer.",
  },
  {
    title: "17. Contact",
    body: "Questions about these Terms may be directed to legal@wayfarer.app. For general support, use the Help center or Contact us options in your account settings.",
  },
];

function TermsSheet({ onDismiss }) {
  const [mounted, setMounted] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <>
      <div
        onClick={onDismiss}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.45)", zIndex: 300,
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.22s ease",
        }}
      />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white",
        borderRadius: "22px 22px 0 0",
        zIndex: 301,
        maxHeight: "88%",
        display: "flex", flexDirection: "column",
        transform: mounted ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "4px 20px 14px", flexShrink: 0, borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: "0 0 2px", letterSpacing: "-0.3px" }}>Terms & Boundaries</p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Effective January 1, 2026 · Wayfarer Technologies, Inc.</p>
            </div>
            <button
              onClick={onDismiss}
              style={{ width: 32, height: 32, borderRadius: 16, background: "#f3f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="#666" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 40px" }}>
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#92400e", margin: "0 0 3px" }}>Please read carefully</p>
            <p style={{ fontSize: 11, color: "#b45309", margin: 0, lineHeight: 1.55 }}>
              These Terms govern your use of the Wayfarer platform. Tap any section to expand it. By using Wayfarer, you accept these Terms in full.
            </p>
          </div>

          {TERMS_SECTIONS.map((sec, i) => (
            <div
              key={i}
              style={{
                borderBottom: i < TERMS_SECTIONS.length - 1 ? "1px solid #f3f4f6" : "none",
                marginBottom: 2,
              }}
            >
              <button
                onClick={() => setOpenSection(openSection === i ? null : i)}
                style={{
                  width: "100%", background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 0", textAlign: "left", gap: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111", flex: 1, lineHeight: 1.4 }}>{sec.title}</span>
                <svg
                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                  style={{ flexShrink: 0, transform: openSection === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
                >
                  <path d="M4 6l4 4 4-4" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {openSection === i && (
                <div style={{ paddingBottom: 14 }}>
                  <p style={{ fontSize: 12.5, color: "#4b5563", margin: 0, lineHeight: 1.7 }}>{sec.body}</p>
                </div>
              )}
            </div>
          ))}

          <div style={{ marginTop: 24, padding: "14px 0", borderTop: "1px solid #f3f4f6" }}>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.6, textAlign: "center" }}>
              Wayfarer Technologies, Inc. · All rights reserved{"\n"}
              Version 1.0 · January 2026
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONTACT US SCREEN (sheet)
// ---------------------------------------------------------------------------
function ContactUsSheet({ onDismiss }) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [sent, setSent] = useState(false);

  const categories = [
    { value: "general", label: "General question" },
    { value: "incident", label: "Incident help" },
    { value: "billing", label: "Billing & plan" },
    { value: "bug", label: "Bug report" },
    { value: "feedback", label: "Feedback" },
  ];

  function handleSend() {
    if (!message.trim()) return;
    setSent(true);
  }

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, height: "88%", display: "flex", flexDirection: "column",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>

        <div style={{ padding: "12px 18px 0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.2px" }}>Contact us</p>
          <button onClick={onDismiss} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 28px" }}>
          {sent ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0 20px", gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "#f0fdf4", border: "1.5px solid #bbf7d0",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12l5 5L20 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.2px" }}>Message sent</p>
              <p style={{ fontSize: 13, color: "#888", margin: 0, textAlign: "center", lineHeight: 1.5, maxWidth: 240 }}>
                We&apos;ll get back to you at {MOCK_USER.email} within 24 hours.
              </p>
              <button
                onClick={onDismiss}
                style={{
                  marginTop: 8, padding: "11px 28px",
                  background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)",
                  border: "none", borderRadius: 13,
                  fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 18px", lineHeight: 1.5 }}>
                Send us a message and we&apos;ll respond within 24 hours. For urgent issues, tap the priority flag.
              </p>

              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Topic</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {categories.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      style={{
                        background: category === c.value ? "#1e3a5f" : "#f3f4f6",
                        color: category === c.value ? "white" : "#555",
                        border: "none", borderRadius: 20,
                        padding: "6px 12px", fontSize: 12, fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Message</p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what you need help with..."
                  rows={5}
                  style={{
                    width: "100%", padding: "12px 14px",
                    background: "#f9fafb", border: "1.5px solid #e5e7eb",
                    borderRadius: 14, fontSize: 13, color: "#111",
                    resize: "none", fontFamily: "system-ui, -apple-system, sans-serif",
                    lineHeight: 1.6, boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Or reach us at</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { icon: "✉", label: "Email support", sub: "support@tripguard.io" },
                    { icon: "💬", label: "Live chat", sub: "Available Mon – Fri, 9am – 6pm ET" },
                  ].map((opt) => (
                    <div key={opt.label} style={{
                      background: "#f9fafb", border: "1px solid #f0f0f0",
                      borderRadius: 12, padding: "11px 13px",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <span style={{ fontSize: 16 }}>{opt.icon}</span>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#111", margin: 0 }}>{opt.label}</p>
                        <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{opt.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSend}
                style={{
                  width: "100%", padding: "13px 0",
                  background: message.trim()
                    ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)"
                    : "#f3f4f6",
                  border: "none", borderRadius: 14,
                  fontSize: 14, fontWeight: 600,
                  color: message.trim() ? "white" : "#aaa",
                  cursor: message.trim() ? "pointer" : "default",
                  transition: "all 0.15s",
                }}
              >
                Send message
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DATA EXPORT ROW
// ---------------------------------------------------------------------------
function DataExportRow() {
  const [open, setOpen] = useState(false);
  const [exportSheet, setExportSheet] = useState(null);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "none", border: "none",
          padding: "12px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: open ? "1px solid #f0f0f0" : "1px solid #f5f5f5",
          textAlign: "left",
        }}
      >
        <div>
          <span style={{ fontSize: 13, color: "#333", fontWeight: 400, display: "block" }}>Export my data</span>
          <span style={{ fontSize: 11, color: "#aaa", display: "block", marginTop: 1 }}>Download your trips, incidents, and coverage history</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{ background: "#fafafa", borderBottom: "1px solid #f5f5f5" }}>
          {[
            { label: "Spreadsheet (CSV)", sub: "Trips, incidents, coverage data", icon: "csv" },
            { label: "PDF report", sub: "Formatted export for records", icon: "pdf" },
            { label: "Email to myself", sub: `Send to ${MOCK_USER.email}`, icon: "email" },
            { label: "Email to someone else", sub: "Specify any email address", icon: "email-other" },
          ].map((opt, i, arr) => (
            <button
              key={opt.label}
              onClick={() => setExportSheet(opt)}
              style={{
                width: "100%", background: "none", border: "none",
                padding: "10px 14px 10px 22px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: i < arr.length - 1 ? "1px solid #f0f0f0" : "none",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div>
                <span style={{ fontSize: 13, color: "#333", fontWeight: 500, display: "block" }}>{opt.label}</span>
                <span style={{ fontSize: 11, color: "#aaa", display: "block", marginTop: 1 }}>{opt.sub}</span>
              </div>
              <svg width="5" height="8" viewBox="0 0 5 8" fill="none">
                <path d="M1 1l3 3-3 3" stroke="#d1d5db" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      )}
      {exportSheet && <ExportConfirmSheet option={exportSheet} onDismiss={() => setExportSheet(null)} />}
    </>
  );
}

function ExportConfirmSheet({ option, onDismiss }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const needsEmail = option.icon === "email-other";

  return (
    <>
      <div onClick={onDismiss} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "white", borderRadius: "22px 22px 0 0",
        zIndex: 501, padding: "0 18px 32px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2 }} />
        </div>
        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 8px", gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", border: "1.5px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 12l5 5L20 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>Export started</p>
            <p style={{ fontSize: 12, color: "#888", margin: 0, textAlign: "center", lineHeight: 1.5 }}>
              {needsEmail ? `Your data export will be sent to ${email}` : `Your ${option.label.toLowerCase()} will be ready shortly`}
            </p>
            <button onClick={onDismiss} style={{ marginTop: 8, padding: "11px 28px", background: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)", border: "none", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>Done</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "4px 0 6px", letterSpacing: "-0.2px" }}>{option.label}</p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px", lineHeight: 1.5 }}>{option.sub}</p>
            {needsEmail && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recipient email</p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. advisor@example.com"
                  style={{ width: "100%", padding: "12px 14px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, fontSize: 13, color: "#111", boxSizing: "border-box", outline: "none", fontFamily: "system-ui, -apple-system, sans-serif" }}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onDismiss} style={{ flex: 1, padding: "12px 0", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 13, fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>Cancel</button>
              <button
                onClick={() => (!needsEmail || email.trim()) && setDone(true)}
                style={{ flex: 1, padding: "12px 0", background: (!needsEmail || email.trim()) ? "linear-gradient(135deg, #1e3a5f 0%, #0f2440 100%)" : "#f3f4f6", border: "none", borderRadius: 13, fontSize: 13, fontWeight: 600, color: (!needsEmail || email.trim()) ? "white" : "#aaa", cursor: (!needsEmail || email.trim()) ? "pointer" : "default" }}
              >
                Export
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PHOTO CROP MODAL
// ---------------------------------------------------------------------------
function PhotoCropModal({ imageSrc, onApply, onCancel }) {
  const canvasRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const imgRef = useRef(null);
  const SIZE = 220;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setScale(Math.max(SIZE / img.width, SIZE / img.height));
      setOffset({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const img = imgRef.current;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const dx = (SIZE - scaledW) / 2 + offset.x;
    const dy = (SIZE - scaledH) / 2 + offset.y;
    ctx.drawImage(img, dx, dy, scaledW, scaledH);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [offset, scale, imageSrc]);

  function onMouseDown(e) {
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }
  function onMouseMove(e) {
    if (!dragging || !dragStart.current) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    const img = imgRef.current;
    if (!img) return;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    const maxX = Math.max(0, (scaledW - SIZE) / 2);
    const maxY = Math.max(0, (scaledH - SIZE) / 2);
    setOffset({ x: Math.max(-maxX, Math.min(maxX, newX)), y: Math.max(-maxY, Math.min(maxY, newY)) });
  }
  function onMouseUp() { setDragging(false); }

  function onTouchStart(e) {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { x: t.clientX - offset.x, y: t.clientY - offset.y };
  }
  function onTouchMove(e) {
    if (!dragging || !dragStart.current) return;
    const t = e.touches[0];
    const newX = t.clientX - dragStart.current.x;
    const newY = t.clientY - dragStart.current.y;
    const img = imgRef.current;
    if (!img) return;
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;
    const maxX = Math.max(0, (scaledW - SIZE) / 2);
    const maxY = Math.max(0, (scaledH - SIZE) / 2);
    setOffset({ x: Math.max(-maxX, Math.min(maxX, newX)), y: Math.max(-maxY, Math.min(maxY, newY)) });
  }

  function handleApply() {
    if (!canvasRef.current) return;
    const out = document.createElement("canvas");
    out.width = 200;
    out.height = 200;
    const ctx = out.getContext("2d");
    ctx.drawImage(canvasRef.current, 0, 0, SIZE, SIZE, 0, 0, 200, 200);
    onApply(out.toDataURL("image/jpeg", 0.9));
  }

  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 600,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
    }}>
      <div style={{
        background: "#1a1a1a", borderRadius: "22px 22px 0 0", width: "100%",
        padding: "20px 20px 32px", display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{ width: 36, height: 4, background: "#444", borderRadius: 2, marginBottom: 18 }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: "white", margin: "0 0 4px", letterSpacing: "-0.2px" }}>Crop photo</p>
        <p style={{ fontSize: 12, color: "#888", margin: "0 0 20px" }}>Drag to reposition · pinch or use slider to zoom</p>

        <div
          style={{ position: "relative", width: SIZE, height: SIZE, borderRadius: "50%", overflow: "hidden", cursor: dragging ? "grabbing" : "grab", userSelect: "none", background: "#333" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
        >
          <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: "block" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 24px", width: "100%" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#888" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#888" strokeWidth="2" strokeLinecap="round"/></svg>
          <input
            type="range" min="0.5" max="3" step="0.01"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: "#3b82f6" }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#888" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#888" strokeWidth="2" strokeLinecap="round"/><path d="M8 11h6M11 8v6" stroke="#888" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>

        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "13px 0", background: "#2a2a2a", border: "1px solid #444", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "#ccc", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleApply} style={{ flex: 2, padding: "13px 0", background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, color: "white", cursor: "pointer" }}>
            Apply photo
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN ACCOUNT SCREEN
// ---------------------------------------------------------------------------
export default function AccountScreen({ onBack }) {
  const user = MOCK_USER;
  const tier = user.tier;
  const tierCfg = TIER_CONFIG[tier];
  const isCorporate = tier === "CORPORATE";
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [photoHovered, setPhotoHovered] = useState(false);
  const [photoSrc, setPhotoSrc] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const photoInputRef = useRef(null);
  const [contactUsOpen, setContactUsOpen] = useState(false);
  const [trustedAllyOpen, setTrustedAllyOpen] = useState(false);
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [units, setUnits] = useState("imperial");

  const [homeCountry, setHomeCountry] = useState(user.homeCountry);
  const [nationality, setNationality] = useState(user.nationality);
  const [language, setLanguage] = useState("English");

  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [nationalityPickerOpen, setNationalityPickerOpen] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState(null);
  const [deleteStep, setDeleteStep] = useState(0); // 0 = default, 1 = confirm prompt

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      overflow: "hidden", position: "relative",
      background: "#f5f5f7",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>

      {/* Status bar */}
      <div style={{
        height: 50, background: "#f5f5f7",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        padding: "0 28px 10px", flexShrink: 0, position: "relative", zIndex: 10,
      }}>
        <div style={{ width: 126, height: 34, background: "#1a1a1a", borderRadius: 20, position: "absolute", left: "50%", transform: "translateX(-50%)", top: 0 }} />
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

      {/* Nav header */}
      <div style={{
        background: "#f5f5f7",
        padding: "4px 20px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#111", margin: 0, letterSpacing: "-0.3px" }}>Account</p>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 100px" }}>

        {/* Profile hero */}
        <div style={{
          background: "linear-gradient(155deg, #1e3a5f 0%, #0f2440 100%)",
          borderRadius: 20, padding: "18px 18px 16px",
          marginBottom: 14, position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", right: -20, top: -20, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", right: 20, bottom: -10, width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />

          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative", marginBottom: 14 }}>
            <div
              onMouseEnter={() => setPhotoHovered(true)}
              onMouseLeave={() => setPhotoHovered(false)}
              onClick={() => photoInputRef.current?.click()}
              style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}
            >
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setCropSrc(ev.target.result);
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              {photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL / crop preview; dynamic src
                <img
                  src={photoSrc}
                  alt="Profile"
                  style={{ width: 54, height: 54, borderRadius: 15, objectFit: "cover", border: "2px solid rgba(255,255,255,0.18)" }}
                />
              ) : (
                <div style={{
                  width: 54, height: 54, borderRadius: 15,
                  background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 700, color: "white",
                  border: "2px solid rgba(255,255,255,0.18)",
                }}>
                  {user.initials}
                </div>
              )}
              <div style={{
                position: "absolute", inset: 0, borderRadius: 15,
                background: "rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: photoHovered ? 1 : 0,
                transition: "opacity 0.15s",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="1.8"/>
                </svg>
              </div>
              <div style={{
                position: "absolute", bottom: -3, right: -3,
                width: 18, height: 18, borderRadius: "50%",
                background: "white", border: "2px solid #1e3a5f",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M4 1v6M1 4h6" stroke="#1e3a5f" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "white", margin: "0 0 2px", letterSpacing: "-0.2px" }}>
                {user.displayName}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: "0 0 6px" }}>
                {user.email}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TierBadge tier={tier} />
              </div>
            </div>

            {/* Compact stats top-right */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "white", margin: 0 }}>{user.tripCount}</p>
                  <p style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Trips</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "white", margin: 0 }}>{user.activeGroups}</p>
                  <p style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Groups</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade plan row — below James at TripGuard */}
          {!isCorporate && (
            <button
              onClick={() => setUpgradeOpen(true)}
              style={{
                width: "100%", background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 10, padding: "9px 12px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, fontSize: 9 }}>Current plan</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "white", margin: 0 }}>Power Traveler</p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#fbbf24",
                background: "rgba(251,191,36,0.15)",
                border: "1px solid rgba(251,191,36,0.35)",
                borderRadius: 20, padding: "4px 12px",
              }}>
                Upgrade plan
              </span>
            </button>
          )}
        </div>

        {/* Member Sense — near top, below James Donovan */}
        <MemberSenseCard />

        {/* Safety & Access */}
        <div style={{ marginBottom: 18 }}>
          <SectionLabel>Safety & Access</SectionLabel>
          <SettingsCard>
            <SettingsRow
              label="Two-factor authentication"
              sub="Protects your account with a second verification step"
              badge={<StatusPill on={user.mfaEnabled} />}
              chevron
            />
            <SettingsRow
              label="Trusted ally"
              sub="Designate a primary emergency contact for your trips"
              chevron
              onTap={() => setTrustedAllyOpen(true)}
            />
            <SettingsRow
              label="Connected devices"
              sub="Manage devices signed in to your account"
              chevron
              last
            />
          </SettingsCard>
        </div>

        {/* Preferences */}
        <div style={{ marginBottom: 18 }}>
          <SectionLabel>Preferences</SectionLabel>
          <SettingsCard>
            <DisplayPreferencesRow
              homeCountry={homeCountry}
              nationality={nationality}
              language={language}
              units={units}
              onUnitsChange={setUnits}
              onOpenCountry={() => setCountryPickerOpen(true)}
              onOpenNationality={() => setNationalityPickerOpen(true)}
              onOpenLanguage={() => setLanguagePickerOpen(true)}
            />
            <SettingsRow label="Notifications" value="Trip alerts" chevron />
            <SettingsRow label="Voice input" value="Enabled" chevron last />
          </SettingsCard>
        </div>

        {/* Data & Privacy */}
        <div style={{ marginBottom: 18 }}>
          <SectionLabel>Data & Privacy</SectionLabel>
          <SettingsCard>
            <DataExportRow />
            <SettingsRow label="Permissions & consent" sub="Manage what TripGuard can access and use" chevron />
            {deleteStep === 0 ? (
              <SettingsRow label="Delete account" danger chevron last onTap={() => setDeleteStep(1)} />
            ) : (
              <div style={{ padding: "14px 14px 12px", borderTop: "none" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#dc2626", margin: "0 0 4px" }}>Delete your account?</p>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.5 }}>This will permanently remove all your trips, incidents, and data. This cannot be undone.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setDeleteStep(0)}
                    style={{ flex: 1, padding: "10px 0", background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStep(0)}
                    style={{ flex: 1, padding: "10px 0", background: "#dc2626", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}
                  >
                    Confirm deletion
                  </button>
                </div>
              </div>
            )}
          </SettingsCard>
        </div>

        {/* Support */}
        <div style={{ marginBottom: 18 }}>
          <SectionLabel>Support</SectionLabel>
          <SettingsCard>
            <SettingsRow label="Help center" chevron onTap={() => setHelpCenterOpen(true)} />
            <SettingsRow label="Trust & safety" chevron onTap={() => {}} />
            <SettingsRow label="Terms & boundaries" chevron onTap={() => setTermsOpen(true)} />
            <SettingsRow label="Contact us" chevron last onTap={() => setContactUsOpen(true)} />
          </SettingsCard>
        </div>

        {/* Platform status */}
        <ServiceStatusRow />

        {/* About */}
        <div style={{ marginBottom: 18 }}>
          <SectionLabel>About</SectionLabel>
          <SettingsCard>
            <SettingsRow label="Version" value="1.0.0-beta" />
            <SettingsRow label="Member since" value={user.memberSince} last />
          </SettingsCard>
        </div>

        {/* Sign out */}
        <button style={{
          width: "100%", padding: "13px 0",
          background: "none",
          border: "1.5px solid #fee2e2",
          borderRadius: 14,
          fontSize: 13, fontWeight: 600, color: "#dc2626",
          cursor: "pointer",
        }}>
          Sign out
        </button>
      </div>

      {/* Bottom tab bar */}
      <SharedBottomTabBar activeTab="Account" onTabChange={onBack ? (t) => { if (t !== "Account") onBack(t); } : undefined} />

      {/* Home indicator */}
      <div style={{ height: 28, background: "rgba(245,245,247,0.92)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 134, height: 5, background: "#111", borderRadius: 3, opacity: 0.15 }} />
      </div>

      {/* Upgrade sheet */}
      {upgradeOpen && <TripUnlockSheet onDismiss={() => setUpgradeOpen(false)} />}

      {/* Contact us sheet */}
      {contactUsOpen && <ContactUsSheet onDismiss={() => setContactUsOpen(false)} />}

      {/* Help center sheet */}
      {helpCenterOpen && <HelpCenterSheet onDismiss={() => setHelpCenterOpen(false)} />}

      {/* Terms & boundaries sheet */}
      {termsOpen && <TermsSheet onDismiss={() => setTermsOpen(false)} />}

      {/* Trusted ally sheet */}
      {trustedAllyOpen && <TrustedAllySheet onDismiss={() => setTrustedAllyOpen(false)} />}

      {/* Photo crop modal */}
      {cropSrc && (
        <PhotoCropModal
          imageSrc={cropSrc}
          onApply={(dataUrl) => { setPhotoSrc(dataUrl); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Country picker */}
      {countryPickerOpen && (
        <ScrollPickerSheet
          title="Home country"
          options={COUNTRIES}
          current={homeCountry}
          onSelect={setHomeCountry}
          onDismiss={() => setCountryPickerOpen(false)}
        />
      )}

      {/* Nationality picker */}
      {nationalityPickerOpen && (
        <ScrollPickerSheet
          title="Nationality"
          options={NATIONALITIES}
          current={nationality}
          onSelect={setNationality}
          onDismiss={() => setNationalityPickerOpen(false)}
        />
      )}

      {/* Language picker — sets pending language first */}
      {languagePickerOpen && (
        <ScrollPickerSheet
          title="Language"
          options={LANGUAGES}
          current={language}
          onSelect={(lang) => {
            if (lang !== language) {
              setPendingLanguage(lang);
            }
            setLanguagePickerOpen(false);
          }}
          onDismiss={() => setLanguagePickerOpen(false)}
        />
      )}

      {/* Language confirm */}
      {pendingLanguage && (
        <LanguageConfirmSheet
          language={pendingLanguage}
          onConfirm={() => { setLanguage(pendingLanguage); setPendingLanguage(null); }}
          onDismiss={() => setPendingLanguage(null)}
        />
      )}
    </div>
  );
}
