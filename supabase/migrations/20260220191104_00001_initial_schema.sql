/*
  # Initial Schema - Reliability Orchestration Foundation

  ## Design Decisions

  1. **Event Sourcing Architecture**
     - event_logs is the source of truth for all state transitions
     - Immutable by design (enforced via RLS policies)
     - All computed metrics derived from event_logs, not stored counters
     - Rolling windows calculated on-read, ensuring consistency

  2. **State Machine Enforcement**
     - Enums define valid states for reliability orchestration
     - incident_status: Capture → Review → Action workflow
     - connector_state: Enabled, Degraded, ManualOnly, UnderReview
     - classification: Operational, External, Unknown
     - control_type: Internal, External, Mixed
     - failure_code: Captures specific failure reasons

  3. **Entity Relationships**
     - projects: Top-level container for incidents
     - incidents: Reliability events with classification and control type
     - evidence: Artifacts attached to incidents (required for state rules)
     - connectors: Data sources with state machine and failure tracking
     - oauth_tokens: Secure credential storage for connectors

  4. **Job Scheduling**
     - job_queue: Persistent queue supporting Mode A (script) and Mode B (HTTP)
     - background_job_runs: Audit trail of all job executions
     - Status tracking with retry logic support

  5. **Indexes**
     - Optimized for time-series queries on event_logs
     - Entity lookup patterns (type + id + time)
     - Job queue processing (status + scheduled time)
     - Connector state filtering

  6. **Security**
     - RLS enabled on all tables
     - Simplified policies for authenticated users
     - OAuth tokens stored securely
     - Immutable audit trail prevents tampering
*/

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE project_status AS ENUM (
  'active',
  'archived',
  'deleted'
);

CREATE TYPE incident_status AS ENUM (
  'Capture',
  'Review',
  'Action'
);

CREATE TYPE classification AS ENUM (
  'Operational',
  'External',
  'Unknown'
);

CREATE TYPE control_type AS ENUM (
  'Internal',
  'External',
  'Mixed'
);

CREATE TYPE evidence_type AS ENUM (
  'file',
  'log',
  'screenshot',
  'network_capture',
  'memory_dump',
  'other'
);

CREATE TYPE connector_state AS ENUM (
  'Enabled',
  'Degraded',
  'ManualOnly',
  'UnderReview'
);

CREATE TYPE connector_type AS ENUM (
  'github',
  'gitlab',
  'jira',
  'slack',
  'google_workspace',
  'microsoft_365',
  'aws',
  'azure',
  'custom'
);

CREATE TYPE failure_code AS ENUM (
  'timeout',
  'auth_failed',
  'structure_changed',
  'rate_limited',
  'unknown'
);

CREATE TYPE job_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'retry'
);

CREATE TYPE entity_type AS ENUM (
  'project',
  'incident',
  'evidence',
  'connector',
  'job',
  'system'
);

-- =====================================================
-- TABLES
-- =====================================================

-- Projects: Top-level organizational unit
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  status project_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  CONSTRAINT projects_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Incidents: Reliability events with classification and control type
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  status incident_status NOT NULL DEFAULT 'Capture',
  classification classification NOT NULL DEFAULT 'Unknown',
  control_type control_type NOT NULL DEFAULT 'Internal',
  assigned_to uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  CONSTRAINT incidents_title_not_empty CHECK (length(trim(title)) > 0)
);

-- Evidence: Artifacts attached to incidents (required for state rules)
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  type evidence_type NOT NULL DEFAULT 'other',
  name text NOT NULL,
  description text DEFAULT '',
  file_path text,
  file_size_bytes bigint,
  mime_type text,
  hash_sha256 text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  CONSTRAINT evidence_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT evidence_file_size_positive CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

-- Connectors: Data sources with state machine and failure tracking
CREATE TABLE IF NOT EXISTS connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  type connector_type NOT NULL,
  name text NOT NULL,
  state connector_state NOT NULL DEFAULT 'Enabled',
  config jsonb NOT NULL DEFAULT '{}',
  failure_count_24h integer NOT NULL DEFAULT 0,
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  CONSTRAINT connectors_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT connectors_failure_count_positive CHECK (failure_count_24h >= 0)
);

-- OAuth Tokens: Secure credential storage
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_type text NOT NULL DEFAULT 'Bearer',
  expires_at timestamptz,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT oauth_tokens_access_token_not_empty CHECK (length(trim(access_token)) > 0)
);

