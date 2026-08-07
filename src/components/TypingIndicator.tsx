/** 打字指示器 —— AI 正在思考时的动画 */
export function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="rounded-2xl rounded-bl-md bg-slate-800 px-4 py-3 shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot w-2 h-2 rounded-full bg-slate-400 inline-block" />
          <span className="typing-dot w-2 h-2 rounded-full bg-slate-400 inline-block" />
          <span className="typing-dot w-2 h-2 rounded-full bg-slate-400 inline-block" />
        </div>
      </div>
    </div>
  );
}
