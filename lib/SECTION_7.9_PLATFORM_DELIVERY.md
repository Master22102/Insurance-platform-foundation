# Section 7.9 — Platform delivery doctrine

**Version 1.0 · March 2026 · Binding**

Governs delivery across **traveler app**, **FOCL founder interface**, and **public website** — same account/data; different presentation.

## 7.9.0 Overview

| Surface | Device priority | Deployment |
|---------|-----------------|------------|
| Traveler | Native iOS/Android primary; responsive web secondary | App stores + Expo EAS OTA |
| FOCL | Desktop/laptop primary; phone read + urgent only | Same web app, founder role |
| Public site | Desktop primary; responsive | Same Next.js app, logged-out |

## 7.9.1 Breakpoints (binding)

Canonical names: **xs** 0–479 · **sm** 480–767 · **md** 768–1023 · **lg** 1024–1279 · **xl** 1280–1535 · **2xl** 1536+ (max content width cap e.g. 1440px).  
**Mobile-first**; Tailwind-style progressive enhancement.

## 7.9.2 Portrait vs landscape (highlights)

- **Emergency SOS sheet (S-EMERGENCY-001):** layout consistency; orientation locked to open orientation.  
- **Voice narration:** soft portrait suggestion, non-blocking.  
- FOCL phone: constrained in landscape too.

## 7.9.3 Traveler phone layout doctrine

- **Full function** on phone — sequence may differ; outcomes same.  
- Bottom tabs; full-screen sheets hide tab bar.  
- **Emergency cluster** (SOS + trip safety) persistent on active trip.  
- **Record status badge** on ledger-derived screens.  
- Tabs map to: Trips, Incident, Coverage, Claims, Account (per spec).

## 7.9.4 Native deployment (summary)

- **Recommended:** Expo / React Native (validate before commit).  
- **iOS:** min e.g. 16.0; privacy strings; push; TestFlight; screenshots.  
- **Android:** min API 29; FCM; Play signing.  
- **OTA:** JS/UI/text via OTA; new native permissions → store build.

## 7.9.5 Sessions & auth (summary)

Biometric step-up, secure token storage, device registration, revocation, limited offline cache for safety/emergency.

## 7.9.6 FOCL device policy

**Laptop:** full FOCL + structural mutations + step-up.  
**Phone:** status, decision queue read, low-risk approvals, breach narrative view — **no** flag %, connector re-enable, threshold changes, finance export, full event log (per **7.3.3** / **8.8.9**).

## 7.9.7 Public website inventory (required pages)

Includes: `/`, `/how-it-works`, `/pricing`, `/travelers`, `/groups`, `/corporate`, `/eu-passenger-rights`, `/about`, `/blog`, `/help`, legal pages, `/signin`, `/signup`, `/download`, `404`.  
**Guardrails:** no outcome guarantees, no fake urgency, honest Tier 0 copy, ad-free.

## 7.9.8 Behavioral invariants (I-01–I-10)

Include: all breakpoints; phone full-function; emergency exempt from layout optimization; OTA default for JS-layer; same codebase URL for site + app; website copy ⊥ platform capability; FOCL structural mutations laptop-only; contextual permission prompts; ad-free everywhere.

---

*Full narrative tables (push channels, store review notes): see founder bible §7.9.*