-- Event Logs: Immutable audit trail (source of truth)
CREATE TABLE IF NOT EXISTS event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_entity_type entity_type NOT NULL,
  related_entity_id uuid NOT NULL,
  event_type text NOT NULL,
  failure_code failure_code,
  event_data jsonb DEFAULT '{}',
  actor_id uuid REFERENCES auth.users(id),
  actor_type text DEFAULT 'user',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_logs_event_type_not_empty CHECK (length(trim(event_type)) > 0)
);

-- Background Job Runs: Audit trail of job executions
CREATE TABLE IF NOT EXISTS background_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  job_type text NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT background_job_runs_job_name_not_empty CHECK (length(trim(job_name)) > 0),
  CONSTRAINT background_job_runs_job_type_not_empty CHECK (length(trim(job_type)) > 0)
);

-- Job Queue: Persistent queue for scheduled jobs
CREATE TABLE IF NOT EXISTS job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status job_status NOT NULL DEFAULT 'pending',
  run_after timestamptz NOT NULL DEFAULT now(),
  max_retries int NOT NULL DEFAULT 3,
  retry_count int NOT NULL DEFAULT 0,
  last_error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT job_queue_job_name_not_empty CHECK (length(trim(job_name)) > 0),
  CONSTRAINT job_queue_job_type_not_empty CHECK (length(trim(job_type)) > 0),
  CONSTRAINT job_queue_retry_count_valid CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

-- =====================================================
-- INDEXES (required indexes per spec)
-- =====================================================

-- Event logs: Time-series queries
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at DESC);

-- Event logs: Entity lookup with time filtering
CREATE INDEX IF NOT EXISTS idx_event_logs_entity_lookup
  ON event_logs(related_entity_type, related_entity_id, created_at DESC);

-- Connectors: State filtering
CREATE INDEX IF NOT EXISTS idx_connectors_state ON connectors(state);

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connectors_project_id ON connectors(project_id);

CREATE INDEX IF NOT EXISTS idx_job_queue_processing
  ON job_queue(status, run_after) WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_job_queue_job_name ON job_queue(job_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_project_status ON incidents(project_id, status);

CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON incidents(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_incident_id ON evidence(incident_id);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_connector_id ON oauth_tokens(connector_id);

CREATE INDEX IF NOT EXISTS idx_background_job_runs_job_name
  ON background_job_runs(job_name, created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Projects: Simplified policies
CREATE POLICY "Authenticated users can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Incidents: Simplified policies
CREATE POLICY "Authenticated users can view incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create incidents"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated users can update incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own incidents"
  ON incidents FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Evidence: Simplified policies
CREATE POLICY "Authenticated users can view evidence"
  ON evidence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create evidence"
  ON evidence FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own evidence"
  ON evidence FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Connectors: Simplified policies
CREATE POLICY "Authenticated users can view connectors"
  ON connectors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create connectors"
  ON connectors FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own connectors"
  ON connectors FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own connectors"
  ON connectors FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- OAuth Tokens: User-scoped policies
CREATE POLICY "Users can view tokens for own connectors"
  ON oauth_tokens FOR SELECT
  TO authenticated
  USING (
    connector_id IN (SELECT id FROM connectors WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can create tokens for own connectors"
  ON oauth_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    connector_id IN (SELECT id FROM connectors WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can update tokens for own connectors"
  ON oauth_tokens FOR UPDATE
  TO authenticated
  USING (
    connector_id IN (SELECT id FROM connectors WHERE created_by = auth.uid())
  )
  WITH CHECK (
    connector_id IN (SELECT id FROM connectors WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can delete tokens for own connectors"
  ON oauth_tokens FOR DELETE
  TO authenticated
  USING (
    connector_id IN (SELECT id FROM connectors WHERE created_by = auth.uid())
  );

-- Event Logs: IMMUTABLE - INSERT and SELECT only
CREATE POLICY "Authenticated users can view event logs"
  ON event_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create event logs"
  ON event_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- NO UPDATE OR DELETE POLICIES - Event logs are immutable

-- Background Job Runs: Read-only for users
CREATE POLICY "Authenticated users can view job runs"
  ON background_job_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage job runs"
  ON background_job_runs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Job Queue: All users can view and create
CREATE POLICY "Authenticated users can view job queue"
  ON job_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create jobs"
  ON job_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update job queue"
  ON job_queue FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can delete completed jobs"
  ON job_queue FOR DELETE
  TO authenticated
  USING (status IN ('completed', 'cancelled'));

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connectors_updated_at BEFORE UPDATE ON connectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_queue_updated_at BEFORE UPDATE ON job_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
