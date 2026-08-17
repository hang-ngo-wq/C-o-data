import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { executeScrape, fetchPreview, suggestSelectorsWithAi, analyzeSampleAndText } from './src/utils/scraperEngine.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 1. Scrape API
app.post('/api/scrape', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
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
    console.error('Server Scrape error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi hệ thống khi trích xuất dữ liệu',
    });
  }
});

// 2. Analyze Sample & Text API (Xác định CSS/HTML tự động từ 1 link mẫu & văn bản)
app.post('/api/analyze-sample', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { sampleUrl, sampleText, htmlSnippet } = req.body || {};
    const result = await analyzeSampleAndText({ sampleUrl, sampleText, htmlSnippet });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Analyze sample error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi phân tích link mẫu & văn bản',
      detectedFields: [],
    });
  }
});

// 2. Fetch HTML Preview
app.post('/api/fetch-preview', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL không được để trống.' });
    }

    const result = await fetchPreview(url);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Không thể tải mã nguồn trang web',
    });
  }
});

// 3. AI Auto Suggest Selectors
app.post('/api/ai-suggest-selectors', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { url, goalDescription, htmlSnippet } = req.body || {};
    const result = await suggestSelectorsWithAi(url, goalDescription, htmlSnippet);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    console.error('AI suggest error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi gọi AI gợi ý selector',
    });
  }
});

// 4. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 5. Vite dev middleware / static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web Scraper & Excel Exporter running on http://localhost:${PORT}`);
  });
}

startServer();
