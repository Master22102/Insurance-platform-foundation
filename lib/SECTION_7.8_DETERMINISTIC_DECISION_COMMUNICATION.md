# Section 7.8 — Deterministic decision communication layer

## 7.8.0 Purpose & scope

Governs **how** interpretive outputs are structured for travelers: decisions, clause alignment, conflicts, exclusions, next steps, authority boundaries.

**Out of scope here:** emotional tone (**7.2**), confidence enum definitions (**9.2**), visual layout (**7.7**), logging (**8.4**), raw decision logic (**3.4**, **6.5.x**).

## 7.8.1 Core structural formula (mandatory)

Order for **all** interpretive outputs:

1. **Recorded fact**  
2. **Clause comparison**  
3. **Structural alignment or conflict**  
4. **Concrete next step**  
5. **Boundary statement**  

Applies to: coverage graph, claim routing, card benefit orchestration, case studies, crisis evaluations, etc.

## 7.8.2 Structural authority vocabulary

**Approved (examples):**

- “This aligns with the stated criteria under Section X.”  
- “No exclusion is indicated under the reviewed sections.”  
- “An exclusion applies under Section X.”  
- “This does not meet the stated threshold at this time.”  
- “This assessment reflects the current documentation.”  

**Prohibited:** “You qualify,” “You’re covered,” “Guaranteed,” “Best option,” “Very likely to win,” predictive payout language.

## 7.8.3 Boundary statement standard

Include **once** per interpretive output, e.g.:

> Final review is performed by the benefit administrator.

Requirements: once per output; not a hedge before alignment; does not undermine structural clarity.

*Align in-app `InterpretiveBoundaryNotice` copy to this standard if verbatim match is required.*

## 7.8.4 Causality communication

- Cause not established → document that documentation does not establish confirmed cause.  
- Conflict → structural statement (e.g. carrier docs vs timeline); no speculation.

## 7.8.5 Ambiguity communication

Surface ambiguity with context (e.g. undefined term + “prior interpretations have varied”). Avoid vague “unclear” / “we’re not sure” alone.

## 7.8.6 Elevated & ManualOnly communication

Plain-language disruption/queue messaging; ManualOnly: automatic submission unavailable, manual still available, user not blamed. Cross-ref **6.7.1**, **12.6**.

## 7.8.7 Enforcement

Outputs must comply with **7.2**, **9.2**, **8.4**, **12.6**, **15** (stress).
