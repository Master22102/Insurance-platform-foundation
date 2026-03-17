/*
  # Fix event_logs.actor_id Foreign Key Constraint

  ## Problem
  The initial schema declares `actor_id uuid REFERENCES auth.users(id)` which blocks:
  - System operations with synthetic actor_ids
  - Test scenarios requiring non-user actors
  - Cross-environment portability

  ## Solution
  Remove the foreign key constraint while keeping the column nullable.
  The actor_type discriminator determines how to interpret actor_id.

  ## Preserves Immutability
  - event_logs table structure unchanged
  - RLS policies remain unchanged (prevent UPDATE/DELETE)
  - Insert-only semantics preserved

  ## Preserves Atomicity
  - Transaction boundaries unchanged
  - State changes and event_logs inserts still coupled
  - Rollback behavior identical

  ## Schema Changes
  Before: actor_id uuid REFERENCES auth.users(id)
  After:  actor_id uuid (no FK constraint, nullable)
*/

ALTER TABLE event_logs
  DROP CONSTRAINT IF EXISTS event_logs_actor_id_fkey;

DO $$
DECLARE
  constraint_count integer;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE table_name = 'event_logs'
    AND constraint_name = 'event_logs_actor_id_fkey'
    AND table_schema = 'public';

  IF constraint_count > 0 THEN
    RAISE EXCEPTION 'Failed to remove event_logs_actor_id_fkey constraint';
  END IF;

  RAISE NOTICE 'Successfully removed actor_id foreign key constraint';
END $$;

INSERT INTO event_logs (
  related_entity_type,
  related_entity_id,
  event_type,
  actor_type,
  actor_id,
  metadata
) VALUES (
  'system'::entity_type,
  gen_random_uuid(),
  'schema_migration_applied',
  'system',
  NULL,
  jsonb_build_object(
    'migration', 'fix_event_logs_actor_constraint',
    'change', 'removed_actor_id_fkey',
    'reason', 'enable_system_operations_and_testing'
  )
);