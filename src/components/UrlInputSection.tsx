import React, { useState } from 'react';
import { Globe, Plus, Trash2, List, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface UrlInputSectionProps {
  urls: string[];
  onChangeUrls: (urls: string[]) => void;
  isLoading: boolean;
}

export const UrlInputSection: React.FC<UrlInputSectionProps> = ({
  urls,
  onChangeUrls,
  isLoading,
}) => {
  const [isBatchMode, setIsBatchMode] = useState<boolean>(urls.length > 1);
  const [batchText, setBatchText] = useState<string>(urls.join('\n'));

  const handleSingleUrlChange = (value: string) => {
    onChangeUrls([value]);
    setBatchText(value);
  };

  const handleBatchTextChange = (text: string) => {
    setBatchText(text);
    const parsed = text
      .split(/[\r\n]+/)
      .map(u => u.trim())
      .filter(u => u.length > 0);
    onChangeUrls(parsed.length > 0 ? parsed : ['']);
  };

  const toggleBatchMode = () => {
    if (!isBatchMode) {
      setBatchText(urls.join('\n'));
      setIsBatchMode(true);
    } else {
      const first = urls[0] || '';
      onChangeUrls([first]);
      setBatchText(first);
      setIsBatchMode(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (text.includes('\n')) {
          setIsBatchMode(true);
          handleBatchTextChange(text);
        } else {
          handleSingleUrlChange(text);
        }
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  const validUrlCount = urls.filter(u => u.trim().startsWith('http://') || u.trim().startsWith('https://') || u.trim().length > 4).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Đường link trang web (Target URL)
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={toggleBatchMode}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
          >
            {isBatchMode ? (
              <>
                <Globe className="w-3.5 h-3.5 mr-1 text-blue-600" />
                Chế độ 1 link duy nhất
              </>
            ) : (
              <>
                <List className="w-3.5 h-3.5 mr-1 text-blue-600" />
                Cào nhiều link hàng loạt (Batch URLs)
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePasteClipboard}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
          >
            Dán từ Clipboard
          </button>
        </div>
      </div>

      {!isBatchMode ? (
        <div>
          <div className="relative rounded-lg shadow-xs">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={urls[0] || ''}
              onChange={e => handleSingleUrlChange(e.target.value)}
              placeholder="VD: https://circus-job.com/search/11091?jobDetailPublicToken=493f8e19-215d-42fc-9c9e-3765979a7cc4"
              className="block w-full pl-10 pr-10 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all font-mono"
              disabled={isLoading}
            />
            {urls[0] && (
              <button
                type="button"
                onClick={() => handleSingleUrlChange('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 flex items-center">
            Nhập đường link trang web bất kỳ chứa thông tin bạn muốn bóc tách dữ liệu.
          </p>
        </div>
      ) : (
        <div>
          <div className="relative">
            <textarea
              rows={4}
              value={batchText}
              onChange={e => handleBatchTextChange(e.target.value)}
              placeholder={`Nhập mỗi đường link trên một dòng:\nhttps://circus-job.com/search/11091?jobDetailPublicToken=...\nhttps://circus-job.com/search/11092?jobDetailPublicToken=...\nhttps://circus-job.com/search/11093?jobDetailPublicToken=...`}
              className="block w-full p-3 text-xs sm:text-sm text-slate-900 bg-slate-50/50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all font-mono leading-relaxed resize-y"
              disabled={isLoading}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
            <span>
              Đã nhập: <strong className="text-slate-700">{validUrlCount}</strong> link hợp lệ.
            </span>
            <span className="text-slate-400">Hỗ trợ hàng chục đến hàng trăm link một lúc</span>
          </div>
        </div>
      )}
    </div>
  );
};
