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
