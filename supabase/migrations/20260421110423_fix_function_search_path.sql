/*
  # Fix mutable search_path on trigger functions

  ## Summary
  Two trigger functions lack a `SET search_path` declaration, which means a
  malicious user could potentially shadow public functions by creating objects
  in a schema earlier in the search path. Adding `SET search_path TO 'public'`
  locks the functions to the public schema.

  ## Functions updated
  1. policy_versions_immutable — enforces immutability of policy_versions rows
  2. prevent_event_ledger_mutation — enforces append-only semantics on event_ledger

  ## Method
  DROP and recreate with identical bodies plus SET search_path TO 'public'.
*/

CREATE OR REPLACE FUNCTION public.policy_versions_immutable()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Standard doctrine: immutable after creation.
  -- Narrow exception: explicit USER_CONFIRMED promotion from sanctioned RPC.
  IF current_setting('app.policy_user_confirm_override', true) = 'on'
     AND NEW.confidence_tier = 'USER_CONFIRMED'
     AND OLD.confidence_tier <> 'USER_CONFIRMED'
     AND NEW.policy_id = OLD.policy_id
     AND NEW.version_number = OLD.version_number
     AND NEW.content_hash = OLD.content_hash
     AND NEW.normalization_pipeline_version = OLD.normalization_pipeline_version
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'policy_versions is immutable after creation';
END;
$function$;


CREATE OR REPLACE FUNCTION public.prevent_event_ledger_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  new_wo jsonb;
  old_wo jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'event_ledger is append-only: DELETE operations are forbidden';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    new_wo := to_jsonb(NEW::public.event_ledger) - 'metadata';
    old_wo := to_jsonb(OLD::public.event_ledger) - 'metadata';
    IF new_wo = old_wo
       AND NEW.metadata = (COALESCE(OLD.metadata, '{}'::jsonb) || jsonb_build_object('pii_redacted', true))
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'event_ledger is append-only: UPDATE operations are forbidden';
  END IF;

  RETURN NEW;
END;
$function$;
