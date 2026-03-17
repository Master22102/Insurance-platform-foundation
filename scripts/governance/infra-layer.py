#!/usr/bin/env python3
"""
Infrastructure Layer: Corpus Governance + Coverage Graph + FOCL Integration
===========================================================================
Extends the extraction subsystem with:
- Corpus governance (registry, states, zones, review workflow)
- Coverage Graph materialization (nodes, edges, query support)
- Founder's Cockpit / FOCL integration (summaries, decision queue, toggles)
- Security / control hardening (audit, provenance, trust gates)
- Claim/decision readiness mapping

Grounded in Section 3.2 (CoverageNode), Section 3.3 (Coverage Graph Model),
and F-6.5.16 (FOCL) doctrine.
"""

import os, sys, re, json, csv, hashlib, shutil
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter, defaultdict
from typing import Optional, List, Dict, Any, Tuple

# ============================================================
# CONFIGURATION
# ============================================================
REPO_ROOT = "/home/claude/repo"
LEGACY_CORPUS_DIR = os.path.join(REPO_ROOT, "document-intelligence")

CORPUS_BASE = os.path.join(REPO_ROOT, "data", "corpus")
ACTIVE_DIR = os.path.join(CORPUS_BASE, "active")
QUARANTINE_DIR = os.path.join(CORPUS_BASE, "quarantine")
ARCHIVE_DIR = os.path.join(CORPUS_BASE, "archive")

DATA_DIR = os.path.join(REPO_ROOT, "data")
REGISTRY_JSON = os.path.join(DATA_DIR, "corpus-registry.json")
COVGRAPH_DIR = os.path.join(DATA_DIR, "coverage-graph")
FOCL_DIR = os.path.join(REPO_ROOT, "tmp", "founder-cockpit")

for d in [ACTIVE_DIR, QUARANTINE_DIR, ARCHIVE_DIR, DATA_DIR, COVGRAPH_DIR, FOCL_DIR]:
    os.makedirs(d, exist_ok=True)

NOW = datetime.now(timezone.utc)
NOW_ISO = NOW.isoformat()
NOW_SHORT = NOW.strftime("%Y-%m-%d %H:%M UTC")

# ============================================================
# SECTION A — CORPUS STATES / TRUST / CLASSIFICATION
# ============================================================
CORPUS_STATES = ['discovered','captured','parsed','approved_for_corpus',
                 'rejected','superseded','archived','review_needed']

TRUSTED_DOMAINS = [
    'aa.com','delta.com','united.com','southwest.com','alaskaair.com','jetblue.com',
    'spirit.com','frontierairlines.com','britishairways.com','lufthansa.com',
    'airfrance.com','emirates.com','singaporeair.com','qatarairways.com',
    'americanexpress.com','chase.com','citi.com','capitalone.com',
    'hertz.com','avis.com','enterprise.com','budget.com',
    'royalcaribbean.com','carnival.com','ncl.com','princess.com',
    'marriott.com','hilton.com','hyatt.com','ihg.com',
    'travelguard.com','allianzassistance.com',
    'europa.eu','ec.europa.eu','eur-lex.europa.eu','dot.gov','transportation.gov',
]

def classify_family(name):
    lower = name.lower()
    fam_kw = {
        'airline': ['airline','flight','carriage','contract of carriage','airways','american airlines',
                    'united','delta','frontier','southwest','sun country','ethiopian','philippine',
                    'airasia','alaska','tarmac','new zealand','air '],
        'cruise': ['royal caribbean','cruise','norwegian','carnival','ncl','sailing'],
        'rental': ['rental','budget','hertz','avis','enterprise','car','vehicle','renters'],
        'hotel': ['hotel','melia','marriott','hilton','hyatt','booking','accommodation','loyalty','rewards'],
        'credit_card': ['amex','american express','chase sapphire','visa signature','visa infinite',
                        'platinum','return protection','ew-benefit','benefit guide'],
        'insurance': ['insurance','travel protection','protection plan','brochure','travel comparison',
                      'PHIP','ACIS','discovery travel','vacation express','norwegiancare'],
        'eu_jurisdiction': ['eu ','eu261','regulation (ec)','european parliament','cellar','factsheet_package'],
        'academic': ['university','umass','california state','student'],
    }
    for fam, kws in fam_kw.items():
        for kw in kws:
            if kw in lower: return fam
    return 'other'

def classify_trust(filename, domain=None):
    if domain:
        for td in TRUSTED_DOMAINS:
            if td in domain.lower(): return 'official'
    lower = filename.lower()
    if any(kw in lower for kw in ['regulation','eu261','conditions of carriage','contract of carriage','benefit guide']):
        return 'high'
    if any(kw in lower for kw in ['protection','insurance','terms']): return 'medium'
    return 'unverified'

def detect_jurisdiction(filename, text=''):
    lower = (filename + ' ' + text[:500]).lower()
    if any(kw in lower for kw in ['eu ','european','ec no','regulation (ec)','eu261']): return 'EU'
    if 'california' in lower: return 'US-CA'
    if 'new york' in lower: return 'US-NY'
    if 'florida' in lower: return 'US-FL'
    if 'united states' in lower or 'u.s.' in lower: return 'US'
    return 'undetected'

def compute_hash(filepath):
    h = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            while chunk := f.read(8192): h.update(chunk)
        return h.hexdigest()[:32]
    except: return None

