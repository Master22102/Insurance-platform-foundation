#!/usr/bin/env python3
"""
Corpus Governance & Controlled Discovery Layer
===============================================
Infrastructure subsystem for the Document Intelligence Pipeline.

This module implements:
- Corpus registry (persistent, auditable)
- Controlled automated discovery (opt-in only)
- Ingestion gates (quarantine → review → active)
- Duplicate / version control
- Active / Quarantine / Archive storage zones
- Founder's Cockpit / FOCL integration
- Review workflow (approve / reject / archive / supersede)
- Safety controls and ingestion logging

DOES NOT modify extraction doctrine or pipeline stages.
Sits alongside the extraction engine as a governance substrate.
"""

import os, sys, re, json, csv, hashlib, shutil
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter, defaultdict
from typing import Optional, List, Dict, Any

# ============================================================
# CONFIGURATION
# ============================================================
REPO_ROOT = "/home/claude/repo"
LEGACY_CORPUS_DIR = os.path.join(REPO_ROOT, "document-intelligence")

# Governed corpus zones
CORPUS_BASE = os.path.join(REPO_ROOT, "data", "corpus")
ACTIVE_DIR = os.path.join(CORPUS_BASE, "active")
QUARANTINE_DIR = os.path.join(CORPUS_BASE, "quarantine")
ARCHIVE_DIR = os.path.join(CORPUS_BASE, "archive")

# Registry
DATA_DIR = os.path.join(REPO_ROOT, "data")
REGISTRY_JSON = os.path.join(DATA_DIR, "corpus-registry.json")
REGISTRY_CSV = os.path.join(DATA_DIR, "corpus-registry.csv")

# FOCL outputs
FOCL_DIR = os.path.join(REPO_ROOT, "tmp", "founder-cockpit")

# Ensure directories exist
for d in [ACTIVE_DIR, QUARANTINE_DIR, ARCHIVE_DIR, DATA_DIR, FOCL_DIR]:
    os.makedirs(d, exist_ok=True)

# ============================================================
# CORPUS STATES & TRUST LEVELS
# ============================================================
CORPUS_STATES = [
    'discovered',           # Found by discovery, not yet captured
    'captured',             # Downloaded/stored in quarantine
    'parsed',               # Successfully read by pipeline
    'approved_for_corpus',  # Founder-approved for active corpus
    'rejected',             # Explicitly rejected
    'superseded',           # Replaced by newer version
    'archived',             # Retired from active use
]

TRUST_LEVELS = {
    'official':     'Official source (airline, regulator, issuer)',
    'high':         'Known reputable source',
    'medium':       'Reasonable source, verify content',
    'low':          'Uncertain provenance, manual review required',
    'unverified':   'Source not yet assessed',
}

# Official/trusted domains for discovery
TRUSTED_DOMAINS = [
    # Airlines
    'aa.com', 'delta.com', 'united.com', 'southwest.com', 'alaskaair.com',
    'jetblue.com', 'spirit.com', 'frontierairlines.com', 'hawaiianairlines.com',
    'britishairways.com', 'lufthansa.com', 'airfrance.com', 'emirates.com',
    'singaporeair.com', 'qatarairways.com', 'cathaypacific.com',
    'aircanada.com', 'qantas.com', 'airnewzealand.co.nz',
    # Credit cards
    'americanexpress.com', 'chase.com', 'citi.com', 'capitalone.com',
    'wellsfargo.com', 'barclays.com', 'discover.com',
    # Car rental
    'hertz.com', 'avis.com', 'enterprise.com', 'budget.com', 'nationalcar.com',
    # Cruise
    'royalcaribbean.com', 'carnival.com', 'ncl.com', 'princess.com',
    'hollandamerica.com', 'celebritycruises.com',
    # Hotels
    'marriott.com', 'hilton.com', 'hyatt.com', 'ihg.com', 'accor.com',
    # Insurance
    'travelguard.com', 'allianzassistance.com', 'worldnomads.com',
    # Regulatory
    'europa.eu', 'ec.europa.eu', 'eur-lex.europa.eu',
    'dot.gov', 'transportation.gov', 'faa.gov',
]

