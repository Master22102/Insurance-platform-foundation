/*
  # Clause timer scheduler

  1. Enables pg_cron so timer elapse is emitted without an external worker.
  2. Schedules emit_elapsed_clause_timers() every 5 minutes.
  3. Stores the job id so future migrations can safely update or unschedule it.

  ## Notes
  - The job runs under the postgres role (pg_cron default).
  - Safe to re-run: unschedules any prior 'clause_timer_tick' job first.
  - emit_elapsed_clause_timers already exists and is SECURITY DEFINER.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'clause_timer_tick';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'clause_timer_tick',
  '*/5 * * * *',
  $$SELECT public.emit_elapsed_clause_timers();$$
);
