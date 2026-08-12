import type { ChatMessage } from '@/types';
import { ClickableEnglish } from '@/components/ClickableEnglish';

interface Props {
  message: ChatMessage;
  onAddWord?: (word: string, context: string) => void;
}

/**
 * 单条消息渲染组件（统一模式：纠错+对话二合一）
 * - 用户消息：右侧气泡
 * - AI 回复：纠错卡片 + 底部对话引导区
 * - 英文单词：点击 + 按钮加入生词本（使用共享 ClickableEnglish 组件）
 */
export function MessageBubble({ message, onAddWord }: Props) {
  const isUser = message.role === 'user';

  // ── 用户消息 ──────────────────────────────────────────

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-sm text-white shadow-lg">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  // ── AI 回复 ──────────────────────────────────────────

  const result = message.result;

  if (!result) {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="rounded-2xl rounded-bl-md bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
          ⚠ 回复失败，请重试
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-slide-up">
      <div className="max-w-[88%] w-full rounded-2xl rounded-bl-md bg-slate-800 border border-slate-700 shadow-lg overflow-hidden">
        {/* 纠错卡片区 */}
        <div className="p-4">
          {/* 纠正后的句子 */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs font-medium text-brand-400">✓ 纠正</span>
              {result.isChinese && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  中→英
                </span>
              )}
            </div>
            <div className="text-base text-slate-100 font-medium leading-relaxed">
              <ClickableEnglish text={result.corrected} onAddWord={onAddWord} />
            </div>
          </div>

          {/* 原文对比 */}
          {result.original !== result.corrected && (
            <div className="mb-3 pb-3 border-b border-slate-700">
              <span className="text-xs text-slate-500">原文</span>
              <p className="text-sm text-slate-400 mt-0.5 line-through decoration-slate-600">
                {result.original}
              </p>
            </div>
          )}

          {/* 解释 */}
          {result.explanation && (
            <div className="mb-2">
              <span className="text-xs text-slate-500">解析</span>
              <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">
                {result.explanation}
              </p>
            </div>
          )}

          {/* 替代表达（也可添加单词） */}
          {result.suggestions && result.suggestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <span className="text-xs text-slate-500">其他表达方式</span>
              <ul className="mt-1.5 space-y-1">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-1.5">
                    <span className="text-brand-400 mt-0.5 shrink-0">→</span>
                    <span className="text-sm text-slate-300 leading-relaxed">
                      <ClickableEnglish text={s} onAddWord={onAddWord} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 对话引导区 */}
        {result.followUp && (
          <div className="bg-brand-500/10 border-t border-brand-500/20 px-4 py-3">
            <div className="flex items-start gap-2">
              <span className="text-brand-400 text-sm shrink-0 mt-0.5">💬</span>
              <span className="text-sm text-slate-200 leading-relaxed">
                <ClickableEnglish text={result.followUp} onAddWord={onAddWord} />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