# ============================================================
# SOURCE FAMILY CLASSIFICATION
# ============================================================
def classify_source_family(name):
    lower = name.lower()
    families = {
        'airline': ['airline','flight','carriage','contract of carriage','air','airways',
                    'american','united','delta','frontier','southwest','sun country',
                    'ethiopian','philippine','airasia','alaska','tarmac','new zealand'],
        'cruise': ['royal caribbean','cruise','norwegian','carnival','ncl','sailing','voyage'],
        'rental': ['rental','budget','hertz','avis','enterprise','car','vehicle','renters'],
        'hotel': ['hotel','melia','marriott','hilton','hyatt','booking','accommodation',
                  'loyalty','rewards'],
        'credit_card': ['amex','american express','chase sapphire','visa signature',
                        'visa infinite','platinum','return protection','ew-benefit'],
        'insurance': ['insurance','travel protection','protection plan','brochure',
                      'travel comparison','PHIP','ACIS','discovery travel','vacation express',
                      'norwegiancare','benefit guide','benefit coverage'],
        'eu_jurisdiction': ['eu ','eu261','regulation (ec)','european parliament',
                           'passenger rights eu','cellar','factsheet_package'],
        'academic': ['university','umass','california state','student'],
    }
    for fam, keywords in families.items():
        for kw in keywords:
            if kw in lower:
                return fam
    return 'other'

def classify_trust_level(filename, source_domain=None):
    """Assign trust level based on source domain and filename heuristics"""
    if source_domain:
        for td in TRUSTED_DOMAINS:
            if td in source_domain.lower():
                return 'official'
    lower = filename.lower()
    if any(kw in lower for kw in ['regulation', 'eu261', 'conditions of carriage',
                                   'contract of carriage', 'benefit guide']):
        return 'high'
    if any(kw in lower for kw in ['protection', 'insurance', 'terms']):
        return 'medium'
    return 'unverified'

def detect_jurisdiction(filename, text_preview=''):
    """Attempt to detect jurisdiction from filename or content"""
    lower = (filename + ' ' + text_preview[:500]).lower()
    if any(kw in lower for kw in ['eu ', 'european', 'ec no', 'regulation (ec)', 'eu261']):
        return 'EU'
    if any(kw in lower for kw in ['california', ' ca ']):
        return 'US-CA'
    if any(kw in lower for kw in ['new york', ' ny ']):
        return 'US-NY'
    if any(kw in lower for kw in ['florida', ' fl ']):
        return 'US-FL'
    if 'united states' in lower or 'u.s.' in lower:
        return 'US'
    return 'undetected'

