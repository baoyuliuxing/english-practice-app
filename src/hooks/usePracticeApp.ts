import { useState, useCallback, useEffect, useRef } from 'react';
import type { PracticeSession, ChatMessage, VocabItem, UnifiedResult, DiaryEntry } from '@/types';
import * as db from '@/lib/db';
import * as api from '@/lib/api';
import { hasSentenceContainingWord } from '@/lib/clip';

/** 保存会话处理一条消息（纠错+对话），返回更新的会话与提取的词汇来源 followUp */
async function handleTurn(
  currentSession: PracticeSession,
  text: string
): Promise<{ session: PracticeSession; userMsg: ChatMessage; assistantMsg: ChatMessage }> {
  const userMsg: ChatMessage = {
    id: db.genMessageId(),
    role: 'user',
    content: text,
    timestamp: Date.now()
  };

  const messagesAfterUser = [...currentSession.messages, userMsg];

  // 构建对话历史上下文（取最近 8 条 assistant 消息的 corrected + followUp）
  const historyContext = messagesAfterUser
    .slice(-12)
    .map(m => {
      if (m.role === 'user') return { role: 'user', content: m.content };
      const result = m.result;
      if (!result) return { role: 'assistant', content: '' };
      return { role: 'assistant', content: `${result.corrected} ${result.followUp}` };
    })
    .filter(m => m.content);

  const result: UnifiedResult = await api.unifiedChat(text, historyContext);

  const assistantMsg: ChatMessage = {
    id: db.genMessageId(),
    role: 'assistant',
    content: result.corrected,
    result,
    timestamp: Date.now()
  };

  const updatedMessages = [...messagesAfterUser, assistantMsg];
  const updatedSession: PracticeSession = {
    ...currentSession,
    messages: updatedMessages,
    correctedSentences: [...currentSession.correctedSentences, result.corrected],
    updatedAt: Date.now()
  };

  return { session: updatedSession, userMsg, assistantMsg };
}

/** 从一条 assistant 消息异步提取词汇并入库（followUp 作为例句来源） */
async function persistVocabFromTurn(
  assistantMsg: ChatMessage,
  sessionId: string
): Promise<void> {
  const result = assistantMsg.result;
  if (!result) return;
  try {
    const vocabItems = await api.extractVocabulary(
      result.original,
      result.corrected,
      result.explanation,
      result.followUp
    );
    if (vocabItems.length > 0) {
      for (const item of vocabItems) {
        item.sessionId = sessionId;
        await db.addVocabItem(item);
      }
    }
  } catch (vocabErr) {
    console.warn('Vocab extraction failed:', vocabErr);
  }
}

/**
 * 主应用状态 Hook —— 统一纠错+对话模式
 * 支持：当前会话 / 日历补写会话（独立于主界面）
 */
