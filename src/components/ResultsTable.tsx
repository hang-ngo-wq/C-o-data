import React, { useState } from 'react';
import { ExtractedRow, FieldConfig } from '../types';
import { Search, ExternalLink, Copy, Check, Eye, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';

interface ResultsTableProps {
  rows: ExtractedRow[];
  fields: FieldConfig[];
  isLoading: boolean;
  onClearResults?: () => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  rows,
  fields,
  isLoading,
  onClearResults,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRow, setSelectedRow] = useState<ExtractedRow | null>(null);
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null);

  // Filter rows by search query
  const filteredRows = rows.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (r.url.toLowerCase().includes(q)) return true;
    return Object.values(r.data).some(val => String(val).toLowerCase().includes(q));
  });

  const handleCopyCell = (text: string, cellKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCellId(cellKey);
    setTimeout(() => {
      setCopiedCellId(null);
    }, 1500);
  };

  if (rows.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
      {/* Header Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
            3
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
              Kết quả trích xuất ({rows.length} bản ghi)
            </h2>
            <p className="text-xs text-slate-500">
              Dữ liệu sẵn sàng để xuất ra file Excel (.xlsx) hoặc CSV
            </p>
          </div>
        </div>

        {/* Search Bar & Actions */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm trong kết quả..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 w-48 sm:w-60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>

          {onClearResults && (
            <button
              type="button"
              onClick={onClearResults}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              Xóa bảng
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && rows.length === 0 && (
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent mb-3" />
          <p className="text-sm font-medium text-slate-700">Đang cào dữ liệu từ trang web...</p>
          <p className="text-xs text-slate-400 mt-1">Đang bóc tách các phần tử HTML theo selector</p>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-100/80 sticky top-0 z-10 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center">STT</th>
              <th className="py-2.5 px-3 min-w-[200px]">Đường link (URL)</th>
              {fields.map(f => (
                <th key={f.id} className="py-2.5 px-3 min-w-[220px]">
                  <div className="font-semibold text-slate-900">{f.name || f.selector}</div>
                  <div className="text-[10px] font-mono text-slate-400 font-normal truncate max-w-[200px]" title={f.selector}>
                    {f.selector}
                  </div>
                </th>
              ))}
              <th className="py-2.5 px-3 w-16 text-center">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredRows.length > 0 ? (
              filteredRows.map((row, rIdx) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Index */}
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                    {rIdx + 1}
                  </td>

                  {/* URL */}
                  <td className="py-2.5 px-3 font-mono">
                    <div className="flex items-center space-x-1.5 max-w-[220px]">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline truncate"
                        title={row.url}
                      >
                        {row.url}
                      </a>
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-blue-600 shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    {row.error && (
                      <span className="inline-flex items-center text-[10px] text-red-600 mt-0.5">
                        <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                        {row.error}
                      </span>
                    )}
                  </td>

                  {/* Dynamic Fields */}
                  {fields.map(field => {
                    const val = row.data[field.id] || '';
                    const cell = row.cells[field.id];
                    const isCopied = copiedCellId === `${row.id}_${field.id}`;

                    return (
                      <td key={field.id} className="py-2.5 px-3 relative group">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="line-clamp-3 text-slate-800 text-xs leading-relaxed break-words whitespace-pre-line font-sans select-all">
                            {val ? (
                              val
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                (Không tìm thấy phần tử)
                              </span>
                            )}
                          </div>

                          {val && (
                            <button
                              type="button"
                              onClick={() => handleCopyCell(val, `${row.id}_${field.id}`)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all cursor-pointer shrink-0"
                              title="Sao chép nội dung ô này"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>

                        {cell?.selectorUsed && (
                          <div className="mt-1 flex items-center text-[10px] text-slate-400">
                            {cell.found ? (
                              <span className="text-emerald-600 flex items-center">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                                {cell.matchCount && cell.matchCount > 1 ? `${cell.matchCount} thẻ` : 'Khớp'}
                              </span>
                            ) : (
                              <span className="text-amber-600">Chưa khớp</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Detail Modal Trigger */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedRow(row)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      title="Xem toàn bộ nội dung bản ghi này"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={fields.length + 3} className="py-8 text-center text-slate-500">
                  Không tìm thấy dòng nào khớp với từ khóa tìm kiếm &quot;{searchQuery}&quot;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Row Detail View Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                Chi tiết bản ghi đã trích xuất
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] block mb-1">
                  Source URL
                </label>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono break-all select-all">
                  <a
                    href={selectedRow.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center"
                  >
                    {selectedRow.url}
                    <ExternalLink className="w-3 h-3 ml-1 shrink-0" />
                  </a>
                </div>
              </div>

              {fields.map(field => {
                const val = selectedRow.data[field.id] || '';
                const cell = selectedRow.cells[field.id];

                return (
                  <div key={field.id}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800 text-xs">
                        {field.name || field.selector}
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">
                        {field.selector}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 whitespace-pre-wrap font-sans text-slate-900 leading-relaxed max-h-60 overflow-y-auto select-all">
                      {val || <span className="text-slate-400 italic">Không có dữ liệu</span>}
                    </div>

                    {cell && (
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Selector đã dùng: {cell.selectorUsed}</span>
                        <span>{cell.found ? 'Trạng thái: Khớp thành công' : 'Không tìm thấy'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
