/**
 * 句子截取工具 —— 从长段落中截取"关键的两句话"，用于单词本例句展示。
 * 目标：找到包含目标单词的那一小段，避免整段超长文本刷屏。
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsWord(sentence: string, word: string): boolean {
  if (!word) return false;
  let re: RegExp;
  try {
    re = new RegExp(escapeRegex(word) + "(?:'s|s|es|ed|ing|d)?\\b", 'i');
  } catch {
    re = new RegExp(escapeRegex(word), 'i');
  }
  return re.test(sentence);
}

/**
 * 把一个文本切成"分句"数组（按句末标点/换行切，保留标点）。
 */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')          // 归一化空白
    .split(/(?<=[.!?。！？])\s+|[\n\r]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * 从一个段落中，截取出包含目标单词的关键句。
 * - 优先返回含目标词的句子（最多 1 句）。
 * - 若该句过长，则以单词为中心向两侧扩展，保留单词两侧上下文，并加省略号。
 * - 找不到含词的句子时，返回文本开头的第一句拼第二句（最多两句）。
 * @param text 原文本
 * @param word 目标单词
 * @param maxLen 截取后的最大长度（字符），默认 120
 */
export function clipAroundWord(text: string, word: string, maxLen = 120): string {
  if (!text) return '';
  const sentences = splitSentences(text);

  // 1) 找含目标词的句子
  const hitIndex = sentences.findIndex(s => containsWord(s, word));

  if (hitIndex === -1) {
    // 找不到：取开头两句
    return sentences.slice(0, 2).join(' ').slice(0, maxLen);
  }

  let target = sentences[hitIndex];

  // 2) 句子过长 → 以单词为中心裁剪
  if (target.length > maxLen) {
    const idx = target.toLowerCase().indexOf(word.toLowerCase());
    const center = idx === -1 ? Math.floor(target.length / 2) : idx + Math.floor(word.length / 2);
    const half = Math.floor(maxLen / 2);
    let start = Math.max(0, center - half);
    let end = Math.min(target.length, center + half);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < target.length ? '…' : '';
    // 尽量在词边界截断，避免截到单词中间
    if (start > 0) {
      const sp = target.indexOf(' ', start);
      if (sp !== -1 && sp < center) start = sp + 1;
    }
    if (end < target.length) {
      const sp = target.lastIndexOf(' ', end);
      if (sp > center) end = sp;
    }
    target = prefix + target.slice(start, end).trim() + suffix;
  }

  return target;
}

/**
 * 判断一个词条是否应"只显示例句"（不显示原句/改后对比）。
 * 规则：词汇类（vocabulary）或缺失原句的数据（通常是手动添加的生词）。
 */
export function isSimpleExampleOnly(item: {
  errorType?: string;
  original?: string;
}): boolean {
  return item.errorType === 'vocabulary' || !item.original || !item.original.trim();
}

/**
 * 判断词条的现有句子（original / correctedExample / example）中，
 * 是否至少有一个包含目标单词。
 */
export function hasSentenceContainingWord(item: {
  word?: string;
  highlight?: string;
  original?: string;
  correctedExample?: string;
  example?: string;
}): boolean {
  const w = item.highlight || item.word;
  if (!w) return false;
  return [item.original, item.correctedExample, item.example]
    .filter(Boolean)
    .some((s) => containsWord(s as string, w));
}

/**
 * 从词条的几个候选句子里，挑第一个包含目标单词的句子；都没有则返回第一个非空。
 * 展示例句时优先用含词的句子。
 */
export function pickWordSentence(item: {
  word?: string;
  highlight?: string;
  original?: string;
  correctedExample?: string;
  example?: string;
}): string {
  const w = item.highlight || item.word || '';
  const candidates = [item.original, item.correctedExample, item.example]
    .filter((s): s is string => !!s && !!s.trim());
  const hit = candidates.find((s) => w && containsWord(s, w));
  return hit || candidates[0] || '';
}
