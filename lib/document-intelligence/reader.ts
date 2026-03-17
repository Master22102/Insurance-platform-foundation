import fs from 'fs';
import path from 'path';
import * as quotedPrintable from 'quoted-printable';
import { JSDOM } from 'jsdom';
import { RawExtraction } from './types';

interface CleaningMetadata {
  removedElements: string[];
  chromeRemoved: boolean;
  mainContentFound: boolean;
}

export async function readDocument(filePath: string): Promise<RawExtraction> {
  const ext = path.extname(filePath).toLowerCase();
  const stats = fs.statSync(filePath);

  try {
    switch (ext) {
      case '.pdf':
        return await readPDF(filePath, stats.size);
      case '.html':
      case '.htm':
        return await readHTML(filePath, stats.size);
      case '.mhtml':
      case '.mht':
        return await readMHTML(filePath, stats.size);
      case '.txt':
      case '.text':
        return readTXT(filePath, stats.size);
      case '.xml':
        return readXML(filePath, stats.size);
      default:
        return {
          success: false,
          method: 'unsupported',
          text: '',
          error: `Unsupported file type: ${ext}`,
          metadata: {
            fileSize: stats.size,
            extractedLength: 0,
          },
        };
    }
  } catch (error) {
    return {
      success: false,
      method: 'error',
      text: '',
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        fileSize: stats.size,
        extractedLength: 0,
      },
    };
  }
}

async function readPDF(filePath: string, fileSize: number): Promise<RawExtraction> {
  try {
    const pdfParse = (await import('pdf-parse-fork')).default;
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    return {
      success: true,
      method: 'pdf-parse',
      text: data.text,
      metadata: {
        fileSize,
        extractedLength: data.text.length,
        encoding: 'utf-8',
      },
    };
  } catch (error) {
    return {
      success: false,
      method: 'pdf-parse',
      text: '',
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        fileSize,
        extractedLength: 0,
      },
    };
  }
}

async function readHTML(filePath: string, fileSize: number): Promise<RawExtraction> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { text, cleaningMetadata } = extractTextFromHTML(content);

    return {
      success: true,
      method: 'html-text-extraction',
      text,
      metadata: {
        fileSize,
        extractedLength: text.length,
        encoding: 'utf-8',
        cleaningMetadata,
      },
    };
  } catch (error) {
    return {
      success: false,
      method: 'html-text-extraction',
      text: '',
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        fileSize,
        extractedLength: 0,
      },
    };
  }
}

async function readMHTML(filePath: string, fileSize: number): Promise<RawExtraction> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const htmlBody = extractHTMLFromMHTML(content);

    if (!htmlBody) {
      return {
        success: false,
        method: 'mhtml-extraction',
        text: '',
        error: 'Failed to extract HTML body from MHTML',
        metadata: {
          fileSize,
          extractedLength: 0,
        },
      };
    }

    const decodedHtml = decodeQuotedPrintable(htmlBody);
    const { text, cleaningMetadata } = extractTextFromHTML(decodedHtml);

    return {
      success: true,
      method: 'mhtml-extraction',
      text,
      metadata: {
        fileSize,
        extractedLength: text.length,
        encoding: 'utf-8',
        cleaningMetadata,
      },
    };
  } catch (error) {
    return {
      success: false,
      method: 'mhtml-extraction',
      text: '',
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        fileSize,
        extractedLength: 0,
      },
    };
  }
}

function readTXT(filePath: string, fileSize: number): RawExtraction {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return {
      success: text.length > 50,
      method: 'txt-read',
      text,
      error: text.length <= 50 ? 'Insufficient text content' : undefined,
      metadata: { fileSize, extractedLength: text.length, encoding: 'utf-8' },
    };
  } catch (error) {
    return {
      success: false, method: 'txt-read', text: '',
      error: error instanceof Error ? error.message : String(error),
      metadata: { fileSize, extractedLength: 0 },
    };
  }
}

function readXML(filePath: string, fileSize: number): RawExtraction {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Strip XML tags and extract text content
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      success: text.length > 50,
      method: 'xml-read',
      text,
      error: text.length <= 50 ? 'Insufficient text content' : undefined,
      metadata: { fileSize, extractedLength: text.length, encoding: 'utf-8' },
    };
  } catch (error) {
    return {
      success: false, method: 'xml-read', text: '',
      error: error instanceof Error ? error.message : String(error),
      metadata: { fileSize, extractedLength: 0 },
    };
  }
}

