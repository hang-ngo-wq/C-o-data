import React, { useState } from 'react';
import { Sparkles, Globe, FileText, CheckCircle2, ArrowRight, RefreshCw, X, AlertCircle, Layers, Check, Search, Code } from 'lucide-react';
import { FieldConfig, DetectedFieldSuggestion, SampleAnalysisResponse } from '../types';
import { safeFetchJson } from '../utils/apiClient';
import { analyzeSampleAndTextClient } from '../utils/clientScraper';

interface SampleAutoDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFields: (fields: FieldConfig[], containerSelector?: string, sampleUrl?: string) => void;
  currentSampleUrl?: string;
}

export const SampleAutoDetectorModal: React.FC<SampleAutoDetectorModalProps> = ({
  isOpen,
  onClose,
  onApplyFields,
  currentSampleUrl = '',
}) => {
  const [sampleUrl, setSampleUrl] = useState<string>(
    currentSampleUrl || 'https://circus-job.com/search/11091?jobDetailPublicToken=493f8e19-215d-42fc-9c9e-3765979a7cc4'
  );
  const [sampleText, setSampleText] = useState<string>(
    `Tiêu đề: 面接1回！【クラウドエンジニア】🔶経験浅くてもOK🔶案件の7割がリモートワーク！/平均残業時間10h以下/社員ファーストの会社でスキルアップ/資格手当◎\nMức lương: 348万円～501万円\nTên công ty: 株式会社プロトシステム\nĐịa điểm: 東京都千代田区二番町12-3`
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<SampleAnalysisResponse | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!sampleUrl.trim() && !sampleText.trim()) {
      setError('Vui lòng nhập 1 đường link mẫu hoặc nội dung văn bản mẫu.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // 1. Try server endpoint
      const { ok, data, error: fetchErr } = await safeFetchJson<SampleAnalysisResponse>('/api/analyze-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleUrl: sampleUrl.trim(),
          sampleText: sampleText.trim(),
        }),
      });

      if (ok && data && data.success && data.detectedFields?.length > 0) {
        setAnalysisResult(data);
        setSelectedIndices(new Set(data.detectedFields.map((_, idx) => idx)));
        return;
      }

      // 2. Client-side fallback if server returned error or offline
      const clientResult = await analyzeSampleAndTextClient({
        sampleUrl: sampleUrl.trim(),
        sampleText: sampleText.trim(),
      });

      if (clientResult.success && clientResult.detectedFields?.length > 0) {
        setAnalysisResult(clientResult);
        setSelectedIndices(new Set(clientResult.detectedFields.map((_, idx) => idx)));
      } else {
        setError(data?.error || fetchErr || 'Không tìm thấy phần tử phù hợp trong trang mẫu.');
      }
    } catch (err: any) {
      // Client-side fallback
      try {
        const clientResult = await analyzeSampleAndTextClient({
          sampleUrl: sampleUrl.trim(),
          sampleText: sampleText.trim(),
        });
        if (clientResult.success && clientResult.detectedFields?.length > 0) {
          setAnalysisResult(clientResult);
          setSelectedIndices(new Set(clientResult.detectedFields.map((_, idx) => idx)));
        } else {
          setError(err.message || 'Lỗi khi phân tích trang mẫu.');
        }
      } catch (e: any) {
        setError(e.message || 'Không thể tải và phân tích đường link mẫu này.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleSelect = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!analysisResult) return;
    if (selectedIndices.size === analysisResult.detectedFields.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(analysisResult.detectedFields.map((_, i) => i)));
    }
  };

  const handleApply = () => {
    if (!analysisResult || selectedIndices.size === 0) return;

    const chosenFields: FieldConfig[] = analysisResult.detectedFields
      .filter((_, idx) => selectedIndices.has(idx))
      .map((df, idx) => ({
        id: `field_${Date.now()}_${idx}`,
        name: df.name,
        selector: df.selector,
        extractType: df.extractType || 'text',
        attributeName: df.attributeName,
        trimWhitespace: true,
        removeNewlines: false,
      }));

    onApplyFields(chosenFields, analysisResult.containerSelector, sampleUrl.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Tự Động Nhận Diện CSS/HTML từ 1 Link Mẫu & Văn Bản
              </h3>
              <p className="text-xs text-indigo-100 mt-0.5">
                Nhập 1 link mẫu + dán nội dung mẫu &rarr; Hệ thống tự dò tìm thẻ HTML/CSS và điền bảng Elements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Step 1: Input Sample URL */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center">
              <Globe className="w-4 h-4 mr-1.5 text-indigo-600" />
              1. Đường link mẫu (1 Sample Target URL)
            </label>
            <input
              type="text"
              value={sampleUrl}
              onChange={e => setSampleUrl(e.target.value)}
              placeholder="VD: https://circus-job.com/search/11091?jobDetailPublicToken=..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Chỉ cần nhập 1 đường link trang mẫu chứa dữ liệu bạn cần bóc tách.
            </p>
          </div>

          {/* Step 2: Input Sample Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-indigo-600" />
                2. Nội dung văn bản mẫu trên trang (Sample Text / Giá trị cần lấy)
              </label>
              <span className="text-[11px] text-indigo-600 font-medium">Mỗi trường trên 1 dòng</span>
            </div>
            <textarea
              rows={4}
              value={sampleText}
              onChange={e => setSampleText(e.target.value)}
              placeholder={`Dán các đoạn văn bản mẫu hoặc theo mẫu Tên: Giá trị\nVD:\nTiêu đề: 面接1回！【クラウドエンジニア】...\nMức lương: 348万円～501万円\nTên công ty: 株式会社プロトシステム\nĐịa điểm: 東京都千代田区...`}
              className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white font-mono leading-relaxed resize-y"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Hệ thống sẽ quét mã nguồn HTML của link mẫu để xác định thẻ HTML, CSS selector và cấu trúc SPA tương ứng với từng dòng văn bản này.
            </p>
          </div>

          {/* Action Analyze Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang phân tích mã nguồn HTML & CSS selector...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>Xác định CSS, HTML & Tự động điền các phần tử</span>
                </>
              )}
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Analysis Results Display */}
          {analysisResult && (
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-sm text-slate-900">
                    Đã nhận diện thành công {analysisResult.detectedFields.length} phần tử (Elements / Columns)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  {selectedIndices.size === analysisResult.detectedFields.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>

              {analysisResult.pageTitle && (
                <p className="text-xs text-slate-600">
                  <strong>Tiêu đề trang:</strong> {analysisResult.pageTitle}
                </p>
              )}

              {/* Detected Fields Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-8">Chọn</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Tên Cột (Column Name)</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">CSS Selector / Thẻ HTML</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Giá trị mẫu tìm thấy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysisResult.detectedFields.map((field, idx) => {
                      const isSelected = selectedIndices.has(idx);
                      return (
                        <tr
                          key={idx}
                          onClick={() => handleToggleSelect(idx)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">{field.name}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-indigo-700 bg-indigo-50/30">
                            {field.selector}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate" title={field.sampleFoundValue}>
                            {field.sampleFoundValue || <span className="text-slate-400 italic">Đã khớp</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!analysisResult || selectedIndices.size === 0}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>Áp dụng vào bảng Cấu hình Elements ({selectedIndices.size})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
