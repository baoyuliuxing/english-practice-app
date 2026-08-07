import { useState, useMemo } from 'react';
import type { VocabItem } from '@/types';

interface Props {
  vocabList: VocabItem[];
  onToggleMastered: (id: string, mastered: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

type FilterType = 'all' | 'unmastered' | 'mastered';
type CoverMode = 'none' | 'coverChinese' | 'coverEnglish';

/**
 * 单词本组件
 * - 列表展示所有提取的词汇
 * - 按掌握状态筛选
 * - 遮盖中文/英文背诵模式
 */
export function VocabularyBook({ vocabList, onToggleMastered, onDelete, onClose }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [coverMode, setCoverMode] = useState<CoverMode>('none');
  const [search, setSearch] = useState('');
  const [flippedItems, setFlippedItems] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = vocabList;
    if (filter === 'unmastered') list = list.filter(v => !v.mastered);
    if (filter === 'mastered') list = list.filter(v => v.mastered);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.word.toLowerCase().includes(q) ||
        v.meaning.includes(q) ||
        v.errorType.includes(q)
      );
    }
    return list;
  }, [vocabList, filter, search]);

  const stats = useMemo(() => ({
    total: vocabList.length,
    mastered: vocabList.filter(v => v.mastered).length,
    unmastered: vocabList.filter(v => !v.mastered).length
  }), [vocabList]);

  const toggleFlip = (id: string) => {
    setFlippedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getErrorTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      grammar: '语法',
      spelling: '拼写',
      translation: '翻译',
      usage: '用法',
      vocabulary: '词汇'
    };
    return map[type] || type;
  };

  const getErrorTypeColor = (type: string) => {
    const map: Record<string, string> = {
      grammar: 'bg-amber-500/20 text-amber-400',
      spelling: 'bg-red-500/20 text-red-400',
      translation: 'bg-blue-500/20 text-blue-400',
      usage: 'bg-purple-500/20 text-purple-400',
      vocabulary: 'bg-emerald-500/20 text-emerald-400'
    };
    return map[type] || 'bg-slate-700 text-slate-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md h-full bg-slate-900 flex flex-col animate-slide-up">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400">
            ✕
          </button>
          <h2 className="text-base font-semibold text-slate-100">📚 单词本</h2>
          <div className="w-9" />
        </div>

        {/* 统计 */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 rounded-xl bg-slate-800/50 p-2.5 text-center">
              <p className="text-lg font-bold text-slate-100">{stats.total}</p>
              <p className="text-[10px] text-slate-500">总词汇</p>
            </div>
            <div className="flex-1 rounded-xl bg-emerald-500/10 p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{stats.mastered}</p>
              <p className="text-[10px] text-emerald-500/70">已掌握</p>
            </div>
            <div className="flex-1 rounded-xl bg-amber-500/10 p-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">{stats.unmastered}</p>
              <p className="text-[10px] text-amber-500/70">待复习</p>
            </div>
          </div>

          {/* 搜索 */}
          <div className="relative mb-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索单词或释义…"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* 筛选 + 遮盖模式 */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-slate-800/50 p-0.5 flex-1">
              {([['all', '全部'], ['unmastered', '待复习'], ['mastered', '已掌握']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    filter === key ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg bg-slate-800/50 p-0.5">
              {([
                ['none', '👁'],
                ['coverChinese', '中'],
                ['coverEnglish', 'En']
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCoverMode(key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    coverMode === key ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={key === 'coverChinese' ? '遮盖中文' : key === 'coverEnglish' ? '遮盖英文' : '显示全部'}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 词汇列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3 opacity-30">📚</p>
              <p className="text-sm text-slate-500">
                {search ? '没有找到匹配的词汇' : '还没有词汇记录'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {search ? '换个搜索词试试' : '开始练习后，AI 会自动提取错词'}
              </p>
            </div>
          ) : (
            filtered.map(item => {
              const isFlipped = flippedItems.has(item.id);
              const showEnglish = coverMode !== 'coverEnglish' || isFlipped;
              const showChinese = coverMode !== 'coverChinese' || isFlipped;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleFlip(item.id)}
                  className={`group rounded-xl border p-3 transition-all cursor-pointer ${
                    item.mastered
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* 单词 + 标签 */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-base font-bold ${
                          showEnglish ? 'text-slate-100' : 'text-slate-700 select-none'
                        }`}>
                          {item.word}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getErrorTypeColor(item.errorType)}`}>
                          {getErrorTypeLabel(item.errorType)}
                        </span>
                        {item.mastered && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            ✓ 已掌握
                          </span>
                        )}
                      </div>

                      {/* 释义 */}
                      <p className={`text-sm mb-1.5 ${
                        showChinese ? 'text-slate-300' : 'text-slate-700 select-none'
                      }`}>
                        {item.meaning}
                      </p>

                      {/* 例句 */}
                      <p className="text-xs text-slate-500 line-clamp-2">
                        <span className="line-through text-slate-600">{item.example}</span>
                        <span className="text-slate-400"> → {item.correctedExample}</span>
                      </p>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMastered(item.id, !item.mastered);
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                          item.mastered
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                        title={item.mastered ? '标记未掌握' : '标记已掌握'}
                      >
                        {item.mastered ? '✓' : '○'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center text-xs transition-colors"
                        title="删除"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-600">
            {coverMode !== 'none' ? '👆 点击卡片翻转查看被遮盖的内容' : '💡 使用遮盖模式进行背诵练习'}
          </p>
        </div>
      </div>
    </div>
  );
}
