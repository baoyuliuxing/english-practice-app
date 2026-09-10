import { useState, useEffect, useMemo } from 'react';
import type { PracticeSession, DiaryResult, DiaryEntry } from '@/types';
import { saveSession } from '@/lib/db';
import * as api from '@/lib/api';

interface Props {
  dateStr: string;
  session?: PracticeSession;
  onClose: () => void;
  /** 进入该天的补写对话模式（对话式写当天日记） */
  onEnterBackfill: (dateStr: string) => void;
  onSessionUpdated: () => void;
  /** 删除某一版日记（按 createdAt 定位） */
  onDeleteDiary?: (sessionId: string, diaryCreatedAt: number) => Promise<void> | void;
}

/**
 * 某一天的日记详情弹窗
 *
 * 方案 A 入口（按状态动态展示）：
 * 1. 有日记(diaries.length > 0)
 *    - 📖 查看当前选中版本
 *    - 💬 继续对话补写（基于已有日记再聊）
 *    - ✨ 重新生成新一版（追加到 versions，不会覆盖）
 *    - 多版时显示版本切换器 + 每条带"🗑 删除这一版"大按钮
 *
 * 2. 有练习无日记
 *    - 💬 继续对话（补写润色）
 *    - ✨ 直接生成日记（快捷路径）
 *
 * 3. 无练习无日记（兜底）
 *    - 💬 开始对话补写
 */
