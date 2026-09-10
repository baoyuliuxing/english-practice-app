import { useState } from 'react';
import type { DiaryResult, DiaryEntry } from '@/types';
import { ClickableEnglish } from '@/components/ClickableEnglish';

interface Props {
  /** 当前展示的日记（最新一版） */
  diary: DiaryResult;
  /** 该会话的所有日记版本（按时间顺序，末尾为最新） */
  diaries?: DiaryEntry[];
  onNewSession: () => void;
  onAddWord?: (word: string, context: string) => void;
  /** 删除某版日记（按 createdAt 标识） */
  onDeleteDiary?: (createdAt: number) => Promise<void> | void;
}

/**
 * 日记展示组件
 * - 展示 AI 生成的结构化英文日记
 * - 顶部提供多版本切换（若有多版）
 * - 每版可独立删除（大号按钮）
 * - 复制 / 分享 / 选词加入生词本
 */
export function DiaryView({ diary, diaries, onNewSession, onAddWord, onDeleteDiary }: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmDelAt, setConfirmDelAt] = useState<number | null>(null);

  const versions = diaries && diaries.length > 0 ? diaries : [{ ...diary, createdAt: Date.now() } as DiaryEntry];
  const isMulti = versions.length > 1;

  const handleCopy = async () => {
    const text = `${diary.title}\n${diary.date}\n\n${diary.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
        // 用户取消分享
      }
    } else {
      handleCopy();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
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
          {/* 版本切换（仅在多版时显示） */}
          {isMulti && (
            <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
              {versions.slice().reverse().map((v, i) => {
                const isLatest = i === 0;
                return (
                  <button
                    key={v.createdAt}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                      isLatest
                        ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                    }`}
                    title={`生成于 ${formatTime(v.createdAt)}`}
                  >
                    📝 {formatTime(v.createdAt)}{i === 0 && ' (最新)'}
                  </button>
                );
              })}
            </div>
          )}

          {/* 单版生成时间小字 */}
          {!isMulti && (
            <p className="text-[11px] text-slate-500 mb-2">
              生成于 {formatTime(versions[0].createdAt)}
            </p>
          )}

          {/* 标题（可选词） */}
          <h1 className="text-2xl font-bold text-slate-100 mb-1">
            <ClickableEnglish text={diary.title} onAddWord={onAddWord} />
          </h1>
          <p className="text-sm text-slate-500 mb-6">{diary.date}</p>

          {/* 正文（可选词） */}
          <div className="prose prose-invert max-w-none">
            {diary.body.split('\n').map((para, i) => (
              <p key={i} className="text-base text-slate-200 leading-relaxed mb-4">
                <ClickableEnglish text={para} onAddWord={onAddWord} />
              </p>
            ))}
          </div>

          {/* 统计 */}
          <div className="flex items-center gap-3 mt-6 mb-6">
            <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
              {diary.wordCount} words
            </span>
            {isMulti && (
              <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                共 {versions.length} 个版本
              </span>
            )}
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

          {/* 提示 */}
          {onAddWord && (
            <p className="text-xs text-slate-600 text-center mb-4">
              💡 点击英文单词旁的 + 可加入生词本
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 mb-3">
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

          {/* 删除当前这版日记（≥ 40px 大按钮） */}
          {onDeleteDiary && isMulti && (
            <div className="mt-2">
              {confirmDelAt === versions[versions.length - 1].createdAt ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelAt(null)}
                    className="flex-1 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      const at = confirmDelAt;
                      setConfirmDelAt(null);
                      if (at != null) await onDeleteDiary(at);
                    }}
                    className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                  >
                    确认删除这一版
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelAt(versions[versions.length - 1].createdAt)}
                  className="w-full h-12 rounded-xl bg-slate-800/80 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/30 text-slate-300 hover:text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  🗑 删除这一版
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
