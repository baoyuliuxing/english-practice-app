import type { PracticeSession } from '@/types';

interface Props {
  history: PracticeSession[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * 历史记录抽屉
 * 列出所有练习会话，可加载或删除
 */
export function HistoryDrawer({ history, onLoad, onDelete, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 抽屉 */}
      <div className="relative w-[85%] max-w-sm h-full bg-slate-900 border-r border-slate-800 flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">历史记录</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="text-4xl mb-3 opacity-30">📚</span>
              <p className="text-sm text-slate-500">还没有练习记录</p>
              <p className="text-xs text-slate-600 mt-1">开始第一次练习吧！</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {history.map(s => (
                <li key={s.id}>
                  <div className="group rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 p-3 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => onLoad(s.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {s.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s.correctedSentences.length} 句 ·
                          {s.diaryGenerated ? ' 已生成日记' : ' 未生成日记'}
                        </p>
                        {s.diary && (
                          <p className="text-xs text-brand-400 mt-1 truncate">
                            📝 {s.diary.title}
                          </p>
                        )}
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
                        className="shrink-0 w-7 h-7 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="删除"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
