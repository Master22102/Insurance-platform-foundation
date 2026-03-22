/** Contexts accepted by /api/voice/parse and VoiceNarrationPanel */
export type VoiceParseContext =
  | 'incident_create'
  | 'incident_update'
  | 'carrier_response'
  | 'evidence_description'
  | 'route_segment'
  | 'signal_capture'
  | 'signal_categorize';

export type VoiceCaptureContext = VoiceParseContext | 'trip_draft' | 'signal_capture';