function extractHTMLFromMHTML(mhtmlContent: string): string | null {
  const htmlStartPatterns = [
    /Content-Type:\s*text\/html[^\r\n]*[\r\n]+(?:Content-Transfer-Encoding:[^\r\n]*[\r\n]+)?(?:Content-Location:[^\r\n]*[\r\n]+)?[\r\n]*(<!DOCTYPE|<html)/i,
    /<html[^>]*>/i,
    /<!DOCTYPE html/i,
  ];

  for (const pattern of htmlStartPatterns) {
    const match = mhtmlContent.match(pattern);
    if (match && match.index !== undefined) {
      const htmlStart = match.index + match[0].length - (match[1]?.length || 0);

      const boundaryMatch = mhtmlContent.match(/boundary="([^"]+)"/);
      if (boundaryMatch) {
        const boundary = '--' + boundaryMatch[1];
        const nextBoundaryIndex = mhtmlContent.indexOf(boundary, htmlStart);
        if (nextBoundaryIndex > htmlStart) {
          return mhtmlContent.substring(htmlStart, nextBoundaryIndex);
        }
      }

      const htmlEndMatch = mhtmlContent.substring(htmlStart).match(/<\/html>/i);
      if (htmlEndMatch && htmlEndMatch.index !== undefined) {
        return mhtmlContent.substring(htmlStart, htmlStart + htmlEndMatch.index + 7);
      }

      return mhtmlContent.substring(htmlStart);
    }
  }

  return null;
}

function decodeQuotedPrintable(text: string): string {
  try {
    const decoded = quotedPrintable.decode(text);

    const buffer = Buffer.from(decoded, 'binary');
    const utf8Text = buffer.toString('utf-8');

    return utf8Text;
  } catch (error) {
    return text;
  }
}

function extractTextFromHTML(html: string): { text: string; cleaningMetadata: CleaningMetadata } {
  const cleaningMetadata: CleaningMetadata = {
    removedElements: [],
    chromeRemoved: false,
    mainContentFound: false,
  };

  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    removeChromeElements(document, cleaningMetadata);

    const contentRoot = findMainContent(document, cleaningMetadata);

    const text = extractStructuredText(contentRoot);

    const cleanedText = postProcessText(text);

    return { text: cleanedText, cleaningMetadata };
  } catch (error) {
    return { text: fallbackTextExtraction(html), cleaningMetadata };
  }
}

function removeChromeElements(document: Document, metadata: CleaningMetadata): void {
  const scripts = document.querySelectorAll('script, style, noscript');
  scripts.forEach(el => {
    el.remove();
  });

  const chromeSelectors = [
    'nav',
    'header',
    'footer',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    'button',
    'form',
  ];

  chromeSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const tagName = el.tagName.toLowerCase();
      if (!metadata.removedElements.includes(tagName)) {
        metadata.removedElements.push(tagName);
      }
      el.remove();
      metadata.chromeRemoved = true;
    });
  });
}

function findMainContent(document: Document, metadata: CleaningMetadata): Element {
  const legalKeywords = [
    'contract of carriage',
    'terms and conditions',
    'conditions of carriage',
    'general conditions',
    'legal',
    'terms of use',
    'terms of service',
  ];

  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
  ];

  for (const selector of contentSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent && el.textContent.length > 5000) {
      metadata.mainContentFound = true;
      return el;
    }
  }

  const body = document.body || document.documentElement;
  const bodyText = body.textContent || '';

  if (bodyText.length > 0) {
    metadata.mainContentFound = bodyText.length > 5000;
  }

  return body;
}

function extractStructuredText(element: Element): string {
  const lines: string[] = [];

  function traverse(node: Node): void {
    if (node.nodeType === 3) {
      const text = (node.textContent || '').trim();
      if (text) {
        lines.push(text);
      }
      return;
    }

    if (node.nodeType !== 1) return;

    const el = node as Element;
    const tagName = el.tagName.toLowerCase();

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      const headingText = (el.textContent || '').trim();
      if (headingText) {
        lines.push('\n\n');
        lines.push(headingText);
        lines.push('\n\n');
      }
      return;
    }

    if (['p'].includes(tagName)) {
      const children = Array.from(el.childNodes);
      children.forEach(child => traverse(child));
      lines.push('\n');
      return;
    }

    if (['div', 'section', 'article'].includes(tagName)) {
      const children = Array.from(el.childNodes);
      children.forEach(child => traverse(child));
      return;
    }

    if (['li'].includes(tagName)) {
      const text = (el.textContent || '').trim();
      if (text) {
        lines.push(text);
        lines.push('\n');
      }
      return;
    }

    if (['br'].includes(tagName)) {
      lines.push('\n');
      return;
    }

    const children = Array.from(el.childNodes);
    children.forEach(child => traverse(child));
  }

  traverse(element);

  let result = lines.join(' ');

  if (!result || result.length < 100) {
    result = element.textContent || '';
  }

  return result;
}

function postProcessText(text: string): string {
  let cleaned = text;

  const junkPatterns = [
    /skip to main content/gi,
    /directional indicator[;:]?\s*[a-z]+\.?[>]?/gi,
    /select preferred language and currency/gi,
    /language\s*-\s*currency/gi,
    /a large x/gi,
    /a shopping cart\./gi,
    /a rectangle with wheels and handle\./gi,
    /indicates accessible content\./gi,
    /a bell\./gi,
    /close\s+(sign in|join now|menu)/gi,
  ];

  junkPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, ' ');
  });

  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/^\s+|\s+$/gm, '');

  return cleaned.trim();
}

function fallbackTextExtraction(html: string): string {
  let text = html;

  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');

  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');

  text = text.replace(/<[^>]+>/g, ' ');

  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/^\s+|\s+$/gm, '');

  return text.trim();
}