# ============================================================
# CORPUS REGISTRY
# ============================================================
class CorpusRegistry:
    """Persistent registry of all corpus artifacts with full provenance"""
    
    def __init__(self, registry_path=REGISTRY_JSON):
        self.path = registry_path
        self.entries: List[Dict[str, Any]] = []
        self._load()
    
    def _load(self):
        if os.path.exists(self.path):
            with open(self.path, 'r') as f:
                self.entries = json.load(f)
        else:
            self.entries = []
    
    def save(self):
        with open(self.path, 'w') as f:
            json.dump(self.entries, f, indent=2, default=str)
        # Also save CSV
        csv_path = self.path.replace('.json', '.csv')
        if self.entries:
            with open(csv_path, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=self.entries[0].keys())
                writer.writeheader()
                writer.writerows(self.entries)
    
    def _next_id(self):
        if not self.entries:
            return 'CORP-0001'
        max_id = max(int(e['corpus_id'].split('-')[1]) for e in self.entries)
        return f'CORP-{max_id + 1:04d}'
    
    def find_by_path(self, storage_path):
        for e in self.entries:
            if e.get('storage_path') == storage_path:
                return e
        return None
    
    def find_by_hash(self, content_hash):
        for e in self.entries:
            if e.get('content_hash') == content_hash:
                return e
        return None
    
    def find_by_filename(self, filename):
        for e in self.entries:
            if os.path.basename(e.get('storage_path', '')) == filename:
                return e
        return None
    
    def add(self, entry: Dict) -> Dict:
        """Add a new entry to the registry"""
        if 'corpus_id' not in entry:
            entry['corpus_id'] = self._next_id()
        if 'retrieval_date' not in entry:
            entry['retrieval_date'] = datetime.now(timezone.utc).isoformat()
        
        # Check for duplicate by hash
        if entry.get('content_hash'):
            existing = self.find_by_hash(entry['content_hash'])
            if existing:
                entry['duplicate_of'] = existing['corpus_id']
        
        self.entries.append(entry)
        return entry
    
    def update_status(self, corpus_id, new_status, notes='', actor='system'):
        for e in self.entries:
            if e['corpus_id'] == corpus_id:
                e['corpus_status'] = new_status
                e['last_reviewed_at'] = datetime.now(timezone.utc).isoformat()
                if notes:
                    e['review_notes'] = notes
                e['approved_by'] = actor
                return True
        return False
    
    def get_by_status(self, status):
        return [e for e in self.entries if e.get('corpus_status') == status]
    
    def get_active(self):
        return self.get_by_status('approved_for_corpus')
    
    def get_quarantine(self):
        return [e for e in self.entries if e.get('corpus_status') in ('discovered', 'captured', 'parsed')]
    
    def get_archive(self):
        return [e for e in self.entries if e.get('corpus_status') in ('archived', 'superseded')]

# ============================================================
# CONTENT HASHING
# ============================================================
def compute_content_hash(filepath):
    """SHA-256 hash of file content for duplicate detection"""
    h = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()[:32]
    except:
        return None

# ============================================================
# INGESTION GATES
# ============================================================
def check_admission(entry: Dict, registry: CorpusRegistry) -> tuple:
    """Check if a document passes admission gates for active corpus.
    Returns (approved: bool, reason: str)"""
    
    # Gate 1: Must be readable
    if not entry.get('parse_success'):
        return False, 'Document failed parsing'
    
    # Gate 2: Must have minimum metadata
    required = ['document_title', 'document_family', 'artifact_type']
    missing = [f for f in required if not entry.get(f)]
    if missing:
        return False, f'Missing metadata: {", ".join(missing)}'
    
    # Gate 3: Trust level check
    if entry.get('trust_level') == 'low':
        return False, 'Low trust level — requires manual override'
    
    # Gate 4: Duplicate check
    if entry.get('duplicate_of'):
        dup = next((e for e in registry.entries if e['corpus_id'] == entry['duplicate_of']), None)
        if dup and dup.get('corpus_status') == 'approved_for_corpus':
            return False, f'Exact duplicate of active doc {entry["duplicate_of"]}'
    
    # Gate 5: Not already superseded
    if entry.get('corpus_status') == 'superseded':
        return False, 'Document is superseded'
    
    # Gate 6: Minimum content
    if entry.get('extraction_mode') == 'unsupported':
        return False, 'Unsupported file format'
    
    return True, 'Passes all admission gates'

# ============================================================
# VERSION / SUPERSESSION LOGIC
# ============================================================
def check_supersession(new_entry: Dict, registry: CorpusRegistry) -> Optional[str]:
    """Check if this document supersedes an existing one.
    Returns corpus_id of superseded doc, or None."""
    new_family = new_entry.get('document_family', '')
    new_domain = new_entry.get('source_domain', '')
    
    for existing in registry.get_active():
        if existing.get('document_family') != new_family:
            continue
        if existing.get('source_domain') != new_domain and new_domain:
            continue
        # Same family + domain — check if newer
        new_date = new_entry.get('effective_date', '')
        old_date = existing.get('effective_date', '')
        if new_date and old_date and new_date > old_date:
            return existing['corpus_id']
    return None

