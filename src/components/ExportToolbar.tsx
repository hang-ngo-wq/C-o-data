import React, { useState } from 'react';
import { ExtractedRow, FieldConfig } from '../types';
import { FileSpreadsheet, Download, FileText, Code, Copy, Check, Sparkles, Clock, CheckCircle } from 'lucide-react';
import { exportToExcel, exportToCsv, exportToJson, copyAsTsv } from '../utils/excelExporter';

interface ExportToolbarProps {
  rows: ExtractedRow[];
  fields: FieldConfig[];
  executionTimeMs?: number;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  rows,
  fields,
  executionTimeMs,
}) => {
  const [filename, setFilename] = useState<string>('trich_xuat_du_lieu_web');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const handleExportExcel = () => {
    if (rows.length === 0) return;
    const finalName = (filename.trim() || 'trich_xuat_du_lieu_web') + '.xlsx';
    exportToExcel(rows, fields, finalName, true);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const finalName = (filename.trim() || 'trich_xuat_du_lieu_web') + '.csv';
    exportToCsv(rows, fields, finalName);
  };

  const handleExportJson = () => {
    if (rows.length === 0) return;
    const finalName = (filename.trim() || 'trich_xuat_du_lieu_web') + '.json';
    exportToJson(rows, fields, finalName);
  };

  const handleCopyTsv = () => {
    if (rows.length === 0) return;
    const success = copyAsTsv(rows, fields);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-xl shadow-md p-5 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Stats */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              Trích xuất thành công
            </span>
            {executionTimeMs !== undefined && (
              <span className="text-xs text-teal-200 flex items-center">
                <Clock className="w-3 h-3 mr-1 opacity-70" />
                {executionTimeMs}ms
              </span>
            )}
          </div>
          <h3 className="text-base font-bold tracking-tight text-white">
            Đã thu thập {rows.length} dòng dữ liệu với {fields.length} cột
          </h3>
          <p className="text-xs text-teal-100/80">
            Tải trực tiếp về định dạng bảng tính Excel chuẩn hoặc sao chép nhanh sang Google Sheets
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* File Name Config */}
          <div className="flex items-center bg-teal-950/60 rounded-lg p-1 border border-teal-700/50">
            <input
              type="text"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              placeholder="Tên file..."
              className="px-2.5 py-1 text-xs text-white bg-transparent focus:outline-hidden w-40 font-medium"
            />
            <span className="text-xs text-teal-300/60 pr-2">.xlsx</span>
          </div>

          {/* Primary Excel Download Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 rounded-lg transition-all shadow-sm cursor-pointer hover:shadow-md"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4 mr-1.5 text-emerald-950" />
                Đã tải file!
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-950" />
                Xuất file Excel (.xlsx)
              </>
            )}
          </button>

          {/* CSV Download Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center px-3 py-2 text-xs font-medium text-white bg-teal-800/80 hover:bg-teal-700 rounded-lg transition-colors border border-teal-600/50 cursor-pointer"
            title="Xuất file CSV mã hóa UTF-8 BOM"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            CSV
          </button>

          {/* JSON Download Button */}
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center px-3 py-2 text-xs font-medium text-white bg-teal-800/80 hover:bg-teal-700 rounded-lg transition-colors border border-teal-600/50 cursor-pointer"
            title="Xuất file JSON"
          >
            <Code className="w-3.5 h-3.5 mr-1" />
            JSON
          </button>

          {/* Copy Table to Clipboard */}
          <button
            type="button"
            onClick={handleCopyTsv}
            className="inline-flex items-center px-3 py-2 text-xs font-medium text-white bg-teal-800/80 hover:bg-teal-700 rounded-lg transition-colors border border-teal-600/50 cursor-pointer"
            title="Sao chép toàn bộ bảng dữ liệu để dán vào Excel hoặc Google Sheets (Ctrl + V)"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-300" />
                Đã chép!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" />
                Chép bảng
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
