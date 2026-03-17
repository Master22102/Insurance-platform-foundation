/*
  # M-07: Create coverage graph tables
  
  1. New Tables
    - coverage_graph_snapshots: versioned coverage computation results per trip
    - coverage_nodes: individual coverage nodes with policy references and overlap detection
  
  2. Security
    - RLS enabled with trip-scoped access through trips table
*/

CREATE TABLE IF NOT EXISTS coverage_graph_snapshots (
  snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(trip_id),
  snapshot_version integer NOT NULL DEFAULT 1,
  computation_timestamp timestamptz NOT NULL DEFAULT now(),
  input_hash text NOT NULL,
  graph_status text NOT NULL DEFAULT 'COMPUTING'
    CHECK (graph_status IN ('COMPUTING','COMPLETE','STALE','FAILED')),
  itr_trace_id uuid REFERENCES interpretive_trace_records(trace_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coverage_nodes (
  node_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES coverage_graph_snapshots(snapshot_id),
  node_type text NOT NULL,
  policy_version_id uuid REFERENCES policy_versions(version_id),
  benefit_type text,
  coverage_trigger_clause_id uuid,
  exclusion_clause_ids uuid[],
  primacy_rank integer,
  overlap_flags jsonb,
  confidence_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coverage_graph_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cgs_select ON coverage_graph_snapshots FOR SELECT
  USING (trip_id IN (SELECT trip_id FROM trips WHERE created_by = auth.uid()));

CREATE POLICY cn_select ON coverage_nodes FOR SELECT
  USING (snapshot_id IN (SELECT snapshot_id FROM coverage_graph_snapshots
    WHERE trip_id IN (SELECT trip_id FROM trips WHERE created_by = auth.uid())));