import fs from 'fs';
import path from 'path';
import { evaluateQuality, recommendParserMode, QualityMetrics, CaptureStatus } from './quality';
import { normalizeContent, NormalizedContent } from './normalize';

export interface HandoffManifest {
  source_url: string;
  mode_used: string;
  rendered_html_path: string;
  rendered_pdf_path: string;
  normalized_html_path: string | null;
  normalized_text_path: string | null;
  text_length: number;
  normalized_text_length: number | null;
  legal_keyword_count: number;
  legal_phrase_count: number;
  legal_density_score: number;
  ui_density_score: number;
  anti_bot_detected: boolean;
  anti_bot_indicators: string[];
  quality_score: number;
  status: CaptureStatus;
  recommended_parser_mode: string;
  warnings: string[];
  element_counts: {
    headings: number;
    paragraphs: number;
    lists: number;
    sections: number;
  } | null;
  removal_stats: {
    scripts: number;
    styles: number;
    nav: number;
    footer: number;
    header: number;
    forms: number;
    buttons: number;
    iframes: number;
  } | null;
  bytes_saved: number | null;
  debug_info: {
    matched_legal_keywords: string[];
    matched_legal_phrases: string[];
    matched_ui_keywords: string[];
    scoring_text_length: number;
  };
  pdf_preferred: boolean;
  detected_pdf_links: string[];
  selected_pdf_link: string | null;
  pdf_capture_status: 'not_attempted' | 'link_found' | 'downloaded' | 'failed' | 'not_applicable';
  generated_at: string;
}

export interface HandoffResult {
  manifest: HandoffManifest;
  quality: QualityMetrics;
  normalized: NormalizedContent | null;
  success: boolean;
  error?: string;
}

function detectPdfLinks(html: string, baseUrl: string): string[] {
  const pdfLinks: string[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    let pdfUrl = match[1];

    if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
      pdfLinks.push(pdfUrl);
    } else if (pdfUrl.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        pdfLinks.push(`${base.protocol}//${base.host}${pdfUrl}`);
      } catch {
        pdfLinks.push(pdfUrl);
      }
    } else if (pdfUrl.startsWith('./') || !pdfUrl.startsWith('http')) {
      try {
        const base = new URL(baseUrl);
        const resolved = new URL(pdfUrl, baseUrl);
        pdfLinks.push(resolved.href);
      } catch {
        pdfLinks.push(pdfUrl);
      }
    }
  }

  return Array.from(new Set(pdfLinks));
}

