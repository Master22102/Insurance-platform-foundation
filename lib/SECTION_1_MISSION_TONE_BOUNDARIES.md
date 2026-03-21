# Product Bible Section 1 — Mission, Tone, and Boundaries

Version anchor: March 2026 (constitutional authority for downstream doctrine).

This file captures the binding operating principles provided by product leadership for Section 1.  
If any downstream implementation conflicts with this file, this file prevails.

## 1.1 Mission statement (binding)

- The platform exists to reduce travel disruption complexity through clarity and structure.
- It is a decision-support and documentation platform, not a prediction or adjudication engine.
- It must state what it knows, what it does not know, and the best available next step.
- Integrity is architectural: no false certainty, no exploitation of user stress, no data monetization.

## 1.2 User promise (binding commitments)

1. We tell users what we know (clause basis visible).
2. We tell users what we do not know (ambiguity is explicit).
3. We explain why guidance is suggested (basis is surfaced).
4. We do not predict insurer/administrator decisions.
5. We do not sell user data.
6. Evidence capture and incident logging are always available.
7. The user remains in control; no action without confirmation.

### Emergency floor (must remain available under stress)

- Evidence capture/upload
- Incident timeline creation
- Emergency Assistance Card
- Offline incident snapshot
- Coverage summary for previously uploaded policies

## 1.3 What this is / is not

### This platform is

- A travel decision-support and documentation system.
- A clause/evidence/context alignment system with auditable outputs.

### This platform is not

- An insurance broker/agent
- A legal advisor
- A claims adjudicator
- A prediction engine
- A financial advisor
- A crisis counselor

### Required boundary statement

Canonical requirement for interpretive outputs (or structural equivalent):

> Final determination is made by the benefit administrator, card issuer, or insurer.  
> We cannot predict their decision.

Placement rule:

- Show this boundary once per interpretive session/output in a stable placement (persistent location users can reliably find).

## 1.4 Ethical guardrails (hard limits)

- No data selling, ad targeting, or unauthorized third-party sharing.
- No crisis pricing or paywall on evidence capture/incident logging/coverage viewing.
- No claim approval probability outputs.
- No dark patterns, urgency manipulation, or coercive copy.
- No hallucinated clause content; interpretive outputs must be traceable.

## 1.5 Trust and psychological design

- Calm through clarity, not cosmetic tone.
- Relief before action.
- Never shame, never blame.
- Anti-panic communication.
- One actionable next step by default.
- Honest gaps over false fills.
- User remains decision authority.
- Founder surfaces mirror traveler values.
- Integrity is shown through behavior and logs, not slogans.

## Implementation binding notes

- All new capabilities must pass `lib/FEATURE_FULLSTACK_BINDING_TEMPLATE.md`.
- Copy and UI must align to non-predictive, non-coercive language.
- Sensitive actions require explicit confirmation and immutable audit trails.
- Any conflict between convenience/performance and Section 1 intent resolves in favor of Section 1.
