/*
  # Fix duplicate and overly-permissive RLS policies

  ## Summary
  Addresses three categories of remaining policy issues:

  1. **trips** — "Authenticated users can view projects" has `USING (true)`, which
     makes ALL trips visible to any authenticated user regardless of ownership.
     This conflicts with the properly scoped `trips_select` policy and the
     group-participant policy. The open policy is the root cause — drop it.

  2. **event_ledger** — Two identical SELECT policies both use `USING (true)`.
     Drop the older-named duplicate; keep "Authenticated users can read event_ledger".

  3. **job_queue** — Two SELECT policies for `authenticated`: one with `true` and
     one that scopes to the user's own jobs. The open `true` policy makes the
     scoped one redundant and exposes all jobs to any authenticated user.
     Replace the open one with a proper ownership check.

  ## Security impact
  - trips: Prevents unauthenticated cross-account trip visibility
  - job_queue: Prevents any authenticated user from seeing all queued jobs
*/

-- ============================================================
-- trips: drop the open "authenticated can view all" policy
-- Proper access is granted by trips_select (own trips),
-- trips_select_group_participant, and trips_select_pending_invite_context
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.trips;

-- ============================================================
-- event_ledger: drop the duplicate SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view event logs" ON public.event_ledger;

-- ============================================================
-- job_queue: replace the open SELECT policy with ownership-scoped one
-- The existing job_queue_user_select already handles user-scoped access.
-- Drop the open policy; the user-scoped one remains.
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view job queue" ON public.job_queue;

-- ============================================================
-- trips_select_pending_invite_context: fix auth.uid() calls inside
-- ============================================================
DROP POLICY IF EXISTS "trips_select_pending_invite_context" ON public.trips;
CREATE POLICY "trips_select_pending_invite_context"
  ON public.trips FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.relationship_verification_requests r
    WHERE r.trip_id = trips.trip_id
      AND r.status = 'pending'
      AND (r.subject_id = (select auth.uid()) OR r.guardian_id = (select auth.uid()))
  ));
