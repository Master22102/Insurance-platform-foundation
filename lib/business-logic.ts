import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Business Logic Module
 *
 * Single source of truth for state machine rules.
 * All state transitions are transactional (state + event_logs atomically).
 * API routes must call these functions and not duplicate rules.
 *
 * Each function accepts a SupabaseClient instance — callers are responsible
 * for providing the appropriate client (e.g., from createServerClient() in
 * a request context, or a service-role client for scheduled jobs).
 */

export type BusinessResult<T = void> = {
  success: boolean;
  error?: string;
  data?: T;
};

export type IncidentStatusChangeResult = BusinessResult<{
  from: string;
  to: string;
}>;

export type ConnectorStateChangeResult = BusinessResult<{
  from: string;
  to: string;
}>;

export type ConnectorFailureResult = BusinessResult<{
  failure_logged: boolean;
  total_failures_24h: number;
  structure_failures_24h: number;
  state_changed: boolean;
  previous_state: string;
  current_state: string;
  downgrade_reason?: string;
}>;

export type HealthCheckResult = BusinessResult<{
  processed_count: number;
  downgraded_count: number;
}>;

/**
 * Change incident status with validation
 *
 * Rule A: Capture → Action requires evidence to exist
 *
 * Transaction: Updates incident.status AND logs event atomically
 *
 * @param supabase - SupabaseClient instance
 * @param incidentId - UUID of the incident
 * @param newStatus - Target status (Capture, Review, or Action)
 * @param actorId - UUID of the user making the change
 * @returns Result with success/error and transition details
 */
export async function changeIncidentStatus(
  supabase: SupabaseClient,
  incidentId: string,
  newStatus: 'Capture' | 'Review' | 'Action',
  actorId: string,
  reasonCode?: string,
  regionId: string = '00000000-0000-0000-0000-000000000000'
): Promise<IncidentStatusChangeResult> {
  try {
    const { data, error } = await supabase.rpc('change_incident_status', {
      p_incident_id: incidentId,
      p_new_status: newStatus,
      p_actor_id: actorId,
      p_reason_code: reasonCode ?? null,
      p_region_id: regionId,
    });

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Status change failed',
      };
    }

    return {
      success: true,
      data: {
        from: data.from,
        to: data.to,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Change connector state with validation
 *
 * Rule B: ManualOnly → Enabled requires manual_review_approved event
 *
 * Transaction: Updates connector.state AND logs event atomically
 *
 * @param supabase - SupabaseClient instance
 * @param connectorId - UUID of the connector
 * @param newState - Target state (Enabled, Degraded, ManualOnly, UnderReview)
 * @param actorId - UUID of the user making the change
 * @returns Result with success/error and transition details
 */
export async function changeConnectorState(
  supabase: SupabaseClient,
  connectorId: string,
  newState: 'Enabled' | 'Degraded' | 'ManualOnly' | 'UnderReview',
  actorId: string,
  regionId: string = '00000000-0000-0000-0000-000000000000'
): Promise<ConnectorStateChangeResult> {
  try {
    const { data, error } = await supabase.rpc('change_connector_state', {
      p_connector_id: connectorId,
      p_new_state: newState,
      p_actor_id: actorId,
      p_region_id: regionId,
    });

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'State change failed',
      };
    }

    return {
      success: true,
      data: {
        from: data.from,
        to: data.to,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Approve connector for manual review
 *
 * Required before ManualOnly → Enabled transition
 * Creates manual_review_approved event in event_logs
 *
 * @param supabase - SupabaseClient instance
 * @param connectorId - UUID of the connector
 * @param actorId - UUID of the user approving the review
 * @returns Result with success/error
 */
export async function approveConnectorManualReview(
  supabase: SupabaseClient,
  connectorId: string,
  actorId: string,
  regionId: string = '00000000-0000-0000-0000-000000000000'
): Promise<BusinessResult> {
  try {
    const { data, error } = await supabase.rpc('approve_connector_manual_review', {
      p_connector_id: connectorId,
      p_actor_id: actorId,
      p_region_id: regionId,
    });

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Approval failed',
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Log connector failure and apply auto-downgrade rules
 *
 * Rule C: Rolling 24-hour downgrade checks computed from event_logs
 * - 10+ total failures in 24h + Enabled → Degraded
 * - 3+ structure_changed failures in 24h → ManualOnly
 *
 * Transaction: Logs failure event AND updates state if thresholds exceeded
 *
 * @param supabase - SupabaseClient instance
 * @param connectorId - UUID of the connector
 * @param failureCode - Type of failure (timeout, auth_failed, structure_changed, rate_limited, unknown)
 * @param actorId - UUID of the user/system logging the failure
 * @param errorDetails - Optional error message or details
 * @returns Result with failure counts and auto-downgrade information
 */
export async function logConnectorFailure(
  supabase: SupabaseClient,
  connectorId: string,
  failureCode: 'timeout' | 'auth_failed' | 'structure_changed' | 'rate_limited' | 'unknown',
  actorId: string,
  errorDetails?: string
): Promise<ConnectorFailureResult> {
  try {
    const { data, error } = await supabase.rpc('log_connector_failure', {
      p_connector_id: connectorId,
      p_failure_code: failureCode,
      p_actor_id: actorId,
      p_error_details: errorDetails || null,
    });

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Failure logging failed',
      };
    }

    return {
      success: true,
      data: {
        failure_logged: data.failure_logged,
        total_failures_24h: data.total_failures_24h,
        structure_failures_24h: data.structure_failures_24h,
        state_changed: data.state_changed,
        previous_state: data.previous_state,
        current_state: data.current_state,
        downgrade_reason: data.downgrade_reason,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Run health check job for all connectors
 *
 * Processes all Enabled/Degraded connectors:
 * - Recalculates failure counts from event_logs (rolling 24h)
 * - Updates failure_count_24h field
 * - Applies auto-downgrade rules if thresholds exceeded
 *
 * Intended for scheduled execution (Mode A: script or Mode B: HTTP cron)
 *
 * @param supabase - SupabaseClient instance
 * @param actorId - Optional UUID of the user/system running the check
 * @returns Result with processed and downgraded counts
 */
export async function runConnectorHealthCheckJob(
  supabase: SupabaseClient,
  actorId?: string
): Promise<HealthCheckResult> {
  try {
    const { data, error } = await supabase.rpc('run_connector_health_check_job', {
      p_actor_id: actorId || null,
    });

    if (error) {
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Health check failed',
      };
    }

    return {
      success: true,
      data: {
        processed_count: data.processed_count,
        downgraded_count: data.downgraded_count,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}
