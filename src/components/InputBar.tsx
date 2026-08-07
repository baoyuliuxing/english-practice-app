import { useState, useRef, useEffect } from 'react';

interface Props {
  loading: boolean;
  onSend: (text: string) => void;
}

/**
 * 底部输入栏（统一模式）
 * 中英混合输入，AI 自动纠错 + 英文对话引导
 */
export function InputBar({ loading, onSend }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="safe-bottom border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm px-3 pt-3 pb-3">
      <div className="flex items-end gap-2 max-w-2xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入中文或英文，AI 帮你纠正并陪你练习…"
            rows={1}
            disabled={loading}
            className="w-full resize-none rounded-2xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-50"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || loading}
          className="shrink-0 w-11 h-11 rounded-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:opacity-50 flex items-center justify-center text-white transition-colors active:scale-95"
          aria-label="发送"
        >
          {loading ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
