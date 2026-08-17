import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from '@google/genai';
import { parseElementInput } from './src/utils/selectorParser.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI | null {
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

// User-Agent and headers for scraping to avoid bot blocking
const DEFAULT_HEADERS: Record<string, string> = {
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

// Scrape API
app.post('/api/scrape', async (req, res) => {
  const startTime = Date.now();
  try {
    const { urls, fields, options = {} } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least one valid URL.',
      });
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please define at least one element or selector to extract.',
      });
    }

    const rows: any[] = [];
    const failedUrls: string[] = [];
    const logs: string[] = [];

    // Process each URL
    for (let uIdx = 0; uIdx < urls.length; uIdx++) {
      const rawUrl = String(urls[uIdx]).trim();
      if (!rawUrl) continue;

      let targetUrl = rawUrl;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      logs.push(`[${uIdx + 1}/${urls.length}] Fetching: ${targetUrl}`);

      let html = '';
      try {
        const fetchHeaders = { ...DEFAULT_HEADERS, ...(options.customHeaders || {}) };
        const response = await fetch(targetUrl, {
          headers: fetchHeaders,
          redirect: 'follow',
          signal: AbortSignal.timeout(options.timeoutMs || 25000),
        });

        if (!response.ok) {
          logs.push(`Failed to fetch ${targetUrl}: HTTP ${response.status} ${response.statusText}`);
          failedUrls.push(targetUrl);
          rows.push({
            id: `row-${uIdx}-err`,
            url: targetUrl,
            data: {},
            cells: {},
            error: `HTTP ${response.status}: ${response.statusText}`,
            timestamp: Date.now(),
          });
          continue;
        }

        html = await response.text();
      } catch (err: any) {
        logs.push(`Network error fetching ${targetUrl}: ${err.message}`);
        failedUrls.push(targetUrl);
        rows.push({
          id: `row-${uIdx}-err`,
          url: targetUrl,
          data: {},
          cells: {},
          error: `Fetch error: ${err.message}`,
          timestamp: Date.now(),
        });
        continue;
      }

      // Load into Cheerio
      const $ = cheerio.load(html);

      // Check if containerSelector is provided for repeating items (e.g. .job-card)
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
              // Ignore invalid selector syntax
            }
          }
        }

        if (foundContainers.length > 0) {
          foundContainers.each((_, el) => {
            containers.push($(el));
          });
          logs.push(`Found ${containers.length} container elements using '${containerSelector}'`);
        }
      }

      // If no repeating containers found or specified, evaluate page root as single container
      if (containers.length === 0) {
        containers = [$.root()];
      }

      // Process each container
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

          // Attempt primary selector
          try {
            const found = contextEl.find(parsed.primarySelector);
            if (found.length > 0) {
              matchedEl = found;
              selectorUsed = parsed.primarySelector;
            }
          } catch (e) {
            // invalid CSS selector syntax, will try fallbacks
          }

          // If primary didn't match, test candidates
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

          // If still not found and in root context, try global search on $
          if ((!matchedEl || matchedEl.length === 0) && contextEl !== $.root()) {
            for (const cand of [parsed.primarySelector, ...parsed.candidateSelectors]) {
              try {
                const found = $(cand);
                if (found.length > 0) {
                  matchedEl = found;
                  selectorUsed = `${cand} (global)`;
                  break;
                }
              } catch (e) {
                // Ignore
              }
            }
          }

          // Extract value
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

          // Fallback if empty and default value defined
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

        // AI Fallback if requested and some fields were missed
        if (options.useAiFallback) {
          const aiClient = getGeminiClient();
          const missingFields = fields.filter((f: any) => !cellInfo[f.id || f.name]?.found);

          if (aiClient && missingFields.length > 0) {
            logs.push(`Calling Gemini AI fallback for ${missingFields.length} missing fields on ${targetUrl}...`);
            try {
              const bodyText = $('body').text().slice(0, 15000); // 15k chars context
              const aiPrompt = `Extract the following data points from this webpage text:
Fields to extract:
${missingFields.map((f: any) => `- ${f.name} (description/selector clue: ${f.selector})`).join('\n')}

Webpage URL: ${targetUrl}
Webpage text content:
${bodyText}

Return a JSON object where keys are the exact field IDs: ${JSON.stringify(missingFields.map((f: any) => f.id || f.name))}. If not found, return empty string.`;

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
                  if (aiData[fid]) {
                    rowData[fid] = String(aiData[fid]);
                    cellInfo[fid] = {
                      value: String(aiData[fid]),
                      rawValue: String(aiData[fid]),
                      selectorUsed: 'AI Semantic Extraction (Gemini 3.7 Flash)',
                      found: true,
                      matchCount: 1,
                    };
                  }
                });
              }
            } catch (aiErr: any) {
              logs.push(`AI fallback notice: ${aiErr.message}`);
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
    return res.json({
      success: true,
      rows,
      totalRows: rows.length,
      urlsProcessed: urls.length,
      failedUrls,
      executionTimeMs,
      logs,
    });
  } catch (error: any) {
    console.error('Scrape error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal scraping error',
      executionTimeMs: Date.now() - startTime,
    });
  }
});

// HTML Preview & Inspector endpoint
app.post('/api/fetch-preview', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required.' });
    }

    let targetUrl = String(url).trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const response = await fetch(targetUrl, {
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return res.json({
        success: false,
        url: targetUrl,
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled Page';
    
    // Extract prominent classes for auto-suggestion
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

    // Clean text snippet
    const textSnippet = $('body').text().replace(/\s+/g, ' ').slice(0, 1500);

    // Grab first 2000 lines of body HTML
    const bodyHtml = $('body').html()?.slice(0, 80000) || '';

    return res.json({
      success: true,
      url: targetUrl,
      title,
      textSnippet,
      htmlSnippet: bodyHtml,
      detectedClasses: Array.from(classSet).slice(0, 50),
      detectedTags: Array.from(tagSet),
      status: response.status,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to inspect URL',
    });
  }
});

// AI Auto Suggest Selectors
app.post('/api/ai-suggest-selectors', async (req, res) => {
  try {
    const { url, goalDescription, htmlSnippet } = req.body;
    const aiClient = getGeminiClient();

    if (!aiClient) {
      return res.status(400).json({
        success: false,
        error: 'Gemini API key is not configured.',
      });
    }

    let pageHtml = htmlSnippet || '';
    if (!pageHtml && url) {
      try {
        const response = await fetch(url, { headers: DEFAULT_HEADERS });
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
- containerSelector: if there is a repeating card/item (e.g. ".job-item", "article", ".job-card"), include container selector.`;

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
      return res.status(500).json({ success: false, error: 'No response from AI' });
    }

    const parsedData = JSON.parse(aiRes.text.trim());
    return res.json({
      success: true,
      suggestions: parsedData,
    });
  } catch (error: any) {
    console.error('AI suggest error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'AI suggestion failed',
    });
  }
});

function cleanText(text: string, field: any): string {
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web Scraper & Excel Exporter running on http://localhost:${PORT}`);
  });
}

startServer();
