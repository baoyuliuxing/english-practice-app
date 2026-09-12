/**
 * API Key 本地存储管理
 * Key 存储在 localStorage 中，仅在本设备使用，不上传任何服务器。
 */

const STORAGE_KEY = 'deepseek_api_key';

/**
 * 清洗 API Key。
 *
 * fetch 的请求头只允许 ISO-8859-1（即 Latin-1）字符，
 * 一旦 Key 里混入中文、全角符号或不可见字符，就会抛出：
 *   Failed to execute 'fetch': String contains non ISO-8859-1 code point.
 *
 * 常见的来源：从聊天软件/网页复制时带上了全角空格、中文引号、
 * 换行或 RTL 控制符。这里统一去掉，只保留 ASCII 可见字符（0x21-0x7E）。
 */
export function sanitizeApiKey(raw: string): string {
  if (!raw) return '';
  return raw
    // 去掉所有非 ASCII 可见字符（保留 ! 到 ~ 即 0x21-0x7E）
    .replace(/[^\x21-\x7E]/g, '')
    // 移除粘贴时常见的 "Bearer " 前缀（用户有时会连前缀一起复制）
    .replace(/^Bearer/i, '')
    .trim();
}

export function getApiKey(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // 读取时兜底清洗：修复此前存入的脏数据，避免持续报错
    const clean = sanitizeApiKey(raw);
    if (clean !== raw) {
      // 顺手把清理后的值写回，下次直接读到干净数据
      localStorage.setItem(STORAGE_KEY, clean);
    }
    return clean || null;
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, sanitizeApiKey(key));
  } catch (err) {
    console.error('Failed to save API key:', err);
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}