export function usePracticeApp() {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [history, setHistory] = useState<PracticeSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);

  // ── 补写会话状态 ──────────────────────────────────────
  const [backfillDate, setBackfillDate] = useState<string | null>(null);
  const [backfillSession, setBackfillSession] = useState<PracticeSession | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  // ── 初始化 ──────────────────────────────────────────

  useEffect(() => {
    refreshHistory();
    refreshVocab();
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const sessions = await db.getAllSessions();
      setHistory(sessions);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, []);

  const refreshVocab = useCallback(async () => {
    try {
      const vocab = await db.getAllVocab();
      setVocabList(vocab);
    } catch (err) {
      console.error('Failed to load vocab:', err);
    }
  }, []);

  // ── 主会话操作 ────────────────────────────────────────

  const startNewSession = useCallback(() => {
    const newSession = db.createSession();
    setSession(newSession);
    setError(null);
    setShowHistory(false);
  }, []);

  const loadSession = useCallback(async (id: string) => {
    const s = await db.getSession(id);
    if (s) {
      setSession(s);
      setShowHistory(false);
    }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    await db.deleteSession(id);
    await refreshHistory();
    await refreshVocab();
  }, [refreshHistory, refreshVocab]);

  // ── 核心：主会话发送消息 ───────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    setError(null);

    let currentSession = session;
    if (!currentSession) {
      currentSession = db.createSession();
      setSession(currentSession);
    }

    const sessionId = currentSession.id;
    // 先追加用户消息，进入 loading
    const userMsg: ChatMessage = {
      id: db.genMessageId(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setSession({
      ...currentSession,
      messages: [...currentSession.messages, userMsg],
      updatedAt: Date.now()
    });
    setLoading(true);

    try {
      const { session: updatedSession, assistantMsg } = await handleTurn(
        currentSession,
        text
      );
      setSession(updatedSession);
      await db.saveSession(updatedSession);
      await refreshHistory();

      // 异步提取词汇（followUp 作为例句来源）
      try {
        await persistVocabFromTurn(assistantMsg, sessionId);
        await refreshVocab();
      } catch (vocabErr) {
        console.warn('Vocab persist failed:', vocabErr);
      }
    } catch (err: any) {
      console.error('AI call failed:', err);
      setError(err?.message || 'AI 调用失败，请检查网络和 API 配置');
      // 追加一条失败占位消息
      const errorMsg: ChatMessage = {
        id: db.genMessageId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };
      setSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, errorMsg]
      } : prev);
    } finally {
      setLoading(false);
    }
  }, [session, loading, refreshHistory, refreshVocab]);

  // ── 生成主会话日记 ────────────────────────────────────

  const generateDiary = useCallback(async () => {
    if (!session || session.correctedSentences.length === 0 || diaryLoading) return;

    setDiaryLoading(true);
    setError(null);

    try {
      const diary = await api.generateDiary(session.correctedSentences);
      const now = Date.now();
      const newEntry: DiaryEntry = { ...diary, createdAt: now };
      const updatedSession: PracticeSession = {
        ...session,
        diaryGenerated: true,
        diaries: [...(session.diaries || []), newEntry],
        updatedAt: now
      };
      setSession(updatedSession);
      await db.saveSession(updatedSession);
      await refreshHistory();
    } catch (err: any) {
      console.error('Diary generation failed:', err);
      setError(err?.message || '日记生成失败');
    } finally {
      setDiaryLoading(false);
    }
  }, [session, diaryLoading, refreshHistory]);

  const clearSession = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  // ── 补写会话：进入某一天的对话模式 ───────────────────────

  /**
   * 进入某一天的继续对话模式。
   * 取该天最近更新的一条会话（不论是否补写、是否已生成日记），
   * 把它已有的全部消息载入，用户可在下面直接接着聊。
   * 该天没有任何会话时才新建补写会话。
   */
  const startBackfill = useCallback(async (dateStr: string) => {
    try {
      setBackfillError(null);
      const byDate = await db.getSessionsByDate(dateStr);
      const existing = byDate.sort((a, b) => b.updatedAt - a.updatedAt)[0];

      const target = existing || db.createBackfillSession(dateStr);
      setBackfillDate(dateStr);
      setBackfillSession(target);
      if (!existing) {
        // 新建会话立即占位保存，避免重复进入产生多条空会话
        await db.saveSession(target);
        await refreshHistory();
      }
    } catch (err) {
      console.error('startBackfill failed:', err);
      setBackfillError('进入补写模式失败，请重试');
    }
  }, [refreshHistory]);

  /** 补写会话发送消息 */
  const sendBackfillMessage = useCallback(async (text: string) => {
    if (!text.trim() || backfillLoading || !backfillSession) return;

    setBackfillError(null);
    const currentSession = backfillSession;
    const sessionId = currentSession.id;

    // 追加用户消息并 loading
    const userMsg: ChatMessage = {
      id: db.genMessageId(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setBackfillSession({
      ...currentSession,
      messages: [...currentSession.messages, userMsg],
      updatedAt: Date.now()
    });
    setBackfillLoading(true);

    try {
      const { session: updatedSession, assistantMsg } = await handleTurn(
        currentSession,
        text
      );
      setBackfillSession(updatedSession);
      await db.saveSession(updatedSession);
      await refreshHistory();

      try {
        await persistVocabFromTurn(assistantMsg, sessionId);
        await refreshVocab();
      } catch (vocabErr) {
        console.warn('Backfill vocab persist failed:', vocabErr);
      }
    } catch (err: any) {
      console.error('Backfill AI call failed:', err);
      setBackfillError(err?.message || 'AI 调用失败，请检查网络和 API 配置');
      const errorMsg: ChatMessage = {
        id: db.genMessageId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };
      setBackfillSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, errorMsg]
      } : prev);
    } finally {
      setBackfillLoading(false);
    }
  }, [backfillSession, backfillLoading, refreshHistory, refreshVocab]);

  /**
   * 结束补写并生成那天日记（存到那天）。返回是否成功。
   */
  const endBackfill = useCallback(async (): Promise<boolean> => {
    if (!backfillSession || backfillLoading) return false;
    if (backfillSession.correctedSentences.length === 0) return false;

    setBackfillError(null);
    try {
      const diary = await api.generateDiary(backfillSession.correctedSentences);
      const dateObj = new Date((backfillDate || db.formatDate(new Date(backfillSession.createdAt))) + 'T00:00:00');
      const englishDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const now = Date.now();
      const newEntry: DiaryEntry = { ...diary, date: englishDate, createdAt: now };
      const updated: PracticeSession = {
        ...backfillSession,
        diaryGenerated: true,
        diaries: [...(backfillSession.diaries || []), newEntry],
        updatedAt: now
      };
      setBackfillSession(updated);
      await db.saveSession(updated);
      await refreshHistory();
      // 关闭补写模式并保留日记会话
      setBackfillDate(null);
      setBackfillSession(null);
      return true;
    } catch (err: any) {
      console.error('endBackfill failed:', err);
      setBackfillError(err?.message || '日记生成失败，请重试');
      return false;
    }
  }, [backfillSession, backfillDate, backfillLoading, refreshHistory]);

  /** 取消补写。keep=true 保留已聊内容；keep=false 丢弃整个补写会话（含空会话） */
  const cancelBackfill = useCallback(async (keep: boolean) => {
    const curDate = backfillDate;
    const curSession = backfillSession;
    if (!curDate) return;

    if (!keep && curSession) {
      // 丢弃：若该会话没有保存的日记且为空/未完成，删除它（删除会连带清词汇）
      // 仅当用户明确"不保留"且确实没有日记时才删除
      if (!curSession.diaryGenerated) {
        try {
          await db.deleteSession(curSession.id);
          await refreshHistory();
          await refreshVocab();
        } catch (err) {
          console.warn('cancelBackfill delete failed:', err);
        }
      } else {
        await db.saveSession(curSession);
      }
    } else if (keep && curSession) {
      // 保留：仅存回（不生成日记）
      await db.saveSession(curSession);
      await refreshHistory();
    }

    setBackfillDate(null);
    setBackfillSession(null);
    setBackfillError(null);
  }, [backfillDate, backfillSession, refreshHistory, refreshVocab]);

  // ── 词汇本操作 ──────────────────────────────────────

  const toggleVocabMastered = useCallback(async (id: string, mastered: boolean) => {
    await db.updateVocabMastered(id, mastered);
    await refreshVocab();
  }, [refreshVocab]);

  const deleteVocabItem = useCallback(async (id: string) => {
    await db.deleteVocab(id);
    await refreshVocab();
  }, [refreshVocab]);

  /** 删除会话中的某版日记（按 createdAt） */
  const deleteDiary = useCallback(async (sessionId: string, diaryCreatedAt: number) => {
    const s = await db.deleteDiaryEntry(sessionId, diaryCreatedAt);
    await refreshHistory();
    // 若当前主会话也命中，同步本地
    setSession(prev => {
      if (!prev || prev.id !== sessionId) return prev;
      return s ? { ...s } : prev;
    });
  }, [refreshHistory]);

  // 正在补例句的词（避免并发重复请求）
  const fixingRef = useRef<Set<string>>(new Set());

  /**
   * 若词条没有任何句子包含目标单词，则调用 AI 生成一句必含该词的例句并保存。
   * 用于修复存量坏数据（AI 此前给的 example 不包含目标词）。
   */
  const ensureVocabExample = useCallback(async (item: VocabItem) => {
    if (fixingRef.current.has(item.id)) return;
    // 已存在含目标词的句子，无需修复
    if (hasSentenceContainingWord(item)) return;
    if (!item.word) return;

    fixingRef.current.add(item.id);
    try {
      const res = await api.generateWordExample(item.word);
      const example = (res?.example || '').trim();
      if (example) {
        await db.updateVocabExample(item.id, example);
        await refreshVocab();
      }
    } catch (err) {
      console.warn('generateWordExample failed:', err);
    } finally {
      fixingRef.current.delete(item.id);
    }
  }, [refreshVocab]);

  return {
    session,
    loading,
    error,
    diaryLoading,
    history,
    vocabList,
    showHistory,
    setShowHistory,
    startNewSession,
    loadSession,
    deleteSession,
    sendMessage,
    generateDiary,
    clearSession,
    refreshHistory,
    toggleVocabMastered,
    deleteVocabItem,
    deleteDiary,
    refreshVocab,
    ensureVocabExample,
    // 补写会话
    backfillDate,
    backfillSession,
    backfillLoading,
    backfillError,
    startBackfill,
    sendBackfillMessage,
    endBackfill,
    cancelBackfill
  };
}
