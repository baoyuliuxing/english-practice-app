import { useEffect, useRef, useState, useCallback } from 'react';
import { usePracticeApp } from '@/hooks/usePracticeApp';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { MessageBubble } from '@/components/MessageBubble';
import { TypingIndicator } from '@/components/TypingIndicator';
import { InputBar } from '@/components/InputBar';
import { DiaryView } from '@/components/DiaryView';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { CalendarWorkspace } from '@/components/CalendarWorkspace';
import { DayDiaryModal } from '@/components/DayDiaryModal';
import { VocabularyBook } from '@/components/VocabularyBook';
import { DataTransferModal } from '@/components/DataTransferModal';
import { hasApiKey } from '@/lib/apiKey';
import { lookupWord } from '@/lib/api';
import { addVocabItem, genVocabId } from '@/lib/db';
import type { PracticeSession } from '@/types';

/**
 * 键盘弹起处理 Hook
 * 现代浏览器（interactive-widget=resizes-content）：布局视口自动压缩，
 *   innerHeight 与 vv.height 同步缩小，diff≈0 → 不干预，由 CSS 的 100dvh 自动处理。
 * 旧浏览器（resizes-visual 行为）：innerHeight 不变而 vv.height 缩小，
 *   diff>100 → 返回键盘高度，容器内联 calc(100vh - Xpx) 补偿。
 */
function useKeyboardAvoid() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const viewportHeight = vv.height;
      const windowHeight = window.innerHeight;
      const diff = windowHeight - viewportHeight;
      // 只处理键盘弹起（diff > 100），忽略小幅变化
      setKeyboardHeight(diff > 100 ? diff : 0);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  return keyboardHeight;
}