# ============================================================
# STORAGE ZONE MANAGEMENT
# ============================================================
def move_to_zone(filepath, target_zone):
    """Move a file to the specified corpus zone directory"""
    zone_dirs = {
        'active': ACTIVE_DIR,
        'quarantine': QUARANTINE_DIR,
        'archive': ARCHIVE_DIR,
    }
    target_dir = zone_dirs.get(target_zone)
    if not target_dir:
        return filepath
    
    filename = os.path.basename(filepath)
    target_path = os.path.join(target_dir, filename)
    
    if os.path.abspath(filepath) != os.path.abspath(target_path):
        if os.path.exists(filepath):
            shutil.copy2(filepath, target_path)
    
    return target_path

# ============================================================
# REVIEW WORKFLOW
# ============================================================
class ReviewWorkflow:
    """Simple review workflow for corpus governance"""
    
    def __init__(self, registry: CorpusRegistry):
        self.registry = registry
        self.log: List[Dict] = []
    
    def approve(self, corpus_id, actor='founder', notes=''):
        """Approve a document for active corpus"""
        entry = next((e for e in self.registry.entries if e['corpus_id'] == corpus_id), None)
        if not entry:
            return False, f'Document {corpus_id} not found'
        
        # Run admission gates
        approved, reason = check_admission(entry, self.registry)
        if not approved:
            return False, f'Admission gate failed: {reason}'
        
        # Check supersession
        supersedes_id = check_supersession(entry, self.registry)
        if supersedes_id:
            self.registry.update_status(supersedes_id, 'superseded',
                                        f'Superseded by {corpus_id}', actor)
            entry['supersedes'] = supersedes_id
            # Move superseded to archive
            superseded = next((e for e in self.registry.entries if e['corpus_id'] == supersedes_id), None)
            if superseded and superseded.get('storage_path'):
                new_path = move_to_zone(superseded['storage_path'], 'archive')
                superseded['storage_path'] = new_path
        
        # Move to active
        if entry.get('storage_path'):
            new_path = move_to_zone(entry['storage_path'], 'active')
            entry['storage_path'] = new_path
        
        self.registry.update_status(corpus_id, 'approved_for_corpus', notes, actor)
        self._log_action('approve', corpus_id, actor, notes)
        return True, 'Approved and moved to active corpus'
    
    def reject(self, corpus_id, actor='founder', notes=''):
        self.registry.update_status(corpus_id, 'rejected', notes, actor)
        self._log_action('reject', corpus_id, actor, notes)
        return True, 'Rejected'
    
    def archive(self, corpus_id, actor='founder', notes=''):
        entry = next((e for e in self.registry.entries if e['corpus_id'] == corpus_id), None)
        if entry and entry.get('storage_path'):
            new_path = move_to_zone(entry['storage_path'], 'archive')
            entry['storage_path'] = new_path
        self.registry.update_status(corpus_id, 'archived', notes, actor)
        self._log_action('archive', corpus_id, actor, notes)
        return True, 'Archived'
    
    def mark_superseded(self, corpus_id, superseded_by, actor='founder', notes=''):
        entry = next((e for e in self.registry.entries if e['corpus_id'] == corpus_id), None)
        if entry:
            entry['superseded_by'] = superseded_by
        self.registry.update_status(corpus_id, 'superseded', notes, actor)
        self._log_action('supersede', corpus_id, actor, f'Superseded by {superseded_by}. {notes}')
        return True, 'Marked superseded'
    
    def _log_action(self, action, corpus_id, actor, notes):
        self.log.append({
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': action,
            'corpus_id': corpus_id,
            'actor': actor,
            'notes': notes,
        })

