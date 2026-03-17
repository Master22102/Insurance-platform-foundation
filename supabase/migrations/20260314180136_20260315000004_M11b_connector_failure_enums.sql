/*
  # M11b — Connector Type & Failure Code Enum Extensions

  ## Summary
  Extends two existing PostgreSQL enum types with new values required for
  the airline verification and OAuth inbox connectors, and for richer
  failure diagnostic codes.

  ## Modified Enums

  ### connector_type (existing values: github, gitlab, jira, slack, google_workspace, microsoft_365, aws, azure, custom)
  New values added:
    - airline_verification  — airline PNR/loyalty connector
    - oauth_inbox_gmail     — Gmail OAuth inbox connector
    - oauth_inbox_microsoft — Microsoft/Outlook OAuth inbox connector
    - oauth_inbox_yahoo     — Yahoo Mail OAuth inbox connector

  ### failure_code (existing values: timeout, auth_failed, structure_changed, rate_limited, unknown)
  New values added:
    - captcha_detected       — site returned a CAPTCHA challenge
    - site_unreachable       — DNS / TCP / HTTP connectivity failure
    - validation_error       — response was reachable but failed schema validation
    - unexpected_response    — HTTP 2xx but payload shape not recognised
    - html_structure_changed — HTML DOM layout changed, selectors broke (more specific than structure_changed)

  ## Notes
  - ALTER TYPE ... ADD VALUE IF NOT EXISTS is safe to run multiple times
  - New enum values are appended; existing orderings are not affected
  - No table alterations needed — columns already typed to these enums
*/


-- =============================================================================
-- connector_type additions
-- =============================================================================

ALTER TYPE connector_type ADD VALUE IF NOT EXISTS 'airline_verification';
ALTER TYPE connector_type ADD VALUE IF NOT EXISTS 'oauth_inbox_gmail';
ALTER TYPE connector_type ADD VALUE IF NOT EXISTS 'oauth_inbox_microsoft';
ALTER TYPE connector_type ADD VALUE IF NOT EXISTS 'oauth_inbox_yahoo';


-- =============================================================================
-- failure_code additions
-- =============================================================================

ALTER TYPE failure_code ADD VALUE IF NOT EXISTS 'captcha_detected';
ALTER TYPE failure_code ADD VALUE IF NOT EXISTS 'site_unreachable';
ALTER TYPE failure_code ADD VALUE IF NOT EXISTS 'validation_error';
ALTER TYPE failure_code ADD VALUE IF NOT EXISTS 'unexpected_response';
ALTER TYPE failure_code ADD VALUE IF NOT EXISTS 'html_structure_changed';
