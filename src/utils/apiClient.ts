/**
 * Safe API Client for making requests and parsing JSON without SyntaxErrors
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 30000
): Promise<{ ok: boolean; data: T | null; error: string | null; status: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    if (!rawText || rawText.trim() === '') {
      if (!response.ok) {
        return {
          ok: false,
          data: null,
          error: `Máy chủ phản hồi lỗi HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }
      return { ok: true, data: null, error: null, status: response.status };
    }

    // Try parsing JSON
    try {
      const parsed = JSON.parse(rawText) as T;
      if (!response.ok) {
        const errorMsg = (parsed as any)?.error || `Lỗi HTTP ${response.status}: ${response.statusText}`;
        return { ok: false, data: parsed, error: errorMsg, status: response.status };
      }
      return { ok: true, data: parsed, error: null, status: response.status };
    } catch (parseError) {
      // The response is not JSON (likely an HTML error page or proxy error)
      let cleanedMessage = 'Máy chủ trả về định dạng không phải JSON';
      if (rawText.includes('<!DOCTYPE html>') || rawText.includes('<html')) {
        if (response.status === 404) {
          cleanedMessage = 'Đường dẫn API không tìm thấy (HTTP 404). Vui lòng thử lại.';
        } else if (response.status === 502 || response.status === 504) {
          cleanedMessage = 'Kết nối tới trang web quá thời gian chờ (Gateway Timeout). Vui lòng thử lại.';
        } else if (response.status === 500) {
          cleanedMessage = 'Máy chủ gặp sự cố nội bộ (HTTP 500).';
        } else {
          cleanedMessage = `Trang web hoặc máy chủ trả về mã lỗi HTTP ${response.status}`;
        }
      } else {
        cleanedMessage = rawText.slice(0, 120);
      }

      return {
        ok: false,
        data: null,
        error: cleanedMessage,
        status: response.status,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        ok: false,
        data: null,
        error: 'Yêu cầu quá thời gian chờ (Timeout sau 30 giây). Vui lòng kiểm tra lại đường link.',
        status: 408,
      };
    }
    return {
      ok: false,
      data: null,
      error: err.message || 'Lỗi mạng hoặc không thể kết nối tới máy chủ.',
      status: 0,
    };
  }
}
