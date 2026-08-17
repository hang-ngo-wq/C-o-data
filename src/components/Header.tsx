import React from 'react';
import { Download, Sparkles, FileSpreadsheet, Globe, Layers, HelpCircle, Code } from 'lucide-react';

interface HeaderProps {
  onLoadExample: () => void;
  onOpenSampleDetector: () => void;
  onOpenInspector: () => void;
  onOpenTemplates: () => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onLoadExample,
  onOpenSampleDetector,
  onOpenInspector,
  onOpenTemplates,
  onOpenHelp,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm ring-1 ring-emerald-700/10">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Web Data Extractor to Excel
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  XLSX & CSV
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Trích xuất dữ liệu từ URL & phần tử HTML (Element / Selector) xuất ra Excel
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onOpenSampleDetector}
              className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg shadow-xs transition-all cursor-pointer"
              title="Dựa vào 1 link mẫu & nội dung văn bản để tự động nhận diện CSS/HTML và điền cột trích xuất"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-yellow-300" />
              Phân tích từ Link & Văn bản mẫu
            </button>

            <button
              type="button"
              onClick={onLoadExample}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Tải cấu hình mẫu ví dụ Circus Job"
            >
              Nạp ví dụ mẫu
            </button>

            <button
              type="button"
              onClick={onOpenInspector}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Xem trước mã nguồn HTML của trang web để lấy selector"
            >
              <Code className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Soi mã HTML
            </button>

            <button
              type="button"
              onClick={onOpenTemplates}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Mẫu trích xuất đã lưu"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
              Mẫu đã lưu
            </button>

            <button
              type="button"
              onClick={onOpenHelp}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Hướng dẫn sử dụng"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
