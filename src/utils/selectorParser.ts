/**
 * Parses user input which can be:
 * 1. Raw HTML snippet: `<div class="job-title MuiBox-root css-0">`
 * 2. Full HTML element with content: `<div class="job-title">Senior Dev</div>`
 * 3. Standard CSS selector: `.job-title`, `div.job-title.MuiBox-root`, `#header h1`
 * 4. XPath: `//div[@class='job-title']`
 * 
 * Returns candidate CSS selectors from most specific to most resilient.
 */

export interface ParsedSelectorResult {
  primarySelector: string;
  candidateSelectors: string[];
  suggestedExtractType: 'text' | 'attribute' | 'html';
  suggestedAttribute?: string;
  tagName?: string;
  classes: string[];
  attributes: Record<string, string>;
  isRawHtml: boolean;
  explanation: string;
}

export function parseElementInput(input: string): ParsedSelectorResult {
  const trimmed = input.trim();

  // Check if input is a raw HTML tag or snippet like <div class="job-title MuiBox-root css-0">
  const htmlTagMatch = trimmed.match(/^<([a-zA-Z0-9\-]+)([^>]*)>/);

  if (htmlTagMatch) {
    const tagName = htmlTagMatch[1].toLowerCase();
    const rawAttrs = htmlTagMatch[2];

    const attributes: Record<string, string> = {};
    const classes: string[] = [];

    // Parse attributes regex: name="value" or name='value' or name=value
    const attrRegex = /([a-zA-Z0-9\-:_]+)(?:=["']([^"']*)["']|=([^\s>]+))?/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = match[1].toLowerCase();
      const attrValue = match[2] ?? match[3] ?? '';
      
      if (attrName === 'class' || attrName === 'classname') {
        const classNames = attrValue.split(/\s+/).filter(Boolean);
        classes.push(...classNames);
      } else if (attrName) {
        attributes[attrName] = attrValue;
      }
    }

    const candidateSelectors: string[] = [];

    // Candidate 1: Specific class combo with tag
    // Filter out dynamic hashes if any (e.g. css-0, styled-123) but keep meaningful ones
    const meaningfulClasses = classes.filter(c => !c.match(/^(css-\w+|sc-\w+|styled-[\w-]+)$/i));

    if (classes.length > 0) {
      // Primary: tag + all classes (escaped for standard CSS)
      const fullClassSelector = classes.map(c => `.${escapeCssIdentifier(c)}`).join('');
      candidateSelectors.push(`${tagName}${fullClassSelector}`);
      candidateSelectors.push(fullClassSelector);

      // Best meaningful classes (e.g., .job-title or div.job-title)
      if (meaningfulClasses.length > 0 && meaningfulClasses.length !== classes.length) {
        const meaningfulClassSelector = meaningfulClasses.map(c => `.${escapeCssIdentifier(c)}`).join('');
        candidateSelectors.push(`${tagName}${meaningfulClassSelector}`);
        candidateSelectors.push(meaningfulClassSelector);
      }

      // First prominent class (e.g. .job-title)
      if (classes[0]) {
        candidateSelectors.push(`${tagName}.${escapeCssIdentifier(classes[0])}`);
        candidateSelectors.push(`.${escapeCssIdentifier(classes[0])}`);
      }

      // Substring class match in case of space variations
      for (const cls of classes.slice(0, 2)) {
        if (cls.length > 3) {
          candidateSelectors.push(`${tagName}[class*="${cls}"]`);
          candidateSelectors.push(`[class*="${cls}"]`);
        }
      }
    }

    // Attributes like id, data-testid, name, etc.
    if (attributes['id']) {
      candidateSelectors.unshift(`#${escapeCssIdentifier(attributes['id'])}`);
      candidateSelectors.unshift(`${tagName}#${escapeCssIdentifier(attributes['id'])}`);
    }
    if (attributes['data-testid']) {
      candidateSelectors.unshift(`[data-testid="${attributes['data-testid']}"]`);
    }
    if (attributes['name']) {
      candidateSelectors.push(`${tagName}[name="${attributes['name']}"]`);
    }
    if (attributes['role']) {
      candidateSelectors.push(`${tagName}[role="${attributes['role']}"]`);
    }

    // Fallback: just tag name
    if (candidateSelectors.length === 0) {
      candidateSelectors.push(tagName);
    }

    // Deduplicate
    const uniqueCandidates = Array.from(new Set(candidateSelectors));

    // Choose best primary selector
    // Prefer meaningful class selector or the first class selector if available
    let primary = uniqueCandidates[0] || tagName;
    if (classes.length > 0) {
      // Find class that looks most semantic (e.g., job-title)
      const semanticClass = classes.find(c => c.includes('title') || c.includes('name') || c.includes('salary') || c.includes('job') || c.includes('item') || c.includes('price') || c.includes('desc'));
      if (semanticClass) {
        primary = `${tagName}.${escapeCssIdentifier(semanticClass)}`;
      } else if (classes[0]) {
        primary = `${tagName}.${escapeCssIdentifier(classes[0])}`;
      }
    }

    // Determine suggested extract type & attribute
    let suggestedExtractType: 'text' | 'attribute' | 'html' = 'text';
    let suggestedAttribute: string | undefined = undefined;

    if (tagName === 'a' && (attributes['href'] || rawAttrs.includes('href'))) {
      suggestedExtractType = 'attribute';
      suggestedAttribute = 'href';
    } else if (tagName === 'img' && (attributes['src'] || rawAttrs.includes('src'))) {
      suggestedExtractType = 'attribute';
      suggestedAttribute = 'src';
    }

    return {
      primarySelector: primary,
      candidateSelectors: uniqueCandidates,
      suggestedExtractType,
      suggestedAttribute,
      tagName,
      classes,
      attributes,
      isRawHtml: true,
      explanation: `Parsed HTML <${tagName}> with ${classes.length} class(es). Primary selector: ${primary}`
    };
  }

  // Handle XPath if starts with // or xpath:
  if (trimmed.startsWith('//') || trimmed.startsWith('xpath:')) {
    const xpath = trimmed.replace(/^xpath:\s*/i, '');
    // Attempt basic conversion from //tag[@class='val'] or //tag[contains(@class, 'val')]
    const classMatch = xpath.match(/\/\/?([a-zA-Z0-9\-*]+)(?:\[@class=['"]([^'"]+)['"]|\[contains\(@class,\s*['"]([^'"]+)['"]\)\])?/);
    if (classMatch) {
      const tag = classMatch[1] === '*' ? '' : classMatch[1];
      const cls = classMatch[2] || classMatch[3];
      if (cls) {
        const cssSel = `${tag}.${cls.split(' ').join('.')}`;
        return {
          primarySelector: cssSel,
          candidateSelectors: [cssSel, xpath],
          suggestedExtractType: 'text',
          classes: cls.split(' '),
          attributes: {},
          isRawHtml: false,
          explanation: `Converted XPath to CSS selector: ${cssSel}`
        };
      }
    }
  }

  // Standard CSS selector
  return {
    primarySelector: trimmed,
    candidateSelectors: [trimmed],
    suggestedExtractType: 'text',
    classes: [],
    attributes: {},
    isRawHtml: false,
    explanation: `Direct CSS selector: ${trimmed}`
  };
}

function escapeCssIdentifier(identifier: string): string {
  // CSS escape special chars like :, /, [ ] if needed
  return identifier.replace(/([:/.\[\],=+@#$^&*()])/g, '\\$1');
}
