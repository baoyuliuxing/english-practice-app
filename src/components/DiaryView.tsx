import { useState } from 'react';
import type { DiaryResult } from '@/types';

interface Props {
  diary: DiaryResult;
  onNewSession: () => void;
}

/**
 * 日记展示组件
 * 展示 AI 生成的结构化英文日记，支持复制和开始新会话
 */
export function DiaryView({ diary, onNewSession }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = `${diary.title}\n${diary.date}\n\n${diary.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级方案
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const text = `${diary.title}\n${diary.date}\n\n${diary.body}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: diary.title, text });
      } catch {
        // 用户取消分享，忽略
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-medium text-slate-300">📝 今日英文日记</h2>
        <button
          onClick={onNewSession}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors"
        >
          新练习
        </button>
      </div>

      {/* 日记内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* 标题 */}
          <h1 className="text-2xl font-bold text-slate-100 mb-1">{diary.title}</h1>
          <p className="text-sm text-slate-500 mb-6">{diary.date}</p>

          {/* 正文 */}
          <div className="prose prose-invert max-w-none">
            {diary.body.split('\n').map((para, i) => (
              <p key={i} className="text-base text-slate-200 leading-relaxed mb-4">
                {para}
              </p>
            ))}
          </div>

          {/* 统计 */}
          <div className="flex items-center gap-3 mt-6 mb-6">
            <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
              {diary.wordCount} words
            </span>
          </div>

          {/* 中文亮点 */}
          {diary.highlight && (
            <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 p-4 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-brand-400 text-sm">💡</span>
                <div>
                  <p className="text-xs text-brand-400 mb-1">今日练习亮点</p>
                  <p className="text-sm text-slate-200 leading-relaxed">{diary.highlight}</p>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {copied ? '✓ 已复制' : '📋 复制日记'}
            </button>
            <button
              onClick={handleShare}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              📤 分享
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
