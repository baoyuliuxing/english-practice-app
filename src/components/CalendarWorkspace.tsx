import { useState, useMemo } from 'react';
import type { PracticeSession } from '@/types';
import { formatDate, getMonthDays, getMonthFirstDayOfWeek, parseDate } from '@/lib/db';

interface Props {
  sessions: PracticeSession[];
  onSelectDate: (dateStr: string, session?: PracticeSession) => void;
  onClose: () => void;
}

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

/**
 * 日历工作台
 * 按月展示日历，有练习的日期带标记，点击可查看/补写日记
 */
export function CalendarWorkspace({ sessions, onSelectDate, onClose }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // 按日期索引会话
  const sessionMap = useMemo(() => {
    const map = new Map<string, PracticeSession[]>();
    for (const s of sessions) {
      const date = s.date || formatDate(new Date(s.createdAt));
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(s);
    }
    return map;
  }, [sessions]);

  const days = getMonthDays(year, month);
  const firstDayOfWeek = getMonthFirstDayOfWeek(year, month);
  const prevMonthDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // 周一开头
  const totalCells = Math.ceil((days.length + prevMonthDays) / 7) * 7;

  const getDayStatus = (date: Date) => {
    const dateStr = formatDate(date);
    const daySessions = sessionMap.get(dateStr) || [];
    const hasPractice = daySessions.length > 0;
    const hasDiary = daySessions.some(s => s.diaryGenerated);
    const isToday = formatDate(date) === formatDate(today);
    return { hasPractice, hasDiary, isToday, daySessions };
  };

  const handleDayClick = (date: Date) => {
    const dateStr = formatDate(date);
    const daySessions = sessionMap.get(dateStr) || [];
    // 优先找有日记的会话，否则找第一个
    const session = daySessions.find(s => s.diaryGenerated) || daySessions[0];
    onSelectDate(dateStr, session);
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
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
          <h2 className="text-base font-semibold text-slate-100">📅 工作台</h2>
          <div className="w-9" />
        </div>

        {/* 月份导航 */}
        <div className="flex items-center justify-between px-6 py-4">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 text-lg">
            ‹
          </button>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-100">{MONTH_NAMES[month]}</p>
            <p className="text-xs text-slate-500">{year}年</p>
          </div>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 text-lg">
            ›
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 px-4 pb-2">
          {WEEK_DAYS.map(d => (
            <div key={d} className="text-center text-xs text-slate-500 py-2">{d}</div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 px-4 gap-1 flex-1 content-start">
          {/* 前月填充 */}
          {Array.from({ length: prevMonthDays }).map((_, i) => (
            <div key={`prev-${i}`} className="aspect-square" />
          ))}

          {/* 当月日期 */}
          {days.map(date => {
            const { hasPractice, hasDiary, isToday } = getDayStatus(date);
            const dayNum = date.getDate();

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDayClick(date)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${
                  hasPractice
                    ? 'bg-brand-500/20 hover:bg-brand-500/30'
                    : 'hover:bg-slate-800/50'
                } ${isToday ? 'ring-2 ring-brand-500' : ''}`}
              >
                <span className={`text-sm font-medium ${
                  hasPractice ? 'text-brand-300' : 'text-slate-400'
                } ${isToday ? 'text-brand-400' : ''}`}>
                  {dayNum}
                </span>

                {/* 练习标记 */}
                {hasPractice && (
                  <div className="mt-0.5">
                    {hasDiary ? (
                      <span className="text-xs">📝</span>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                    )}
                  </div>
                )}
              </button>
            );
          })}

          {/* 后月填充 */}
          {Array.from({ length: totalCells - days.length - prevMonthDays }).map((_, i) => (
            <div key={`next-${i}`} className="aspect-square" />
          ))}
        </div>

        {/* 图例 */}
        <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-brand-400" />
            <span>有练习</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>📝</span>
            <span>已生成日记</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full ring-2 ring-brand-500" />
            <span>今天</span>
          </div>
        </div>
      </div>
    </div>
  );
}
