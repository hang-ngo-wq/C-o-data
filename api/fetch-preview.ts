import { fetchPreview } from '../src/utils/scraperEngine.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Chỉ hỗ trợ phương thức POST' });
  }

  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL không được để trống.' });
    }

    const result = await fetchPreview(url);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vercel API Fetch-Preview Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Không thể tải mã nguồn trang web',
    });
  }
}
