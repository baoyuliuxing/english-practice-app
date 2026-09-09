import { useEffect, useRef } from 'react';
import type { PracticeSession } from '@/types';
import { MessageBubble } from '@/components/MessageBubble';
import { TypingIndicator } from '@/components/TypingIndicator';
import { InputBar } from '@/components/InputBar';

interface Props {
  session: PracticeSession;
  dateStr: string;
  loading: boolean;
  error?: string | null;
  busy?: boolean; // 正在生成日记等操作时禁用输入
  onSend: (text: string) => void;
  /** 结束并生成那天日记 */
  onGenerateDiary: () => void;
  /** 保存并退出（保留已聊内容，不生成日记） */
  onSaveExit: () => void;
  /** 关闭 */
  onClose: () => void;
  onAddWord?: (word: string, context: string) => void;
}

/**
 * 补写日记对话界面（全屏覆盖）
 * 用户像"写当天日记"一样，与 AI 对话式补写过去某天发生的事情。
 * - 复用 MessageBubble / InputBar / TypingIndicator
 * - 顶部：日期 + 结束并生成日记按钮
 */
export function BackfillChatView({
  session,
  dateStr,
  loading,
  error,
  busy,
  onSend,
  onGenerateDiary,
  onSaveExit,
  onClose,
  onAddWord
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const date = new Date(dateStr + 'T00:00:00');
  const dateDisplay = date.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [session.messages, loading]);

  const canGenerate = session.correctedSentences.length > 0;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900 animate-fade-in">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm safe-top shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0"
          aria-label="返回"
        >
          ✕
        </button>

        <div className="text-center min-w-0">
          <h2 className="text-sm font-semibold text-slate-100 truncate">💬 补写日记</h2>
          <p className="text-[11px] text-slate-500 truncate">{dateDisplay}</p>
        </div>

        <button
          onClick={onGenerateDiary}
          disabled={!canGenerate || loading || busy}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
            canGenerate
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400'
              : 'bg-slate-800 text-slate-600'
          }`}
        >
          ✨ 生成日记
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400 shrink-0">
          ⚠ {error}
        </div>
      )}

      {/* 聊天区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 chat-scroll-area">
        {session.messages.length === 0 && (
          <div className="text-center py-8 animate-fade-in">
            <div className="text-4xl mb-3">🕰️</div>
            <p className="text-sm text-slate-300 mb-1">
              回忆一下那天发生了什么？
            </p>
            <p className="text-xs text-slate-500 leading-relaxed px-6">
              像写日记一样，用中文或英文聊聊那天你做了什么、见了谁、有什么感受。
              <br />
              AI 会边纠错边陪你回忆，最后可一键整合成一篇英文日记。
            </p>
          </div>
        )}

        {session.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onAddWord={onAddWord} />
        ))}

        {loading && <TypingIndicator />}

        {busy && (
          <div className="flex flex-col items-center py-6 animate-fade-in">
            <div className="w-9 h-9 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mb-2" />
            <p className="text-xs text-slate-400">正在整合成英文日记…</p>
          </div>
        )}

        {/* 底部提示 */}
        {!loading && !busy && session.messages.length > 0 && (
          <div className="pt-1 text-center">
            <p className="text-[11px] text-slate-600">
              💡 聊够了？点右上角「✨ 生成日记」整合这一天的内容
            </p>
          </div>
        )}
      </div>

      {/* 输入区 + 保存退出 */}
      <div className="shrink-0">
        {!busy && (
          <InputBar loading={loading} onSend={onSend} />
        )}

        {/* 不生成日记的退出选项 */}
        {!busy && session.messages.length > 0 && (
          <div className="px-4 pb-2 pt-1">
            <button
              onClick={onSaveExit}
              className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 text-xs font-medium transition-colors"
            >
              💾 先保存，暂不生成日记（下次可继续）
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
