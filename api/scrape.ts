import { executeScrape } from '../src/utils/scraperEngine.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Chỉ hỗ trợ phương thức POST' });
  }

  try {
    const { urls, fields, options = {} } = req.body || {};

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp ít nhất một đường link URL hợp lệ.',
      });
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cấu hình ít nhất một phần tử / cột trích xuất.',
      });
    }

    const result = await executeScrape(urls, fields, options);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vercel API Scrape Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi xử lý khi trích xuất dữ liệu trên Vercel',
    });
  }
}
