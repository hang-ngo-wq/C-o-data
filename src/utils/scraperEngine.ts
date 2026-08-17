import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from '@google/genai';
import { parseElementInput } from './selectorParser.js';
import { FieldConfig, ScrapeOptions, ScrapeResponse, ExtractedRow, HtmlPreviewResponse } from '../types.js';

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8,vi;q=0.7',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function extractStructuredData($: cheerio.CheerioAPI): any {
  const structured: Record<string, any> = {};

  // 1. Next.js __NEXT_DATA__
  try {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      const parsed = JSON.parse(nextDataScript);
      structured.nextData = parsed?.props?.pageProps || parsed?.props || parsed;
    }
  } catch (e) {
    // Ignore
  }

  // 2. JSON-LD scripts
  try {
    $('script[type="application/ld+json"]').each((_, el) => {
      const content = $(el).html();
      if (content) {
        try {
          const ld = JSON.parse(content);
          if (Array.isArray(ld)) {
            structured.jsonLd = ld;
          } else if (ld) {
            structured.jsonLd = { ...(structured.jsonLd || {}), ...ld };
          }
        } catch (e) {
          // Ignore
        }
      }
    });
  } catch (e) {
    // Ignore
  }

  return structured;
}

export function findValueInObject(obj: any, keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    const val = obj[key];

    for (const targetKey of keys) {
      if (lowerKey === targetKey.toLowerCase() || lowerKey.includes(targetKey.toLowerCase())) {
        if (typeof val === 'string' && val.trim().length > 0) return val.trim();
        // Handle salary min/max object like { min: 348, max: 501 }
        if (val && typeof val === 'object' && ('min' in val || 'max' in val)) {
          if (val.min && val.max) return `${val.min}万円～${val.max}万円`;
          if (val.min) return `Từ ${val.min}万円`;
          if (val.max) return `Đến ${val.max}万円`;
        }
        // Handle objects with name, title, or label
        if (val && typeof val === 'object' && val.name && typeof val.name === 'string') return val.name.trim();
        if (val && typeof val === 'object' && val.title && typeof val.title === 'string') return val.title.trim();
        if (val && typeof val === 'object' && val.label && typeof val.label === 'string') return val.label.trim();
        if (typeof val === 'number' && val > 100) return String(val);
      }
    }

    if (val && typeof val === 'object') {
      const nested = findValueInObject(val, keys);
      if (nested) return nested;
    }
  }

  return null;
}

export function cleanText(text: string, field: Partial<FieldConfig>): string {
  if (!text) return '';
  let result = text;

  if (field.removeNewlines) {
    result = result.replace(/[\r\n\t]+/g, ' ');
  }

  // Remove excessive spaces
  result = result.replace(/[ \t]{2,}/g, ' ');

  if (field.trimWhitespace !== false) {
    result = result.trim();
  }

  return result;
}

