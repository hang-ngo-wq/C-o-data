import * as cheerio from 'cheerio';
import { FieldConfig, ScrapeOptions, ScrapeResponse, ExtractedRow, SampleAnalysisResponse } from '../types.js';
import { parseElementInput } from './selectorParser.js';
import { extractStructuredData, findValueInObject, cleanText, generateBestCssSelector } from './scraperEngine.js';

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

export async function analyzeSampleAndTextClient(params: {
  sampleUrl?: string;
  sampleText?: string;
  htmlSnippet?: string;
}): Promise<SampleAnalysisResponse> {
  const { sampleUrl, sampleText, htmlSnippet } = params;
  let html = htmlSnippet || '';
  let finalUrl = sampleUrl ? sampleUrl.trim() : '';

  if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    finalUrl = 'https://' + finalUrl;
  }

  if (!html && finalUrl) {
    try {
      html = await fetchHtmlWithCorsFallback(finalUrl, 15000);
    } catch (e: any) {
      console.warn('Client fallback fetch sample URL error:', e.message);
    }
  }

  const $ = cheerio.load(html || '<div></div>');
  const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || '';
  const structuredData = extractStructuredData($);

  const detectedFields: any[] = [];
  const previewData: Record<string, string> = {};

  if (sampleText && sampleText.trim().length > 0) {
    const rawLines = sampleText
      .split(/[\r\n]+/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    for (let idx = 0; idx < rawLines.length; idx++) {
      const line = rawLines[idx];
      let fieldLabel = `Cột ${idx + 1}`;
      let targetValue = line;

      const colonMatch = line.match(/^([^:：]{2,25})[:：]\s*(.+)$/);
      if (colonMatch) {
        fieldLabel = colonMatch[1].trim();
        targetValue = colonMatch[2].trim();
      } else {
        const lower = line.toLowerCase();
        if (lower.includes('lương') || lower.includes('salary') || lower.includes('万円') || lower.includes('vnd') || lower.includes('$')) {
          fieldLabel = 'Mức lương / Salary';
        } else if (lower.includes('công ty') || lower.includes('tnhh') || lower.includes('株式会社') || lower.includes('corp')) {
          fieldLabel = 'Tên công ty / Company';
        } else if (lower.includes('địa chỉ') || lower.includes('hà nội') || lower.includes('hồ chí minh') || lower.includes('tokyo') || lower.includes('address')) {
          fieldLabel = 'Địa điểm làm việc / Location';
        } else if (idx === 0) {
          fieldLabel = 'Tiêu đề công việc / Title';
        } else {
          fieldLabel = `Cột ${idx + 1}`;
        }
      }

      let matchedSelector = '';
      let foundValue = '';
      let matchedSource = 'DOM Match';

      if (html && targetValue.length > 1) {
        const searchSub = targetValue.slice(0, 35).replace(/["'\\]/g, '');
        let bestEl: any = null;
        let minTextLength = Infinity;

        $('*').each((_, el) => {
          if (el.type === 'tag' && el.tagName !== 'script' && el.tagName !== 'style') {
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

      if (!matchedSelector && structuredData) {
        const searchKeys = fieldLabel.toLowerCase().includes('lương') ? ['salary', 'expectedAnnualSalary'] : fieldLabel.toLowerCase().includes('công ty') ? ['company', 'companyName'] : ['name', 'title'];
        const val = findValueInObject(structuredData, searchKeys);
        if (val) {
          matchedSelector = fieldLabel.toLowerCase().includes('lương') ? '.salary' : fieldLabel.toLowerCase().includes('công ty') ? '.company-name' : '.job-title';
          foundValue = val;
          matchedSource = 'SPA Next.js State';
        }
      }

      if (!matchedSelector) {
        matchedSelector = fieldLabel.toLowerCase().includes('tiêu đề') ? 'h1, .job-title' : fieldLabel.toLowerCase().includes('lương') ? '.salary' : '.item-detail';
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

  if (detectedFields.length === 0 && structuredData?.nextData?.publicJob?.job) {
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
  }

  return {
    success: true,
    sampleUrl: finalUrl,
    pageTitle,
    detectedFields,
    previewData,
  };
}

async function fetchHtmlWithCorsFallback(targetUrl: string, timeoutMs: number = 15000): Promise<string> {
  // 1. Try direct fetch first
  try {
    const res = await fetch(targetUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      return await res.text();
    }
  } catch (e) {
    // CORS or network error, proceed to proxies
  }

  // 2. Try CORS proxies in sequence
  for (const getProxyUrl of CORS_PROXIES) {
    try {
      const proxyUrl = getProxyUrl(targetUrl);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 50) {
          return text;
        }
      }
    } catch (e) {
      // Continue to next proxy
    }
  }

  throw new Error(`Không thể kết nối đến ${targetUrl} (Bị chặn bởi CORS hoặc trang web không khả dụng).`);
}

export async function executeClientSideScrape(
  urls: string[],
  fields: FieldConfig[],
  options: ScrapeOptions = {}
): Promise<ScrapeResponse> {
  const startTime = Date.now();
  const rows: ExtractedRow[] = [];
  const failedUrls: string[] = [];
  const logs: string[] = ['[Chế độ dự phòng Client-Side Scraper] Đang xử lý trực tiếp...'];

  for (let uIdx = 0; uIdx < urls.length; uIdx++) {
    const rawUrl = String(urls[uIdx]).trim();
    if (!rawUrl) continue;

    let targetUrl = rawUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    logs.push(`[${uIdx + 1}/${urls.length}] Đang tải: ${targetUrl}`);

    let html = '';
    try {
      html = await fetchHtmlWithCorsFallback(targetUrl, options.timeoutMs || 15000);
    } catch (err: any) {
      logs.push(`Lỗi tải ${targetUrl}: ${err.message}`);
      failedUrls.push(targetUrl);
      rows.push({
        id: `row-${uIdx}-err`,
        url: targetUrl,
        data: {},
        cells: {},
        error: err.message,
        timestamp: Date.now(),
      });
      continue;
    }

    // Parse with Cheerio
    const $ = cheerio.load(html);
    const structuredData = extractStructuredData($);

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

  return {
    success: true,
    rows,
    totalRows: rows.length,
    urlsProcessed: urls.length,
    failedUrls,
    executionTimeMs: Date.now() - startTime,
    logs,
  };
}
