import { useState, useCallback } from 'react';

interface Props {
  text: string;
  className?: string;
  onAddWord?: (word: string, context: string) => void;
}

/**
 * 可点击英文单词组件
 * 每个英文单词可点击添加到生词本，右上角悬浮 + 标记
 */
export function ClickableEnglish({ text, className = '', onAddWord }: Props) {
  const [addingWord, setAddingWord] = useState<string | null>(null);
  const [addedWord, setAddedWord] = useState<string | null>(null);

  const handleAddWord = useCallback((word: string) => {
    if (!onAddWord || addingWord) return;
    const cleanWord = word.replace(/[^a-zA-Z'’\-]$/, '');
    if (cleanWord.length < 2) return;

    setAddingWord(cleanWord);
    onAddWord(cleanWord, text);

    setAddedWord(cleanWord);
    setTimeout(() => setAddedWord(null), 1500);
    setTimeout(() => setAddingWord(null), 2000);
  }, [onAddWord, addingWord, text]);

  // 按空格和标点拆分，保留标点
  const tokens = text.match(/[\w'’\-]+|[^\w'’\-]+/g) || [text];

  return (
    <span className={className}>
      {tokens.map((token, i) => {
        if (/^[a-zA-Z'’\-]+$/.test(token) && token.length > 1) {
          const isThisAdded = addedWord === token.replace(/[^a-zA-Z'’\-]$/, '');
          return (
            <span key={i} className="relative inline group/word">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddWord(token);
                }}
                disabled={!!addingWord}
                className={`relative cursor-pointer rounded transition-colors ${
                  isThisAdded ? 'text-emerald-400' : 'hover:text-brand-300'
                }`}
                title={`添加 "${token}" 到生词本`}
              >
                {token}
                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold leading-none transition-all ${
                  isThisAdded
                    ? 'bg-emerald-500 text-white scale-100'
                    : 'bg-brand-500 text-white scale-0 group-hover/word:scale-100'
                }`}>
                  {isThisAdded ? '✓' : '+'}
                </span>
              </button>
            </span>
          );
        }
        return <span key={i}>{token}</span>;
      })}
    </span>
  );
}
