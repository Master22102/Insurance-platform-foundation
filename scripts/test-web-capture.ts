import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { webCaptureTargets } from '../configs/web-capture-targets';
import { processHandoff, HandoffResult } from '../lib/web-capture/handoff';
import { processDocument } from '../lib/document-intelligence';
import { ProcessingResult } from '../lib/document-intelligence/types';

interface CaptureResult {
  name: string;
  url: string;
  mode: string;
  success: boolean;
  textLength: number;
  expandedElements: number;
  pdfGenerated: boolean;
  interactions: string[];
  artifactDir: string;
  warnings: string[];
  error?: string;
  handoff?: HandoffResult;
  parserResult?: ProcessingResult;
  parserRan: boolean;
}

const OUTPUT_BASE = path.join(process.cwd(), 'tmp', 'web-capture');

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function setupOutputDir(name: string): Promise<string> {
  const slug = slugify(name);
  const dir = path.join(OUTPUT_BASE, slug);

  if (!fs.existsSync(OUTPUT_BASE)) {
    fs.mkdirSync(OUTPUT_BASE, { recursive: true });
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

async function waitForNetworkIdle(page: Page, timeout = 30000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (error) {
    console.log('  Warning: Network idle timeout, continuing anyway');
  }
}

async function expandAccordions(page: Page): Promise<number> {
  let expandedCount = 0;

  const accordionSelectors = [
    'details',
    '[role="button"][aria-expanded="false"]',
    'button[aria-expanded="false"]',
    '.accordion:not(.open)',
    '.collapse:not(.show)',
    '[data-toggle="collapse"]',
    '.expandable:not(.expanded)',
  ];

  for (const selector of accordionSelectors) {
    try {
      const elements = await page.$$(selector);
      for (const element of elements) {
        try {
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click({ timeout: 1000 });
            expandedCount++;
            await page.waitForTimeout(200);
          }
        } catch (error) {
          // Skip elements that can't be clicked
        }
      }
    } catch (error) {
      // Selector not found or error, continue
    }
  }

  return expandedCount;
}

async function performDropdownInteraction(page: Page, interactions: any): Promise<string[]> {
  const actions: string[] = [];

  if (interactions.selectCountry) {
    try {
      await page.selectOption('select[name*="country" i], select[id*="country" i]',
        { label: interactions.selectCountry });
      actions.push(`Selected country: ${interactions.selectCountry}`);
      await page.waitForTimeout(1000);
    } catch (error) {
      actions.push(`Failed to select country: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return actions;
}

async function captureTarget(
  browser: Browser,
  target: typeof webCaptureTargets[0]
): Promise<CaptureResult> {
  const result: CaptureResult = {
    name: target.name,
    url: target.url,
    mode: target.mode,
    success: false,
    textLength: 0,
    expandedElements: 0,
    pdfGenerated: false,
    interactions: [],
    artifactDir: '',
    warnings: [],
    parserRan: false,
  };

  let page: Page | null = null;

  try {
    const outputDir = await setupOutputDir(target.name);
    result.artifactDir = outputDir;

    page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });

    console.log(`\nProcessing: ${target.name}`);
    console.log(`  URL: ${target.url}`);
    console.log(`  Mode: ${target.mode}`);

    await page.goto(target.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await waitForNetworkIdle(page);

    if (target.mode === 'dropdown' && target.interactions) {
      console.log('  Performing dropdown interactions...');
      result.interactions = await performDropdownInteraction(page, target.interactions);
      await waitForNetworkIdle(page);
    }

    if (target.mode === 'expand_and_capture') {
      console.log('  Expanding accordion elements...');
      result.expandedElements = await expandAccordions(page);
      console.log(`  Expanded ${result.expandedElements} elements`);
      await page.waitForTimeout(1000);
    }

    const htmlContent = await page.content();
    fs.writeFileSync(path.join(outputDir, 'rendered.html'), htmlContent, 'utf-8');

    const textContent = await page.evaluate(() => {
      const main = document.querySelector('main, article, [role="main"]');
      return main ? main.textContent : document.body.textContent;
    });

    result.textLength = textContent?.length || 0;

    const textPreview = (textContent || '').substring(0, 2000);
    fs.writeFileSync(path.join(outputDir, 'text-preview.txt'), textPreview, 'utf-8');

    await page.pdf({
      path: path.join(outputDir, 'rendered.pdf'),
      format: 'A4',
      printBackground: true,
    });
    result.pdfGenerated = true;

    const metadata = {
      name: target.name,
      url: target.url,
      mode: target.mode,
      capturedAt: new Date().toISOString(),
      textLength: result.textLength,
      expandedElements: result.expandedElements,
      interactions: result.interactions,
      htmlSize: htmlContent.length,
      warnings: result.warnings,
    };

    fs.writeFileSync(
      path.join(outputDir, 'capture-metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    result.success = true;

    console.log(`  ✓ HTML captured: ${htmlContent.length} bytes`);
    console.log(`  ✓ PDF generated`);
    console.log(`  ✓ Text length: ${result.textLength} characters`);
    console.log(`  ✓ Artifacts saved to: ${outputDir}`);

    console.log('  Running quality gate and normalization...');
    const handoffResult = processHandoff(outputDir, target.name, target.url, target.mode);
    result.handoff = handoffResult;

    if (handoffResult.success) {
      console.log(`  ✓ Quality Score: ${handoffResult.quality.qualityScore}/100`);
      console.log(`  ✓ Status: ${handoffResult.quality.status}`);
      console.log(`  ✓ Legal Density: ${(handoffResult.quality.legalKeywordDensity * 100).toFixed(3)}%`);
      console.log(`  ✓ Parser Mode: ${handoffResult.manifest.recommended_parser_mode}`);

      if (handoffResult.normalized) {
        console.log(`  ✓ Normalized: ${handoffResult.normalized.bytesSaved.toLocaleString()} bytes saved`);
      }

      if (handoffResult.quality.antiBotDetected) {
        console.log(`  ⚠ Anti-bot detected: ${handoffResult.quality.antiBotIndicators.join(', ')}`);
      }

      const shouldParse =
        handoffResult.manifest.recommended_parser_mode === 'document-intelligence' &&
        (handoffResult.quality.status === 'READY_FOR_PARSE' ||
         handoffResult.quality.status === 'PARTIAL_CAPTURE');

      if (shouldParse && handoffResult.normalized) {
        console.log('  Running document intelligence parser...');
        try {
          const normalizedHtmlPath = path.join(outputDir, 'normalized.html');
          const parserResult = await processDocument(normalizedHtmlPath, 'normalized.html');
          result.parserResult = parserResult;
          result.parserRan = true;

          console.log(`  ✓ Parser complete: ${parserResult.sections.length} sections, ${parserResult.candidates.length} candidates, ${parserResult.promotedRules.length} promoted`);
        } catch (parserError) {
          console.log(`  ✗ Parser failed: ${parserError instanceof Error ? parserError.message : String(parserError)}`);
          result.warnings.push(`Parser failed: ${parserError instanceof Error ? parserError.message : String(parserError)}`);
        }
      } else if (shouldParse && !handoffResult.normalized) {
        console.log('  ⚠ Parser recommended but no normalized content available');
      }
    } else {
      console.log(`  ✗ Handoff processing failed: ${handoffResult.error}`);
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.warnings.push(`Capture failed: ${result.error}`);
    console.log(`  ✗ Error: ${result.error}`);
  } finally {
    if (page) {
      await page.close();
    }
  }

  return result;
}

function generateReviewMarkdown(results: CaptureResult[]): void {
  const reviewPath = path.join(OUTPUT_BASE, 'web-capture-review.md');

  let md = '# Web Capture Review\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**Total Targets:** ${results.length}\n`;
  md += `**Successful:** ${results.filter(r => r.success).length}\n`;
  md += `**Failed:** ${results.filter(r => !r.success).length}\n\n`;
  md += '---\n\n';

  for (const result of results) {
    md += `## ${result.name}\n\n`;
    md += `**URL:** ${result.url}\n\n`;
    md += `**Mode:** ${result.mode}\n\n`;
    md += `**Status:** ${result.success ? '✓ Success' : '✗ Failed'}\n\n`;

    if (result.interactions.length > 0) {
      md += '**Interactions Performed:**\n\n';
      result.interactions.forEach(action => {
        md += `- ${action}\n`;
      });
      md += '\n';
    }

    if (result.expandedElements > 0) {
      md += `**Expanded Elements:** ${result.expandedElements}\n\n`;
    }

    md += `**Content Length:** ${result.textLength.toLocaleString()} characters\n\n`;
    md += `**PDF Generated:** ${result.pdfGenerated ? 'Yes' : 'No'}\n\n`;

    if (result.success) {
      const textPreviewPath = path.join(result.artifactDir, 'text-preview.txt');
      if (fs.existsSync(textPreviewPath)) {
        const preview = fs.readFileSync(textPreviewPath, 'utf-8');
        md += '**Content Preview:**\n\n';
        md += '```\n';
        md += preview.substring(0, 500).trim();
        md += '\n...\n```\n\n';
      }
    }

    if (result.handoff) {
      md += '### Capture Quality Analysis\n\n';
      md += `**Quality Classification:** ${result.handoff.quality.status}\n\n`;
      md += `**Quality Score:** ${result.handoff.quality.qualityScore}/100\n\n`;
      md += `**Legal Keyword Density:** ${(result.handoff.quality.legalKeywordDensity * 100).toFixed(3)}%\n\n`;
      md += `**UI Keyword Density:** ${(result.handoff.quality.uiKeywordDensity * 100).toFixed(3)}%\n\n`;
      md += `**Heading Count:** ${result.handoff.quality.headingCount}\n\n`;
      md += `**Anti-Bot Detected:** ${result.handoff.quality.antiBotDetected ? 'Yes' : 'No'}\n\n`;

      if (result.handoff.quality.antiBotIndicators.length > 0) {
        md += `**Anti-Bot Indicators:** ${result.handoff.quality.antiBotIndicators.join(', ')}\n\n`;
      }

      md += `**Recommended Parser Mode:** ${result.handoff.manifest.recommended_parser_mode}\n\n`;

      if (result.handoff.normalized) {
        md += '### Normalization Results\n\n';
        md += `**Normalized Text Length:** ${result.handoff.manifest.normalized_text_length?.toLocaleString()} characters\n\n`;
        md += `**Bytes Saved:** ${result.handoff.normalized.bytesSaved.toLocaleString()} bytes (${((result.handoff.normalized.bytesSaved / result.textLength) * 100).toFixed(1)}% reduction)\n\n`;
        md += `**Headings Preserved:** ${result.handoff.normalized.elementCounts.headings}\n\n`;
        md += `**Paragraphs Preserved:** ${result.handoff.normalized.elementCounts.paragraphs}\n\n`;
        md += `**Lists Preserved:** ${result.handoff.normalized.elementCounts.lists}\n\n`;

        md += '**Elements Removed:**\n\n';
        md += `- Scripts: ${result.handoff.normalized.removalStats.scripts}\n`;
        md += `- Styles: ${result.handoff.normalized.removalStats.styles}\n`;
        md += `- Navigation: ${result.handoff.normalized.removalStats.nav}\n`;
        md += `- Headers: ${result.handoff.normalized.removalStats.header}\n`;
        md += `- Footers: ${result.handoff.normalized.removalStats.footer}\n`;
        md += `- Forms: ${result.handoff.normalized.removalStats.forms}\n`;
        md += `- Buttons: ${result.handoff.normalized.removalStats.buttons}\n`;
        md += `- iFrames: ${result.handoff.normalized.removalStats.iframes}\n\n`;
      }

      if (result.handoff.quality.warnings.length > 0) {
        md += '**Quality Warnings:**\n\n';
        result.handoff.quality.warnings.forEach(warning => {
          md += `- ⚠️ ${warning}\n`;
        });
        md += '\n';
      }
    }

    md += '**Artifact Paths:**\n\n';
    md += `- Directory: \`${result.artifactDir}\`\n`;
    md += `- rendered.html\n`;
    md += `- rendered.pdf\n`;
    md += `- text-preview.txt\n`;
    md += `- capture-metadata.json\n`;
    md += `- handoff-manifest.json\n`;

    if (result.handoff?.normalized) {
      md += `- normalized.html\n`;
      md += `- normalized.txt\n`;
    }

    md += '\n';

    if (result.warnings.length > 0) {
      md += '**Warnings:**\n\n';
      result.warnings.forEach(warning => {
        md += `- ⚠️ ${warning}\n`;
      });
      md += '\n';
    }

    if (result.error) {
      md += '**Error:**\n\n';
      md += `\`\`\`\n${result.error}\n\`\`\`\n\n`;
    }

    md += '---\n\n';
  }

  fs.writeFileSync(reviewPath, md, 'utf-8');
  console.log(`\n✓ Review markdown generated: ${reviewPath}`);
}

function generateParserReview(results: CaptureResult[]): void {
  const reviewPath = path.join(OUTPUT_BASE, 'web-capture-parser-review.md');
  const jsonPath = path.join(OUTPUT_BASE, 'web-capture-parser-output.json');

  let md = '# Web Capture + Parser Review\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**Total Targets:** ${results.length}\n`;
  md += `**Successful Captures:** ${results.filter(r => r.success).length}\n`;
  md += `**Parser Executed:** ${results.filter(r => r.parserRan).length}\n\n`;
  md += '---\n\n';

  const jsonOutput: any[] = [];

  for (const result of results) {
    md += `## ${result.name}\n\n`;
    md += `**URL:** ${result.url}\n\n`;
    md += `**Capture Status:** ${result.success ? '✓ Success' : '✗ Failed'}\n\n`;

    const outputEntry: any = {
      name: result.name,
      url: result.url,
      captureSuccess: result.success,
    };

    if (result.handoff) {
      md += `**Quality Score:** ${result.handoff.quality.qualityScore}/100\n\n`;
      md += `**Quality Classification:** ${result.handoff.quality.status}\n\n`;
      md += `**Legal Density:** ${(result.handoff.quality.legalKeywordDensity * 100).toFixed(3)}%\n\n`;
      md += `**Legal Keywords Matched:** ${result.handoff.quality.legalKeywordCount} (${result.handoff.quality.debugInfo.matchedLegalKeywords.slice(0, 10).join(', ')}${result.handoff.quality.debugInfo.matchedLegalKeywords.length > 10 ? '...' : ''})\n\n`;
      md += `**Legal Phrases Matched:** ${result.handoff.quality.legalPhraseCount} (${result.handoff.quality.debugInfo.matchedLegalPhrases.join(', ')})\n\n`;

      outputEntry.qualityScore = result.handoff.quality.qualityScore;
      outputEntry.status = result.handoff.quality.status;
      outputEntry.legalDensity = result.handoff.quality.legalKeywordDensity;
      outputEntry.legalKeywordCount = result.handoff.quality.legalKeywordCount;
      outputEntry.legalPhraseCount = result.handoff.quality.legalPhraseCount;

      md += `**PDF Preferred:** ${result.handoff.manifest.pdf_preferred ? 'Yes' : 'No'}\n\n`;
      outputEntry.pdfPreferred = result.handoff.manifest.pdf_preferred;

      if (result.handoff.manifest.pdf_preferred) {
        md += `**PDF Capture Status:** ${result.handoff.manifest.pdf_capture_status}\n\n`;
        outputEntry.pdfCaptureStatus = result.handoff.manifest.pdf_capture_status;

        if (result.handoff.manifest.detected_pdf_links.length > 0) {
          md += `**Detected PDF Links:** ${result.handoff.manifest.detected_pdf_links.length}\n\n`;
          if (result.handoff.manifest.selected_pdf_link) {
            md += `**Selected PDF Link:** ${result.handoff.manifest.selected_pdf_link}\n\n`;
            outputEntry.selectedPdfLink = result.handoff.manifest.selected_pdf_link;
          }
          outputEntry.detectedPdfLinks = result.handoff.manifest.detected_pdf_links;
        } else {
          md += `**Detected PDF Links:** 0 (no PDF links found in page)\n\n`;
        }
      }

      if (result.handoff.normalized) {
        md += `**Normalized:** Yes\n\n`;
        md += `**Normalized Path:** \`${path.join(result.artifactDir, 'normalized.html')}\`\n\n`;
        outputEntry.normalized = true;
        outputEntry.normalizedPath = 'normalized.html';
      } else {
        md += `**Normalized:** No\n\n`;
        outputEntry.normalized = false;
      }
    }

    md += `**Parser Ran:** ${result.parserRan ? 'Yes' : 'No'}\n\n`;
    outputEntry.parserRan = result.parserRan;

    if (result.parserResult) {
      md += `**Section Count:** ${result.parserResult.sections.length}\n\n`;
      md += `**Clause Candidates:** ${result.parserResult.candidates.length}\n\n`;
      md += `**Promoted Rules:** ${result.parserResult.promotedRules.length}\n\n`;

      outputEntry.sectionCount = result.parserResult.sections.length;
      outputEntry.clauseCandidates = result.parserResult.candidates.length;
      outputEntry.promotedRules = result.parserResult.promotedRules.length;

      if (result.parserResult.promotedRules.length > 0) {
        const typeCounts: Record<string, number> = {};
        result.parserResult.promotedRules.forEach(rule => {
          typeCounts[rule.clauseType] = (typeCounts[rule.clauseType] || 0) + 1;
        });

        md += '**Top Promoted Rule Types:**\n\n';
        Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([type, count]) => {
            md += `- ${type}: ${count}\n`;
          });
        md += '\n';

        outputEntry.topRuleTypes = Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type, count]) => ({ type, count }));
      }

      if (result.parserResult.warnings.length > 0) {
        md += '**Parser Warnings:**\n\n';
        result.parserResult.warnings.forEach(warning => {
          md += `- ⚠️ ${warning}\n`;
        });
        md += '\n';
        outputEntry.parserWarnings = result.parserResult.warnings;
      }

      if (result.parserResult.errors.length > 0) {
        md += '**Parser Errors:**\n\n';
        result.parserResult.errors.forEach(error => {
          md += `- ✗ ${error}\n`;
        });
        md += '\n';
        outputEntry.parserErrors = result.parserResult.errors;
      }
    }

    if (result.warnings.length > 0) {
      md += '**Capture Warnings:**\n\n';
      result.warnings.forEach(warning => {
        md += `- ⚠️ ${warning}\n`;
      });
      md += '\n';
      outputEntry.captureWarnings = result.warnings;
    }

    md += '---\n\n';
    jsonOutput.push(outputEntry);
  }

  const totalSections = results.reduce((sum, r) => sum + (r.parserResult?.sections.length || 0), 0);
  const totalCandidates = results.reduce((sum, r) => sum + (r.parserResult?.candidates.length || 0), 0);
  const totalPromoted = results.reduce((sum, r) => sum + (r.parserResult?.promotedRules.length || 0), 0);

  md += '## Summary Statistics\n\n';
  md += `**Total Sections:** ${totalSections}\n\n`;
  md += `**Total Clause Candidates:** ${totalCandidates}\n\n`;
  md += `**Total Promoted Rules:** ${totalPromoted}\n\n`;

  fs.writeFileSync(reviewPath, md, 'utf-8');
  console.log(`✓ Parser review markdown generated: ${reviewPath}`);

  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
  console.log(`✓ Parser output JSON generated: ${jsonPath}`);
}

