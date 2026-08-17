import { suggestSelectorsWithAi } from '../src/utils/scraperEngine.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Chỉ hỗ trợ phương thức POST' });
  }

  try {
    const { url, goalDescription, htmlSnippet } = req.body || {};
    const result = await suggestSelectorsWithAi(url, goalDescription, htmlSnippet);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    console.error('Vercel API AI-Suggest Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi gọi AI gợi ý selector',
    });
  }
}
