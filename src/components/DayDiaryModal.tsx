import { useState, useEffect } from 'react';
import type { PracticeSession, DiaryResult } from '@/types';
import { saveSession, formatDate } from '@/lib/db';
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
 * - 无日记但有练习：AI 补生成日记（保存到本地）
 * - 无练习：手动输入内容补写日记（AI 润色，保存到本地）
 */
export function DayDiaryModal({ dateStr, session, onClose, onSessionUpdated }: Props) {
  const [localSession, setLocalSession] = useState<PracticeSession | undefined>(session);
  const [manualText, setManualText] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 外部 session 变化时同步
  useEffect(() => {
    setLocalSession(session);
  }, [session]);

  const date = new Date(dateStr + 'T00:00:00');
  const dateDisplay = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  const hasDiary = localSession?.diaryGenerated && localSession?.diary;
  const hasPractice = !!localSession;

  /** 该天的日期显示为英文格式（用于日记的 date 字段） */
  const englishDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── 补写日记：基于已有练习句子，AI 生成 ────────────────

  const handleGenerateDiary = async () => {
    if (!localSession || localSession.correctedSentences.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const diary = await api.generateDiary(localSession.correctedSentences);
      const updated: PracticeSession = {
        ...localSession,
        diaryGenerated: true,
        diary: { ...diary, date: englishDate },
        updatedAt: Date.now()
      };
      await saveSession(updated);
      setLocalSession(updated);
    } catch (err: any) {
      setError(err.message || '日记生成失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // ── 手动补写：无练习记录的日期 ─────────────────────────

  const handleManualDiary = async () => {
    const text = manualText.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      // 用户描述（中文或英文均可）交给 AI 润色成英文日记
      const diary = await api.generateDiary([text]);
      const ts = date.getTime();
      const newSession: PracticeSession = {
        id: `session-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: `补写日记 ${dateStr}`,
        createdAt: ts,
        updatedAt: Date.now(),
        messages: [],
        correctedSentences: [],
        diaryGenerated: true,
        diary: { ...diary, date: englishDate },
        date: dateStr
      };
      await saveSession(newSession);
      setLocalSession(newSession);
      setManualText('');
    } catch (err: any) {
      setError(err.message || '补写失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!localSession?.diary) return;
    const text = `${localSession.diary.title}\n${localSession.diary.date}\n\n${localSession.diary.body}`;
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

  const handleClose = () => {
    // 关闭时刷新外部历史列表（可能新增了日记）
    onSessionUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg max-h-[85vh] bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-800 flex flex-col animate-slide-up overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{dateDisplay}</h3>
            <p className="text-xs text-slate-500">
              {hasDiary ? '📝 已生成日记' : hasPractice ? '✍️ 有练习，未生成日记' : '暂无练习记录'}
            </p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400">
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
              ⚠ {error}
            </div>
          )}

          {hasDiary && localSession?.diary ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-xl font-bold text-slate-100 mb-1">{localSession.diary.title}</h4>
                <p className="text-sm text-slate-500">{localSession.diary.date}</p>
              </div>

              <div className="prose prose-invert max-w-none">
                {localSession.diary.body.split('\n').map((para, i) => (
                  <p key={i} className="text-sm text-slate-200 leading-relaxed mb-3">
                    {para}
                  </p>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                  {localSession.diary.wordCount} words
                </span>
              </div>

              {localSession.diary.highlight && (
                <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 p-3">
                  <p className="text-xs text-brand-400 mb-1">💡 练习亮点</p>
                  <p className="text-sm text-slate-200">{localSession.diary.highlight}</p>
                </div>
              )}

              {/* 练习句子回顾 */}
              {localSession.correctedSentences.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">练习句子 ({localSession.correctedSentences.length}句)</p>
                  <ul className="space-y-1.5">
                    {localSession.correctedSentences.map((s, i) => (
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
              <p className="text-sm text-slate-300 mb-1">这天练习了 {localSession!.correctedSentences.length} 个句子</p>
              <p className="text-xs text-slate-500 mb-6">可以补生成日记</p>
              <button
                onClick={handleGenerateDiary}
                disabled={saving || localSession!.correctedSentences.length === 0}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 text-white text-sm font-medium transition-colors"
              >
                {saving ? '生成中…' : '📝 生成日记'}
              </button>
            </div>
          ) : (
            <div className="py-2">
              <div className="text-center mb-4">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-sm text-slate-300 mb-1">补写这一天的日记</p>
                <p className="text-xs text-slate-500">用中文或英文写下那天做了什么，AI 帮你写成英文日记</p>
              </div>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="例如：那天我去了图书馆学习英语，背了20个单词，晚上和朋友吃了火锅，聊了很多有趣的事…"
                className="w-full h-32 resize-none rounded-xl bg-slate-800 border border-slate-700 p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={handleManualDiary}
                disabled={saving || !manualText.trim()}
                className="w-full mt-3 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium transition-colors"
              >
                {saving ? '生成中…' : '✨ AI 生成英文日记'}
              </button>
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
                const text = `${localSession!.diary!.title}\n${localSession!.diary!.date}\n\n${localSession!.diary!.body}`;
                if (navigator.share) {
                  navigator.share({ title: localSession!.diary!.title, text }).catch(() => {});
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
