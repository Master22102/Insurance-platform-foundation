#!/usr/bin/env tsx

/**
 * Web Capture Script for Corpus Expansion
 *
 * Captures web pages and PDFs for document intelligence corpus expansion.
 * Stores rendered HTML, PDF, metadata, and text preview for each URL.
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface CaptureTarget {
  url: string;
  category: 'airlines' | 'hotels' | 'cruise' | 'car-rental' | 'insurance';
  name: string;
}

interface CaptureMetadata {
  url: string;
  capturedAt: string;
  title: string;
  category: string;
  name: string;
  contentLength: number;
  hasRenderedHtml: boolean;
  hasRenderedPdf: boolean;
  hasTextPreview: boolean;
}

const CAPTURE_TARGETS: CaptureTarget[] = [
  // Airlines
  { url: 'https://www.united.com/en/us/fly/contract-of-carriage.html', category: 'airlines', name: 'united' },
  { url: 'https://www.delta.com/us/en/legal/contract-of-carriage', category: 'airlines', name: 'delta' },
  { url: 'https://www.aa.com/i18n/customer-service/support/conditions-of-carriage.jsp', category: 'airlines', name: 'american' },
  { url: 'https://www.jetblue.com/legal/contract-of-carriage', category: 'airlines', name: 'jetblue' },
  { url: 'https://www.southwest.com/assets/pdfs/corporate-commitments/contract-of-carriage.pdf', category: 'airlines', name: 'southwest' },
  { url: 'https://www.aircanada.com/ca/en/aco/home/legal/conditions-carriage-tariffs.html', category: 'airlines', name: 'air-canada' },
  { url: 'https://www.britishairways.com/en-us/information/legal/conditions-of-carriage', category: 'airlines', name: 'british-airways' },
  { url: 'https://www.emirates.com/us/english/conditions-of-carriage/', category: 'airlines', name: 'emirates' },
  { url: 'https://www.qatarairways.com/en/legal/conditions-of-carriage.html', category: 'airlines', name: 'qatar' },

  // Hotels
  { url: 'https://www.hilton.com/en/p/terms/', category: 'hotels', name: 'hilton' },
  { url: 'https://www.hyatt.com/info/terms-conditions', category: 'hotels', name: 'hyatt' },
  { url: 'https://www.marriott.com/about/terms-of-use.mi', category: 'hotels', name: 'marriott' },
  { url: 'https://www.ihg.com/content/us/en/customer-care/terms-of-use', category: 'hotels', name: 'ihg' },
  { url: 'https://all.accor.com/security-certificate/index.en.shtml', category: 'hotels', name: 'accor' },

  // Cruise Lines
  { url: 'https://www.carnival.com/about-carnival/legal/ticket-contract', category: 'cruise', name: 'carnival' },
  { url: 'https://www.ncl.com/about/terms-and-conditions', category: 'cruise', name: 'ncl' },
  { url: 'https://www.princess.com/legal/passage_contract/', category: 'cruise', name: 'princess' },

  // Car Rental
  { url: 'https://www.hertz.com/rentacar/reservation/policy/policy-detail/enGB', category: 'car-rental', name: 'hertz' },
  { url: 'https://www.avis.com/en/legal-documents/rental-terms', category: 'car-rental', name: 'avis' },
  { url: 'https://www.enterprise.com/en/help/legal/terms-and-conditions.html', category: 'car-rental', name: 'enterprise' },

  // Insurance & Credit Cards
  { url: 'https://www.allianztravelinsurance.com/coverage/terms-and-conditions.htm', category: 'insurance', name: 'allianz' },
  { url: 'https://www.chasebenefits.com/sapphirereserve', category: 'insurance', name: 'chase-sapphire' },
  { url: 'https://www.americanexpress.com/us/credit-cards/features-benefits/policies/travel/', category: 'insurance', name: 'amex-travel' },
  { url: 'https://www.capitalone.com/credit-cards/benefits-guide/', category: 'insurance', name: 'capital-one' },
];

async function captureWebPage(
  browser: Browser,
  target: CaptureTarget,
  outputDir: string
): Promise<CaptureMetadata> {
  console.log(`\n📥 Capturing: ${target.name} (${target.url})`);

  const categoryDir = path.join(outputDir, target.category);
  const captureDir = path.join(categoryDir, target.name);

  // Create directory
  fs.mkdirSync(captureDir, { recursive: true });

  const page = await browser.newPage();

  try {
    // Navigate with timeout
    await page.goto(target.url, {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Get page title
    const title = await page.title();
    console.log(`  📄 Title: ${title}`);

    // Get rendered HTML
    const html = await page.content();
    fs.writeFileSync(path.join(captureDir, 'rendered.html'), html);
    console.log(`  ✓ Saved rendered.html (${html.length} chars)`);

    // Get text content
    const textContent = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(captureDir, 'text-preview.txt'), textContent);
    console.log(`  ✓ Saved text-preview.txt (${textContent.length} chars)`);

    // Generate PDF
    await page.pdf({
      path: path.join(captureDir, 'rendered.pdf'),
      format: 'A4',
      printBackground: true,
    });
    console.log(`  ✓ Saved rendered.pdf`);

    // Create metadata
    const metadata: CaptureMetadata = {
      url: target.url,
      capturedAt: new Date().toISOString(),
      title,
      category: target.category,
      name: target.name,
      contentLength: textContent.length,
      hasRenderedHtml: true,
      hasRenderedPdf: true,
      hasTextPreview: true,
    };

    fs.writeFileSync(
      path.join(captureDir, 'capture-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    console.log(`  ✓ Saved capture-metadata.json`);

    await page.close();
    return metadata;

  } catch (error) {
    console.error(`  ❌ Error capturing ${target.name}:`, error);
    await page.close();

    // Return partial metadata
    return {
      url: target.url,
      capturedAt: new Date().toISOString(),
      title: 'ERROR: Failed to capture',
      category: target.category,
      name: target.name,
      contentLength: 0,
      hasRenderedHtml: false,
      hasRenderedPdf: false,
      hasTextPreview: false,
    };
  }
}

async function main() {
  console.log('🌐 Starting Web Capture for Corpus Expansion');
  console.log(`📊 Targets: ${CAPTURE_TARGETS.length} URLs\n`);

  const outputDir = path.join(process.cwd(), 'tmp', 'web-capture');

  // Launch browser
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({
    headless: true,
  });

  const results: CaptureMetadata[] = [];

  // Capture each target
  for (const target of CAPTURE_TARGETS) {
    try {
      const metadata = await captureWebPage(browser, target, outputDir);
      results.push(metadata);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to capture ${target.name}:`, error);
    }
  }

  await browser.close();

  // Write summary
  const summary = {
    totalTargets: CAPTURE_TARGETS.length,
    successfulCaptures: results.filter(r => r.hasRenderedHtml).length,
    failedCaptures: results.filter(r => !r.hasRenderedHtml).length,
    capturedAt: new Date().toISOString(),
    results,
  };

  fs.writeFileSync(
    path.join(outputDir, 'capture-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CAPTURE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total targets: ${summary.totalTargets}`);
  console.log(`✓ Successful: ${summary.successfulCaptures}`);
  console.log(`✗ Failed: ${summary.failedCaptures}`);
  console.log('');

  // Category breakdown
  const byCategory = results.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + (r.hasRenderedHtml ? 1 : 0);
    return acc;
  }, {} as Record<string, number>);

  console.log('By category:');
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  console.log('\n✅ Web capture complete!');
  console.log(`📁 Output: ${outputDir}`);
}

main().catch(console.error);
