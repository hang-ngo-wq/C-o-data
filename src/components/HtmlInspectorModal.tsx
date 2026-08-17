import React, { useState } from 'react';
import { Code, Search, Copy, Check, Plus, RefreshCw, Globe, ExternalLink, X, AlertCircle } from 'lucide-react';
import { HtmlPreviewResponse } from '../types';
import { safeFetchJson } from '../utils/apiClient';

interface HtmlInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUrl: string;
  onSelectSelector: (selector: string, suggestedName?: string) => void;
}

export const HtmlInspectorModal: React.FC<HtmlInspectorModalProps> = ({
  isOpen,
  onClose,
  targetUrl,
  onSelectSelector,
}) => {
  const [url, setUrl] = useState<string>(targetUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [data, setData] = useState<HtmlPreviewResponse | null>(null);
  const [searchHtml, setSearchHtml] = useState<string>('job-title');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchPreview = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const { ok, data: result, error: fetchErr } = await safeFetchJson<HtmlPreviewResponse>('/api/fetch-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!ok || !result) {
        setError(fetchErr || 'Không thể tải mã nguồn trang web');
        return;
      }

      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Không thể tải mã nguồn trang web');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối mạng');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Soi mã nguồn HTML & Tìm Class / Element
              </h3>
              <p className="text-xs text-slate-500">
                Tìm kiếm class và thẻ HTML trực tiếp từ trang web để thêm vào cột trích xuất
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* URL Input Bar */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Nhập URL cần soi mã HTML..."
                className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={handleFetchPreview}
              disabled={isLoading || !url.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer flex items-center shrink-0 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Đang tải...
                </>
              ) : (
                'Tải mã HTML'
              )}
            </button>
          </div>

          {error && (
            <div className="mt-2 text-xs text-red-600 flex items-center">
              <AlertCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {data ? (
            <>
              {/* Page Title & Status */}
              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">
                    Tiêu đề trang (Page Title)
                  </span>
                  <span className="font-semibold text-slate-900 text-xs">
                    {data.title || 'N/A'}
                  </span>
                </div>
                <a
                  href={data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center text-xs"
                >
                  Mở trang <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>

              {/* Detected Classes */}
              {data.detectedClasses && data.detectedClasses.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 text-xs mb-2">
                    Các CSS Class nổi bật tìm thấy trên trang (Bấm để thêm làm cột trích xuất):
                  </h4>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                    {data.detectedClasses.map(cls => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => onSelectSelector(`.${cls}`, cls)}
                        className="inline-flex items-center px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded text-[11px] font-mono text-slate-700 transition-colors cursor-pointer"
                        title={`Thêm .${cls} vào danh sách cột`}
                      >
                        <Plus className="w-3 h-3 mr-1 text-emerald-600" />
                        .{cls}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* HTML Snippet Search */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="font-bold text-slate-800 text-xs">
                    Tìm kiếm trong mã nguồn HTML (Body HTML):
                  </h4>
                  <div className="relative w-52">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchHtml}
                      onChange={e => setSearchHtml(e.target.value)}
                      placeholder="Tìm thẻ hoặc class..."
                      className="w-full pl-7 pr-2 py-1 text-[11px] font-mono border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 text-slate-200 rounded-lg p-3 font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap select-all">
                  {data.htmlSnippet ? (
                    data.htmlSnippet.slice(0, 15000)
                  ) : (
                    <span className="text-slate-500 italic">Không có mã HTML</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Code className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p>Bấm &quot;Tải mã HTML&quot; để soi cấu trúc và lấy class của trang web</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
