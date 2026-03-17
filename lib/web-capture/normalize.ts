import { JSDOM } from 'jsdom';

export interface NormalizedContent {
  html: string;
  text: string;
  elementCounts: {
    headings: number;
    paragraphs: number;
    lists: number;
    sections: number;
  };
  bytesSaved: number;
  removalStats: {
    scripts: number;
    styles: number;
    nav: number;
    footer: number;
    header: number;
    forms: number;
    buttons: number;
    iframes: number;
  };
}

const REMOVE_SELECTORS = [
  'script',
  'style',
  'nav',
  'header[role="banner"]',
  'footer',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '[class*="header"]',
  '[class*="nav"]',
  '[class*="menu"]',
  '[class*="sidebar"]',
  '[class*="footer"]',
  '[id*="header"]',
  '[id*="nav"]',
  '[id*="menu"]',
  '[id*="sidebar"]',
  '[id*="footer"]',
  'form',
  'button',
  'iframe',
  '[class*="cookie"]',
  '[class*="banner"]',
  '[class*="advertisement"]',
  '[class*="ad-"]',
  '[id*="cookie"]',
  '[id*="ad"]',
];

const KEEP_SELECTORS = [
  'main',
  'article',
  '[role="main"]',
  '[role="article"]',
  '.content',
  '.main-content',
  '#content',
  '#main-content',
];

function countRemoved(doc: Document, selector: string): number {
  try {
    return doc.querySelectorAll(selector).length;
  } catch (error) {
    return 0;
  }
}

function removeElements(doc: Document, selectors: string[]): {
  scripts: number;
  styles: number;
  nav: number;
  footer: number;
  header: number;
  forms: number;
  buttons: number;
  iframes: number;
} {
  const stats = {
    scripts: 0,
    styles: 0,
    nav: 0,
    footer: 0,
    header: 0,
    forms: 0,
    buttons: 0,
    iframes: 0,
  };

  stats.scripts = countRemoved(doc, 'script');
  stats.styles = countRemoved(doc, 'style');
  stats.nav = countRemoved(doc, 'nav, [role="navigation"], [class*="nav"], [id*="nav"], [class*="menu"], [id*="menu"]');
  stats.footer = countRemoved(doc, 'footer, [role="contentinfo"], [class*="footer"], [id*="footer"]');
  stats.header = countRemoved(doc, 'header[role="banner"], [role="banner"], [class*="header"]:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6), [id*="header"]');
  stats.forms = countRemoved(doc, 'form');
  stats.buttons = countRemoved(doc, 'button');
  stats.iframes = countRemoved(doc, 'iframe');

  for (const selector of selectors) {
    try {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    } catch (error) {
      // Invalid selector or element already removed
    }
  }

  return stats;
}

function extractMainContent(doc: Document): Element | null {
  for (const selector of KEEP_SELECTORS) {
    try {
      const element = doc.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 100) {
        return element;
      }
    } catch (error) {
      // Invalid selector
    }
  }

  return doc.body;
}

function cleanAttributes(element: Element): void {
  const attributesToKeep = ['href', 'src', 'alt', 'title'];

  const allElements = element.querySelectorAll('*');
  allElements.forEach(el => {
    const attributeNames = el.getAttributeNames();
    attributeNames.forEach(attr => {
      if (!attributesToKeep.includes(attr)) {
        el.removeAttribute(attr);
      }
    });
  });
}

function removeEmptyElements(element: Element): void {
  const emptyElements = element.querySelectorAll('p:empty, div:empty, span:empty, section:empty');
  emptyElements.forEach(el => {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
}

function countElements(element: Element) {
  return {
    headings: element.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
    paragraphs: element.querySelectorAll('p').length,
    lists: element.querySelectorAll('ul, ol').length,
    sections: element.querySelectorAll('section, article, div').length,
  };
}

export function normalizeContent(html: string): NormalizedContent {
  const originalSize = html.length;

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const removalStats = removeElements(doc, REMOVE_SELECTORS);

  let mainContent = extractMainContent(doc);

  if (!mainContent) {
    mainContent = doc.body;
  }

  if (!mainContent) {
    throw new Error('No content found to normalize');
  }

  const contentClone = mainContent.cloneNode(true) as Element;

  cleanAttributes(contentClone);
  removeEmptyElements(contentClone);

  const elementCounts = countElements(contentClone);

  const normalizedHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Normalized Content</title>
</head>
<body>
${contentClone.innerHTML}
</body>
</html>`;

  const textContent = contentClone.textContent || '';
  const normalizedText = textContent
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  const bytesSaved = originalSize - normalizedHTML.length;

  return {
    html: normalizedHTML,
    text: normalizedText,
    elementCounts,
    bytesSaved,
    removalStats,
  };
}
