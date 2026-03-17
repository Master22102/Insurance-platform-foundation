export * from './types';
export * from './clause-taxonomy';
export * from './phrase-clusters';
export * from './reader';
export * from './segmenter';
export * from './clause-detector';
export * from './confidence';
export * from './promotion';
export * from './conflict-resolution';

import { readDocument } from './reader';
import { segmentText } from './segmenter';
import { detectClauses } from './clause-detector';
import { assignConfidenceToCandidates } from './confidence';
import { promoteRules } from './promotion';
import { ProcessingResult, ClauseCandidate } from './types';
import { runClauseFamilyPass } from './clause-family-passes';
import {
  getAllDelayThresholdClusters,
  getAllLiabilityClusters,
  getAllRefundCancellationClusters,
  getAllDocumentationClusters,
  getAllPaymentEligibilityClusters,
  getAllMedicalInsuranceClusters,
  getAllRentalCarClusters,
  getAllCruiseBookingClusters,
  getAllAdditionalInsuranceClusters,
  getAllEuPassengerRightsClusters,
} from './pass-phrase-clusters';
import { consolidateCandidates } from './consolidation';
import { normalizeCandidates } from './normalizer';
import { resolveConflicts, generateConflictReport } from './conflict-resolution';

export async function processDocument(filePath: string, fileName: string): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    fileName,
    fileType: getFileType(fileName),
    extraction: { success: false, method: '', text: '', metadata: { fileSize: 0, extractedLength: 0 } },
    sections: [],
    candidates: [],
    promotedRules: [],
    warnings: [],
    errors: [],
  };

  try {
    result.extraction = await readDocument(filePath);

    if (!result.extraction.success) {
      result.errors.push(`Extraction failed: ${result.extraction.error}`);
      return result;
    }

    result.sections = segmentText(result.extraction.text);

    if (result.sections.length === 0) {
      result.warnings.push('No sections detected in document');
    }

    const rawCandidates: ClauseCandidate[] = [];

    rawCandidates.push(...runClauseFamilyPass(
      'delay-threshold-pass',
      getAllDelayThresholdClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'liability-pass',
      getAllLiabilityClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'refund-cancellation-pass',
      getAllRefundCancellationClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'documentation-requirements-pass',
      getAllDocumentationClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'payment-eligibility-pass',
      getAllPaymentEligibilityClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'medical-insurance-pass',
      getAllMedicalInsuranceClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'rental-car-pass',
      getAllRentalCarClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'cruise-booking-pass',
      getAllCruiseBookingClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'additional-insurance-pass',
      getAllAdditionalInsuranceClusters(),
      result.sections
    ));

    rawCandidates.push(...runClauseFamilyPass(
      'eu-passenger-rights-pass',
      getAllEuPassengerRightsClusters(),
      result.sections
    ));

    const { consolidated, metrics } = consolidateCandidates(rawCandidates);

    result.consolidationMetrics = {
      beforeCount: metrics.beforeCount,
      afterCount: metrics.afterCount,
      reductionCount: metrics.reductionCount,
      reductionPercent: metrics.reductionPercent,
      conflictsDetected: metrics.conflictsDetected,
    };

    const { normalized, metrics: normMetrics } = normalizeCandidates(consolidated);

    result.normalizationMetrics = {
      beforeCount: normMetrics.beforeCount,
      afterCount: normMetrics.afterCount,
      normalizedCount: normMetrics.normalizedCount,
      normalizationRate: normMetrics.normalizationRate,
    };

    const candidatesWithConfidence = assignConfidenceToCandidates(normalized);

    const conflictResolution = resolveConflicts(candidatesWithConfidence);

    result.candidates = conflictResolution.candidates;
    result.conflictResolutionMetrics = conflictResolution.resolutionMetrics;

    if (conflictResolution.resolutionMetrics.blockingConflictsAfter > 0) {
      const conflictReport = generateConflictReport(conflictResolution);
      result.warnings.push(...conflictReport);
    }

    if (result.candidates.length === 0) {
      result.warnings.push('No clause candidates detected');
    }

    result.promotedRules = promoteRules(result.candidates);

    if (result.promotedRules.length === 0 && result.candidates.length > 0) {
      result.warnings.push('No candidates met promotion criteria');
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'PDF';
    case 'html':
    case 'htm':
      return 'HTML';
    case 'mhtml':
    case 'mht':
      return 'MHTML';
    case 'txt':
      return 'TXT';
    case 'xml':
      return 'XML';
    default:
      return 'UNKNOWN';
  }
}
