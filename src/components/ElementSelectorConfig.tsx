import React, { useState } from 'react';
import { Plus, Trash2, Settings2, Sparkles, ChevronDown, ChevronUp, Code2, Tag, Info, SlidersHorizontal, Check, RefreshCw } from 'lucide-react';
import { ExtractType, FieldConfig } from '../types';
import { parseElementInput } from '../utils/selectorParser';

interface ElementSelectorConfigProps {
  fields: FieldConfig[];
  onChangeFields: (fields: FieldConfig[]) => void;
  containerSelector: string;
  onChangeContainerSelector: (val: string) => void;
  onAiSuggest: () => void;
  isAiSuggesting: boolean;
  onOpenSampleDetector?: () => void;
  onOpenInspectorForField?: (fieldId: string) => void;
}

export const ElementSelectorConfig: React.FC<ElementSelectorConfigProps> = ({
  fields,
  onChangeFields,
  containerSelector,
  onChangeContainerSelector,
  onAiSuggest,
  isAiSuggesting,
  onOpenSampleDetector,
  onOpenInspectorForField,
}) => {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});

  const handleAddField = () => {
    const newField: FieldConfig = {
      id: `field_${Date.now()}`,
      name: `Cột ${fields.length + 1}`,
      selector: '',
      extractType: 'text',
      trimWhitespace: true,
      removeNewlines: false,
    };
    onChangeFields([...fields, newField]);
  };

  const handleRemoveField = (id: string) => {
    if (fields.length <= 1) return;
    onChangeFields(fields.filter(f => f.id !== id));
  };

  const handleFieldChange = (id: string, updates: Partial<FieldConfig>) => {
    onChangeFields(
      fields.map(f => {
        if (f.id === id) {
          const updated = { ...f, ...updates };
          // If selector changed, re-parse
          if (updates.selector !== undefined) {
            const parsed = parseElementInput(updates.selector);
            updated.resolvedSelector = parsed.primarySelector;
            // Auto-suggest attribute if empty and user typed <a href="..."> or <img src="...">
            if (parsed.suggestedAttribute && !f.attributeName) {
              updated.extractType = parsed.suggestedExtractType;
              updated.attributeName = parsed.suggestedAttribute;
            }
          }
          return updated;
        }
        return f;
      })
    );
  };

  const toggleFieldOptions = (id: string) => {
    setExpandedOptions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 transition-all">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Các phần tử cần trích xuất (Elements / Columns)
            </h2>
            <p className="text-xs text-slate-500">
              Nhập mã thẻ HTML (VD: <code>{'<div class="job-title MuiBox-root css-0">'}</code>) hoặc CSS selector
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenSampleDetector && (
            <button
              type="button"
              onClick={onOpenSampleDetector}
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg shadow-xs transition-all cursor-pointer"
              title="Dựa vào 1 link mẫu và dán văn bản mẫu để tự động tìm CSS, HTML và điền các cột"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-yellow-300" />
              Tự động nhận diện từ Link & Văn bản mẫu
            </button>
          )}

          <button
            type="button"
            onClick={onAiSuggest}
            disabled={isAiSuggesting}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Sử dụng Gemini AI để tự động phát hiện các phần tử quan trọng trên trang"
          >
            {isAiSuggesting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-purple-600" />
                Đang phân tích trang...
              </>
            ) : (
              <>
                <Code2 className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                AI Gợi ý Selector
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-slate-500" />
            {showAdvanced ? 'Ẩn nâng cao' : 'Khung lặp'}
          </button>
        </div>
      </div>

      {/* Repeating Container Setting (Optional) */}
      {showAdvanced && (
        <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div className="flex items-start justify-between mb-1.5">
            <span className="font-semibold text-slate-800 flex items-center">
              <Code2 className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Khung phần tử lặp lại (Container / Card Selector - Không bắt buộc)
            </span>
            <span className="text-slate-500 text-[11px]">Dành cho trang danh sách nhiều việc làm / sản phẩm</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={containerSelector}
              onChange={e => onChangeContainerSelector(e.target.value)}
              placeholder="VD: .job-card hoặc <div class='job-list-item'> hoặc article"
              className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
            />
            {containerSelector && (
              <button
                type="button"
                onClick={() => onChangeContainerSelector('')}
                className="text-slate-400 hover:text-slate-600 px-2 py-1"
              >
                Xóa
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Nếu nhập khung lặp lại, công cụ sẽ quét qua từng thẻ card trên trang để trích xuất thành nhiều hàng trong file Excel.
          </p>
        </div>
      )}

      {/* Fields List */}
      <div className="space-y-3">
        {fields.map((field, idx) => {
          const parsed = parseElementInput(field.selector || '');
          const isOptionsOpen = !!expandedOptions[field.id];

          return (
            <div
              key={field.id}
              className="p-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-lg transition-all"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
                {/* Column Name */}
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tên cột trong Excel
                  </label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={e => handleFieldChange(field.id, { name: e.target.value })}
                    placeholder="VD: Tiêu đề công việc"
                    className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Element / Selector Input */}
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                    <span>Phần tử HTML / Selector</span>
                    {parsed.isRawHtml && (
                      <span className="text-[10px] text-emerald-700 font-normal">
                        ✓ Đã tự nhận diện thẻ HTML
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={field.selector}
                      onChange={e => handleFieldChange(field.id, { selector: e.target.value })}
                      placeholder='VD: <div class="job-title MuiBox-root css-0"> hoặc .job-title'
                      className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  {/* Selector Resolution Clue */}
                  {field.selector && (
                    <div className="mt-1 flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                      <span className="text-slate-400">CSS:</span>
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold border border-emerald-200/60">
                        {parsed.primarySelector}
                      </span>
                      {parsed.classes.length > 0 && (
                        <span className="text-slate-400 text-[10px]">
                          ({parsed.classes.length} class: {parsed.classes.slice(0, 2).join(', ')})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Extract Type */}
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Kiểu trích xuất
                  </label>
                  <select
                    value={field.extractType}
                    onChange={e => handleFieldChange(field.id, { extractType: e.target.value as ExtractType })}
                    className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="text">Văn bản sạch (Clean Text)</option>
                    <option value="raw_text">Văn bản gốc (Raw Text)</option>
                    <option value="attribute">Thuộc tính HTML (href, src, data-...)</option>
                    <option value="html">Mã HTML bên trong (Inner HTML)</option>
                    <option value="outer_html">Toàn bộ thẻ (Outer HTML)</option>
                    <option value="count">Đếm số lượng phần tử</option>
                  </select>
                </div>

                {/* Actions & Settings Toggle */}
                <div className="md:col-span-1 flex items-center justify-end space-x-1 pt-4">
                  <button
                    type="button"
                    onClick={() => toggleFieldOptions(field.id)}
                    className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      isOptionsOpen ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-200'
                    }`}
                    title="Tùy chọn nâng cao (Xóa khoảng trắng, giá trị mặc định)"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveField(field.id)}
                    disabled={fields.length <= 1}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 cursor-pointer"
                    title="Xóa cột này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Conditional: Attribute Name Input */}
              {field.extractType === 'attribute' && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center space-x-3 text-xs">
                  <span className="font-medium text-slate-700">Tên thuộc tính cần lấy:</span>
                  <input
                    type="text"
                    value={field.attributeName || ''}
                    onChange={e => handleFieldChange(field.id, { attributeName: e.target.value })}
                    placeholder="VD: href, src, title, data-id, alt"
                    className="px-2 py-1 text-xs font-mono bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 w-44"
                  />
                  <span className="text-[11px] text-slate-400">
                    (Thẻ &lt;a&gt; dùng &apos;href&apos;, thẻ &lt;img&gt; dùng &apos;src&apos;)
                  </span>
                </div>
              )}

              {/* Collapsible Options Drawer */}
              {isOptionsOpen && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-2.5 rounded-md">
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.trimWhitespace !== false}
                      onChange={e => handleFieldChange(field.id, { trimWhitespace: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span>Cắt bỏ khoảng trắng thừa (Trim)</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!field.removeNewlines}
                      onChange={e => handleFieldChange(field.id, { removeNewlines: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span>Gộp dòng thành 1 hàng</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!field.isList}
                      onChange={e => handleFieldChange(field.id, { isList: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                    />
                    <span>Lấy tất cả các thẻ trùng lặp</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Field Button */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddField}
          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Thêm cột mới (+ Cột Excel)
        </button>

        <span className="text-xs text-slate-400">
          Tổng cộng: <strong>{fields.length}</strong> cột dữ liệu sẽ xuất ra Excel
        </span>
      </div>
    </div>
  );
};