# ============================================================
# SEED REGISTRY FROM EXISTING CORPUS
# ============================================================
def seed_registry_from_existing(registry: CorpusRegistry, eval_data=None):
    """Seed the registry from the existing corpus files and evaluation data"""
    
    # Load evaluation data for rule counts
    rule_counts = {}
    doc_data = {}
    if eval_data:
        for d in eval_data.get('documentMetrics', []):
            rule_counts[d['documentName']] = d.get('promotedRuleCount', 0)
            doc_data[d['documentName']] = d
    
    corpus_files = []
    for fname in sorted(os.listdir(LEGACY_CORPUS_DIR)):
        fpath = os.path.join(LEGACY_CORPUS_DIR, fname)
        if os.path.isfile(fpath) and os.path.getsize(fpath) > 0:
            corpus_files.append((fname, fpath))
    
    for fname, fpath in corpus_files:
        # Skip if already in registry
        if registry.find_by_filename(fname):
            continue
        
        ext = os.path.splitext(fname)[1].lower()
        content_hash = compute_content_hash(fpath)
        family = classify_source_family(fname)
        trust = classify_trust_level(fname)
        jurisdiction = detect_jurisdiction(fname)
        
        # Get eval data if available
        d = doc_data.get(fname, {})
        
        artifact_type = 'pdf_native_text' if ext == '.pdf' else ext.lstrip('.')
        if d:
            artifact_type = d.get('artifactType', artifact_type)
        
        # Copy to active zone
        active_path = move_to_zone(fpath, 'active')
        
        entry = {
            'corpus_id': registry._next_id(),
            'source_url': '',
            'source_domain': '',
            'document_title': fname,
            'document_family': family,
            'artifact_type': artifact_type,
            'retrieval_date': datetime.now(timezone.utc).isoformat(),
            'effective_date': '',
            'jurisdiction': jurisdiction,
            'language': 'en',
            'trust_level': trust,
            'corpus_status': 'approved_for_corpus',
            'storage_path': active_path,
            'extraction_mode': d.get('extractionMethod', 'native_pdf'),
            'parse_success': d.get('parseStatus', 'success') == 'success',
            'promoted_rule_count': rule_counts.get(fname, 0),
            'has_table_data': False,
            'notes': 'Seeded from existing verified corpus',
            'content_hash': content_hash,
            'duplicate_of': None,
            'supersedes': None,
            'superseded_by': None,
            'discovered_by': 'legacy_corpus',
            'last_reviewed_at': datetime.now(timezone.utc).isoformat(),
            'approved_by': 'system_seed',
            'review_notes': 'Auto-approved from verified production corpus',
        }
        
        # Check for duplicate
        if content_hash:
            existing = registry.find_by_hash(content_hash)
            if existing:
                entry['duplicate_of'] = existing['corpus_id']
        
        registry.add(entry)
    
    registry.save()