export default function App() {
  const {
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
  } = usePracticeApp();

  const keyboardHeight = useKeyboardAvoid();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyReady, setApiKeyReady] = useState(hasApiKey());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showVocab, setShowVocab] = useState(false);
  const [showDataTransfer, setShowDataTransfer] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateSession, setSelectedDateSession] = useState<PracticeSession | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [addingWord, setAddingWord] = useState(false);

  // ── 点击 + 按钮添加单词到生词本 ──────────────────────────

  const handleAddWord = useCallback(async (word: string, context: string) => {
    if (addingWord) return;

    const exists = vocabList.some(v => v.word.toLowerCase() === word.toLowerCase());
    if (exists) {
      setToast(`「${word}」已在单词本中`);
      setTimeout(() => setToast(null), 2000);
      return;
    }

    setAddingWord(true);
    try {
      const lookup = await lookupWord(word, context);
      const item = {
        id: genVocabId(),
        word: lookup.word || word,
        meaning: lookup.meaning || '',
        example: context,
        correctedExample: context,
        errorType: lookup.errorType || 'vocabulary',
        addedAt: Date.now(),
        mastered: false,
        reviewCount: 0,
        sessionId: session?.id || ''
      };
      await addVocabItem(item);
      await refreshVocab();
      setToast(`✓ 「${word}」已加入单词本`);
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      setToast(`✗ 添加失败: ${err.message || '请重试'}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setAddingWord(false);
    }
  }, [addingWord, vocabList, session?.id, refreshVocab]);

  // ── 自动滚动到底部（键盘弹起时也重新滚到底） ─────────────

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [session?.messages, loading, keyboardHeight]);

  const handleEndSession = () => setShowEndConfirm(true);

  const confirmEnd = async () => {
    setShowEndConfirm(false);
    await generateDiary();
  };

  const handleStart = () => {
    if (!hasApiKey()) {
      setShowApiKeyModal(true);
    } else {
      startNewSession();
    }
  };

  const handleApiKeySaved = () => {
    setApiKeyReady(true);
    if (!session) startNewSession();
  };

  const handleCalendarSelect = (dateStr: string, sess?: PracticeSession) => {
    setSelectedDate(dateStr);
    setSelectedDateSession(sess);
  };

  // ── 渲染 ──────────────────────────────────────────────

  if (session?.diaryGenerated && session?.diary) {
    return (
      <div className="flex flex-col app-height">
        <DiaryView diary={session.diary} onNewSession={clearSession} onAddWord={handleAddWord} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col max-w-2xl mx-auto relative app-height"
      style={keyboardHeight > 0 ? { height: `calc(100vh - ${keyboardHeight}px)` } : undefined}
    >
      {/* ── 顶部栏 ──────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm safe-top">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(true)}
            className="w-9 h-9 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400"
            aria-label="历史记录"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => setShowCalendar(true)}
            className="w-9 h-9 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400"
            aria-label="日历工作台"
            title="日历工作台"
          >
            <span className="text-base">📅</span>
          </button>
          <button
            onClick={() => setShowVocab(true)}
            className="w-9 h-9 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 relative"
            aria-label="单词本"
            title="单词本"
          >
            <span className="text-base">📚</span>
            {vocabList.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] flex items-center justify-center font-bold">
                {vocabList.length > 99 ? '99+' : vocabList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowDataTransfer(true)}
            className="w-9 h-9 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400"
            aria-label="数据导入导出"
            title="数据导入导出"
          >
            <span className="text-base">⇄</span>
          </button>
        </div>

        <h1 className="text-base font-semibold text-slate-100">英语练习</h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="w-9 h-9 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors"
            aria-label="设置"
          >
            <span className="text-base">{apiKeyReady ? '⚙️' : '🔑'}</span>
          </button>
          {session && session.correctedSentences.length > 0 && (
            <button
              onClick={handleEndSession}
              disabled={diaryLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors disabled:opacity-50"
            >
              {diaryLoading ? '生成中…' : '结束 & 生成日记'}
            </button>
          )}
        </div>
      </header>

      {/* ── API Key 未配置提示 ──────────────────────────────── */}
      {!apiKeyReady && session && (
        <div className="mx-4 mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-400 flex items-center justify-between animate-fade-in">
          <span>⚠ 请先配置 API Key 才能使用 AI 功能</span>
          <button onClick={() => setShowApiKeyModal(true)} className="font-medium underline">去配置</button>
        </div>
      )}

      {/* ── 错误提示 ────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400 animate-fade-in">
          ⚠ {error}
        </div>
      )}

      {/* ── 主内容区 ────────────────────────────────────── */}
      {!session ? (
        <WelcomeScreen onStart={handleStart} />
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 chat-scroll-area">
            {session.messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-1">
                  ✍️ 输入中文或英文，AI 纠正并陪你练习
                </p>
                <p className="text-xs text-slate-600">
                  每次回复都包含：语法纠正 + 解析 + 英文对话引导
                </p>
                <p className="text-xs text-slate-500 mt-3">
                  💡 点击英文单词旁的 + 可加入生词本
                </p>
              </div>
            )}

            {session.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onAddWord={handleAddWord} />
            ))}

            {loading && <TypingIndicator />}

            {diaryLoading && (
              <div className="flex flex-col items-center py-8 animate-fade-in">
                <div className="w-12 h-12 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mb-3" />
                <p className="text-sm text-slate-400">正在生成你的英文日记…</p>
              </div>
            )}
          </div>

          {!diaryLoading && (
            <InputBar loading={loading} onSend={sendMessage} />
          )}
        </>
      )}

      {/* ── Toast 提示 ──────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] animate-slide-up">
          <div className={`rounded-full px-4 py-2 text-sm font-medium shadow-xl backdrop-blur-sm ${
            toast.startsWith('✓') ? 'bg-emerald-500/90 text-white' :
            toast.startsWith('✗') ? 'bg-red-500/90 text-white' :
            'bg-slate-700/90 text-slate-100'
          }`}>
            {toast}
          </div>
        </div>
      )}

      {/* ── 弹窗们 ──────────────────────────────────────── */}

      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEndConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-2xl animate-slide-up">
            <h3 className="text-base font-semibold text-slate-100 mb-2">生成英文日记？</h3>
            <p className="text-sm text-slate-400 mb-1">
              将把本次练习的 <span className="text-brand-400 font-medium">{session?.correctedSentences.length || 0}</span> 个句子整合成一篇完整的英文日记。
            </p>
            <p className="text-xs text-slate-500 mb-5">生成后可查看、复制和分享。会话将结束。</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEndConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors">
                继续练习
              </button>
              <button onClick={confirmEnd} className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors">
                生成日记
              </button>
            </div>
          </div>
        </div>
      )}

      {showApiKeyModal && (
        <ApiKeyModal onClose={() => setShowApiKeyModal(false)} onSaved={handleApiKeySaved} />
      )}

      {showHistory && (
        <HistoryDrawer
          history={history}
          onLoad={loadSession}
          onDelete={deleteSession}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showCalendar && (
        <CalendarWorkspace
          sessions={history}
          onSelectDate={handleCalendarSelect}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {selectedDate && (
        <DayDiaryModal
          dateStr={selectedDate}
          session={selectedDateSession}
          onClose={() => {
            setSelectedDate(null);
            setSelectedDateSession(undefined);
          }}
          onSessionUpdated={() => {
            refreshHistory();
            setSelectedDate(null);
            setSelectedDateSession(undefined);
          }}
        />
      )}

      {showVocab && (
        <VocabularyBook
          vocabList={vocabList}
          onToggleMastered={toggleVocabMastered}
          onDelete={deleteVocabItem}
          onClose={() => setShowVocab(false)}
        />
      )}

      {showDataTransfer && (
        <DataTransferModal
          sessions={history}
          vocabList={vocabList}
          onImported={async () => {
            await refreshHistory();
            await refreshVocab();
          }}
          onClose={() => setShowDataTransfer(false)}
        />
      )}
    </div>
  );
}