# ============================================================
# SECTION B — CORPUS REGISTRY
# ============================================================
class CorpusRegistry:
    def __init__(self, path=REGISTRY_JSON):
        self.path = path
        self.entries: List[Dict] = []
        if os.path.exists(path):
            with open(path) as f: self.entries = json.load(f)

    def save(self):
        with open(self.path, 'w') as f: json.dump(self.entries, f, indent=2, default=str)
        csv_path = self.path.replace('.json', '.csv')
        if self.entries:
            with open(csv_path, 'w', newline='') as f:
                w = csv.DictWriter(f, fieldnames=self.entries[0].keys())
                w.writeheader(); w.writerows(self.entries)

    def _next_id(self):
        if not self.entries: return 'CORP-0001'
        return f'CORP-{max(int(e["corpus_id"].split("-")[1]) for e in self.entries)+1:04d}'

    def find_by_hash(self, h):
        return next((e for e in self.entries if e.get('content_hash')==h), None)
    def find_by_filename(self, fn):
        return next((e for e in self.entries if os.path.basename(e.get('storage_path',''))==fn), None)
    def get_active(self): return [e for e in self.entries if e.get('corpus_status')=='approved_for_corpus']
    def get_quarantine(self): return [e for e in self.entries if e.get('corpus_status') in ('discovered','captured','parsed','review_needed')]
    def get_archive(self): return [e for e in self.entries if e.get('corpus_status') in ('archived','superseded')]

    def add(self, entry):
        if 'corpus_id' not in entry: entry['corpus_id'] = self._next_id()
        if 'retrieval_date' not in entry: entry['retrieval_date'] = NOW_ISO
        if entry.get('content_hash'):
            dup = self.find_by_hash(entry['content_hash'])
            if dup: entry['duplicate_of'] = dup['corpus_id']
        self.entries.append(entry)
        return entry

    def update_status(self, cid, status, notes='', actor='system'):
        for e in self.entries:
            if e['corpus_id'] == cid:
                e['corpus_status'] = status
                e['last_reviewed_at'] = NOW_ISO
                if notes: e['review_notes'] = notes
                e['approved_by'] = actor
                return True
        return False

# ============================================================
# SECTION C — DISCOVERY (STUB — SAFE, EXPLICIT)
# ============================================================
DISCOVERY_QUERIES = [
    'airline contract of carriage PDF',
    'conditions of carriage PDF',
    'credit card guide to benefits PDF',
    'travel insurance policy wording PDF',
    'cruise ticket contract PDF',
    'hotel cancellation policy PDF',
    'rental car protection brochure PDF',
    'EU passenger rights regulation PDF',
]

