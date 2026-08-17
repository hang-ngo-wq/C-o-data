import React, { useState } from 'react';
import { Header } from './components/Header';
import { UrlInputSection } from './components/UrlInputSection';
import { ElementSelectorConfig } from './components/ElementSelectorConfig';
import { ResultsTable } from './components/ResultsTable';
import { ExportToolbar } from './components/ExportToolbar';
import { HtmlInspectorModal } from './components/HtmlInspectorModal';
import { TemplateManager } from './components/TemplateManager';
import { HelpModal } from './components/HelpModal';
import { SampleAutoDetectorModal } from './components/SampleAutoDetectorModal';
import { ExtractedRow, ExtractionTemplate, FieldConfig, ScrapeResponse } from './types';
import { safeFetchJson } from './utils/apiClient';
import { executeClientSideScrape } from './utils/clientScraper';
import { Play, Sparkles, AlertCircle, RefreshCw, Layers, CheckCircle2, ChevronRight, FileSpreadsheet, ArrowRight } from 'lucide-react';

export default function App() {
  // 1. Initial State with User's Example
  const [urls, setUrls] = useState<string[]>([
    'https://circus-job.com/search/11091?jobDetailPublicToken=493f8e19-215d-42fc-9c9e-3765979a7cc4',
  ]);

  const [fields, setFields] = useState<FieldConfig[]>([
    {
      id: 'f_title',
      name: 'Tiêu đề công việc / Job Title',
      selector: '<div class="job-title MuiBox-root css-0">',
      extractType: 'text',
      trimWhitespace: true,
      removeNewlines: false,
    },
    {
      id: 'f_salary',
      name: 'Mức lương / Salary',
      selector: '.salary, .job-salary, div[class*="salary"]',
      extractType: 'text',
      trimWhitespace: true,
    },
    {
      id: 'f_company',
      name: 'Tên công ty / Company',
      selector: '.company-name, .client-name, div[class*="company"]',
      extractType: 'text',
      trimWhitespace: true,
    },
  ]);

  const [containerSelector, setContainerSelector] = useState<string>('');
  const [useAiFallback, setUseAiFallback] = useState<boolean>(true);

  // 2. Results & Processing States
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>(undefined);
  const [logs, setLogs] = useState<string[]>([]);

  // 3. Modals
  const [showSampleDetector, setShowSampleDetector] = useState<boolean>(false);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [showTemplates, setShowTemplates] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // Handle Apply Fields from Sample Auto Detector
  const handleApplySampleDetection = (newFields: FieldConfig[], detectedContainer?: string, detectedUrl?: string) => {
    if (newFields.length > 0) {
      setFields(newFields);
    }
    if (detectedContainer) {
      setContainerSelector(detectedContainer);
    }
    if (detectedUrl && urls.length === 1 && (!urls[0] || urls[0] === '')) {
      setUrls([detectedUrl]);
    }
    setError(null);
  };

  // Load Example Handler
  const handleLoadExample = () => {
    setUrls([
      'https://circus-job.com/search/11091?jobDetailPublicToken=493f8e19-215d-42fc-9c9e-3765979a7cc4',
    ]);
    setFields([
      {
        id: 'f_title',
        name: 'Tiêu đề công việc / Job Title',
        selector: '<div class="job-title MuiBox-root css-0">',
        extractType: 'text',
        trimWhitespace: true,
        removeNewlines: false,
      },
      {
        id: 'f_salary',
        name: 'Mức lương / Salary',
        selector: '.salary, .job-salary, div[class*="salary"]',
        extractType: 'text',
        trimWhitespace: true,
      },
      {
        id: 'f_company',
        name: 'Tên công ty / Company',
        selector: '.company-name, .client-name, div[class*="company"]',
        extractType: 'text',
        trimWhitespace: true,
      },
    ]);
    setError(null);
  };

  // Start Scrape Execution
  const handleStartScrape = async () => {
    const validUrls = urls.map(u => u.trim()).filter(Boolean);
    if (validUrls.length === 0) {
      setError('Vui lòng nhập ít nhất một đường link URL để trích xuất.');
      return;
    }

    const validFields = fields.filter(f => f.selector.trim());
    if (validFields.length === 0) {
      setError('Vui lòng nhập ít nhất một phần tử / selector HTML để trích xuất.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { ok, data, error: fetchErr } = await safeFetchJson<ScrapeResponse>('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: validUrls,
          fields: validFields,
          options: {
            containerSelector: containerSelector.trim() || undefined,
            useAiFallback,
          },
        }),
      });

      if (ok && data && data.success) {
        setRows(data.rows);
        setExecutionTimeMs(data.executionTimeMs);
        if (data.logs) setLogs(data.logs);
        return;
      }

      // If server returned 404/500/HTML error or serverless is unavailable (e.g. static hosting on Vercel), fallback to client-side scraper!
      const clientResult = await executeClientSideScrape(validUrls, validFields, {
        containerSelector: containerSelector.trim() || undefined,
      });

      if (clientResult.success && clientResult.rows.length > 0) {
        setRows(clientResult.rows);
        setExecutionTimeMs(clientResult.executionTimeMs);
        if (clientResult.logs) setLogs(clientResult.logs);
      } else {
        setError(data?.error || fetchErr || 'Có lỗi xảy ra trong quá trình trích xuất dữ liệu.');
      }
    } catch (err: any) {
      // Direct client-side fallback
      try {
        const clientResult = await executeClientSideScrape(validUrls, validFields, {
          containerSelector: containerSelector.trim() || undefined,
        });
        if (clientResult.success) {
          setRows(clientResult.rows);
          setExecutionTimeMs(clientResult.executionTimeMs);
          if (clientResult.logs) setLogs(clientResult.logs);
        } else {
          setError(err.message || 'Lỗi khi trích xuất dữ liệu.');
        }
      } catch (clientErr: any) {
        setError(clientErr.message || 'Không thể trích xuất dữ liệu từ các liên kết này.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // AI Selector Suggestion Handler
  const handleAiSuggest = async () => {
    const targetUrl = urls[0]?.trim();
    if (!targetUrl) {
      setError('Vui lòng nhập URL trước khi sử dụng AI gợi ý Selector.');
      return;
    }

    setIsAiSuggesting(true);
    setError(null);

    try {
      const { ok, data, error: fetchErr } = await safeFetchJson<any>('/api/ai-suggest-selectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          goalDescription: 'Trích xuất thông tin việc làm, tiêu đề, mức lương, công ty, địa điểm',
        }),
      });

      if (!ok || !data) {
        setError(fetchErr || 'Không thể gọi AI phân tích.');
        return;
      }

      if (data.success && data.suggestions?.fields?.length > 0) {
        const newFields: FieldConfig[] = data.suggestions.fields.map((f: any, idx: number) => ({
          id: `f_ai_${Date.now()}_${idx}`,
          name: f.name,
          selector: f.selector,
          extractType: f.extractType || 'text',
          attributeName: f.attributeName || undefined,
          trimWhitespace: true,
        }));
        setFields(newFields);
        if (data.suggestions.containerSelector) {
          setContainerSelector(data.suggestions.containerSelector);
        }
      } else {
        setError(data.error || 'Không thể tự động phân tích trang bằng AI.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi gọi AI gợi ý selector.');
    } finally {
      setIsAiSuggesting(false);
    }
  };

  // Apply Template Handler
  const handleApplyTemplate = (tpl: ExtractionTemplate) => {
    if (tpl.sampleUrl) {
      setUrls([tpl.sampleUrl]);
    }
    if (tpl.containerSelector !== undefined) {
      setContainerSelector(tpl.containerSelector);
    }
    setFields(tpl.fields);
  };

  // Select Selector from Inspector
  const handleSelectSelectorFromInspector = (selector: string, suggestedName?: string) => {
    const newField: FieldConfig = {
      id: `f_ins_${Date.now()}`,
      name: suggestedName ? `Cột ${suggestedName}` : `Cột ${fields.length + 1}`,
      selector,
      extractType: 'text',
      trimWhitespace: true,
    };
    setFields([...fields, newField]);
    setShowInspector(false);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Header */}
      <Header
        onLoadExample={handleLoadExample}
        onOpenSampleDetector={() => setShowSampleDetector(true)}
        onOpenInspector={() => setShowInspector(true)}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Sample-to-Batch Guidance Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl p-5 shadow-sm border border-indigo-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              <Sparkles className="w-3 h-3 text-yellow-300 mr-1" />
              Quy trình thông minh: Link Mẫu &rarr; Xác định CSS/HTML &rarr; Cào Hàng Loạt
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Tự động phân tích từ 1 link mẫu &amp; cào nhiều link xuất Excel
            </h2>
            <p className="text-xs text-indigo-200 max-w-2xl leading-relaxed">
              Nhập 1 link mẫu và dán nội dung văn bản cần bóc tách. Hệ thống sẽ tự dò tìm thẻ HTML, class CSS và điền danh sách Elements để bạn cào hàng loạt link cùng loại.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowSampleDetector(true)}
            className="shrink-0 px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-900" />
            <span>Mở Trình Phân Tích Link Mẫu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm flex items-start justify-between shadow-xs">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Thông báo lỗi:</strong>
                <span>{error}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 p-1 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Step 1: URL Input Section */}
        <UrlInputSection
          urls={urls}
          onChangeUrls={setUrls}
          isLoading={isLoading}
        />

        {/* Step 2: Element / Selector Mapping Configuration */}
        <ElementSelectorConfig
          fields={fields}
          onChangeFields={setFields}
          containerSelector={containerSelector}
          onChangeContainerSelector={setContainerSelector}
          onAiSuggest={handleAiSuggest}
          isAiSuggesting={isAiSuggesting}
          onOpenSampleDetector={() => setShowSampleDetector(true)}
          onOpenInspectorForField={() => setShowInspector(true)}
        />

        {/* Execution Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-3 text-xs text-slate-600">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useAiFallback}
                onChange={e => setUseAiFallback(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span className="font-medium text-slate-800 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-600" />
                Bật AI Fallback (Gemini 3.7 Flash tự động điền nếu không tìm thấy selector)
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleStartScrape}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Đang trích xuất dữ liệu...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2 fill-current" />
                Bắt đầu trích xuất dữ liệu
              </>
            )}
          </button>
        </div>

        {/* Step 3: Export Toolbar (when data available) */}
        {rows.length > 0 && (
          <ExportToolbar
            rows={rows}
            fields={fields}
            executionTimeMs={executionTimeMs}
          />
        )}

        {/* Step 4: Results Table */}
        <ResultsTable
          rows={rows}
          fields={fields}
          isLoading={isLoading}
          onClearResults={() => setRows([])}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          Web Data Extractor &amp; Excel Exporter &bull; Hỗ trợ bóc tách phần tử HTML, thẻ tag, class và xuất file Excel (.xlsx / .csv)
        </div>
      </footer>

      {/* Modals */}
      <SampleAutoDetectorModal
        isOpen={showSampleDetector}
        onClose={() => setShowSampleDetector(false)}
        onApplyFields={handleApplySampleDetection}
        currentSampleUrl={urls[0] || ''}
      />

      <HtmlInspectorModal
        isOpen={showInspector}
        onClose={() => setShowInspector(false)}
        targetUrl={urls[0] || ''}
        onSelectSelector={handleSelectSelectorFromInspector}
      />

      <TemplateManager
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        currentFields={fields}
        currentUrl={urls[0] || ''}
        currentContainerSelector={containerSelector}
        onApplyTemplate={handleApplyTemplate}
      />

      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}
