export type ExtractType = 
  | 'text'          // Clean inner text
  | 'raw_text'      // Raw text with whitespace
  | 'html'          // Inner HTML
  | 'outer_html'    // Outer HTML (including the tag)
  | 'attribute'     // Specific HTML attribute like href, src, title, etc.
  | 'count';        // Count of matched elements

export interface FieldConfig {
  id: string;
  name: string;             // Column name in Excel, e.g., "Job Title", "Salary"
  selector: string;         // CSS selector or raw HTML tag snippet, e.g., '<div class="job-title MuiBox-root css-0">'
  resolvedSelector?: string;// Computed clean CSS selector, e.g., 'div.job-title'
  extractType: ExtractType;
  attributeName?: string;   // e.g. 'href', 'src', 'data-id'
  defaultValue?: string;    // Fallback if element not found
  trimWhitespace?: boolean; // Trim leading/trailing whitespace
  removeNewlines?: boolean; // Replace multiple newlines with space
  isList?: boolean;         // Extract all matching elements (joined by newline or comma)
}

export interface ScrapeOptions {
  containerSelector?: string; // Optional card/container selector for multi-item scraping (e.g. '.job-card')
  useAiFallback?: boolean;    // Use Gemini AI to extract if CSS selectors return empty
  timeoutMs?: number;         // Fetch timeout in milliseconds
  customHeaders?: Record<string, string>;
}

export interface ScrapeRequest {
  urls: string[];
  fields: FieldConfig[];
  options?: ScrapeOptions;
}

export interface ExtractedCell {
  value: string;
  rawValue?: string;
  selectorUsed: string;
  found: boolean;
  matchCount?: number;
}

export interface ExtractedRow {
  id: string;
  url: string;
  itemIndex?: number;         // For repeated containers within a page
  data: Record<string, string>; // Key is field.id, value is string
  cells: Record<string, ExtractedCell>;
  error?: string;
  timestamp: number;
}

export interface ScrapeResponse {
  success: boolean;
  rows: ExtractedRow[];
  totalRows: number;
  urlsProcessed: number;
  failedUrls: string[];
  executionTimeMs: number;
  logs?: string[];
  error?: string;
}

export interface DetectedFieldSuggestion {
  name: string;
  selector: string;
  extractType: ExtractType;
  attributeName?: string;
  sampleFoundValue?: string;
  confidence?: number;
  source?: string;
}

export interface SampleAnalysisResponse {
  success: boolean;
  sampleUrl?: string;
  detectedFields: DetectedFieldSuggestion[];
  containerSelector?: string;
  pageTitle?: string;
  previewData?: Record<string, string>;
  error?: string;
}

export interface ExtractionTemplate {
  id: string;
  name: string;
  description?: string;
  sampleUrl: string;
  fields: FieldConfig[];
  containerSelector?: string;
  createdAt: number;
}

export interface HtmlPreviewResponse {
  success: boolean;
  url: string;
  title?: string;
  htmlSnippet?: string;
  textSnippet?: string;
  detectedClasses?: string[];
  detectedTags?: string[];
  status?: number;
  error?: string;
}
