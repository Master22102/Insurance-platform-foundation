/**
 * Product rule: max 2 full regenerations after the initial packet (v1).
 * When packet_version reaches 4, further regeneration should be blocked in UI (download remains).
 */
export const PACKET_VERSION_REGENERATION_BLOCKED_MIN = 4;
