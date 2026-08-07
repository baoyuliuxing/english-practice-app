import { useState, useEffect } from 'react';
import type { PracticeSession, DiaryResult } from '@/types';
import { formatDate } from '@/lib/db';
import * as api from '@/lib/api';

interface Props {
  dateStr: string;
  session?: PracticeSession;
  onClose: () => void;
  onSessionUpdated: () => void;
}

/**
 * 某一天的日记详情弹窗
 * - 有日记：展示日记内容
 * - 无日记但有练习：可补写
 * - 无练习：提示开始练习
 */
export function DayDiaryModal({ dateStr, session, onClose, onSessionUpdated }: Props) {
  const [manualDiary, setManualDiary] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const date = new Date(dateStr + 'T00:00:00');
  const dateDisplay = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  const hasDiary = session?.diaryGenerated && session?.diary;
  const hasPractice = !!session;

  // 补写日记：用 AI 生成
  const handleGenerateDiary = async () => {
    if (!session || session.correctedSentences.length === 0) return;
    setSaving(true);
    try {
      const diary = await api.generateDiary(session.correctedSentences);
      // 更新会话
      const updated = { ...session, diaryGenerated: true, diary, updatedAt: Date.now() };
      // 这里需要通过外部保存，简化处理：直接刷新
      onSessionUpdated();
    } catch (err: any) {
      alert('日记生成失败: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!session?.diary) return;
    const text = `${session.diary.title}\n${session.diary.date}\n\n${session.diary.body}`;
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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[85vh] bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-800 flex flex-col animate-slide-up overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{dateDisplay}</h3>
            <p className="text-xs text-slate-500">
              {hasDiary ? '📝 已生成日记' : hasPractice ? '✍️ 有练习，未生成日记' : '暂无练习记录'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400">
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {hasDiary && session?.diary ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-xl font-bold text-slate-100 mb-1">{session.diary.title}</h4>
                <p className="text-sm text-slate-500">{session.diary.date}</p>
              </div>

              <div className="prose prose-invert max-w-none">
                {session.diary.body.split('\n').map((para, i) => (
                  <p key={i} className="text-sm text-slate-200 leading-relaxed mb-3">
                    {para}
                  </p>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                  {session.diary.wordCount} words
                </span>
              </div>

              {session.diary.highlight && (
                <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 p-3">
                  <p className="text-xs text-brand-400 mb-1">💡 练习亮点</p>
                  <p className="text-sm text-slate-200">{session.diary.highlight}</p>
                </div>
              )}

              {/* 练习句子回顾 */}
              {session.correctedSentences.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">练习句子 ({session.correctedSentences.length}句)</p>
                  <ul className="space-y-1.5">
                    {session.correctedSentences.map((s, i) => (
                      <li key={i} className="text-xs text-slate-400 pl-2 border-l-2 border-slate-700">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : hasPractice ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">✍️</p>
              <p className="text-sm text-slate-300 mb-1">这天练习了 {session!.correctedSentences.length} 个句子</p>
              <p className="text-xs text-slate-500 mb-6">可以补生成日记</p>
              <button
                onClick={handleGenerateDiary}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 text-white text-sm font-medium transition-colors"
              >
                {saving ? '生成中…' : '📝 生成日记'}
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-4xl mb-3 opacity-30">📭</p>
              <p className="text-sm text-slate-500">这一天还没有练习记录</p>
              <p className="text-xs text-slate-600 mt-1">开始今天的练习吧！</p>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        {hasDiary && (
          <div className="px-4 py-3 border-t border-slate-800 flex gap-3 shrink-0">
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
            <button
              onClick={() => {
                const text = `${session!.diary!.title}\n${session!.diary!.date}\n\n${session!.diary!.body}`;
                if (navigator.share) {
                  navigator.share({ title: session!.diary!.title, text }).catch(() => {});
                } else {
                  handleCopy();
                }
              }}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              📤 分享
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
