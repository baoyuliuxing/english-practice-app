import { useState } from 'react';
import { getApiKey, setApiKey, clearApiKey } from '@/lib/apiKey';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

/**
 * API Key 设置弹窗
 * 用户在此输入 DeepSeek API Key，存储在 localStorage 中。
 * Key 仅保存在本设备，不上传任何服务器。
 */
export function ApiKeyModal({ onClose, onSaved }: Props) {
  const [key, setKey] = useState(getApiKey() || '');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!key.trim()) return;
    setApiKey(key.trim());
    setSaved(true);
    setTimeout(() => {
      onSaved();
      onClose();
    }, 600);
  };

  const handleClear = () => {
    clearApiKey();
    setKey('');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-2xl animate-slide-up">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-100">配置 API Key</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-400"
          >
            ✕
          </button>
        </div>

        {/* 说明 */}
        <div className="mb-4 p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
          <p className="text-xs text-slate-400 leading-relaxed">
            🔑 请输入你的 <span className="text-brand-400">DeepSeek API Key</span>
          </p>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Key 仅保存在你的手机本地，不会上传到任何服务器。
          </p>
          <a
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2"
          >
            没有 Key？点击此处免费获取 →
          </a>
        </div>

        {/* 输入框 */}
        <div className="relative mb-4">
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="sk-..."
            autoFocus
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 pr-12 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm"
            type="button"
          >
            {showKey ? '🙈' : '👁'}
          </button>
        </div>

        {/* 按钮 */}
        <div className="flex gap-3">
          {getApiKey() && (
            <button
              onClick={handleClear}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-300 text-sm font-medium transition-colors"
            >
              清除
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!key.trim() || saved}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {saved ? '✓ 已保存' : '保存'}
          </button>
        </div>

        {/* 安全提示 */}
        <p className="text-[11px] text-slate-600 mt-3 text-center leading-relaxed">
          🔒 你的 Key 通过 HTTPS 直接发送给 DeepSeek 官方 API，不经过第三方
        </p>
      </div>
    </div>
  );
}
