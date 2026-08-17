import React from 'react';
import { HelpCircle, CheckCircle2, Code2, FileSpreadsheet, X, Sparkles, Terminal } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Hướng dẫn sử dụng & Bóc tách dữ liệu
              </h3>
              <p className="text-xs text-slate-500">
                Cách lấy thẻ HTML, CSS Selector và xuất ra file Excel
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
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700">
          {/* Step 1 */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-bold text-slate-900 text-xs mb-1 flex items-center">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px] mr-1.5 font-bold">
                1
              </span>
              Nhập đường link (URL)
            </h4>
            <p className="text-slate-600">
              Dán đường link trang web bạn cần lấy dữ liệu (VD: <code>https://circus-job.com/search/11091?...</code>).
              Bạn có thể chọn chế độ <strong>Cào nhiều link hàng loạt</strong> để quét nhiều trang cùng lúc.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-bold text-slate-900 text-xs mb-1 flex items-center">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px] mr-1.5 font-bold">
                2
              </span>
              Cách nhập phần tử cần trích xuất (Element / Selector)
            </h4>
            <p className="text-slate-600 mb-2">
              Hệ thống hỗ trợ nhiều cách nhập linh hoạt:
            </p>
            <ul className="space-y-1.5 list-disc pl-4 text-slate-600">
              <li>
                <strong>Dán trực tiếp mã thẻ HTML:</strong> Copy thẻ từ trình duyệt như <code>&lt;div class=&quot;job-title MuiBox-root css-0&quot;&gt;</code>. Hệ thống sẽ tự động phân tích và tạo selector tương ứng.
              </li>
              <li>
                <strong>CSS Selector chuẩn:</strong> <code>.job-title</code>, <code>div.job-title</code>, <code>h1</code>, <code>.salary</code>, <code>div[class*=&quot;job-title&quot;]</code>.
              </li>
              <li>
                <strong>Lấy link hoặc ảnh:</strong> Chọn kiểu trích xuất là <em>Thuộc tính HTML</em> và điền <code>href</code> (đối với thẻ a) hoặc <code>src</code> (đối với thẻ img).
              </li>
              <li>
                <strong>AI Gợi ý tự động:</strong> Bấm nút <em>AI Tự động gợi ý Selector</em> để Gemini quét toàn bộ trang web và điền sẵn các cột tiêu đề, lương, công ty.
              </li>
            </ul>
          </div>

          {/* Step 3 */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-bold text-slate-900 text-xs mb-1 flex items-center">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white inline-flex items-center justify-center text-[10px] mr-1.5 font-bold">
                3
              </span>
              Bấm &quot;Bắt đầu trích xuất dữ liệu&quot; &amp; Tải file Excel
            </h4>
            <p className="text-slate-600">
              Sau khi dữ liệu được trích xuất và hiển thị trên bảng, bạn bấm nút <strong>Xuất file Excel (.xlsx)</strong> để tải ngay file bảng tính về máy.
            </p>
          </div>

          {/* Developer Tip */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
            <h5 className="font-bold text-xs mb-1 flex items-center">
              <Code2 className="w-3.5 h-3.5 mr-1 text-blue-700" />
              Mẹo lấy thẻ trên trình duyệt:
            </h5>
            <p className="text-[11px] text-blue-800">
              Trên Chrome / Edge, nhấp chuột phải vào dòng chữ bạn muốn lấy trên trang web &rarr; chọn <strong>Kiểm tra (Inspect)</strong> &rarr; nhấp chuột phải vào dòng thẻ &rarr; chọn <strong>Copy &rarr; Copy element</strong> rồi dán thẳng vào ô Phần tử.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
