import { analyzeSampleAndText } from '../src/utils/scraperEngine.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Chỉ hỗ trợ phương thức POST' });
  }

  try {
    const { sampleUrl, sampleText, htmlSnippet } = req.body || {};
    const result = await analyzeSampleAndText({ sampleUrl, sampleText, htmlSnippet });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Vercel API Analyze-Sample Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi phân tích link mẫu & văn bản',
      detectedFields: [],
    });
  }
}