export async function executeScrape(
  urls: string[],
  fields: FieldConfig[],
  options: ScrapeOptions = {}
): Promise<ScrapeResponse> {
  const startTime = Date.now();
  const rows: ExtractedRow[] = [];
  const failedUrls: string[] = [];
  const logs: string[] = [];

  for (let uIdx = 0; uIdx < urls.length; uIdx++) {
    const rawUrl = String(urls[uIdx]).trim();
    if (!rawUrl) continue;

    let targetUrl = rawUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    logs.push(`[${uIdx + 1}/${urls.length}] Đang tải dữ liệu: ${targetUrl}`);

    let html = '';
    try {
      const fetchHeaders = { ...DEFAULT_HEADERS, ...(options.customHeaders || {}) };
      const response = await fetch(targetUrl, {
        headers: fetchHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(options.timeoutMs || 15000),
      });

      if (!response.ok) {
        logs.push(`Lỗi kết nối tới ${targetUrl}: HTTP ${response.status} ${response.statusText}`);
        failedUrls.push(targetUrl);
        rows.push({
          id: `row-${uIdx}-err`,
          url: targetUrl,
          data: {},
          cells: {},
          error: `Mã lỗi HTTP ${response.status}: ${response.statusText}`,
          timestamp: Date.now(),
        });
        continue;
      }

      html = await response.text();
    } catch (err: any) {
      const errorText = err.name === 'AbortError' ? 'Thời gian tải trang quá lâu (Timeout 15s)' : err.message;
      logs.push(`Lỗi mạng tải ${targetUrl}: ${errorText}`);
      failedUrls.push(targetUrl);
      rows.push({
        id: `row-${uIdx}-err`,
        url: targetUrl,
        data: {},
        cells: {},
        error: errorText,
        timestamp: Date.now(),
      });
      continue;
    }

    // Load into Cheerio
    const $ = cheerio.load(html);
    const structuredData = extractStructuredData($);

    // Repeating containers
    const containerSelector = options.containerSelector?.trim();
    let containers: cheerio.Cheerio<any>[] = [];

    if (containerSelector) {
      const parsedContainer = parseElementInput(containerSelector);
      let foundContainers = $(parsedContainer.primarySelector);

      if (foundContainers.length === 0) {
        for (const cand of parsedContainer.candidateSelectors) {
          try {
            const test = $(cand);
            if (test.length > 0) {
              foundContainers = test;
              break;
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      if (foundContainers.length > 0) {
        foundContainers.each((_, el) => {
          containers.push($(el));
        });
        logs.push(`Đã tìm thấy ${containers.length} container khớp '${containerSelector}'`);
      }
    }

    if (containers.length === 0) {
      containers = [$.root()];
    }

    for (let cIdx = 0; cIdx < containers.length; cIdx++) {
      const contextEl = containers[cIdx];
      const rowData: Record<string, string> = {};
      const cellInfo: Record<string, any> = {};

      for (const field of fields) {
        const fieldId = field.id || field.name;
        const selectorInput = field.selector || '';
        const parsed = parseElementInput(selectorInput);

        let matchedEl: cheerio.Cheerio<any> | null = null;
        let selectorUsed = parsed.primarySelector;

        try {
          const found = contextEl.find(parsed.primarySelector);
          if (found.length > 0) {
            matchedEl = found;
            selectorUsed = parsed.primarySelector;
          }
        } catch (e) {
          // Ignore
        }

        if (!matchedEl || matchedEl.length === 0) {
          for (const cand of parsed.candidateSelectors) {
            try {
              const found = contextEl.find(cand);
              if (found.length > 0) {
                matchedEl = found;
                selectorUsed = cand;
                break;
              }
            } catch (e) {
              // Ignore
            }
          }
        }

        if ((!matchedEl || matchedEl.length === 0) && contextEl !== $.root()) {
          for (const cand of [parsed.primarySelector, ...parsed.candidateSelectors]) {
            try {
              const found = $(cand);
              if (found.length > 0) {
                matchedEl = found;
                selectorUsed = `${cand} (toàn trang)`;
                break;
              }
            } catch (e) {
              // Ignore
            }
          }
        }

        let extractedValue = '';
        let rawValue = '';
        let matchCount = 0;
        let found = false;

        if (matchedEl && matchedEl.length > 0) {
          found = true;
          matchCount = matchedEl.length;
          const targetElement = field.isList ? matchedEl : matchedEl.first();

          switch (field.extractType) {
            case 'attribute': {
              const attrName = field.attributeName || parsed.suggestedAttribute || 'href';
              if (field.isList) {
                const values: string[] = [];
                matchedEl.each((_, el) => {
                  const val = $(el).attr(attrName);
                  if (val) values.push(val);
                });
                extractedValue = values.join('\n');
              } else {
                extractedValue = targetElement.attr(attrName) || '';
              }
              rawValue = extractedValue;
              break;
            }
            case 'html': {
              extractedValue = targetElement.html() || '';
              rawValue = extractedValue;
              break;
            }
            case 'outer_html': {
              extractedValue = $.html(targetElement) || '';
              rawValue = extractedValue;
              break;
            }
            case 'count': {
              extractedValue = String(matchedEl.length);
              rawValue = extractedValue;
              break;
            }
            case 'raw_text': {
              if (field.isList) {
                const values: string[] = [];
                matchedEl.each((_, el) => {
                  values.push($(el).text());
                });
                extractedValue = values.join('\n');
              } else {
                extractedValue = targetElement.text();
              }
              rawValue = extractedValue;
              break;
            }
            case 'text':
            default: {
              if (field.isList) {
                const values: string[] = [];
                matchedEl.each((_, el) => {
                  const txt = cleanText($(el).text(), field);
                  if (txt) values.push(txt);
                });
                extractedValue = values.join('\n');
              } else {
                extractedValue = cleanText(targetElement.text(), field);
              }
              rawValue = targetElement.text();
              break;
            }
          }
        }

        // SPA Structured Data Fallback
        if (!found && structuredData) {
          const searchTerms: string[] = [];
          const colName = (field.name || '').toLowerCase();
          const sel = (field.selector || '').toLowerCase();

          if (colName.includes('tiêu đề') || colName.includes('title') || colName.includes('job') || sel.includes('title')) {
            searchTerms.push('name', 'title', 'jobTitle', 'jobName', 'headline', 'headlineName');
          } else if (colName.includes('lương') || colName.includes('salary') || sel.includes('salary') || sel.includes('income')) {
            searchTerms.push('expectedAnnualSalary', 'salary', 'jobSalary', 'income', 'annualIncome', 'baseSalary', 'price');
          } else if (colName.includes('công ty') || colName.includes('company') || sel.includes('company') || sel.includes('client')) {
            searchTerms.push('company', 'companyName', 'client', 'clientName', 'hiringOrganization', 'organization');
          } else if (colName.includes('địa điểm') || colName.includes('location') || sel.includes('location') || sel.includes('place')) {
            searchTerms.push('addressDetail', 'location', 'workLocation', 'address', 'jobLocation', 'city');
          } else if (colName.includes('mô tả') || colName.includes('desc') || sel.includes('description')) {
            searchTerms.push('jobDescriptions', 'description', 'jobDescription', 'summary', 'detail');
          }

          if (searchTerms.length > 0) {
            const matchedStructured = findValueInObject(structuredData, searchTerms);
            if (matchedStructured) {
              extractedValue = matchedStructured;
              rawValue = matchedStructured;
              selectorUsed = 'Dữ liệu cấu trúc SPA / Next.js State';
              found = true;
              matchCount = 1;
            }
          }
        }

        if (!extractedValue && field.defaultValue) {
          extractedValue = field.defaultValue;
        }

        rowData[fieldId] = extractedValue;
        cellInfo[fieldId] = {
          value: extractedValue,
          rawValue,
          selectorUsed,
          found,
          matchCount,
        };
      }

      // Gemini AI Fallback if requested
      if (options.useAiFallback !== false) {
        const aiClient = getGeminiClient();
        const missingFields = fields.filter((f: any) => !cellInfo[f.id || f.name]?.found);

        if (aiClient && missingFields.length > 0) {
          logs.push(`Kích hoạt Gemini AI Fallback cho ${missingFields.length} trường dữ liệu...`);
          try {
            const bodyText = $('body').text().slice(0, 15000);
            const aiPrompt = `Trích xuất các trường dữ liệu sau từ nội dung website:
Fields to extract:
${missingFields.map((f: any) => `- Field ID: "${f.id || f.name}", Tên: "${f.name}", Selector gợi ý: "${f.selector}"`).join('\n')}

URL: ${targetUrl}
Nội dung văn bản website:
${bodyText}

Trả về định dạng JSON object trong đó các keys là các Field ID chính xác: ${JSON.stringify(missingFields.map((f: any) => f.id || f.name))}. Nếu không tìm thấy, trả về chuỗi rỗng.`;

            const aiRes = await aiClient.models.generateContent({
              model: 'gemini-3.7-flash',
              contents: aiPrompt,
              config: {
                responseMimeType: 'application/json',
              },
            });

            if (aiRes.text) {
              const aiData = JSON.parse(aiRes.text.trim());
              missingFields.forEach((f: any) => {
                const fid = f.id || f.name;
                if (aiData[fid] && String(aiData[fid]).trim() !== '') {
                  rowData[fid] = String(aiData[fid]);
                  cellInfo[fid] = {
                    value: String(aiData[fid]),
                    rawValue: String(aiData[fid]),
                    selectorUsed: 'Gemini 3.7 Flash AI Semantic',
                    found: true,
                    matchCount: 1,
                  };
                }
              });
            }
          } catch (aiErr: any) {
            logs.push(`Ghi chú AI Fallback: ${aiErr.message}`);
          }
        }
      }

      rows.push({
        id: `row-${uIdx}-${cIdx}`,
        url: targetUrl,
        itemIndex: containers.length > 1 ? cIdx + 1 : undefined,
        data: rowData,
        cells: cellInfo,
        timestamp: Date.now(),
      });
    }
  }

  const executionTimeMs = Date.now() - startTime;
  return {
    success: true,
    rows,
    totalRows: rows.length,
    urlsProcessed: urls.length,
    failedUrls,
    executionTimeMs,
    logs,
  };
}

export async function fetchPreview(url: string): Promise<HtmlPreviewResponse> {
  let targetUrl = String(url).trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const response = await fetch(targetUrl, {
    headers: DEFAULT_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    return {
      success: false,
      url: targetUrl,
      status: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $('title').text().trim() || $('h1').first().text().trim() || 'Trang web không có tiêu đề';
  
  const classSet = new Set<string>();
  const tagSet = new Set<string>();

  $('*').each((_, el) => {
    if (el.type === 'tag') {
      tagSet.add(el.tagName);
      const cls = $(el).attr('class');
      if (cls) {
        cls.split(/\s+/).forEach((c) => {
          if (c.length > 2 && c.length < 35 && !c.startsWith('css-')) {
            classSet.add(c);
          }
        });
      }
    }
  });

  const textSnippet = $('body').text().replace(/\s+/g, ' ').slice(0, 1500);
  const bodyHtml = $('body').html()?.slice(0, 80000) || '';

  return {
    success: true,
    url: targetUrl,
    title,
    textSnippet,
    htmlSnippet: bodyHtml,
    detectedClasses: Array.from(classSet).slice(0, 50),
    detectedTags: Array.from(tagSet),
    status: response.status,
  };
}

export function generateBestCssSelector($: cheerio.CheerioAPI, el: any): string {
  if (!el || el.length === 0) return '';
  const node = el.get(0);
  if (!node || node.type !== 'tag') return '';

  const tagName = node.tagName.toLowerCase();

  // 1. If has ID
  const id = el.attr('id');
  if (id && !id.match(/^[0-9]/) && !id.includes(':') && id.length < 40) {
    return `#${id}`;
  }

  // 2. Data attributes
  const testId = el.attr('data-testid') || el.attr('data-test') || el.attr('data-cy');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // 3. Meaningful classes
  const rawClass = el.attr('class');
  if (rawClass) {
    const classes = rawClass
      .split(/\s+/)
      .filter((c: string) => c.length > 2 && !c.startsWith('css-') && !c.includes('MuiBox-root') && !c.includes('active') && !c.includes('hover'));
    
    // Check specific semantic classes
    const semanticClasses = classes.filter((c: string) => 
      c.includes('title') || c.includes('name') || c.includes('salary') || c.includes('company') ||
      c.includes('job') || c.includes('price') || c.includes('address') || c.includes('desc') ||
      c.includes('detail') || c.includes('header') || c.includes('meta') || c.includes('item')
    );

    if (semanticClasses.length > 0) {
      return `${tagName}.${semanticClasses.slice(0, 2).join('.')}`;
    }

    if (classes.length > 0) {
      return `${tagName}.${classes[0]}`;
    }
  }

  // 4. Parent context
  const parent = el.parent();
  if (parent && parent.length > 0 && parent.get(0).type === 'tag') {
    const parentTag = parent.get(0).tagName.toLowerCase();
    const parentClass = parent.attr('class');
    if (parentClass) {
      const pClasses = parentClass.split(/\s+/).filter((c: string) => !c.startsWith('css-') && c.length > 2);
      if (pClasses.length > 0) {
        return `.${pClasses[0]} ${tagName}`;
      }
    }
    return `${parentTag} > ${tagName}`;
  }

  return tagName;
}

export async function analyzeSampleAndText(params: {
  sampleUrl?: string;
  sampleText?: string;
  htmlSnippet?: string;
}): Promise<{
  success: boolean;
  sampleUrl?: string;
  detectedFields: Array<{
    name: string;
    selector: string;
    extractType: 'text' | 'attribute' | 'html';
    attributeName?: string;
    sampleFoundValue?: string;
    confidence?: number;
    source?: string;
  }>;
  containerSelector?: string;
  pageTitle?: string;
  previewData?: Record<string, string>;
  error?: string;
}> {
  const { sampleUrl, sampleText, htmlSnippet } = params;
  let html = htmlSnippet || '';
  let finalUrl = sampleUrl ? sampleUrl.trim() : '';

  if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = 'https://' + finalUrl;
  }

  if (!html && finalUrl) {
    try {
      const response = await fetch(finalUrl, {
        headers: DEFAULT_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        html = await response.text();
      }
    } catch (e: any) {
      console.warn('Could not fetch sample URL:', e.message);
    }
  }

  if (!html && !sampleText) {
    return {
      success: false,
      error: 'Vui lòng cung cấp một đường link URL mẫu hoặc dán nội dung văn bản mẫu từ trang web.',
      detectedFields: [],
    };
  }

  const $ = cheerio.load(html || '<div></div>');
  const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || '';
  const structuredData = extractStructuredData($);

  const detectedFields: Array<{
    name: string;
    selector: string;
    extractType: 'text' | 'attribute' | 'html';
    attributeName?: string;
    sampleFoundValue?: string;
    confidence?: number;
    source?: string;
  }> = [];

  const previewData: Record<string, string> = {};

  // 1. Process sampleText lines if provided
  if (sampleText && sampleText.trim().length > 0) {
    const rawLines = sampleText
      .split(/[\r\n]+/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    for (let idx = 0; idx < rawLines.length; idx++) {
      const line = rawLines[idx];
      let fieldLabel = `Cột ${idx + 1}`;
      let targetValue = line;

      // Check if line is "Label: Value" format (e.g. "Tiêu đề: Tuyển lập trình viên", "Lương: 350 - 500 man")
      const colonMatch = line.match(/^([^:：]{2,25})[:：]\s*(.+)$/);
      if (colonMatch) {
        fieldLabel = colonMatch[1].trim();
        targetValue = colonMatch[2].trim();
      } else {
        // Infer label from value content
        const lower = line.toLowerCase();
        if (lower.includes('lương') || lower.includes('salary') || lower.includes('万円') || lower.includes('đ/tháng') || lower.includes('vnd') || lower.includes('$')) {
          fieldLabel = 'Mức lương / Salary';
        } else if (lower.includes('công ty') || lower.includes('tnhh') || lower.includes('cổ phần') || lower.includes('株式会社') || lower.includes('corp') || lower.includes('ltd')) {
          fieldLabel = 'Tên công ty / Company';
        } else if (lower.includes('hà nội') || lower.includes('hồ chí minh') || lower.includes('đà nẵng') || lower.includes('tokyo') || lower.includes('quận') || lower.includes('địa chỉ') || lower.includes('address') || lower.includes('都') || lower.includes('県')) {
          fieldLabel = 'Địa điểm làm việc / Location';
        } else if (idx === 0) {
          fieldLabel = 'Tiêu đề công việc / Title';
        } else {
          fieldLabel = `Thông tin ${idx + 1} (${targetValue.slice(0, 15)}...)`;
        }
      }

      // Search Cheerio DOM for matching text
      let matchedSelector = '';
      let foundValue = '';
      let matchedSource = 'DOM Match';

      if (html && targetValue.length > 1) {
        const searchSub = targetValue.slice(0, 40).replace(/["'\\]/g, '');
        let bestEl: any = null;
        let minTextLength = Infinity;

        $('*').each((_, el) => {
          if (el.type === 'tag' && el.tagName !== 'script' && el.tagName !== 'style' && el.tagName !== 'html' && el.tagName !== 'body') {
            const txt = $(el).text();
            if (txt.includes(searchSub)) {
              if (txt.length < minTextLength) {
                minTextLength = txt.length;
                bestEl = $(el);
              }
            }
          }
        });

        if (bestEl && bestEl.length > 0) {
          matchedSelector = generateBestCssSelector($, bestEl);
          foundValue = cleanText(bestEl.text(), { trimWhitespace: true });
        }
      }

      // If not found in DOM, check Next.js / JSON-LD Structured Data
      if (!matchedSelector && structuredData) {
        const lowerLabel = fieldLabel.toLowerCase();
        const searchKeys: string[] = [];
        if (lowerLabel.includes('tiêu đề') || lowerLabel.includes('title') || lowerLabel.includes('name')) {
          searchKeys.push('name', 'title', 'jobTitle');
        } else if (lowerLabel.includes('lương') || lowerLabel.includes('salary')) {
          searchKeys.push('expectedAnnualSalary', 'salary', 'income');
        } else if (lowerLabel.includes('công ty') || lowerLabel.includes('company')) {
          searchKeys.push('company', 'companyName', 'client');
        } else if (lowerLabel.includes('địa điểm') || lowerLabel.includes('location') || lowerLabel.includes('address')) {
          searchKeys.push('addressDetail', 'location', 'address');
        }

        if (searchKeys.length > 0) {
          const val = findValueInObject(structuredData, searchKeys);
          if (val) {
            matchedSelector = `.${lowerLabel.includes('tiêu đề') ? 'job-title' : lowerLabel.includes('lương') ? 'salary' : lowerLabel.includes('công ty') ? 'company-name' : 'address'}`;
            foundValue = val;
            matchedSource = 'Next.js Structured State';
          }
        }
      }

      // Fallback selector if still empty
      if (!matchedSelector) {
        if (fieldLabel.toLowerCase().includes('tiêu đề') || fieldLabel.toLowerCase().includes('title')) {
          matchedSelector = 'h1, .job-title, .title';
        } else if (fieldLabel.toLowerCase().includes('lương') || fieldLabel.toLowerCase().includes('salary')) {
          matchedSelector = '.salary, .job-salary, [class*="salary"]';
        } else if (fieldLabel.toLowerCase().includes('công ty') || fieldLabel.toLowerCase().includes('company')) {
          matchedSelector = '.company-name, .company, [class*="company"]';
        } else if (fieldLabel.toLowerCase().includes('địa điểm') || fieldLabel.toLowerCase().includes('location')) {
          matchedSelector = '.location, .address, [class*="location"]';
        } else {
          matchedSelector = `div:contains("${targetValue.slice(0, 20)}")`;
        }
        foundValue = targetValue;
      }

      detectedFields.push({
        name: fieldLabel,
        selector: matchedSelector,
        extractType: 'text',
        sampleFoundValue: foundValue || targetValue,
        confidence: foundValue ? 0.95 : 0.7,
        source: matchedSource,
      });

      previewData[fieldLabel] = foundValue || targetValue;
    }
  }

  // 2. If no sample text was provided OR we want to auto-enrich from HTML
  if (detectedFields.length === 0 && html) {
    // Check Next.js state first for rich job portals (like circus-job, doda, rikunabi, wantedly)
    if (structuredData?.nextData?.publicJob?.job) {
      const job = structuredData.nextData.publicJob.job;
      if (job.name) {
        detectedFields.push({
          name: 'Tiêu đề công việc / Job Title',
          selector: '<div class="job-title MuiBox-root css-0">',
          extractType: 'text',
          sampleFoundValue: job.name,
          confidence: 0.99,
          source: 'Next.js Job Object',
        });
        previewData['Tiêu đề công việc / Job Title'] = job.name;
      }
      if (job.expectedAnnualSalary) {
        const sal = job.expectedAnnualSalary.min && job.expectedAnnualSalary.max ? `${job.expectedAnnualSalary.min}万円～${job.expectedAnnualSalary.max}万円` : String(job.expectedAnnualSalary.min || job.expectedAnnualSalary);
        detectedFields.push({
          name: 'Mức lương / Salary',
          selector: '.salary, .job-salary',
          extractType: 'text',
          sampleFoundValue: sal,
          confidence: 0.99,
          source: 'Next.js Job Object',
        });
        previewData['Mức lương / Salary'] = sal;
      }
      if (job.company?.name) {
        detectedFields.push({
          name: 'Tên công ty / Company',
          selector: '.company-name, .client-name',
          extractType: 'text',
          sampleFoundValue: job.company.name,
          confidence: 0.99,
          source: 'Next.js Job Object',
        });
        previewData['Tên công ty / Company'] = job.company.name;
      }
      if (job.addressDetail || job.company?.address?.line1) {
        const addr = job.addressDetail || `${job.company?.address?.line1 || ''} ${job.company?.address?.line2 || ''}`.trim();
        detectedFields.push({
          name: 'Địa điểm làm việc / Location',
          selector: '.address, .location',
          extractType: 'text',
          sampleFoundValue: addr,
          confidence: 0.95,
          source: 'Next.js Job Object',
        });
        previewData['Địa điểm làm việc / Location'] = addr;
      }
      if (job.jobDescriptions) {
        detectedFields.push({
          name: 'Mô tả công việc / Job Description',
          selector: '.job-description, .work-content',
          extractType: 'text',
          sampleFoundValue: String(job.jobDescriptions).slice(0, 100) + '...',
          confidence: 0.9,
          source: 'Next.js Job Object',
        });
        previewData['Mô tả công việc / Job Description'] = String(job.jobDescriptions).slice(0, 100);
      }
    } else {
      // Standard DOM auto-detection
      // Title
      const h1 = $('h1').first();
      if (h1.length > 0) {
        detectedFields.push({
          name: 'Tiêu đề / Title',
          selector: generateBestCssSelector($, h1),
          extractType: 'text',
          sampleFoundValue: cleanText(h1.text(), { trimWhitespace: true }),
          confidence: 0.95,
          source: 'DOM H1',
        });
        previewData['Tiêu đề / Title'] = cleanText(h1.text(), { trimWhitespace: true });
      }

      // Salary / Price
      $('[class*="salary"], [class*="price"], .salary, .price').first().each((_, el) => {
        const txt = cleanText($(el).text(), { trimWhitespace: true });
        if (txt && txt.length < 80) {
          detectedFields.push({
            name: 'Mức lương / Giá',
            selector: generateBestCssSelector($, $(el)),
            extractType: 'text',
            sampleFoundValue: txt,
            confidence: 0.9,
            source: 'DOM Match',
          });
          previewData['Mức lương / Giá'] = txt;
        }
      });

      // Company / Author
      $('[class*="company"], [class*="client"], [class*="author"]').first().each((_, el) => {
        const txt = cleanText($(el).text(), { trimWhitespace: true });
        if (txt && txt.length < 100) {
          detectedFields.push({
            name: 'Tên công ty / Đơn vị',
            selector: generateBestCssSelector($, $(el)),
            extractType: 'text',
            sampleFoundValue: txt,
            confidence: 0.9,
            source: 'DOM Match',
          });
          previewData['Tên công ty / Đơn vị'] = txt;
        }
      });
    }
  }

  // 3. Optional Gemini AI enhancement if available
  const aiClient = getGeminiClient();
  if (aiClient && detectedFields.length < 2 && (html || sampleText)) {
    try {
      const aiRes = await suggestSelectorsWithAi(finalUrl, sampleText || 'Extract main job or article information', html.slice(0, 30000));
      if (aiRes.success && aiRes.suggestions?.fields?.length > 0) {
        for (const f of aiRes.suggestions.fields) {
          if (!detectedFields.some(df => df.name.toLowerCase() === f.name.toLowerCase())) {
            detectedFields.push({
              name: f.name,
              selector: f.selector,
              extractType: f.extractType || 'text',
              attributeName: f.attributeName,
              sampleFoundValue: f.sampleExpected || '',
              confidence: 0.9,
              source: 'Gemini AI Analysis',
            });
            previewData[f.name] = f.sampleExpected || '';
          }
        }
      }
    } catch (aiErr) {
      // Continue
    }
  }

  return {
    success: true,
    sampleUrl: finalUrl,
    pageTitle,
    detectedFields,
    previewData,
  };
}

export async function suggestSelectorsWithAi(
  url?: string,
  goalDescription?: string,
  htmlSnippet?: string
): Promise<{ success: boolean; suggestions?: any; error?: string }> {
  const aiClient = getGeminiClient();

  if (!aiClient) {
    return {
      success: false,
      error: 'Chưa cấu hình Gemini API Key trên máy chủ (GEMINI_API_KEY).',
    };
  }

  let pageHtml = htmlSnippet || '';
  if (!pageHtml && url) {
    try {
      const response = await fetch(url, { headers: DEFAULT_HEADERS, signal: AbortSignal.timeout(12000) });
      const text = await response.text();
      const $ = cheerio.load(text);
      pageHtml = $('body').html()?.slice(0, 40000) || '';
    } catch (e) {
      // Continue with whatever context we have
    }
  }

  const prompt = `You are an expert web scraping and CSS selector specialist.
Analyze this webpage HTML and generate optimal CSS selectors and field configurations for extracting data.

User's goal: ${goalDescription || 'Extract job title, salary, company, requirements, location or primary content'}
URL: ${url || 'N/A'}

HTML Snippet:
${pageHtml.slice(0, 25000)}

Return a JSON array of suggested fields with:
- name: Clear column name in Vietnamese and English (e.g. "Tiêu đề công việc / Job Title")
- selector: The best robust CSS selector (e.g. "div.job-title", "h1", ".salary", "div.MuiBox-root.job-title")
- extractType: "text" | "attribute" | "html"
- attributeName: "href" | "src" | null
- sampleExpected: sample expected text from the HTML
- containerSelector: if there is a repeating card/item (e.g. ".job-card", "article", ".job-card"), include container selector.`;

  const aiRes = await aiClient.models.generateContent({
    model: 'gemini-3.7-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          containerSelector: {
            type: Type.STRING,
            description: 'CSS selector for repeating card container if applicable, or empty string',
          },
          fields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                selector: { type: Type.STRING },
                extractType: { type: Type.STRING },
                attributeName: { type: Type.STRING },
                sampleExpected: { type: Type.STRING },
              },
              required: ['name', 'selector', 'extractType'],
            },
          },
        },
        required: ['fields'],
      },
    },
  });

  if (!aiRes.text) {
    return { success: false, error: 'Không nhận được phản hồi từ AI' };
  }

  const parsedData = JSON.parse(aiRes.text.trim());
  return {
    success: true,
    suggestions: parsedData,
  };
}
