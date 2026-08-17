import React, { useState, useEffect } from 'react';
import { Layers, Bookmark, Plus, Trash2, Check, X, ArrowRight, Sparkles } from 'lucide-react';
import { ExtractionTemplate, FieldConfig } from '../types';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentFields: FieldConfig[];
  currentUrl: string;
  currentContainerSelector?: string;
  onApplyTemplate: (template: ExtractionTemplate) => void;
}

const DEFAULT_PRESETS: ExtractionTemplate[] = [
  {
    id: 'preset_circus_job',
    name: 'Circus Job Detail (Ví dụ mẫu người dùng)',
    description: 'Trích xuất Tiêu đề công việc, Mức lương, và Tên công ty từ trang circus-job.com',
    sampleUrl: 'https://circus-job.com/search/11091?jobDetailPublicToken=493f8e19-215d-42fc-9c9e-3765979a7cc4',
    createdAt: Date.now(),
    fields: [
      {
        id: 'f_job_title',
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
      {
        id: 'f_location',
        name: 'Địa điểm / Location',
        selector: '.location, .work-location, div[class*="location"]',
        extractType: 'text',
        trimWhitespace: true,
      },
    ],
  },
  {
    id: 'preset_ecommerce',
    name: 'Sản phẩm Thương mại điện tử (E-Commerce)',
    description: 'Trích xuất Tên sản phẩm, Giá bán, Hình ảnh, và Link chi tiết',
    sampleUrl: 'https://example.com/product/123',
    createdAt: Date.now(),
    fields: [
      {
        id: 'f_prod_title',
        name: 'Tên sản phẩm',
        selector: 'h1.product-title, .product-name, h1',
        extractType: 'text',
        trimWhitespace: true,
      },
      {
        id: 'f_prod_price',
        name: 'Giá bán',
        selector: '.price, .product-price, span.price',
        extractType: 'text',
        trimWhitespace: true,
      },
      {
        id: 'f_prod_image',
        name: 'Link hình ảnh',
        selector: 'img.product-image, .gallery img',
        extractType: 'attribute',
        attributeName: 'src',
      },
      {
        id: 'f_prod_desc',
        name: 'Mô tả tóm tắt',
        selector: '.description, .product-description, #description',
        extractType: 'text',
        trimWhitespace: true,
        removeNewlines: true,
      },
    ],
  },
  {
    id: 'preset_article',
    name: 'Bài viết tin tức & Blog',
    description: 'Trích xuất Tiêu đề bài viết, Tác giả, Ngày đăng, và Nội dung',
    sampleUrl: 'https://example.com/news/123',
    createdAt: Date.now(),
    fields: [
      {
        id: 'f_art_title',
        name: 'Tiêu đề bài viết',
        selector: 'h1.entry-title, h1.article-title, h1',
        extractType: 'text',
        trimWhitespace: true,
      },
      {
        id: 'f_art_author',
        name: 'Tác giả',
        selector: '.author, .byline, .author-name',
        extractType: 'text',
        trimWhitespace: true,
      },
      {
        id: 'f_art_date',
        name: 'Ngày đăng',
        selector: 'time, .publish-date, .post-date',
        extractType: 'text',
        trimWhitespace: true,
      },
    ],
  },
];

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  isOpen,
  onClose,
  currentFields,
  currentUrl,
  currentContainerSelector,
  onApplyTemplate,
}) => {
  const [savedTemplates, setSavedTemplates] = useState<ExtractionTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('web_scraper_templates');
      if (stored) {
        setSavedTemplates(JSON.parse(stored));
      } else {
        setSavedTemplates(DEFAULT_PRESETS);
        localStorage.setItem('web_scraper_templates', JSON.stringify(DEFAULT_PRESETS));
      }
    } catch (e) {
      setSavedTemplates(DEFAULT_PRESETS);
    }
  }, []);

  const handleSaveCurrent = () => {
    if (!newTemplateName.trim()) return;
    const newTpl: ExtractionTemplate = {
      id: `tpl_${Date.now()}`,
      name: newTemplateName.trim(),
      description: `Lưu ${currentFields.length} cột trích xuất`,
      sampleUrl: currentUrl || '',
      containerSelector: currentContainerSelector,
      fields: currentFields,
      createdAt: Date.now(),
    };

    const updated = [newTpl, ...savedTemplates];
    setSavedTemplates(updated);
    localStorage.setItem('web_scraper_templates', JSON.stringify(updated));
    setNewTemplateName('');
    setIsSaving(false);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    localStorage.setItem('web_scraper_templates', JSON.stringify(updated));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Quản lý mẫu cấu hình trích xuất (Templates)
              </h3>
              <p className="text-xs text-slate-500">
                Lưu và tái sử dụng bộ cột trích xuất cho các loại website khác nhau
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

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Save Current Section */}
          <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-purple-900 text-xs flex items-center">
                <Bookmark className="w-3.5 h-3.5 mr-1 text-purple-600" />
                Lưu cấu hình hiện tại thành mẫu mới
              </span>
              <span className="text-[11px] text-purple-700">
                ({currentFields.length} cột đã định cấu hình)
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="Nhập tên mẫu (VD: Mẫu tuyển dụng Circus, Mẫu Shopee...)"
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={handleSaveCurrent}
                disabled={!newTemplateName.trim()}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-40 flex items-center shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Lưu mẫu
              </button>
            </div>
          </div>

          {/* Saved Templates List */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs">Danh sách mẫu có sẵn:</h4>
            {savedTemplates.map(template => (
              <div
                key={template.id}
                className="p-3.5 bg-white border border-slate-200 hover:border-purple-300 rounded-xl transition-all flex items-center justify-between gap-3 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {template.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                      {template.fields.length} cột
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-slate-500 text-[11px]">{template.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {template.fields.map(f => (
                      <span
                        key={f.id}
                        className="text-[10px] px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded font-mono"
                      >
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyTemplate(template);
                      onClose();
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Sử dụng
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </button>

                  {!template.id.startsWith('preset_') && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa mẫu này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
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
