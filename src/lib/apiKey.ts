/**
 * API Key 本地存储管理
 * Key 存储在 localStorage 中，仅在本设备使用，不上传任何服务器。
 */

const STORAGE_KEY = 'deepseek_api_key';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
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
