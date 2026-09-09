import { useMemo } from 'react';

interface Props {
  /** 例句文本 */
  text: string;
  /** 需要高亮的词（大小写不敏感，含词形尾缀匹配） */
  highlight?: string;
  /** 是否可点击加词（默认为 false，单词本例句展示场景） */
  onAddWord?: (word: string, context: string) => void;
  className?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 高亮例句组件
 * 在一段英文例句中把指定的 target 单词高亮显示（保留大小写不敏感词形匹配）。
 * 可选：点击单词可加入生词本。
 */
export function HighlightEnglish({ text, highlight, onAddWord, className = '' }: Props) {
  const hl = highlight?.trim();

  const segments = useMemo(() => {
    if (!hl) return [{ text, hl: false, addable: '' }];

    // 允许匹配带词尾的词形（-s/-es/-ed/-ing/-'s 等），同时对 highlight 基础词做边界匹配
    const regex = new RegExp(`(${escapeRegex(hl)})(?:'s|s|es|ed|ing|d)?\\b`, 'gi');
    const parts: { text: string; hl: boolean; addable: string }[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, m.index), hl: false, addable: '' });
      }
      parts.push({ text: m[0], hl: true, addable: m[0] });
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), hl: false, addable: '' });
    }
    return parts;
  }, [text, hl]);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        const clean = seg.text.replace(/[^a-zA-Z'’\-]/g, '');
        const canAdd = !!onAddWord && !!clean && clean.length > 1 && !seg.hl;
        if (seg.hl) {
          return (
            <mark
              key={i}
              className="bg-amber-400/90 text-slate-900 font-semibold rounded px-0.5 mx-px"
            >
              {seg.text}
            </mark>
          );
        }
        if (canAdd) {
          return (
            <button
              key={i}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddWord!(clean, text);
              }}
              className="cursor-pointer hover:text-brand-300 transition-colors rounded"
              title={`添加 "${clean}" 到生词本`}
            >
              {seg.text}
            </button>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </span>
  );
}