export function DayDiaryModal({
  dateStr,
  session,
  onClose,
  onEnterBackfill,
  onSessionUpdated,
  onDeleteDiary
}: Props) {
  const [localSession, setLocalSession] = useState<PracticeSession | undefined>(session);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 多版时当前选中的版本（按 createdAt 索引） */
  const [selectedCreatedAt, setSelectedCreatedAt] = useState<number | null>(null);
  /** 二次确认态：被点删除的那一版的 createdAt */
  const [confirmDelAt, setConfirmDelAt] = useState<number | null>(null);

  // 外部 session 变化时同步
  useEffect(() => {
    setLocalSession(session);
  }, [session]);

  const date = useMemo(() => new Date(dateStr + 'T00:00:00'), [dateStr]);
  const dateDisplay = date.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  // 全部日记版本（按时间倒序：新的在前）
  const diaries: DiaryEntry[] = useMemo(() => {
    const list = localSession?.diaries || [];
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [localSession?.diaries]);

  const hasDiary = diaries.length > 0;
  const hasPractice = !!localSession && (localSession.messages.length > 0 || localSession.correctedSentences.length > 0);

  // 当前选中的日记版本（默认最新 = 排序后第一个）
  const currentDiary: DiaryEntry | null = useMemo(() => {
    if (!hasDiary) return null;
    if (selectedCreatedAt != null) {
      const found = diaries.find(d => d.createdAt === selectedCreatedAt);
      if (found) return found;
    }
    return diaries[0]; // 最新版
  }, [hasDiary, diaries, selectedCreatedAt]);

  // 当 diaries 变化（删除 / 新增）后，重置 selectedCreatedAt
  useEffect(() => {
    if (hasDiary) {
      setSelectedCreatedAt(prev => {
        if (prev != null && diaries.some(d => d.createdAt === prev)) return prev;
        return diaries[0]?.createdAt ?? null;
      });
    } else {
      setSelectedCreatedAt(null);
    }
  }, [diaries, hasDiary]);

  /** 该天的日期显示为英文格式（用于日记的 date 字段） */
  const englishDate = useMemo(
    () =>
      date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
    [date]
  );

  // ── 基于已有练习句子直接生成日记（追加新版本） ──────
  const handleGenerateDiary = async () => {
    if (!localSession || localSession.correctedSentences.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const diary = await api.generateDiary(localSession.correctedSentences);
      const newEntry: DiaryEntry = {
        ...diary,
        date: englishDate,
        createdAt: Date.now()
      };
      const updated: PracticeSession = {
        ...localSession,
        diaryGenerated: true,
        diaries: [...(localSession.diaries || []), newEntry],
        updatedAt: Date.now()
      };
      await saveSession(updated);
      setLocalSession(updated);
      // 切到新生成的版本
      setSelectedCreatedAt(newEntry.createdAt);
    } catch (err: any) {
      setError(err.message || '日记生成失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // ── 删除某一版日记 ──────────────────────────────────
  const handleDeleteDiary = async (createdAt: number) => {
    if (!localSession) return;
    try {
      if (onDeleteDiary) {
        await onDeleteDiary(localSession.id, createdAt);
      }
      // 本地状态也同步（避免依赖外层刷新）
      setLocalSession(prev => {
        if (!prev) return prev;
        const remaining = (prev.diaries || []).filter(d => d.createdAt !== createdAt);
        return {
          ...prev,
          diaries: remaining,
          diaryGenerated: remaining.length > 0,
          updatedAt: Date.now()
        };
      });
      setConfirmDelAt(null);
    } catch (err: any) {
      setError(err.message || '删除失败，请重试');
    }
  };

  // ── 复制当前选中版本 ────────────────────────────────
  const handleCopy = async () => {
    if (!currentDiary) return;
    const text = `${currentDiary.title}\n${currentDiary.date}\n\n${currentDiary.body}`;
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
    onSessionUpdated();
    onClose();
  };

  const subtitle = hasDiary
    ? `📝 已生成日记（${diaries.length} 版）`
    : hasPractice
    ? '✍️ 有练习，未生成日记'
    : '暂无记录，可对话补写';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg max-h-[85vh] bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-800 flex flex-col animate-slide-up overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{dateDisplay}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400"
            aria-label="关闭"
          >
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

          {/* ───────── 状态 1：有日记（日记视图） ───────── */}
          {hasDiary && currentDiary ? (
            <div className="space-y-4">
              {/* 多版时显示版本切换横条 */}
              {diaries.length > 1 && (
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/60 p-2">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <p className="text-[11px] text-slate-400">
                      共 {diaries.length} 个版本（最新在前）
                    </p>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {diaries.map((d, idx) => {
                      const ts = new Date(d.createdAt);
                      const label = `${idx === 0 ? '最新 ' : ''}${ts.toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`;
                      const active = d.createdAt === currentDiary.createdAt;
                      return (
                        <button
                          key={d.createdAt}
                          onClick={() => {
                            setSelectedCreatedAt(d.createdAt);
                            setConfirmDelAt(null);
                          }}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            active
                              ? 'bg-brand-500 text-white'
                              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 当前日记正文 */}
              <div>
                <h4 className="text-xl font-bold text-slate-100 mb-1">{currentDiary.title}</h4>
                <p className="text-sm text-slate-500">
                  {currentDiary.date}
                  <span className="ml-2 text-[11px] text-slate-600">
                    · 生成于{' '}
                    {new Date(currentDiary.createdAt).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </p>
              </div>

              <div className="prose prose-invert max-w-none">
                {currentDiary.body.split('\n').map((para, i) => (
                  <p key={i} className="text-sm text-slate-200 leading-relaxed mb-3">
                    {para}
                  </p>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                  {currentDiary.wordCount} words
                </span>
              </div>

              {currentDiary.highlight && (
                <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 p-3">
                  <p className="text-xs text-brand-400 mb-1">💡 练习亮点</p>
                  <p className="text-sm text-slate-200">{currentDiary.highlight}</p>
                </div>
              )}

              {/* 入口组：📖查看当前 / 💬继续对话 / ✨再生成一版 */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => onEnterBackfill(dateStr)}
                  className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  💬 继续对话（基于日记继续聊这一天）
                </button>
                <button
                  onClick={handleGenerateDiary}
                  disabled={saving || localSession!.correctedSentences.length === 0}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:text-slate-600 text-slate-300 text-sm font-medium transition-colors"
                >
                  {saving ? '生成中…' : '✨ 重新生成新一版（不覆盖旧的）'}
                </button>
              </div>

              {/* 删除当前选中版本：单版 & 多版都显示，但大号按钮 */}
              <div className="pt-2 border-t border-slate-800">
                <p className="text-[11px] text-slate-500 mb-2 px-1">
                  {diaries.length > 1 ? '删除当前选中的这一版' : '删除这篇日记'}
                </p>
                {confirmDelAt === currentDiary.createdAt ? (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
                      ⚠ 确定要删除这版日记吗？该操作不可撤销。
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setConfirmDelAt(null)}
                        className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleDeleteDiary(currentDiary.createdAt)}
                        className="w-full h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                      >
                        确认删除
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelAt(currentDiary.createdAt)}
                    disabled={diaries.length === 1 && localSession!.correctedSentences.length > 0 && !hasPractice}
                    className="w-full h-12 rounded-xl bg-slate-800/80 hover:bg-red-500/20 hover:border-red-500/40 border border-slate-700 text-slate-300 hover:text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    🗑 删除这一版
                  </button>
                )}
              </div>

              {/* 多版时，展示所有版本的快速删除列表 */}
              {diaries.length > 1 && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[11px] text-slate-500 mb-2 px-1">所有版本</p>
                  <div className="space-y-2">
                    {diaries.map(d => (
                      <div
                        key={d.createdAt}
                        className={`rounded-xl border p-3 ${
                          d.createdAt === currentDiary.createdAt
                            ? 'bg-brand-500/5 border-brand-500/30'
                            : 'bg-slate-800/40 border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-200 truncate">
                              {d.title}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {new Date(d.createdAt).toLocaleString('zh-CN', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}{' '}
                              · {d.wordCount} words
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedCreatedAt(d.createdAt);
                                setConfirmDelAt(null);
                              }}
                              className="h-9 px-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                            >
                              查看
                            </button>
                            <button
                              onClick={() => setConfirmDelAt(d.createdAt)}
                              className="h-9 w-9 rounded-lg bg-slate-700/60 hover:bg-red-500/30 text-slate-300 hover:text-red-400 text-sm transition-colors flex items-center justify-center"
                              aria-label="删除这一版"
                            >
                              🗑
                            </button>
                          </div>
                        </div>

                        {confirmDelAt === d.createdAt && d.createdAt !== currentDiary.createdAt && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setConfirmDelAt(null)}
                              className="h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleDeleteDiary(d.createdAt)}
                              className="h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors"
                            >
                              确认删除
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 练习句子回顾 */}
              {localSession!.correctedSentences.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">
                    练习句子 ({localSession!.correctedSentences.length}句)
                  </p>
                  <ul className="space-y-1.5">
                    {localSession!.correctedSentences.map((s, i) => (
                      <li
                        key={i}
                        className="text-xs text-slate-400 pl-2 border-l-2 border-slate-700"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : hasPractice ? (
            /* ───────── 状态 2：有练习无日记 ───────── */
            <div className="py-4">
              <div className="text-center mb-4">
                <p className="text-4xl mb-3">✍️</p>
                <p className="text-sm text-slate-300 mb-1">
                  这天已经练习了 {localSession!.correctedSentences.length} 个句子
                </p>
                <p className="text-xs text-slate-500">还没有生成日记</p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => onEnterBackfill(dateStr)}
                  className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
                >
                  💬 进入对话补写（继续聊这一天）
                </button>
                <button
                  onClick={handleGenerateDiary}
                  disabled={saving || localSession!.correctedSentences.length === 0}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:text-slate-600 text-slate-300 text-sm font-medium transition-colors"
                >
                  {saving ? '生成中…' : '✨ 直接基于练习句子生成日记'}
                </button>
              </div>
            </div>
          ) : (
            /* ───────── 状态 3：无练习无日记（兜底） ───────── */
            <div className="py-4">
              <div className="text-center mb-4">
                <p className="text-3xl mb-2">🕰️</p>
                <p className="text-sm text-slate-300 mb-1">补写这一天的日记</p>
                <p className="text-xs text-slate-500 leading-relaxed px-6">
                  进入对话，像写当天日记一样回忆那天做了什么。
                  <br />
                  AI 边纠错边陪你聊，最后一键整合成英文日记。
                </p>
              </div>
              <button
                onClick={() => onEnterBackfill(dateStr)}
                className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
              >
                💬 开始对话补写
              </button>
            </div>
          )}
        </div>

        {/* 底部操作：仅在 hasDiary 时显示复制/分享 */}
        {hasDiary && currentDiary && (
          <div className="px-4 py-3 border-t border-slate-800 flex gap-3 shrink-0">
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              {copied ? '✓ 已复制' : '📋 复制当前版本'}
            </button>
            <button
              onClick={() => {
                const text = `${currentDiary.title}\n${currentDiary.date}\n\n${currentDiary.body}`;
                if (navigator.share) {
                  navigator.share({ title: currentDiary.title, text }).catch(() => {});
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
