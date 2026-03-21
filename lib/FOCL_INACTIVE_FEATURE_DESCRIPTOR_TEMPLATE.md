# FOCL inactive feature descriptor template

Use this whenever a feature is staged off, partially rolled out, or intentionally not launch-ready.

## Founder-facing status block (required)

- **Feature:** `<feature_id> / <feature_name>`
- **Current status:** `inactive | staged off | partial rollout`
- **Why inactive now:** concise reason (risk, dependency, policy, compliance, capacity)
- **User impact right now:** what users can and cannot do
- **Target activation window (if known):** date/phase, else "TBD"

## Activation prerequisites (required checklist)

- [ ] Product doctrine alignment complete (Section 1 + 1.9 full-stack binding)
- [ ] UI surface complete + reviewed
- [ ] Registry/cockpit controls present (`feature_registry`, activation state, rollout plan)
- [ ] Entitlement binding complete (including additive corporate handling)
- [ ] Permission scope + RLS + RPC contracts complete
- [ ] Confirmation gate behavior complete (Section 7.8)
- [ ] Governance events registered + emitted (fail-closed where required)
- [ ] Stress/degradation behavior defined (Section 15.0)
- [ ] Tests passing (unit/integration/e2e/replay as relevant)
- [ ] Founder sign-off criteria met

## Activation command language (required)

Use calm, explicit language in FOCL:

- "This feature is currently staged off. No user action is required right now."
- "To activate, complete the prerequisites listed below."
- "Current blockers: `<comma-separated blockers>`."
- "Next recommended action: `<single next action>`."

## Notes

- Do not leave inactive features with ambiguous status.
- Do not use urgency or coercive language.
- Keep one clear next action visible to founder operators.
