import * as XLSX from 'xlsx';
import { ExtractedRow, FieldConfig } from '../types';

export function exportToExcel(
  rows: ExtractedRow[],
  fields: FieldConfig[],
  filename: string = 'extracted_data.xlsx',
  includeMetadata: boolean = true
) {
  const wb = XLSX.utils.book_new();

  // 1. Prepare Main Data Sheet
  const headerRow: string[] = ['STT / No.', 'Source URL', ...fields.map(f => f.name || f.selector)];

  const dataRows = rows.map((row, index) => {
    const rowValues = [
      (index + 1).toString(),
      row.url,
      ...fields.map(f => {
        const val = row.data[f.id];
        return val !== undefined && val !== null ? val : (f.defaultValue || '');
      })
    ];
    return rowValues;
  });

  const wsData = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-calculate column widths
  const colWidths = headerRow.map((colName, colIdx) => {
    let maxLen = colName.length;
    dataRows.forEach(r => {
      const cellVal = r[colIdx] ? String(r[colIdx]) : '';
      if (cellVal.length > maxLen) {
        maxLen = Math.min(cellVal.length, 60); // Cap width at 60
      }
    });
    return { wch: Math.max(maxLen + 4, 12) };
  });
  ws['!cols'] = colWidths;

  // Add sheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');

  // 2. Optional Metadata & Selector Config Sheet
  if (includeMetadata) {
    const metaHeader = ['Field Name', 'Element / Selector', 'Extract Type', 'Attribute', 'Matches Found'];
    const metaData = fields.map(f => {
      // Calculate total matches across rows
      const totalMatches = rows.reduce((acc, r) => {
        const cell = r.cells[f.id];
        return acc + (cell?.found ? 1 : 0);
      }, 0);

      return [
        f.name || 'Unnamed Column',
        f.selector,
        f.extractType,
        f.attributeName || 'N/A',
        `${totalMatches} / ${rows.length} rows`
      ];
    });

    const metaSheetData = [
      ['WEB DATA EXTRACTION REPORT'],
      [`Exported on: ${new Date().toLocaleString()}`],
      [`Total Records: ${rows.length}`],
      [],
      metaHeader,
      ...metaData
    ];

    const metaWs = XLSX.utils.aoa_to_sheet(metaSheetData);
    metaWs['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 18 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, metaWs, 'Extraction Config');
  }

  // Trigger browser download
  XLSX.writeFile(wb, filename);
}

export function exportToCsv(
  rows: ExtractedRow[],
  fields: FieldConfig[],
  filename: string = 'extracted_data.csv'
) {
  const headerRow = ['STT / No.', 'Source URL', ...fields.map(f => f.name || f.selector)];

  const dataRows = rows.map((row, index) => {
    return [
      index + 1,
      `"${escapeCsv(row.url)}"`,
      ...fields.map(f => {
        const val = row.data[f.id] ?? f.defaultValue ?? '';
        return `"${escapeCsv(val)}"`;
      })
    ].join(',');
  });

  // UTF-8 BOM for Excel to open Japanese/Vietnamese correctly
  const csvContent = '\uFEFF' + [headerRow.map(h => `"${escapeCsv(h)}"`).join(','), ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToJson(
  rows: ExtractedRow[],
  fields: FieldConfig[],
  filename: string = 'extracted_data.json'
) {
  const exportData = rows.map((r, i) => {
    const obj: Record<string, any> = {
      index: i + 1,
      sourceUrl: r.url,
      extractedAt: new Date(r.timestamp).toISOString()
    };
    fields.forEach(f => {
      obj[f.name || f.selector] = r.data[f.id] ?? f.defaultValue ?? '';
    });
    return obj;
  });

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function copyAsTsv(rows: ExtractedRow[], fields: FieldConfig[]): boolean {
  try {
    const headerRow = ['STT', 'Source URL', ...fields.map(f => f.name || f.selector)].join('\t');
    const dataLines = rows.map((row, idx) => {
      const vals = [
        idx + 1,
        row.url,
        ...fields.map(f => (row.data[f.id] ?? '').replace(/[\r\n\t]+/g, ' '))
      ];
      return vals.join('\t');
    });

    const fullTsv = [headerRow, ...dataLines].join('\n');
    navigator.clipboard.writeText(fullTsv);
    return true;
  } catch (e) {
    console.error('Failed to copy TSV:', e);
    return false;
  }
}

function escapeCsv(str: string): string {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/"/g, '""');
}
