'use client';

import { supabase } from '@/lib/auth/supabase-client';

export type DraftHomeBlocker = {
  item_type: string;
  item_title: string | null;
  description: string;
  severity: 'critical' | 'warning';
};

export type DraftHomeActivityCandidateInput = {
  activity_name: string;
  activity_category: string | null;
  decision: 'accepted' | 'rejected' | 'deferred';
};

export async function ensureTripDraftVersion(params: {
  tripId: string;
  actorId: string;
  draftState?: string;
  narrationText?: string;
}): Promise<{ success: boolean; draft_version_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('ensure_trip_draft_version', {
    p_trip_id: params.tripId,
    p_actor_id: params.actorId,
    p_draft_state: params.draftState ?? null,
    p_narration_text: params.narrationText ?? null,
  });
  if (error) throw error;
  return data as any;
}

export async function syncTripDraftRouteSegments(params: {
  tripId: string;
  actorId: string;
  routeSegmentIds: string[];
}): Promise<{ success: boolean; error?: string; draft_version_id?: string }> {
  const { data, error } = await supabase.rpc('sync_trip_draft_version_route_segments', {
    p_trip_id: params.tripId,
    p_actor_id: params.actorId,
    p_route_segment_ids: params.routeSegmentIds,
  });
  if (error) throw error;
  return data as any;
}

export async function syncTripDraftActivities(params: {
  tripId: string;
  actorId: string;
  candidates: DraftHomeActivityCandidateInput[];
}): Promise<{ success: boolean; error?: string; draft_version_id?: string }> {
  const { data, error } = await supabase.rpc('sync_trip_draft_activities', {
    p_trip_id: params.tripId,
    p_actor_id: params.actorId,
    p_candidates: (params.candidates || []).map((c) => ({
      activity_name: c.activity_name,
      activity_category: c.activity_category,
      decision: c.decision,
    })),
  });
  if (error) throw error;
  return data as any;
}

export async function syncTripDraftUnresolvedItems(params: {
  tripId: string;
  actorId: string;
  blockers: Array<{
    item_type: string;
    item_title: string | null;
    description: string;
    severity: 'critical' | 'warning';
    fix_screen?: string | null;
  }>;
}): Promise<{ success: boolean; error?: string; draft_version_id?: string }> {
  const { data, error } = await supabase.rpc('sync_trip_draft_unresolved_items', {
    p_trip_id: params.tripId,
    p_actor_id: params.actorId,
    p_blockers: (params.blockers || []).map((b) => ({
      item_type: b.item_type,
      item_title: b.item_title,
      description: b.description,
      severity: b.severity,
      fix_screen: b.fix_screen ?? null,
    })),
  });
  if (error) throw error;
  return data as any;
}

export async function evaluateTripReadiness(params: {
  tripId: string;
  actorId: string;
}): Promise<{ success: boolean; ready: boolean; blockers: DraftHomeBlocker[] }>{
  const { data, error } = await supabase.rpc('evaluate_trip_readiness', {
    p_trip_id: params.tripId,
    p_actor_id: params.actorId,
  });
  if (error) throw error;
  return data as any;
}

export async function resolveTripDraftUnresolvedItem(params: {
  tripId: string;
  actorId: string;
  itemType: string;
  resolutionNotes?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('resolve_trip_draft_unresolved_item', {
    p_trip_id: params.tripId,
    p_actor_id: params.actorId,
    p_item_type: params.itemType,
    p_resolution_notes: params.resolutionNotes ?? null,
  });
  if (error) throw error;
  return data as any;
}

