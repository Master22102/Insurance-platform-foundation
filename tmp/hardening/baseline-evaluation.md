# Baseline Evaluation Report
**Generated:** 2026-03-19T02:39:24.720708+00:00

## Summary
- Total Documents: 46
- Successful Parses: 46
- Failed Parses: 0
- Total Raw Candidates: 2164
- Total Consolidated: 1807
- Total Normalized: 1807
- Total Promoted Rules: 103
- Zero-Yield Docs: 7

## By Source Family
| Family | Count | Success | Candidates | Promoted |
|--------|-------|---------|------------|----------|
| airline | 14 | 14 | 666 | 38 |
| credit_card | 5 | 5 | 391 | 17 |
| cruise | 4 | 4 | 241 | 12 |
| insurance | 4 | 4 | 84 | 11 |
| rental | 4 | 4 | 178 | 8 |
| other | 7 | 7 | 47 | 6 |
| hotel | 3 | 3 | 144 | 5 |
| academic | 1 | 1 | 10 | 3 |
| eu_jurisdiction | 4 | 4 | 46 | 3 |

## By Artifact Type
| Type | Count | Success | Candidates | Promoted |
|------|-------|---------|------------|----------|
| pdf_native_text | 40 | 40 | 1568 | 93 |
| txt | 3 | 3 | 152 | 7 |
| mhtml | 2 | 2 | 83 | 3 |
| xml | 1 | 1 | 4 | 0 |

## Top Clause Families
| Clause Type | Count |
|-------------|-------|
| round_trip_requirement (req) | 395 |
| common_carrier_requirement (req) | 373 |
| payment_method_requirement (req) | 328 |
| refund_eligibility_rule (req) | 284 |
| claim_deadline_days (op) | 87 |
| trip_interruption_limit (op) | 71 |
| trip_cancellation_limit (op) | 53 |
| trip_delay_threshold (op) | 50 |
| baggage_liability_limit (op) | 31 |
| requires_medical_certificate (req) | 28 |
| requires_receipts (req) | 27 |
| requires_police_report (req) | 19 |
| hotel_cancellation_window (op) | 17 |
| requires_baggage_pir (req) | 17 |
| carrier_liability_cap (op) | 14 |

## Top 10 Strongest Documents
| Document | Family | Type | Promoted | Sections |
|----------|--------|------|----------|----------|
| southwest contract-of-carriage.pdf | airline | pdf_native_text | 6 | 219 |
| United Contract of Carriage.txt | airline | txt | 5 | 94 |
| amex return protection.pdf | credit_card | pdf_native_text | 5 | 5 |
| frontier contract of carriage.pdf | airline | pdf_native_text | 5 | 149 |
| premier world discovery travel protction.pdf | insurance | pdf_native_text | 5 | 7 |
| sun country airlines_Contract_of_Carriage.pdf | airline | pdf_native_text | 5 | 165 |
| Conditions of Carriage _ Ethiopian Airlines United | airline | pdf_native_text | 4 | 70 |
| EW-Benefit-Guide_314-399_EDT-10.20_REV_4.24_a11y2. | insurance | pdf_native_text | 4 | 49 |
| Royal_Caribbean_booklet_.pdf | rental | pdf_native_text | 4 | 112 |
| 2026 amex _Platinum_TermsandConditions.pdf | credit_card | pdf_native_text | 3 | 118 |

## Top 10 Weakest Documents
| Document | Family | Type | Promoted | Sections |
|----------|--------|------|----------|----------|
| G23.pdf | other | pdf_native_text | 0 | 3 |
| United Airlines Lenghty Tarmac Plan.txt | airline | txt | 0 | 2 |
| air-new-zealand-modern-slavery-act-statement-2023. | airline | pdf_native_text | 0 | 14 |
| budget-us-protections-coverages-brochure-010224.pd | rental | pdf_native_text | 0 | 10 |
| cellar_2f65bf46-8f8a-11ee-8aa6-01aa75ed71a1.xml | eu_jurisdiction | xml | 0 | 1682 |
| eu Documents..pdf | eu_jurisdiction | pdf_native_text | 0 | 33 |
| main.govpilot.com_web_public_b5c0642b-18f_Citizen- | other | pdf_native_text | 0 | 4 |
| 2025-2026-umass-international-travel-insurance-bro | insurance | pdf_native_text | 1 | 44 |
| 2026-2027-ACIS-International-Protection-Plans.pdf | other | pdf_native_text | 1 | 23 |
| Does Renters Insurance Cover Theft_ _ Progressive. | rental | pdf_native_text | 1 | 33 |

## Zero-Yield Documents
- G23.pdf
- United Airlines Lenghty Tarmac Plan.txt
- air-new-zealand-modern-slavery-act-statement-2023.pdf
- budget-us-protections-coverages-brochure-010224.pdf
- cellar_2f65bf46-8f8a-11ee-8aa6-01aa75ed71a1.xml
- eu Documents..pdf
- main.govpilot.com_web_public_b5c0642b-18f_Citizen-Incident-Reports-City-of-Elizabeth_uid=7414&ust=NJ&pu=1&id=0.pdf

## Confidence Distribution
| Tier | Count |
|------|-------|
| CONFLICT_PRESENT | 1630 |
| HIGH | 115 |
| DOCUMENTATION_INCOMPLETE | 49 |
| AMBIGUOUS | 7 |
| CONDITIONAL | 6 |