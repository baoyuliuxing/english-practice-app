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
 * 键盘弹起处理 Hook —— 浏览器原生滚动方案
 *
 * 实测结论（华为/荣耀浏览器）：
 *   - visualViewport.height 与 window.innerHeight 在键盘弹起时【都不变化】，
 *     JS 根本无法推算键盘高度；
 *   - 此前用 transform 主动上推容器，又会与浏览器自身的位置调整【叠加】，
 *     导致"推过头"（内容被推出屏幕）。
 *
 * 因此改为：JS 不自己推，而是让浏览器用自己掌握的"可视区（含键盘）"信息处理：
 *   1. 放开外层容器的 position:fixed / overflow:hidden 锁（见 index.css），
 *      让浏览器能够执行"滚动让聚焦元素可见"的原生行为；
 *   2. 输入框聚焦后，延时调用 input.scrollIntoView({ block: 'end' })，
 *      让浏览器把输入框滚到可视区底部 —— 也就是键盘上方。
 */
/**
 * 键盘弹起处理 Hook —— 多源探测 + 聊天区收缩
 *
 * 目标：键盘弹起时，让【聊天消息区】向上收缩，把被键盘遮住的内容露出来。
 *
 * 难点：部分国产浏览器（华为/荣耀）的 visualViewport.height 与 window.innerHeight
 * 在键盘弹起时都不变化，JS 无法直接得到键盘高度。因此这里同时用多个来源探测，
 * 取其中能用的那一组：
 *   A. window.visualViewport.height   （支持它的浏览器最准）
 *   B. window.innerHeight             （Chrome 系 resizes-content 模式下会变）
 *   C. resize 事件里 document.documentElement.clientHeight
 *
 * 探测结果 = "键盘弹起前的基准高度 - 当前可用高度"。
 * 基准在页面加载后（键盘未弹起时）记录，窗口真正 resize（非聚焦态）时更新。
 */
function useKeyboardAvoid() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  /** 调试信息：暴露各数据源，便于排查 */
  const [kbDebug, setKbDebug] = useState({
    winH: 0,
    vvH: 0,
    docH: 0,
    base: 0,
    kb: 0,
    source: '-'
  });

  useEffect(() => {
    /** 键盘弹起前的基准可用高度 */
    let base = 0;

    const readCurrent = () => {
      const vv = window.visualViewport;
      return {
        winH: window.innerHeight,
        vvH: vv ? vv.height : 0,
        docH: document.documentElement.clientHeight
      };
    };

    const isFocused = () => {
      const ta = inputRef.current;
      return !!ta && document.activeElement === ta;
    };

    const measure = () => {
      const { winH, vvH, docH } = readCurrent();
      // 三个来源里取"最能反映键盘压缩"的最小值
      const candidates: { v: number; s: string }[] = [
        { v: winH, s: 'innerHeight' },
        { v: vvH, s: 'visualViewport' },
        { v: docH, s: 'docEl' }
      ].filter(c => c.v > 0);
      let cur = { v: winH, s: 'innerHeight' };
      for (const c of candidates) {
        if (c.v < cur.v) cur = c;
      }

      if (base === 0) {
        setKbDebug({ winH, vvH, docH, base: 0, kb: 0, source: cur.s });
        return;
      }

      const kb = base - cur.v;
      setKeyboardHeight(kb > 60 ? kb : 0);
      setKbDebug({ winH, vvH, docH, base, kb, source: cur.s });
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || (t.tagName !== 'TEXTAREA' && t.tagName !== 'INPUT')) return;
      const timers: any[] = [];
      [100, 220, 380, 600, 900, 1300].forEach(ms => {
        timers.push(setTimeout(measure, ms));
      });
      // 保存以便清理
      (onFocusIn as any)._timers = timers;
    };

    const onFocusOut = () => {
      setKeyboardHeight(0);
      setKbDebug(d => ({ ...d, kb: 0 }));
    };

    const onResize = () => {
      // 只在非聚焦态更新基准（避免把键盘弹起后的高度当成新基准）
      if (!isFocused()) {
        const { winH, vvH, docH } = readCurrent();
        const min = Math.min(...[winH, vvH || winH, docH].filter(v => v > 0));
        base = min;
      }
      measure();
    };

    // 初始化基准
    const initTimer = setTimeout(() => {
      const { winH, vvH, docH } = readCurrent();
      base = Math.min(...[winH, vvH || winH, docH].filter(v => v > 0));
      setKbDebug(d => ({ ...d, base }));
    }, 300);

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', onResize);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', onResize);

    return () => {
      clearTimeout(initTimer);
      const ts = (onFocusIn as any)._timers || [];
      ts.forEach((t: any) => clearTimeout(t));
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', onResize);
      if (vv) vv.removeEventListener('resize', onResize);
    };
  }, []);

  return { inputRef, keyboardHeight, kbDebug };
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

  const { inputRef, keyboardHeight: kbH, kbDebug } = useKeyboardAvoid();
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
  const prevKeyboardOpenRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const cur = session?.messages.length || 0;
    const grew = cur > prevMsgCountRef.current;
    const wasLoading = prevLoadingRef.current;
    const keyboardJustOpened = kbH > 0 && !prevKeyboardOpenRef.current;
    prevMsgCountRef.current = cur;
    prevLoadingRef.current = loading;
    prevKeyboardOpenRef.current = kbH > 0;

    // 距底距离
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distFromBottom <= 180;

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

    // ② 键盘刚弹起：仅在接近底部时跟随（避免打断用户浏览历史）
    if (keyboardJustOpened) {
      if (nearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
      return;
    }

    // ③ 其余情况：在底部 / 加载中 / 刚发新消息 → 滚到底
    if (nearBottom || loading || grew) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [session?.messages, loading, kbH]);

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
      className="flex flex-col max-w-2xl mx-auto relative app-container"
      style={
        kbH > 0
          ? // 键盘弹起：容器高度收缩，聊天滚动区随之变矮，内容自然上滑露出
            { height: `calc(100dvh - ${kbH}px)` }
          : undefined
      }
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
          <span className="ml-1.5 text-[10px] font-normal text-slate-500 align-middle">v3.5</span>
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

      {/* ── 键盘调试面板（临时，排查用） ─────────────────── */}
      <div className="fixed top-16 right-1 z-[95] rounded-lg bg-black/90 border border-amber-500/50 px-2 py-1.5 text-[10px] text-amber-300 font-mono leading-snug pointer-events-none">
        <div>winH {kbDebug.winH}</div>
        <div>vvH {kbDebug.vvH.toFixed(0)}</div>
        <div>docH {kbDebug.docH}</div>
        <div>base {kbDebug.base}</div>
        <div className="text-cyan-300">kb {kbDebug.kb.toFixed(0)}</div>
        <div className="text-emerald-300">src {kbDebug.source}</div>
      </div>

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