async function main() {
  console.log('================================================================================');
  console.log('Web Capture Harness');
  console.log('================================================================================\n');
  console.log(`Found ${webCaptureTargets.length} target(s) to capture:\n`);

  webCaptureTargets.forEach((target, i) => {
    console.log(`  ${i + 1}. ${target.name}`);
    console.log(`     ${target.url}`);
    console.log(`     Mode: ${target.mode}`);
  });

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/appuser/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
  });

  const results: CaptureResult[] = [];

  for (const target of webCaptureTargets) {
    const result = await captureTarget(browser, target);
    results.push(result);
  }

  await browser.close();

  generateReviewMarkdown(results);
  generateParserReview(results);

  console.log('\n================================================================================');
  console.log('Web Capture Summary');
  console.log('================================================================================\n');

  results.forEach(result => {
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${result.name}`);
    console.log(`   Mode: ${result.mode}`);
    console.log(`   Text: ${result.textLength.toLocaleString()} chars`);

    if (result.handoff) {
      console.log(`   Quality: ${result.handoff.quality.qualityScore}/100 (${result.handoff.quality.status})`);
      console.log(`   Legal Density: ${(result.handoff.quality.legalKeywordDensity * 100).toFixed(3)}%`);
      console.log(`   Parser Mode: ${result.handoff.manifest.recommended_parser_mode}`);

      if (result.handoff.quality.antiBotDetected) {
        console.log(`   ⚠ Anti-Bot: ${result.handoff.quality.antiBotIndicators[0]}`);
      }

      if (result.handoff.normalized) {
        console.log(`   Normalized: Yes (${result.handoff.normalized.bytesSaved.toLocaleString()} bytes saved)`);
      }
    }

    if (result.parserRan && result.parserResult) {
      console.log(`   Parser: ${result.parserResult.candidates.length} candidates, ${result.parserResult.promotedRules.length} promoted`);
    }

    if (result.expandedElements > 0) {
      console.log(`   Expanded: ${result.expandedElements} elements`);
    }

    console.log(`   Artifacts: ${result.artifactDir}`);
    console.log('');
  });

  const successCount = results.filter(r => r.success).length;
  const readyForParse = results.filter(r => r.handoff?.quality.status === 'READY_FOR_PARSE').length;
  const partialCapture = results.filter(r => r.handoff?.quality.status === 'PARTIAL_CAPTURE').length;
  const antiBotBlocked = results.filter(r => r.handoff?.quality.status === 'ANTI_BOT_BLOCKED').length;
  const parserRan = results.filter(r => r.parserRan).length;
  const totalCandidates = results.reduce((sum, r) => sum + (r.parserResult?.candidates.length || 0), 0);
  const totalPromoted = results.reduce((sum, r) => sum + (r.parserResult?.promotedRules.length || 0), 0);

  console.log(`Total: ${successCount}/${results.length} successful captures`);
  console.log(`Ready for Parse: ${readyForParse}`);
  console.log(`Partial Capture: ${partialCapture}`);
  console.log(`Anti-Bot Blocked: ${antiBotBlocked}`);
  console.log(`Parser Executed: ${parserRan}`);
  console.log(`Total Clause Candidates: ${totalCandidates}`);
  console.log(`Total Promoted Rules: ${totalPromoted}\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
