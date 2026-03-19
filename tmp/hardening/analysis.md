# System Analysis

Corpus: 46 documents
Parse success: 46/46
Promoted rules: 233

## Verified Weaknesses Addressed

1. Table extraction: Header inheritance added, row-value association improved
2. Number disambiguation: Contextual plausibility guard filters noise
3. Rule provenance: source_file, extraction_mode, artifact_type now tracked
4. EUR currency: Proper EUR unit detection (was hardcoded USD)
5. EU jurisdiction: 6 new clause families with phrase clusters
6. trip_interruption_limit: New cluster with 15 primary phrases
7. Text rule tightening: 3+ phrases required for text_rule HIGH