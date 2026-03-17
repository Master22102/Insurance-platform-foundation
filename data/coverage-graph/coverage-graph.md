# Coverage Graph
**Generated:** 2026-03-11 09:56 UTC
**Grounded in:** Section 3.2 CoverageNode + Section 3.3 Coverage Graph Model

## Statistics
- **total_nodes:** 319
- **total_edges:** 943
- **rule_nodes:** 230
- **document_nodes:** 41
- **family_nodes:** 9
- **clause_type_nodes:** 34
- **jurisdiction_nodes:** 5

## Node Types
| Type | Count |
|------|-------|
| documentation_rule | 56 |
| operational_limit | 52 |
| document | 41 |
| deadline | 39 |
| clause_type | 34 |
| liability_rule | 24 |
| threshold | 18 |
| rule | 18 |
| compensation_rule | 15 |
| source_family | 9 |
| jurisdiction | 5 |
| payment_condition | 4 |
| requirement | 3 |
| transport_condition | 1 |

## Edge Types
| Type | Count |
|------|-------|
| document_contains_rule | 230 |
| rule_originates_from_source_family | 230 |
| rule_belongs_to_clause_type | 230 |
| rule_has_limit | 76 |
| rule_requires_documentation | 56 |
| rule_has_deadline | 39 |
| rule_applies_to_jurisdiction | 39 |
| rule_depends_on | 20 |
| rule_has_threshold | 18 |
| rule_depends_on_payment_method | 4 |
| rule_depends_on_round_trip | 1 |

## Supported Query Patterns
1. "What rules apply to trip delay?" → Filter nodes by clause_type containing `trip_delay`
2. "What rules depend on common carrier?" → Follow `rule_depends_on_common_carrier` edges
3. "What documentation is required for baggage claims?" → Follow `rule_requires_documentation` edges from baggage rules
4. "Which rules are jurisdiction-specific?" → Follow `rule_applies_to_jurisdiction` edges
5. "What limits/caps/deadlines by source family?" → Filter by node_type + follow `rule_originates_from_source_family`
6. "Which rules are high-value operational?" → Filter by high_value=true + operational_or_requirement=operational