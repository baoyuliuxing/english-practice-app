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
import { BackfillChatView } from '@/components/BackfillChatView';
import { hasApiKey } from '@/lib/apiKey';
import { lookupWord } from '@/lib/api';
import { addVocabItem, genVocabId } from '@/lib/db';
import type { PracticeSession } from '@/types';

/**
 * 键盘弹起处理 Hook
 *
 * 兼容性最好的做法：直接读取 visualViewport.height 作为容器高度。
 *  - Chrome 108+（interactive-widget=resizes-content）：布局视口自动压缩，
 *    vv.height 与 innerHeight 同步缩小，容器跟随 → 表现一致
 *  - 华为/UC/旧 Chrome 等（键盘只在视觉层，布局视口不变）：
 *    vv.height 仍会缩小 → 容器高度跟随缩小 → 输入框始终在键盘上方，
 *    聊天区底部也不会被键盘盖住
 *
 * 返回 { viewportHeight, keyboardHeight }：
 *  - viewportHeight：当前可视视口高度（没用 visualViewport 时为 0，交给 CSS 兜底）
 *  - keyboardHeight：键盘占用的高度（用于判断"键盘刚弹起"）
 */
function useKeyboardAvoid() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let raf = 0;
    let timer1: any = 0;
    let timer2: any = 0;
    let timer3: any = 0;

    const measure = () => {
      const ta = inputRef.current;
      if (!ta) {
        setKeyboardHeight(0);
        return;
      }
      // 是否聚焦
      if (document.activeElement !== ta) {
        setKeyboardHeight(0);
        return;
      }
      const rect = ta.getBoundingClientRect();
      const winH = window.innerHeight;
      const overflow = rect.bottom - winH;
      // 如果 textarea 底部还在窗口内（≤0），说明没被键盘盖住
      setKeyboardHeight(overflow > 20 ? overflow : 0);
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || (t.tagName !== 'TEXTAREA' && t.tagName !== 'INPUT')) return;
      // 多次测量，捕获键盘动画过程中各个阶段
      timer1 = setTimeout(measure, 100);
      timer2 = setTimeout(measure, 300);
      timer3 = setTimeout(measure, 600);
    };

    const onFocusOut = () => {
      setTimeout(() => {
        setKeyboardHeight(0);
      }, 200);
    };

    // 视觉视口变化时（支持它的浏览器）也测量一次
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', schedule);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', schedule);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      cancelAnimationFrame(raf);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', schedule);
      if (vv) {
        vv.removeEventListener('resize', schedule);
      }
    };
  }, []);

  return { inputRef, keyboardHeight };
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
    deleteDiary,
    refreshVocab,
    ensureVocabExample,
    backfillDate,
    backfillSession,
    backfillLoading,
    backfillError,
    startBackfill,
    sendBackfillMessage,
    endBackfill,
    cancelBackfill
  } = usePracticeApp();

  const { inputRef, keyboardHeight } = useKeyboardAvoid();
  const [showDebug, setShowDebug] = useState(false);
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
  const [backfillBusy, setBackfillBusy] = useState(false);

  // ── 补写对话：生成日记 / 保存退出 / 关闭 ──────────────────
  const handleBackfillGenerate = useCallback(async () => {
    if (backfillBusy) return;
    setBackfillBusy(true);
    const ok = await endBackfill();
    setBackfillBusy(false);
    if (ok) {
      setToast('✓ 已生成该天的英文日记');
      setTimeout(() => setToast(null), 2200);
    }
    // 失败时保留弹窗，error 由 hook 显示
  }, [backfillBusy, endBackfill]);

  const handleBackfillSaveExit = useCallback(() => {
    cancelBackfill(true); // 保留已聊内容
  }, [cancelBackfill]);

  const handleBackfillClose = useCallback(() => {
    // 有内容时询问式引导走"保存退出"，这里直接丢弃不保留会丢数据，故默认保留
    if (backfillSession && backfillSession.messages.length > 0) {
      cancelBackfill(true); // 保守保留已聊内容
    } else {
      cancelBackfill(false);
    }
  }, [backfillSession, cancelBackfill]);

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
      const lookupExample = (lookup.example || '').trim();
      const item = {
        id: genVocabId(),
        word: lookup.word || word,
        meaning: lookup.meaning || '',
        example: lookupExample || context,
        correctedExample: lookupExample || context,
        highlight: lookup.word || word,
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

  // ── 智能滚动 ────────────────────────────────────────────
  // 规则：
  //  1) 发送新消息后（消息数增长）→ 滚到底，让用户看到自己发的 + 等待 AI
  //  2) AI 回复完成（loading true→false，且消息数再增长）→ 滚到「这条回复的顶部」，
  //     让用户从回复第一行开始阅读，而不是被甩到最底部
  //  3) 键盘弹起 / 其他重渲染 → 只有用户在「接近底部」时才跟随滚动
  //     （阈值放宽到 180px，避免差一点点就不跟随的情况）

  const prevMsgCountRef = useRef(0);
  const prevLoadingRef = useRef(false);
  const prevKeyboardRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const cur = session?.messages.length || 0;
    const grew = cur > prevMsgCountRef.current;
    const wasLoading = prevLoadingRef.current;
    const keyboardJustOpened = keyboardHeight > 0 && prevKeyboardRef.current === 0;
    prevMsgCountRef.current = cur;
    prevLoadingRef.current = loading;
    prevKeyboardRef.current = keyboardHeight;

    // 距底距离（键盘动画期间 clientHeight 会抖动，留足余量）
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom <= 180;
    // 键盘刚弹起时给更宽松的判定，避免"差一点点就不跟随"
    const nearBottomForKeyboard = distFromBottom <= 260;

    // ① AI 刚回复完成：把最后一条 assistant 消息滚到可视区顶部
    const justFinished = wasLoading && !loading && grew;
    if (justFinished) {
      // 等一帧，确保新消息的 DOM 与图片/样式都已布局完成
      requestAnimationFrame(() => {
        const el2 = scrollRef.current;
        if (!el2) return;
        const nodes = el2.querySelectorAll<HTMLElement>('[data-msg-index]');
        const last = nodes[nodes.length - 1];
        if (!last) return;
        // 用 getBoundingClientRect 计算相对滚动容器的真实偏移，避免 offsetParent 陷阱
        const elRect = el2.getBoundingClientRect();
        const lastRect = last.getBoundingClientRect();
        const targetTop = el2.scrollTop + (lastRect.top - elRect.top) - 12;
        el2.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      });
      return;
    }

    // ② 键盘刚弹起：仅在接近底部时跟随
    if (keyboardJustOpened) {
      if (nearBottomForKeyboard) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
      return;
    }

    // ③ 其余情况：在底部 / 加载中 / 刚发新消息 → 滚到底
    if (nearBottom || loading || grew) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
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

  const latestDiary = session?.diaries && session.diaries.length > 0
    ? session.diaries[session.diaries.length - 1]
    : null;

  if (session?.diaryGenerated && latestDiary) {
    return (
      <div className="flex flex-col app-height">
        <DiaryView
          diary={latestDiary}
          diaries={session.diaries}
          onNewSession={clearSession}
          onAddWord={handleAddWord}
          onDeleteDiary={async (createdAt) => {
            await deleteDiary(session.id, createdAt);
            // 删完最后一版时自动退出 DiaryView
            const cur = await (await import('@/lib/db')).getSession(session.id);
            if (cur && (cur.diaries?.length || 0) === 0) {
              clearSession();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col max-w-2xl mx-auto relative app-height app-container"
      style={{
        transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : undefined,
        transition: 'transform 0.18s ease-out'
      }}
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

        <h1 className="text-base font-semibold text-slate-100">
          英语练习
          <span
            onClick={() => setShowDebug(d => !d)}
            className="ml-1.5 text-[10px] font-normal text-slate-500 align-middle select-none"
          >
            v3.2
          </span>
        </h1>

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

            {session.messages.map((msg, i) => (
              <div key={msg.id} data-msg-index={i}>
                <MessageBubble message={msg} onAddWord={handleAddWord} />
              </div>
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
            <InputBar loading={loading} onSend={sendMessage} inputRef={inputRef} />
          )}
        </>
      )}

      {/* ── 调试面板（点版本号开关） ─────────────────────── */}
      {showDebug && (
        <div className="fixed top-14 left-2 z-[90] rounded-lg bg-black/85 border border-amber-500/40 px-3 py-2 text-[10px] text-amber-300 font-mono leading-relaxed pointer-events-none">
          <div>innerH: {typeof window !== 'undefined' ? window.innerHeight : 0}</div>
          <div>ta.bottom: {inputRef.current ? inputRef.current.getBoundingClientRect().bottom.toFixed(0) : '-'}</div>
          <div>kbH (推上): {keyboardHeight.toFixed(0)}</div>
          <div>msgs: {session?.messages.length ?? 0}</div>
        </div>
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

      {selectedDate && !backfillDate && (
        <DayDiaryModal
          dateStr={selectedDate}
          session={selectedDateSession}
          onClose={() => {
            setSelectedDate(null);
            setSelectedDateSession(undefined);
          }}
          onEnterBackfill={(dateStr) => {
            // 关闭日历详情，进入补写对话
            setSelectedDate(null);
            setSelectedDateSession(undefined);
            setShowCalendar(false);
            startBackfill(dateStr);
          }}
          onSessionUpdated={() => {
            refreshHistory();
          }}
          onDeleteDiary={async (sessionId, diaryCreatedAt) => {
            await deleteDiary(sessionId, diaryCreatedAt);
          }}
        />
      )}

      {showVocab && (
        <VocabularyBook
          vocabList={vocabList}
          onToggleMastered={toggleVocabMastered}
          onDelete={deleteVocabItem}
          onEnsureExample={ensureVocabExample}
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

      {/* ── 补写日记对话模式（全屏覆盖） ─────────────────── */}
      {backfillDate && backfillSession && (
        <BackfillChatView
          session={backfillSession}
          dateStr={backfillDate}
          loading={backfillLoading}
          error={backfillError}
          busy={backfillBusy}
          onSend={sendBackfillMessage}
          onGenerateDiary={handleBackfillGenerate}
          onSaveExit={handleBackfillSaveExit}
          onClose={handleBackfillClose}
          onAddWord={handleAddWord}
        />
      )}
    </div>
  );
}