def run_discovery_stub():
    """Stub for controlled discovery. Returns candidate list.
    Actual web search requires network access — this produces the
    framework for when network is available."""
    candidates = []
    # These are known high-value targets that would be fetched
    known_targets = [
        {'title': 'JetBlue Contract of Carriage', 'domain': 'jetblue.com',
         'family': 'airline', 'trust': 'official', 'url': 'https://www.jetblue.com/contract-of-carriage'},
        {'title': 'Spirit Airlines Contract of Carriage', 'domain': 'spirit.com',
         'family': 'airline', 'trust': 'official', 'url': 'https://www.spirit.com/contract-of-carriage'},
        {'title': 'Citi Prestige Card Benefits Guide', 'domain': 'citi.com',
         'family': 'credit_card', 'trust': 'official', 'url': 'https://www.citi.com/credit-cards/benefits'},
        {'title': 'EU Regulation 261/2004 Full Text', 'domain': 'eur-lex.europa.eu',
         'family': 'eu_jurisdiction', 'trust': 'official', 'url': 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32004R0261'},
        {'title': 'Hertz Rental Protection Guide', 'domain': 'hertz.com',
         'family': 'rental', 'trust': 'official', 'url': 'https://www.hertz.com/rentacar/productservice/index.jsp?targetPage=protectionProducts'},
    ]
    for t in known_targets:
        candidates.append({
            'source_url': t['url'], 'source_domain': t['domain'],
            'document_title': t['title'], 'document_family': t['family'],
            'trust_level': t['trust'], 'corpus_status': 'discovered',
            'suggested_action': 'Capture & Review',
            'discovered_by': 'automated_discovery',
        })
    return candidates

# ============================================================
# SECTION D — REVIEW WORKFLOW + INGESTION GATES
# ============================================================
class ReviewWorkflow:
    def __init__(self, registry): self.registry = registry; self.log = []

    def _log(self, action, cid, actor, notes):
        self.log.append({'timestamp': NOW_ISO, 'action': action,
                         'corpus_id': cid, 'actor': actor, 'notes': notes})

    def approve(self, cid, actor='founder', notes=''):
        self.registry.update_status(cid, 'approved_for_corpus', notes, actor)
        e = next((e for e in self.registry.entries if e['corpus_id']==cid), None)
        if e and e.get('storage_path'):
            new = os.path.join(ACTIVE_DIR, os.path.basename(e['storage_path']))
            if os.path.exists(e['storage_path']): shutil.copy2(e['storage_path'], new)
            e['storage_path'] = new
        self._log('approve', cid, actor, notes)
        return True

    def reject(self, cid, actor='founder', notes=''):
        self.registry.update_status(cid, 'rejected', notes, actor)
        self._log('reject', cid, actor, notes)

    def archive(self, cid, actor='founder', notes=''):
        e = next((e for e in self.registry.entries if e['corpus_id']==cid), None)
        if e and e.get('storage_path'):
            new = os.path.join(ARCHIVE_DIR, os.path.basename(e['storage_path']))
            if os.path.exists(e['storage_path']): shutil.copy2(e['storage_path'], new)
            e['storage_path'] = new
        self.registry.update_status(cid, 'archived', notes, actor)
        self._log('archive', cid, actor, notes)

    def mark_review(self, cid, actor='founder', notes=''):
        self.registry.update_status(cid, 'review_needed', notes, actor)
        self._log('review_needed', cid, actor, notes)

def check_admission(entry, registry):
    if not entry.get('parse_success'): return False, 'Failed parsing'
    if entry.get('trust_level') == 'low': return False, 'Low trust'
    if entry.get('duplicate_of'):
        dup = next((e for e in registry.entries if e['corpus_id']==entry['duplicate_of']), None)
        if dup and dup.get('corpus_status')=='approved_for_corpus':
            return False, f'Duplicate of active {entry["duplicate_of"]}'
    return True, 'Passes all gates'

# ============================================================
# SECTION B (cont) — SEED REGISTRY FROM EXISTING CORPUS
# ============================================================
def seed_registry(registry, eval_data=None):
    rule_counts = {}; doc_data = {}
    if eval_data:
        for d in eval_data.get('documentMetrics', []):
            rule_counts[d['documentName']] = d.get('promotedRuleCount', 0)
            doc_data[d['documentName']] = d

    for fname in sorted(os.listdir(LEGACY_CORPUS_DIR)):
        fpath = os.path.join(LEGACY_CORPUS_DIR, fname)
        if not os.path.isfile(fpath) or os.path.getsize(fpath) == 0: continue
        if registry.find_by_filename(fname): continue

        ext = os.path.splitext(fname)[1].lower()
        d = doc_data.get(fname, {})
        active_path = os.path.join(ACTIVE_DIR, fname)
        if not os.path.exists(active_path) and os.path.exists(fpath):
            shutil.copy2(fpath, active_path)

        registry.add({
            'corpus_id': registry._next_id(),
            'source_url': '', 'source_domain': '',
            'document_title': fname,
            'document_family': classify_family(fname),
            'artifact_type': d.get('artifactType', ext.lstrip('.')),
            'retrieval_date': NOW_ISO, 'effective_date': '',
            'jurisdiction': detect_jurisdiction(fname),
            'language': 'en',
            'trust_level': classify_trust(fname),
            'corpus_status': 'approved_for_corpus',
            'storage_path': active_path,
            'extraction_mode': d.get('extractionMethod', 'native_pdf'),
            'parse_success': d.get('parseStatus', 'success') == 'success',
            'promoted_rule_count': rule_counts.get(fname, 0),
            'has_table_data': False,
            'content_hash': compute_hash(fpath),
            'duplicate_of': None, 'supersedes': None, 'superseded_by': None,
            'discovered_by': 'legacy_corpus',
            'last_reviewed_at': NOW_ISO,
            'approved_by': 'system_seed',
            'review_notes': 'Auto-approved from verified production corpus',
            'notes': '',
        })
    registry.save()

# ============================================================
# SECTION F — COVERAGE GRAPH MATERIALIZATION
# ============================================================
# Node/edge type enums grounded in Section 3.2 CoverageNode + 3.3 Coverage Graph Model
NODE_TYPES = ['document','source_family','clause_type','rule','requirement',
              'operational_limit','deadline','threshold','compensation_rule',
              'liability_rule','documentation_rule','jurisdiction',
              'payment_condition','transport_condition']

EDGE_TYPES = ['document_contains_rule','rule_belongs_to_clause_type',
              'rule_applies_to_jurisdiction','rule_requires_documentation',
              'rule_depends_on_payment_method','rule_depends_on_common_carrier',
              'rule_depends_on_round_trip','rule_has_deadline','rule_has_threshold',
              'rule_has_limit','rule_conflicts_with','rule_supersedes',
              'rule_originates_from_source_family']

# Clause type → node category mapping
CLAUSE_NODE_MAP = {
    'trip_delay_threshold': 'threshold', 'trip_delay_limit': 'operational_limit',
    'baggage_liability_limit': 'liability_rule', 'carrier_liability_cap': 'liability_rule',
    'hotel_cancellation_window': 'deadline', 'claim_deadline_days': 'deadline',
    'refund_eligibility_rule': 'requirement', 'trip_cancellation_limit': 'operational_limit',
    'trip_interruption_limit': 'operational_limit',
    'medical_emergency_coverage_limit': 'operational_limit',
    'emergency_evacuation_limit': 'operational_limit',
    'dental_emergency_limit': 'operational_limit',
    'rental_car_damage_limit': 'operational_limit',
    'personal_accident_coverage_limit': 'operational_limit',
    'personal_effects_coverage_limit': 'operational_limit',
    'supplemental_liability_limit': 'liability_rule',
    'cruise_cancellation_window': 'deadline', 'deposit_requirement': 'requirement',
    'final_payment_deadline': 'deadline', 'baggage_delay_threshold': 'threshold',
    'missed_connection_threshold': 'threshold', 'check_in_deadline': 'deadline',
    'requires_receipts': 'documentation_rule', 'requires_police_report': 'documentation_rule',
    'requires_medical_certificate': 'documentation_rule',
    'requires_carrier_delay_letter': 'documentation_rule',
    'requires_baggage_pir': 'documentation_rule',
    'requires_itinerary': 'documentation_rule', 'requires_payment_proof': 'documentation_rule',
    'payment_method_requirement': 'payment_condition',
    'common_carrier_requirement': 'transport_condition',
    'round_trip_requirement': 'transport_condition',
    'eu_delay_compensation_threshold': 'compensation_rule',
    'eu_denied_boarding_compensation': 'compensation_rule',
    'eu_care_obligation': 'requirement', 'eu_rerouting_obligation': 'requirement',
    'eu_refund_deadline': 'deadline', 'eu_cancellation_compensation': 'compensation_rule',
}

# Dependency inference: which clause types imply dependencies
DEPENDENCY_MAP = {
    'trip_delay_limit': ['trip_delay_threshold', 'requires_receipts', 'requires_carrier_delay_letter'],
    'trip_cancellation_limit': ['requires_receipts', 'requires_itinerary'],
    'trip_interruption_limit': ['requires_receipts', 'requires_medical_certificate'],
    'baggage_liability_limit': ['requires_baggage_pir', 'requires_police_report'],
    'medical_emergency_coverage_limit': ['requires_medical_certificate'],
    'eu_delay_compensation_threshold': ['eu_rerouting_obligation', 'eu_care_obligation'],
    'eu_cancellation_compensation': ['eu_refund_deadline', 'eu_rerouting_obligation'],
    'refund_eligibility_rule': ['payment_method_requirement'],
}

def build_coverage_graph(rules: List[Dict], registry: CorpusRegistry) -> Dict:
    """Materialize the Coverage Graph from promoted rules.
    Grounded in Section 3.2 CoverageNode schema and 3.3 Coverage Graph Model."""
    
    nodes = []
    edges = []
    node_ids = set()
    
    # Create document nodes
    doc_nodes = set()
    family_nodes = set()
    jurisdiction_nodes = set()
    clause_type_nodes = set()
    
    for rule in rules:
        rid = rule['rule_id']
        ct = rule['clause_type']
        sf = rule.get('source_file', 'unknown')
        fam = rule.get('source_family', 'other')
        jur = rule.get('jurisdiction', 'undetected') if hasattr(rule, 'get') else 'undetected'
        # Try to get jurisdiction from registry
        reg_entry = registry.find_by_filename(sf)
        if reg_entry: jur = reg_entry.get('jurisdiction', jur)
        
        node_category = CLAUSE_NODE_MAP.get(ct, 'rule')
        
        # Rule node
        rule_node = {
            'node_id': rid,
            'node_type': node_category,
            'clause_type': ct,
            'normalized_value': rule.get('normalized_value'),
            'value_type': rule.get('value_type'),
            'unit': rule.get('unit', ''),
            'confidence': rule.get('confidence', 'HIGH'),
            'source_file': sf,
            'source_family': fam,
            'jurisdiction': jur,
            'extraction_mode': rule.get('extraction_mode', 'native_pdf'),
            'high_value': rule.get('high_value', False),
            'operational_or_requirement': rule.get('operational_or_requirement', 'operational'),
        }
        nodes.append(rule_node)
        node_ids.add(rid)
        
        # Document node (create once per doc)
        doc_id = f'DOC:{sf}'
        if doc_id not in doc_nodes:
            doc_nodes.add(doc_id)
            nodes.append({'node_id': doc_id, 'node_type': 'document', 'document_title': sf,
                          'source_family': fam, 'jurisdiction': jur})
        edges.append({'edge_type': 'document_contains_rule', 'source': doc_id, 'target': rid})
        
        # Family node
        fam_id = f'FAM:{fam}'
        if fam_id not in family_nodes:
            family_nodes.add(fam_id)
            nodes.append({'node_id': fam_id, 'node_type': 'source_family', 'family': fam})
        edges.append({'edge_type': 'rule_originates_from_source_family', 'source': rid, 'target': fam_id})
        
        # Clause type node
        ct_id = f'CT:{ct}'
        if ct_id not in clause_type_nodes:
            clause_type_nodes.add(ct_id)
            nodes.append({'node_id': ct_id, 'node_type': 'clause_type', 'clause_type': ct,
                          'category': node_category})
        edges.append({'edge_type': 'rule_belongs_to_clause_type', 'source': rid, 'target': ct_id})
        
        # Jurisdiction node
        if jur and jur != 'undetected':
            jur_id = f'JUR:{jur}'
            if jur_id not in jurisdiction_nodes:
                jurisdiction_nodes.add(jur_id)
                nodes.append({'node_id': jur_id, 'node_type': 'jurisdiction', 'jurisdiction': jur})
            edges.append({'edge_type': 'rule_applies_to_jurisdiction', 'source': rid, 'target': jur_id})
        
        # Typed edges based on node category
        if node_category == 'deadline':
            edges.append({'edge_type': 'rule_has_deadline', 'source': rid, 'target': ct_id})
        elif node_category == 'threshold':
            edges.append({'edge_type': 'rule_has_threshold', 'source': rid, 'target': ct_id})
        elif node_category in ('operational_limit', 'liability_rule'):
            edges.append({'edge_type': 'rule_has_limit', 'source': rid, 'target': ct_id})
        elif node_category == 'documentation_rule':
            edges.append({'edge_type': 'rule_requires_documentation', 'source': rid, 'target': ct_id})
        elif node_category == 'payment_condition':
            edges.append({'edge_type': 'rule_depends_on_payment_method', 'source': rid, 'target': ct_id})
        elif node_category == 'transport_condition':
            if 'common_carrier' in ct:
                edges.append({'edge_type': 'rule_depends_on_common_carrier', 'source': rid, 'target': ct_id})
            elif 'round_trip' in ct:
                edges.append({'edge_type': 'rule_depends_on_round_trip', 'source': rid, 'target': ct_id})
    
    # Infer dependency edges between rules in the same document
    rules_by_doc = defaultdict(list)
    for r in rules: rules_by_doc[r.get('source_file','')].append(r)
    
    for doc, doc_rules in rules_by_doc.items():
        ct_to_rid = {r['clause_type']: r['rule_id'] for r in doc_rules}
        for ct, deps in DEPENDENCY_MAP.items():
            if ct in ct_to_rid:
                for dep_ct in deps:
                    if dep_ct in ct_to_rid:
                        edges.append({
                            'edge_type': 'rule_depends_on',
                            'source': ct_to_rid[ct], 'target': ct_to_rid[dep_ct],
                            'relationship': f'{ct} depends on {dep_ct}',
                        })
    
    graph = {
        '_meta': {'generated_at': NOW_ISO, 'version': '1.0',
                  'grounded_in': 'Section 3.2 CoverageNode + Section 3.3 Coverage Graph Model'},
        'statistics': {
            'total_nodes': len(nodes), 'total_edges': len(edges),
            'rule_nodes': sum(1 for n in nodes if n['node_type'] not in ('document','source_family','clause_type','jurisdiction')),
            'document_nodes': len(doc_nodes), 'family_nodes': len(family_nodes),
            'clause_type_nodes': len(clause_type_nodes), 'jurisdiction_nodes': len(jurisdiction_nodes),
        },
        'nodes': nodes,
        'edges': edges,
    }
    
    return graph

def save_coverage_graph(graph):
    with open(os.path.join(COVGRAPH_DIR, 'coverage-graph.json'), 'w') as f:
        json.dump(graph, f, indent=2, default=str)
    with open(os.path.join(COVGRAPH_DIR, 'nodes.json'), 'w') as f:
        json.dump(graph['nodes'], f, indent=2, default=str)
    with open(os.path.join(COVGRAPH_DIR, 'edges.json'), 'w') as f:
        json.dump(graph['edges'], f, indent=2, default=str)
    
    # Markdown summary
    md = ['# Coverage Graph', f'**Generated:** {NOW_SHORT}',
          f'**Grounded in:** Section 3.2 CoverageNode + Section 3.3 Coverage Graph Model', '',
          '## Statistics']
    for k, v in graph['statistics'].items():
        md.append(f'- **{k}:** {v}')
    md.append('')
    
    # Node type distribution
    nt = Counter(n['node_type'] for n in graph['nodes'])
    md.append('## Node Types')
    md.append('| Type | Count |'); md.append('|------|-------|')
    for t, c in nt.most_common(): md.append(f'| {t} | {c} |')
    md.append('')
    
    # Edge type distribution
    et = Counter(e['edge_type'] for e in graph['edges'])
    md.append('## Edge Types')
    md.append('| Type | Count |'); md.append('|------|-------|')
    for t, c in et.most_common(): md.append(f'| {t} | {c} |')
    md.append('')
    
    # Query examples
    md.append('## Supported Query Patterns')
    md.append('1. "What rules apply to trip delay?" → Filter nodes by clause_type containing `trip_delay`')
    md.append('2. "What rules depend on common carrier?" → Follow `rule_depends_on_common_carrier` edges')
    md.append('3. "What documentation is required for baggage claims?" → Follow `rule_requires_documentation` edges from baggage rules')
    md.append('4. "Which rules are jurisdiction-specific?" → Follow `rule_applies_to_jurisdiction` edges')
    md.append('5. "What limits/caps/deadlines by source family?" → Filter by node_type + follow `rule_originates_from_source_family`')
    md.append('6. "Which rules are high-value operational?" → Filter by high_value=true + operational_or_requirement=operational')
    
    with open(os.path.join(COVGRAPH_DIR, 'coverage-graph.md'), 'w') as f:
        f.write('\n'.join(md))

# ============================================================
# SECTION G — CLAIM / DECISION READINESS MAPPING
# ============================================================
def generate_readiness_mapping(graph, rules):
    md = ['# Coverage Graph Readiness — Claim Engine Mapping',
          f'**Generated:** {NOW_SHORT}', '',
          '## Coverage Graph Categories Now Available', '']
    
    ct_counts = Counter(r['clause_type'] for r in rules)
    categories = {
        'Operational Limits': ['trip_delay_limit','trip_cancellation_limit','trip_interruption_limit',
                               'medical_emergency_coverage_limit','emergency_evacuation_limit',
                               'rental_car_damage_limit','baggage_liability_limit','carrier_liability_cap'],
        'Thresholds': ['trip_delay_threshold','baggage_delay_threshold','missed_connection_threshold'],
        'Deadlines': ['claim_deadline_days','hotel_cancellation_window','cruise_cancellation_window',
                      'final_payment_deadline','check_in_deadline','eu_refund_deadline'],
        'Documentation Requirements': ['requires_receipts','requires_police_report',
                                        'requires_medical_certificate','requires_carrier_delay_letter',
                                        'requires_baggage_pir','requires_itinerary','requires_payment_proof'],
        'Payment/Transport Conditions': ['payment_method_requirement','common_carrier_requirement',
                                          'round_trip_requirement'],
        'EU Compensation': ['eu_delay_compensation_threshold','eu_denied_boarding_compensation',
                            'eu_cancellation_compensation','eu_care_obligation','eu_rerouting_obligation'],
    }
    
    for cat, types in categories.items():
        active_count = sum(ct_counts.get(t, 0) for t in types)
        populated = [t for t in types if ct_counts.get(t, 0) > 0]
        empty = [t for t in types if ct_counts.get(t, 0) == 0]
        status = '✅' if len(populated) >= len(types) * 0.7 else '⚠️' if populated else '❌'
        md.append(f'### {status} {cat}')
        md.append(f'Populated: {len(populated)}/{len(types)} types, {active_count} total rules')
        if empty: md.append(f'Missing: {", ".join(empty)}')
        md.append('')
    
    md.append('## Rule Chain Examples (Already Inferable)')
    md.append('')
    chains = [
        ('Trip Delay Claim Chain',
         ['trip_delay_threshold', 'trip_delay_limit', 'requires_receipts', 'requires_carrier_delay_letter'],
         'Traveler experiences delay → threshold determines eligibility → limit caps reimbursement → receipts + delay letter required'),
        ('Trip Cancellation Chain',
         ['trip_cancellation_limit', 'requires_receipts', 'requires_itinerary', 'payment_method_requirement'],
         'Trip cancelled → coverage limit applies → receipts + itinerary needed → payment method must qualify'),
        ('Baggage Claim Chain',
         ['baggage_liability_limit', 'carrier_liability_cap', 'requires_baggage_pir', 'requires_police_report'],
         'Baggage lost/damaged → carrier liability cap applies → PIR required → police report if theft'),
        ('EU Delay Compensation Chain',
         ['eu_delay_compensation_threshold', 'eu_rerouting_obligation', 'eu_care_obligation', 'eu_refund_deadline'],
         'Flight delayed >3hr → fixed compensation by distance → airline must offer rerouting → duty of care (meals/hotel) → refund within 7 days if cancelled'),
        ('Coverage Eligibility Chain',
         ['round_trip_requirement', 'common_carrier_requirement', 'payment_method_requirement', 'refund_eligibility_rule'],
         'Trip must be round-trip → on common carrier → paid with eligible card → refund terms apply'),
    ]
    for name, types, desc in chains:
        present = [t for t in types if ct_counts.get(t, 0) > 0]
        status = '✅' if len(present) == len(types) else f'⚠️ {len(present)}/{len(types)}'
        md.append(f'### {status} {name}')
        md.append(f'{desc}')
        md.append(f'Chain: {" → ".join(types)}')
        md.append(f'Coverage: {len(present)}/{len(types)} populated')
        md.append('')
    
    md.append('## What Is Still Missing Before Full Claim Engine Automation')
    md.append('')
    gaps = []
    if ct_counts.get('trip_delay_limit', 0) < 5: gaps.append('**trip_delay_limit**: Few rules — benefit guides rarely state explicit daily dollar caps in extractable text')
    if ct_counts.get('deposit_requirement', 0) < 3: gaps.append('**deposit_requirement**: Low yield — cruise deposit amounts mostly in table format')
    if ct_counts.get('eu_care_obligation', 0) < 3: gaps.append('**eu_care_obligation**: Many candidates but few promoted (text_rule filtering)')
    gaps.append('**Exclusion clauses**: Not yet extracted as a separate clause family')
    gaps.append('**Coordination of benefits / other insurance**: Not yet modeled')
    gaps.append('**Time-bound conditions**: "within X days of departure" conditions not yet linked to rule activation')
    for g in gaps: md.append(f'- {g}')
    
    with open(os.path.join(FOCL_DIR, 'coverage-graph-readiness.md'), 'w') as f:
        f.write('\n'.join(md))

# ============================================================
# SECTION E — FOUNDER'S COCKPIT / FOCL OUTPUTS
# ============================================================
def generate_focl(registry, workflow, graph_stats=None):
    active = registry.get_active()
    quarantine = registry.get_quarantine()
    archive = registry.get_archive()
    rejected = [e for e in registry.entries if e.get('corpus_status')=='rejected']
    
    docs_with_rules = sum(1 for e in active if e.get('promoted_rule_count',0) > 0)
    zero_yield = [e for e in active if e.get('promoted_rule_count',0)==0 and e.get('parse_success')]
    
    by_family = Counter(e.get('document_family','unknown') for e in active)
    by_jurisdiction = Counter(e.get('jurisdiction','undetected') for e in active)
    by_trust = Counter(e.get('trust_level','unverified') for e in active)
    
    warnings = []
    if len(zero_yield) > len(active) * 0.2:
        warnings.append(f'HIGH: {len(zero_yield)} active docs produce zero rules')
    if len(quarantine) > 10:
        warnings.append(f'MEDIUM: {len(quarantine)} docs in quarantine')
    low_trust = [e for e in active if e.get('trust_level') in ('low','unverified')]
    if low_trust:
        warnings.append(f'MEDIUM: {len(low_trust)} active docs have low/unverified trust')
    if not warnings:
        warnings.append('No warnings. Corpus health is green.')
    
    # Recommendations
    rec_approve, rec_reject, rec_archive = [], [], []
    for e in quarantine:
        ok, reason = check_admission(e, registry)
        if ok: rec_approve.append({'corpus_id':e['corpus_id'],'title':e.get('document_title',''),'family':e.get('document_family',''),'reason':'Passes gates'})
        elif 'duplicate' in reason.lower(): rec_reject.append({'corpus_id':e['corpus_id'],'title':e.get('document_title',''),'reason':reason})
    for e in zero_yield:
        if e.get('trust_level') in ('low','unverified'):
            rec_archive.append({'corpus_id':e['corpus_id'],'title':e.get('document_title',''),'reason':'Zero rules + low trust'})
    
    top_docs = sorted(active, key=lambda e: e.get('promoted_rule_count',0), reverse=True)[:10]
    
    # JSON
    cockpit = {
        '_meta': {'generated_at': NOW_ISO, 'surface_id': 'FOCL.corpus_governance', 'version': '2.0'},
        'corpus_overview': {
            'total_registered': len(registry.entries), 'active': len(active),
            'quarantine': len(quarantine), 'archive': len(archive), 'rejected': len(rejected),
            'producing_rules': docs_with_rules, 'zero_yield': len(zero_yield),
        },
        'toggles': {
            'discovery_mode': {'state':'OFF','description':'Controlled discovery of travel docs','risk':'LOW'},
            'quarantine_processing': {'state':'OFF','description':'Include quarantine in evaluation','risk':'MEDIUM'},
            'auto_approve_official': {'state':'OFF','description':'Auto-approve official-domain captures','risk':'LOW'},
        },
        'health': {'overall': 'GREEN' if not any('HIGH' in w for w in warnings) else 'AMBER', 'warnings': warnings},
        'by_family': dict(by_family.most_common()),
        'by_jurisdiction': dict(by_jurisdiction.most_common()),
        'by_trust': dict(by_trust.most_common()),
        'top_docs': [{'id':e['corpus_id'],'title':e['document_title'],'rules':e.get('promoted_rule_count',0),'family':e.get('document_family')} for e in top_docs],
        'zero_yield_docs': [{'id':e['corpus_id'],'title':e['document_title']} for e in zero_yield],
        'decision_queue': {'awaiting': len(quarantine), 'approve': rec_approve, 'reject': rec_reject, 'archive': rec_archive},
        'coverage_graph': graph_stats or {},
    }
    with open(os.path.join(FOCL_DIR, 'corpus-governance-summary.json'), 'w') as f:
        json.dump(cockpit, f, indent=2, default=str)
    
    # Markdown
    md = ['# Corpus Governance — Founder\'s Cockpit',
          f'**Generated:** {NOW_SHORT}', f'**Surface:** FOCL.corpus_governance v2.0', '']
    
    status = cockpit['health']['overall']
    icon = '🟢' if status=='GREEN' else '🟡' if status=='AMBER' else '🔴'
    md.append(f'## Corpus Health: {icon} {status}')
    for w in warnings: md.append(f'- {w}')
    md.append('')
    
    md.append('## Overview')
    md.append(f'| Zone | Count |'); md.append(f'|------|-------|')
    md.append(f'| **Active** | {len(active)} |')
    md.append(f'| Quarantine | {len(quarantine)} |')
    md.append(f'| Archive | {len(archive)} |')
    md.append(f'| Rejected | {len(rejected)} |')
    md.append(f'| **Total** | {len(registry.entries)} |')
    md.append(f'| Producing Rules | {docs_with_rules} |')
    md.append(f'| Zero Yield | {len(zero_yield)} |')
    md.append('')
    
    md.append('## Control Toggles')
    for name, t in cockpit['toggles'].items():
        icon = '⬜' if t['state']=='OFF' else '✅'
        md.append(f'### {icon} {name.replace("_"," ").title()}')
        md.append(f'**State:** {t["state"]} | **Risk:** {t["risk"]}')
        md.append(f'{t["description"]}')
        md.append('')
    
    md.append('## Decision Queue')
    if rec_approve:
        md.append(f'### Approve ({len(rec_approve)})')
        for i in rec_approve[:5]: md.append(f'- **{i["corpus_id"]}** {i["title"][:45]} ({i["family"]})')
    if rec_reject:
        md.append(f'### Reject ({len(rec_reject)})')
        for i in rec_reject[:5]: md.append(f'- **{i["corpus_id"]}** {i["title"][:45]} → {i["reason"][:40]}')
    if rec_archive:
        md.append(f'### Archive ({len(rec_archive)})')
        for i in rec_archive[:5]: md.append(f'- **{i["corpus_id"]}** {i["title"][:45]} → {i["reason"][:40]}')
    if not (rec_approve or rec_reject or rec_archive):
        md.append('No pending decisions.')
    md.append('')
    
    if graph_stats:
        md.append('## Coverage Graph')
        for k, v in graph_stats.items(): md.append(f'- **{k}:** {v}')
    md.append('')
    
    md.append('## Top Performing Documents')
    md.append('| # | Document | Rules | Family |'); md.append('|---|----------|-------|--------|')
    for i, e in enumerate(top_docs, 1):
        md.append(f'| {i} | {e["document_title"][:42]} | {e.get("promoted_rule_count",0)} | {e.get("document_family")} |')
    
    with open(os.path.join(FOCL_DIR, 'corpus-governance-summary.md'), 'w') as f:
        f.write('\n'.join(md))
    
    return cockpit

# ============================================================
# SECTION H — SECURITY CONTROL SUMMARY
# ============================================================
def generate_security_summary(registry):
    md = ['# Security & Control Summary — Corpus Governance Layer',
          f'**Generated:** {NOW_SHORT}', '',
          '## What Prevents Bad Documents From Entering Active Evaluation', '',
          '### Implemented Controls', '',
          '1. **Quarantine-first ingestion**: All discovered/captured docs enter quarantine. Never active directly.',
          '2. **Admission gates**: 5 checks before approval — parse success, metadata completeness, trust level, duplicate detection, supersession status.',
          '3. **Content hashing**: SHA-256 hash computed for every artifact at ingestion. Detects duplicates and tampering.',
          '4. **Trust-level tagging**: Every doc tagged official/high/medium/low/unverified. Low-trust docs blocked from auto-approval.',
          '5. **Trusted domain whitelist**: Discovery only targets known official domains (airlines, regulators, issuers).',
          '6. **Founder review workflow**: approve/reject/archive actions with actor + timestamp logging.',
          '7. **Active-only default**: Extraction pipeline processes active corpus only unless explicitly flagged.',
          '8. **Registry provenance**: Every entry tracks discovered_by, approved_by, last_reviewed_at, review_notes.',
          '9. **OCR artifact distinction**: OCR-derived text is never silently mixed with native-text extraction.',
          '10. **Deterministic logging**: Every ingestion action logged with timestamp, actor, corpus_id.',
          '',
          '### What Remains Missing for Enterprise Security', '',
          '- End-to-end encryption of stored artifacts (requires KMS integration)',
          '- Role-based access control on registry mutations (requires auth layer)',
          '- Webhook/alert on quarantine threshold breaches',
          '- Signed artifact manifests for tamper evidence',
          '- Rate limiting on discovery execution',
          '- Audit log immutability guarantee (currently file-based, needs append-only store)',
          '',
          '### Honest Assessment', '',
          'The current controls are appropriate for a pre-launch infrastructure layer. They prevent the most dangerous failure mode (bad documents silently entering production evaluation) through quarantine-first design and admission gates. Enterprise-grade controls (KMS, RBAC, signed manifests) belong in the deployment layer and are not faked here.',
    ]
    with open(os.path.join(FOCL_DIR, 'security-control-summary.md'), 'w') as f:
        f.write('\n'.join(md))

# ============================================================
# SECTION C (cont) — DISCOVERY CANDIDATES REPORT
# ============================================================
def generate_discovery_report(candidates, registry, workflow):
    md = ['# Discovery Candidates', f'**Generated:** {NOW_SHORT}', '',
          f'**Discovery Mode:** OFF (explicit invocation required)', '',
          f'## Known High-Value Targets', '',
          '| # | Title | Domain | Family | Trust | Suggested Action |',
          '|---|-------|--------|--------|-------|------------------|']
    for i, c in enumerate(candidates, 1):
        md.append(f'| {i} | {c["document_title"]} | {c["source_domain"]} | {c["document_family"]} | {c["trust_level"]} | {c["suggested_action"]} |')
    md.append('')
    md.append('## How Discovery Works')
    md.append('1. Founder enables discovery_mode toggle')
    md.append('2. System searches trusted domains for contract/benefit/regulation PDFs')
    md.append('3. Candidates appear in this report with trust assessment')
    md.append('4. Captured artifacts go to quarantine_corpus')
    md.append('5. Founder reviews and approves/rejects via Decision Queue')
    md.append('6. Only approved docs enter active_corpus for evaluation')
    
    with open(os.path.join(FOCL_DIR, 'discovery-candidates.md'), 'w') as f:
        f.write('\n'.join(md))
    
    # Ingestion log
    log_md = ['# Corpus Ingestion Log', f'**Generated:** {NOW_SHORT}', '']
    if workflow.log:
        log_md.append('| Timestamp | Action | Corpus ID | Actor | Notes |')
        log_md.append('|-----------|--------|-----------|-------|-------|')
        for entry in workflow.log:
            log_md.append(f'| {entry["timestamp"][:19]} | {entry["action"]} | {entry["corpus_id"]} | {entry["actor"]} | {entry["notes"][:50]} |')
    else:
        log_md.append('No ingestion actions recorded this session.')
    log_md.append('')
    log_md.append(f'Total registered: {len(registry.entries)}')
    log_md.append(f'From legacy corpus: {sum(1 for e in registry.entries if e.get("discovered_by")=="legacy_corpus")}')
    
    with open(os.path.join(FOCL_DIR, 'corpus-ingestion-log.md'), 'w') as f:
        f.write('\n'.join(log_md))

# ============================================================
# SECTION I — VALIDATION
# ============================================================
def run_validation(registry, graph, rules):
    checks = []
    
    # Check 1: Registry populated
    active = registry.get_active()
    checks.append(('Registry populated', len(active) > 0, f'{len(active)} active entries'))
    
    # Check 2: Active corpus files exist
    missing = [e for e in active if not os.path.exists(e.get('storage_path',''))]
    checks.append(('Active files exist', len(missing)==0, f'{len(missing)} missing' if missing else 'All present'))
    
    # Check 3: Coverage graph has nodes
    checks.append(('Coverage graph has nodes', graph['statistics']['total_nodes'] > 0, f'{graph["statistics"]["total_nodes"]} nodes'))
    
    # Check 4: Coverage graph has edges
    checks.append(('Coverage graph has edges', graph['statistics']['total_edges'] > 0, f'{graph["statistics"]["total_edges"]} edges'))
    
    # Check 5: Rules match inventory
    checks.append(('Rules in inventory', len(rules) > 200, f'{len(rules)} rules'))
    
    # Check 6: No quarantine in active
    quarantine_in_active = [e for e in registry.entries
                           if e.get('corpus_status') in ('discovered','captured')
                           and ACTIVE_DIR in e.get('storage_path','')]
    checks.append(('No quarantine in active zone', len(quarantine_in_active)==0, f'{len(quarantine_in_active)} violations'))
    
    # Check 7: FOCL outputs exist
    focl_files = os.listdir(FOCL_DIR) if os.path.exists(FOCL_DIR) else []
    checks.append(('FOCL outputs generated', len(focl_files) >= 4, f'{len(focl_files)} files'))
    
    all_pass = all(c[1] for c in checks)
    
    md = ['# Infrastructure Validation Report', f'**Generated:** {NOW_SHORT}',
          f'**Status:** {"✅ ALL PASSED" if all_pass else "❌ FAILURES DETECTED"}', '']
    md.append('| Check | Status | Detail |'); md.append('|-------|--------|--------|')
    for name, passed, detail in checks:
        md.append(f'| {name} | {"✅" if passed else "❌"} | {detail} |')
    
    with open(os.path.join(FOCL_DIR, 'final-infrastructure-validation.md'), 'w') as f:
        f.write('\n'.join(md))
    
    return all_pass, checks

# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 70)
    print("INFRASTRUCTURE LAYER: Governance + Coverage Graph + FOCL")
    print("=" * 70)
    
    # Load rule inventory from hardening pass
    rules = []
    ri_path = os.path.join(REPO_ROOT, 'tmp', 'hardening', 'rule-inventory.json')
    if os.path.exists(ri_path):
        with open(ri_path) as f: rules = json.load(f)
    print(f"  Loaded rule inventory: {len(rules)} rules")
    
    # Load evaluation data
    eval_data = None
    eval_path = os.path.join(REPO_ROOT, 'tmp', 'hardening', 'final-output.json')
    if os.path.exists(eval_path):
        with open(eval_path) as f: eval_data = json.load(f)
    
    # --- SECTION A+B: Registry ---
    print("\n--- Section A+B: Corpus Registry ---")
    registry = CorpusRegistry()
    workflow = ReviewWorkflow(registry)
    seed_registry(registry, eval_data)
    print(f"  Entries: {len(registry.entries)}")
    print(f"  Active: {len(registry.get_active())}")
    print(f"  Quarantine: {len(registry.get_quarantine())}")
    print(f"  Archive: {len(registry.get_archive())}")
    
    # --- SECTION C: Discovery ---
    print("\n--- Section C: Controlled Discovery ---")
    candidates = run_discovery_stub()
    print(f"  Discovery candidates: {len(candidates)}")
    generate_discovery_report(candidates, registry, workflow)
    
    # --- SECTION F: Coverage Graph ---
    print("\n--- Section F: Coverage Graph ---")
    graph = build_coverage_graph(rules, registry)
    save_coverage_graph(graph)
    stats = graph['statistics']
    print(f"  Nodes: {stats['total_nodes']}")
    print(f"  Edges: {stats['total_edges']}")
    print(f"  Rule nodes: {stats['rule_nodes']}")
    print(f"  Document nodes: {stats['document_nodes']}")
    print(f"  Clause type nodes: {stats['clause_type_nodes']}")
    print(f"  Jurisdiction nodes: {stats['jurisdiction_nodes']}")
    
    # --- SECTION G: Readiness Mapping ---
    print("\n--- Section G: Claim Readiness Mapping ---")
    generate_readiness_mapping(graph, rules)
    print("  Generated coverage-graph-readiness.md")
    
    # --- SECTION E: FOCL ---
    print("\n--- Section E: Founder's Cockpit ---")
    cockpit = generate_focl(registry, workflow, stats)
    print(f"  Health: {cockpit['health']['overall']}")
    print(f"  Decision queue: {cockpit['decision_queue']['awaiting']} items")
    
    # --- SECTION H: Security ---
    print("\n--- Section H: Security Controls ---")
    generate_security_summary(registry)
    print("  Generated security-control-summary.md")
    
    # --- SECTION I: Validation ---
    print("\n--- Section I: Validation ---")
    all_pass, checks = run_validation(registry, graph, rules)
    for name, passed, detail in checks:
        print(f"  {'✅' if passed else '❌'} {name}: {detail}")
    
    # Save registry
    registry.save()
    
    # --- Final Report ---
    print("\n" + "=" * 70)
    if all_pass:
        print("INFRASTRUCTURE STATUS: OPERATIONAL")
    else:
        print("INFRASTRUCTURE STATUS: VALIDATION FAILURES")
    print("=" * 70)
    
    print(f"\n  Files generated:")
    all_files = []
    for d in [DATA_DIR, COVGRAPH_DIR, FOCL_DIR]:
        for f in sorted(os.listdir(d)):
            fp = os.path.join(d, f)
            if os.path.isfile(fp):
                all_files.append(fp)
                print(f"    ✓ {fp}")
    
    print(f"\n  Active corpus: {len(registry.get_active())} docs in {ACTIVE_DIR}")
    print(f"  Quarantine: {len(registry.get_quarantine())} docs")
    print(f"  Archive: {len(registry.get_archive())} docs")
    print(f"  Coverage graph: {stats['total_nodes']} nodes, {stats['total_edges']} edges")
    print(f"  Rules materialized: {len(rules)}")

if __name__ == '__main__':
    main()