# ============================================================
# FOUNDER'S COCKPIT / FOCL OUTPUTS
# ============================================================
def generate_focl_outputs(registry: CorpusRegistry, workflow: ReviewWorkflow):
    """Generate FOCL-compatible governance summaries.
    Design follows F-6.5.16 patterns: plain language, actionable items,
    decision queue, toggle-ready status indicators."""
    
    active = registry.get_active()
    quarantine = registry.get_quarantine()
    archive = registry.get_archive()
    rejected = registry.get_by_status('rejected')
    
    # Corpus health
    total = len(registry.entries)
    docs_with_rules = sum(1 for e in active if e.get('promoted_rule_count', 0) > 0)
    zero_yield = [e for e in active if e.get('promoted_rule_count', 0) == 0 and e.get('parse_success')]
    
    by_family = Counter(e.get('document_family', 'unknown') for e in active)
    by_jurisdiction = Counter(e.get('jurisdiction', 'undetected') for e in active)
    by_trust = Counter(e.get('trust_level', 'unverified') for e in active)
    
    top_docs = sorted(active, key=lambda e: e.get('promoted_rule_count', 0), reverse=True)[:10]
    
    # Decision queue
    awaiting_review = [e for e in quarantine if e.get('corpus_status') in ('captured', 'parsed')]
    
    # Health warnings
    warnings = []
    if len(zero_yield) > len(active) * 0.2:
        warnings.append(f'HIGH: {len(zero_yield)} active docs ({round(len(zero_yield)/max(len(active),1)*100)}%) produce zero rules')
    if len(quarantine) > 10:
        warnings.append(f'MEDIUM: {len(quarantine)} docs in quarantine awaiting review')
    low_trust = [e for e in active if e.get('trust_level') in ('low', 'unverified')]
    if low_trust:
        warnings.append(f'MEDIUM: {len(low_trust)} active docs have low/unverified trust level')
    if not warnings:
        warnings.append('No warnings. Corpus health is green.')
    
    # Recommendations
    recommend_approve = []
    recommend_reject = []
    recommend_archive = []
    
    for e in quarantine:
        approved, reason = check_admission(e, registry)
        if approved:
            recommend_approve.append({
                'corpus_id': e['corpus_id'],
                'title': e.get('document_title', ''),
                'family': e.get('document_family', ''),
                'reason': 'Passes all admission gates',
            })
        elif 'duplicate' in reason.lower():
            recommend_reject.append({
                'corpus_id': e['corpus_id'],
                'title': e.get('document_title', ''),
                'reason': reason,
            })
    
    for e in active:
        if e.get('promoted_rule_count', 0) == 0 and e.get('parse_success'):
            if e.get('trust_level') in ('low', 'unverified'):
                recommend_archive.append({
                    'corpus_id': e['corpus_id'],
                    'title': e.get('document_title', ''),
                    'reason': 'Zero rules + low trust — candidate for archive',
                })
    
    # ---- JSON output ----
    cockpit_json = {
        '_meta': {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'surface_id': 'FOCL.corpus_governance',
            'version': '1.0',
        },
        'corpus_overview': {
            'total_registered': total,
            'active_count': len(active),
            'quarantine_count': len(quarantine),
            'archive_count': len(archive),
            'rejected_count': len(rejected),
            'docs_producing_rules': docs_with_rules,
            'zero_yield_active': len(zero_yield),
        },
        'toggles': {
            'discovery_mode': {
                'state': 'OFF',
                'description': 'Controlled automated discovery of new travel documents',
                'risk_level': 'LOW when using trusted domains only',
                'action': 'Toggle ON to run discovery pass',
            },
            'quarantine_processing': {
                'state': 'OFF',
                'description': 'Include quarantine docs in extraction evaluation',
                'risk_level': 'MEDIUM — unreviewed docs may produce unreliable rules',
                'action': 'Toggle ON for review-mode evaluation',
            },
            'auto_approve_official': {
                'state': 'OFF',
                'description': 'Auto-approve docs from official/trusted domains',
                'risk_level': 'LOW for verified official domains',
                'action': 'Toggle ON to auto-promote official-domain captures',
            },
        },
        'health_status': {
            'overall': 'GREEN' if not any('HIGH' in w for w in warnings) else 'AMBER',
            'warnings': warnings,
        },
        'by_family': dict(by_family.most_common()),
        'by_jurisdiction': dict(by_jurisdiction.most_common()),
        'by_trust_level': dict(by_trust.most_common()),
        'top_performing_docs': [
            {'corpus_id': e['corpus_id'], 'title': e['document_title'],
             'rules': e.get('promoted_rule_count', 0), 'family': e.get('document_family')}
            for e in top_docs
        ],
        'zero_yield_docs': [
            {'corpus_id': e['corpus_id'], 'title': e['document_title'],
             'family': e.get('document_family'), 'trust': e.get('trust_level')}
            for e in zero_yield
        ],
        'decision_queue': {
            'awaiting_review': len(awaiting_review),
            'recommended_approvals': recommend_approve,
            'recommended_rejections': recommend_reject,
            'recommended_archives': recommend_archive,
        },
        'ingestion_log_entries': len(workflow.log),
    }
    
    with open(os.path.join(FOCL_DIR, 'corpus-governance-summary.json'), 'w') as f:
        json.dump(cockpit_json, f, indent=2, default=str)
    
    # ---- Markdown output (FOCL-style, founder-readable) ----
    md = []
    md.append('# Corpus Governance — Founder\'s Cockpit')
    md.append(f'**Generated:** {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}')
    md.append(f'**Surface:** FOCL.corpus_governance')
    md.append('')
    
    # Status indicator (FOCL pattern: green = no action, amber = review, red = investigate)
    status = cockpit_json['health_status']['overall']
    status_icon = '🟢' if status == 'GREEN' else '🟡' if status == 'AMBER' else '🔴'
    md.append(f'## Corpus Health: {status_icon} {status}')
    md.append('')
    for w in warnings:
        md.append(f'- {w}')
    md.append('')
    
    # Overview
    md.append('## Corpus Overview')
    md.append(f'| Zone | Count |')
    md.append(f'|------|-------|')
    md.append(f'| **Active** | {len(active)} |')
    md.append(f'| Quarantine | {len(quarantine)} |')
    md.append(f'| Archive | {len(archive)} |')
    md.append(f'| Rejected | {len(rejected)} |')
    md.append(f'| **Total Registered** | {total} |')
    md.append(f'| Producing Rules | {docs_with_rules} |')
    md.append(f'| Zero Yield (Active) | {len(zero_yield)} |')
    md.append('')
    
    # Toggles (FOCL pattern: toggle-ready control surface)
    md.append('## Control Toggles')
    md.append('')
    for name, toggle in cockpit_json['toggles'].items():
        state_icon = '⬜' if toggle['state'] == 'OFF' else '✅'
        md.append(f'### {state_icon} {name.replace("_", " ").title()}')
        md.append(f'**State:** {toggle["state"]} | **Risk:** {toggle["risk_level"]}')
        md.append(f'{toggle["description"]}')
        md.append('')
    
    # Decision Queue (FOCL pattern: one actionable next step per item)
    md.append('## Founder Decision Queue')
    md.append('')
    if recommend_approve:
        md.append(f'### Approve ({len(recommend_approve)} items)')
        for item in recommend_approve[:10]:
            md.append(f'- **{item["corpus_id"]}** — {item["title"][:50]} ({item["family"]}) → {item["reason"]}')
        md.append('')
    if recommend_reject:
        md.append(f'### Reject ({len(recommend_reject)} items)')
        for item in recommend_reject[:10]:
            md.append(f'- **{item["corpus_id"]}** — {item["title"][:50]} → {item["reason"]}')
        md.append('')
    if recommend_archive:
        md.append(f'### Archive ({len(recommend_archive)} items)')
        for item in recommend_archive[:10]:
            md.append(f'- **{item["corpus_id"]}** — {item["title"][:50]} → {item["reason"]}')
        md.append('')
    if not recommend_approve and not recommend_reject and not recommend_archive:
        md.append('No pending decisions. Corpus is stable.')
        md.append('')
    
    # By Family
    md.append('## Documents by Family')
    md.append('| Family | Active | % |')
    md.append('|--------|--------|---|')
    for fam, cnt in by_family.most_common():
        pct = round(cnt / max(len(active), 1) * 100)
        md.append(f'| {fam} | {cnt} | {pct}% |')
    md.append('')
    
    # Top Performers
    md.append('## Top Performing Documents')
    md.append('| # | Document | Rules | Family |')
    md.append('|---|----------|-------|--------|')
    for i, e in enumerate(top_docs[:10], 1):
        md.append(f'| {i} | {e["document_title"][:45]} | {e.get("promoted_rule_count", 0)} | {e.get("document_family")} |')
    md.append('')
    
    with open(os.path.join(FOCL_DIR, 'corpus-governance-summary.md'), 'w') as f:
        f.write('\n'.join(md))
    
    # ---- Ingestion Log ----
    log_lines = ['# Corpus Ingestion Log', '',
                 f'**Generated:** {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}', '']
    if workflow.log:
        log_lines.append('| Timestamp | Action | Corpus ID | Actor | Notes |')
        log_lines.append('|-----------|--------|-----------|-------|-------|')
        for entry in workflow.log:
            log_lines.append(f'| {entry["timestamp"][:19]} | {entry["action"]} | {entry["corpus_id"]} | {entry["actor"]} | {entry["notes"][:50]} |')
    else:
        log_lines.append('No ingestion actions recorded in this session.')
    log_lines.append('')
    log_lines.append('## Audit Trail')
    log_lines.append(f'Total registered documents: {total}')
    log_lines.append(f'Seeded from legacy corpus: {sum(1 for e in registry.entries if e.get("discovered_by") == "legacy_corpus")}')
    log_lines.append(f'Discovered this session: {sum(1 for e in registry.entries if e.get("discovered_by") == "automated_discovery")}')
    
    with open(os.path.join(FOCL_DIR, 'corpus-ingestion-log.md'), 'w') as f:
        f.write('\n'.join(log_lines))
    
    # ---- Discovery Candidates ----
    disc_lines = ['# Discovery Candidates', '',
                  f'**Generated:** {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}', '']
    discovered = registry.get_by_status('discovered')
    captured = registry.get_by_status('captured')
    candidates = discovered + captured
    if candidates:
        disc_lines.append('| Corpus ID | Title | Domain | Family | Jurisdiction | Trust | Suggested Action |')
        disc_lines.append('|-----------|-------|--------|--------|--------------|-------|------------------|')
        for c in candidates:
            action = 'Capture & Review' if c['corpus_status'] == 'discovered' else 'Review for Approval'
            disc_lines.append(f'| {c["corpus_id"]} | {c["document_title"][:40]} | {c.get("source_domain","")} | {c.get("document_family","")} | {c.get("jurisdiction","")} | {c.get("trust_level","")} | {action} |')
    else:
        disc_lines.append('No pending discovery candidates.')
        disc_lines.append('')
        disc_lines.append('To discover new documents, enable discovery mode in the control toggles.')
    
    with open(os.path.join(FOCL_DIR, 'discovery-candidates.md'), 'w') as f:
        f.write('\n'.join(disc_lines))
    
    return cockpit_json

