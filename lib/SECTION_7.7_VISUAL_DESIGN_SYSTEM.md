# Section 7.7 — Visual Design System & Interaction Patterns (in-repo)

**Source:** Product Bible Section 7.7
**Purpose:** In-repo companion for Cursor implementation. Canonical visual design doctrine.
**Cross-ref:** 7.3 (surfaces), 7.4 (voice), 7.8 (decision communication), 7.9 (delivery)

---

## 7.7.0 Base tokens

These tokens apply across all platform screens (registration snapshot — April 2026). See Amendment v1.1 for locked values.

### Typography

- Font: `system-ui, -apple-system, sans-serif`
- Heading weight: 500 (never 600 or 700 on dark surfaces)
- Body: 12–13px on mobile cards, 14–16px on desktop
- Labels: 9–10px uppercase, `letter-spacing: 0.07em`

### Recurring elements

- **Toast notifications:** green pill, 2 seconds, fades. Text format: "Profile Saved ✓"
- **`prefers-reduced-motion`:** All animations must have a static fallback. Compass stops. Globe stops. Blips and scan lines do not appear. Aurora gradients are static. Waveform does not animate. Layout and color are unaffected.

---

## Amendment v1.1 — Dark design language locked (April 2026)

**Applies to:** All 25+ existing screens listed in Section 7.3.

### Color tokens (locked)

| Token | Value | Usage |
|-------|-------|-------|
| `background-amoled` | `#03050d` | Primary dark background — capture screens, headers, cards |
| `background-card-dark` | `#0a1420` | Dark card surface |
| `background-nav` | `rgba(2,4,10,0.98)` | Navigation bar |
| `gold-accent` | `rgba(251,191,36,1)` | North is always gold — active states, brand accent, north ring |
| `gold-accent-muted` | `rgba(251,191,36,0.4)` | Card borders, secondary gold usage |
| `amber-catch` | `rgba(251,160,60,0.95)` | Catch bucket indicator dot |
| `aurora-purple` | `rgba(99,102,241,0.1)` | Aurora layer 1 |
| `aurora-teal` | `rgba(16,185,129,0.07)` | Aurora layer 1 secondary |
| `aurora-blue` | `rgba(56,189,248,0.07)` | Aurora layer 2 |

### Brand mark tokens (locked)

- Symbol: `✦` (U+2726) — nav top right, static, never spinning
- Compass rose: 14px in nav, 210px on splash/capture screens
- Gold arc at north: ~30° span, `rgba(251,191,36,1)`, `stroke-width: 2.5`
- Needle: `rgba(255,255,255,0.55)`, same weight north and south
- Center: clean white circle, no colored dot
- Compass rotation animation: 28s cycle

### Recurring element tokens (locked)

- **Aurora background:** two overlapping radial gradient blobs, `filter:blur(10–12px)`, slow drift (~14s and ~18s cycles), opacity 0.5–0.85
- **Coordinate grid:** curved latitude/longitude paths, shimmer gradient along length, great-circle diagonals, vignette mask at edges. Fixed — does not rotate.
- **Catch bucket indicator:** amber pulsing dot (5px, `animation:pillPulse`) + inline text. Never a blocking modal.
- **Ripple rings:** `animation:micRipple` on voice capture mic — three rings, staggered delays, pause on record, resume on stop.

### Screen application priority order

Apply design tokens in this order across existing screens:

1. Trips dashboard — empty state + trip cards
2. Trip detail page
3. Coverage intelligence panel
4. Incident creation and workspace
5. Claim packet
6. All remaining account and settings screens

### What changes on each screen

- Nav bar: `background-nav` token, ✦ mark static top right, compass mark 14px with northPulse animation
- Page background: `background-amoled` for hero/capture zones; system background for content zones
- Primary action cards: `background-card-dark` with gold-accent-muted border
- Empty states: coordinate grid texture at low opacity, ✦ centered
- Typography: weight normalized to 500 for headings on dark surfaces

### What does not change

- All business logic, RPC contracts, and state machine behavior
- WCAG contrast requirements — dark surfaces must still meet 4.5:1 for normal text
- Accessibility attributes — aria labels, alt text, focus states