export function processHandoff(
  outputDir: string,
  targetName: string,
  targetUrl: string,
  mode: string
): HandoffResult {
  try {
    const htmlPath = path.join(outputDir, 'rendered.html');
    const pdfPath = path.join(outputDir, 'rendered.pdf');
    const textPath = path.join(outputDir, 'text-preview.txt');

    if (!fs.existsSync(htmlPath)) {
      throw new Error('rendered.html not found');
    }

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const text = fs.existsSync(textPath)
      ? fs.readFileSync(textPath, 'utf-8')
      : '';

    const quality = evaluateQuality(html, text);

    let normalized: NormalizedContent | null = null;
    let normalizedHtmlPath: string | null = null;
    let normalizedTextPath: string | null = null;

    if (quality.status === 'READY_FOR_PARSE' || quality.status === 'PARTIAL_CAPTURE') {
      normalized = normalizeContent(html);

      normalizedHtmlPath = 'normalized.html';
      normalizedTextPath = 'normalized.txt';

      fs.writeFileSync(
        path.join(outputDir, normalizedHtmlPath),
        normalized.html,
        'utf-8'
      );

      fs.writeFileSync(
        path.join(outputDir, normalizedTextPath),
        normalized.text,
        'utf-8'
      );
    }

    const detectedPdfLinks = detectPdfLinks(html, targetUrl);
    const isPdfPreferred = quality.status === 'PDF_PREFERRED';
    let pdfCaptureStatus: 'not_attempted' | 'link_found' | 'downloaded' | 'failed' | 'not_applicable' = 'not_applicable';
    let selectedPdfLink: string | null = null;

    if (isPdfPreferred) {
      if (detectedPdfLinks.length > 0) {
        selectedPdfLink = detectedPdfLinks[0];
        pdfCaptureStatus = 'link_found';
      } else {
        pdfCaptureStatus = 'not_attempted';
      }
    }

    const manifest: HandoffManifest = {
      source_url: targetUrl,
      mode_used: mode,
      rendered_html_path: 'rendered.html',
      rendered_pdf_path: 'rendered.pdf',
      normalized_html_path: normalizedHtmlPath,
      normalized_text_path: normalizedTextPath,
      text_length: quality.textLength,
      normalized_text_length: normalized ? normalized.text.length : null,
      legal_keyword_count: quality.legalKeywordCount,
      legal_phrase_count: quality.legalPhraseCount,
      legal_density_score: quality.legalKeywordDensity,
      ui_density_score: quality.uiKeywordDensity,
      anti_bot_detected: quality.antiBotDetected,
      anti_bot_indicators: quality.antiBotIndicators,
      quality_score: quality.qualityScore,
      status: quality.status,
      recommended_parser_mode: recommendParserMode(quality.status, quality.qualityScore),
      warnings: quality.warnings,
      element_counts: normalized ? normalized.elementCounts : null,
      removal_stats: normalized ? normalized.removalStats : null,
      bytes_saved: normalized ? normalized.bytesSaved : null,
      debug_info: {
        matched_legal_keywords: quality.debugInfo.matchedLegalKeywords,
        matched_legal_phrases: quality.debugInfo.matchedLegalPhrases,
        matched_ui_keywords: quality.debugInfo.matchedUIKeywords,
        scoring_text_length: quality.debugInfo.scoringTextLength,
      },
      pdf_preferred: isPdfPreferred,
      detected_pdf_links: detectedPdfLinks,
      selected_pdf_link: selectedPdfLink,
      pdf_capture_status: pdfCaptureStatus,
      generated_at: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(outputDir, 'handoff-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    return {
      manifest,
      quality,
      normalized,
      success: true,
    };
  } catch (error) {
    return {
      manifest: {
        source_url: targetUrl,
        mode_used: mode,
        rendered_html_path: 'rendered.html',
        rendered_pdf_path: 'rendered.pdf',
        normalized_html_path: null,
        normalized_text_path: null,
        text_length: 0,
        normalized_text_length: null,
        legal_keyword_count: 0,
        legal_phrase_count: 0,
        legal_density_score: 0,
        ui_density_score: 0,
        anti_bot_detected: false,
        anti_bot_indicators: [],
        quality_score: 0,
        status: 'SHELL_ONLY',
        recommended_parser_mode: 'unknown',
        warnings: ['Handoff processing failed'],
        element_counts: null,
        removal_stats: null,
        bytes_saved: null,
        debug_info: {
          matched_legal_keywords: [],
          matched_legal_phrases: [],
          matched_ui_keywords: [],
          scoring_text_length: 0,
        },
        pdf_preferred: false,
        detected_pdf_links: [],
        selected_pdf_link: null,
        pdf_capture_status: 'not_applicable',
        generated_at: new Date().toISOString(),
      },
      quality: {
        textLength: 0,
        normalizedTextLength: 0,
        legalKeywordCount: 0,
        legalPhraseCount: 0,
        legalKeywordDensity: 0,
        uiKeywordCount: 0,
        uiKeywordDensity: 0,
        headingCount: 0,
        headingDensity: 0,
        antiBotIndicators: [],
        antiBotDetected: false,
        qualityScore: 0,
        status: 'SHELL_ONLY',
        warnings: ['Handoff processing failed'],
        debugInfo: {
          matchedLegalKeywords: [],
          matchedLegalPhrases: [],
          matchedUIKeywords: [],
          scoringTextLength: 0,
        },
      },
      normalized: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
