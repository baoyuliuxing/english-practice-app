import { useMemo } from 'react';

interface Props {
  /** 句子文本（用户原句或改后句） */
  text: string;
  /** 目标单词（大小写不敏感，含词形尾缀匹配） */
  word?: string;
  /** 用【】高亮标出目标词出现的位置（默认 true） */
  mark?: boolean;
  className?: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 标错句组件
 * 在一段句子中，把目标单词出现的位置用【】包围并加亮，让用户一眼看到单词位置。
 * 支持词形尾缀匹配（-s/-es/-ed/-ing/-'s 等），大小写不敏感。
 * 若句子中找不到该词，则原样显示整句（不报错、不标注）。
 */
export function MarkedEnglish({ text, word, mark = true, className = '' }: Props) {
  const w = word?.trim();

  const segments = useMemo(() => {
    if (!w || !mark) return [{ text, matched: false }];

    const regex = new RegExp(`(${escapeRegex(w)})(?:'s|s|es|ed|ing|d)?\\b`, 'gi');
    const parts: { text: string; matched: boolean }[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, m.index), matched: false });
      }
      parts.push({ text: m[0], matched: true });
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), matched: false });
    }
    // 无匹配时回退为整句未匹配
    if (parts.length === 0) parts.push({ text, matched: false });
    return parts;
  }, [text, w, mark]);

  const hasMatch = segments.some(s => s.matched);

  // 搜索时可能原句里没有该词（例如单词仅出现在 AI 例句/改后句）→ 保持易读，不加【】
  if (!hasMatch) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.matched ? (
          <span key={i} className="mark-word-bracket">
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}
