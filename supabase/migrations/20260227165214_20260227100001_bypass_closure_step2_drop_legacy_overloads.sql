/*
  # Bypass Closure Step 2: Drop legacy RPC overloads that bypass mutation guard

  ## Summary
  Drops the legacy short-signature overloads of three guarded RPCs.
  These overloads were created before the governance substrate and do not call
  precheck_mutation_guard(). Any caller using them silently bypasses the guard.

  ## Functions Dropped
  - change_incident_status(uuid, incident_status, uuid)  [3-arg]
  - change_incident_status(uuid, incident_status, uuid, text)  [4-arg, no region]
  - change_connector_state(uuid, connector_state, uuid)  [3-arg]
  - approve_connector_manual_review(uuid, uuid)  [2-arg]

  ## Functions Retained
  - change_incident_status(uuid, incident_status, uuid, text, uuid)  [5-arg with region]
  - change_connector_state(uuid, connector_state, uuid, uuid)  [4-arg with region]
  - approve_connector_manual_review(uuid, uuid, uuid)  [3-arg with region]
  - log_connector_failure(uuid, failure_code, uuid, text)  [4-arg, 5-arg: both call guard]
  - run_connector_health_check_job(uuid)  [1-arg, 2-arg: both call guard]

  ## Security
  After this migration, attempting to call the dropped signatures returns
  "function does not exist", preventing silent guard bypass.
*/

DROP FUNCTION IF EXISTS change_incident_status(uuid, incident_status, uuid);
DROP FUNCTION IF EXISTS change_incident_status(uuid, incident_status, uuid, text);
DROP FUNCTION IF EXISTS change_connector_state(uuid, connector_state, uuid);
DROP FUNCTION IF EXISTS approve_connector_manual_review(uuid, uuid);
