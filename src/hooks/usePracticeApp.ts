import { useState, useCallback, useEffect } from 'react';
import type { PracticeSession, ChatMessage, VocabItem, UnifiedResult } from '@/types';
import * as db from '@/lib/db';
import * as api from '@/lib/api';

/**
 * 主应用状态 Hook —— 统一纠错+对话模式
 */
export function usePracticeApp() {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [history, setHistory] = useState<PracticeSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);

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

  // ── 会话操作 ────────────────────────────────────────

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

  // ── 核心：发送消息（纠错+对话二合一） ──────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    setError(null);

    let currentSession = session;
    if (!currentSession) {
      currentSession = db.createSession();
      setSession(currentSession);
    }

    const userMsg: ChatMessage = {
      id: db.genMessageId(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const sessionId = currentSession.id;
    const messagesAfterUser = [...currentSession.messages, userMsg];
    setSession({
      ...currentSession,
      messages: messagesAfterUser,
      updatedAt: Date.now()
    });
    setLoading(true);

    try {
      // 构建对话历史上下文（取最近 8 条 assistant 消息的 corrected + followUp）
      const historyContext = messagesAfterUser
        .slice(-12)
        .map(m => {
          if (m.role === 'user') return { role: 'user', content: m.content };
          // assistant 消息：取 corrected 和 followUp 作为上下文
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
      const updatedSentences = [...currentSession.correctedSentences, result.corrected];

      const updatedSession: PracticeSession = {
        ...currentSession,
        messages: updatedMessages,
        correctedSentences: updatedSentences,
        updatedAt: Date.now()
      };
      setSession(updatedSession);
      await db.saveSession(updatedSession);
      await refreshHistory();

      // 异步提取词汇
      try {
        const vocabItems = await api.extractVocabulary(
          result.original,
          result.corrected,
          result.explanation
        );
        if (vocabItems.length > 0) {
          for (const item of vocabItems) {
            item.sessionId = sessionId;
            await db.addVocabItem(item);
          }
          await refreshVocab();
        }
      } catch (vocabErr) {
        console.warn('Vocab extraction failed:', vocabErr);
      }
    } catch (err: any) {
      console.error('AI call failed:', err);
      setError(err?.message || 'AI 调用失败，请检查网络和 API 配置');
      // 错误消息
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
  }, [session, loading]);

  // ── 生成日记 ────────────────────────────────────────

  const generateDiary = useCallback(async () => {
    if (!session || session.correctedSentences.length === 0 || diaryLoading) return;

    setDiaryLoading(true);
    setError(null);

    try {
      const diary = await api.generateDiary(session.correctedSentences);
      const updatedSession: PracticeSession = {
        ...session,
        diaryGenerated: true,
        diary,
        updatedAt: Date.now()
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

  // ── 词汇本操作 ──────────────────────────────────────

  const toggleVocabMastered = useCallback(async (id: string, mastered: boolean) => {
    await db.updateVocabMastered(id, mastered);
    await refreshVocab();
  }, [refreshVocab]);

  const deleteVocabItem = useCallback(async (id: string) => {
    await db.deleteVocab(id);
    await refreshVocab();
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
    refreshVocab
  };
}