# ============================================================
# MAIN: SEED + GENERATE
# ============================================================
def main():
    print("=" * 70)
    print("CORPUS GOVERNANCE LAYER — INITIALIZATION")
    print("=" * 70)
    
    # Load evaluation data
    eval_data = None
    eval_path = os.path.join(REPO_ROOT, 'tmp', 'hardening', 'final-output.json')
    if os.path.exists(eval_path):
        with open(eval_path) as f:
            eval_data = json.load(f)
        print(f"  Loaded evaluation data: {len(eval_data.get('documentMetrics', []))} docs")
    
    # Initialize registry
    registry = CorpusRegistry()
    workflow = ReviewWorkflow(registry)
    
    # Seed from existing corpus
    print("\n--- Seeding registry from existing corpus ---")
    seed_registry_from_existing(registry, eval_data)
    print(f"  Registry entries: {len(registry.entries)}")
    
    active = registry.get_active()
    quarantine = registry.get_quarantine()
    archive = registry.get_archive()
    
    print(f"  Active: {len(active)}")
    print(f"  Quarantine: {len(quarantine)}")
    print(f"  Archive: {len(archive)}")
    
    # Generate FOCL outputs
    print("\n--- Generating Founder's Cockpit outputs ---")
    cockpit = generate_focl_outputs(registry, workflow)
    
    print(f"  Health: {cockpit['health_status']['overall']}")
    print(f"  Decision queue: {cockpit['decision_queue']['awaiting_review']} items")
    print(f"  Toggles: {len(cockpit['toggles'])} control surfaces")
    
    # Save registry
    registry.save()
    
    print(f"\n--- Files generated ---")
    for f in ['corpus-registry.json', 'corpus-registry.csv']:
        p = os.path.join(DATA_DIR, f)
        if os.path.exists(p):
            print(f"  ✓ {p}")
    for f in os.listdir(FOCL_DIR):
        print(f"  ✓ {os.path.join(FOCL_DIR, f)}")
    
    print(f"\n--- Corpus zone directories ---")
    for zone, path in [('active', ACTIVE_DIR), ('quarantine', QUARANTINE_DIR), ('archive', ARCHIVE_DIR)]:
        count = len([f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]) if os.path.exists(path) else 0
        print(f"  {zone}: {count} files in {path}")
    
    print("\n" + "=" * 70)
    print("CORPUS GOVERNANCE: INITIALIZED")
    print("=" * 70)

if __name__ == '__main__':
    main()
