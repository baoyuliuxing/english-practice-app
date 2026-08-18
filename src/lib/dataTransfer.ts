import type { PracticeSession, VocabItem, DiaryResult } from '@/types';
import { saveSession, addVocabItem, formatDate } from '@/lib/db';

/** 导出文件格式版本（未来结构变更时用于兼容） */
const EXPORT_VERSION = 1;

/** 全量导出数据结构 */
export interface ExportData {
  version: number;
  exportedAt: number;
  sessions: PracticeSession[];
  vocabulary: VocabItem[];
}

/** 导入解析结果 */
export interface ParsedImport {
  sessions: PracticeSession[];
  vocabulary: VocabItem[];
}

/** 导入执行结果统计 */
export interface ImportStats {
  sessionImported: number;
  sessionSkipped: number;
  vocabImported: number;
  vocabSkipped: number;
}

// ── 导出 ────────────────────────────────────────────────

/** 导出全部数据（练习记录 + 日记 + 生词本）为 JSON 字符串 */
export function exportAllData(
  sessions: PracticeSession[],
  vocabulary: VocabItem[]
): string {
  const data: ExportData = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    sessions,
    vocabulary
  };
  return JSON.stringify(data, null, 2);
}

// ── 导入解析 ────────────────────────────────────────────

/**
 * 解析导入内容（容错）：
 * - JSON（本应用导出格式）→ 完整还原 sessions + vocabulary
 * - 纯文本日记（兼容现有"复制日记"格式：首行标题/次行日期/空行/正文）
 *   → 构造一个导入型 PracticeSession
 */
export function parseImport(text: string): ParsedImport {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('内容为空');
  }

  // 尝试 JSON 解析
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJson(trimmed);
  }

  // 纯文本日记解析
  const session = parsePlainTextDiary(trimmed);
  return { sessions: [session], vocabulary: [] };
}

function parseJson(text: string): ParsedImport {
  let obj: any;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('JSON 格式错误，请检查粘贴内容是否完整');
  }

  // 兼容数组和对象两种包裹
  const root = Array.isArray(obj) ? { sessions: obj, vocabulary: [] } : obj;

  const sessions: PracticeSession[] = [];
  const vocabulary: VocabItem[] = [];

  if (Array.isArray(root.sessions)) {
    for (const s of root.sessions) {
      const fixed = sanitizeSession(s);
      if (fixed) sessions.push(fixed);
    }
  }

  if (Array.isArray(root.vocabulary)) {
    for (const v of root.vocabulary) {
      const fixed = sanitizeVocab(v);
      if (fixed) vocabulary.push(fixed);
    }
  }

  if (sessions.length === 0 && vocabulary.length === 0) {
    throw new Error('未找到可导入的数据（需要 sessions 或 vocabulary 字段）');
  }

  return { sessions, vocabulary };
}

/** 校验并修复导入的 session 对象 */
function sanitizeSession(s: any): PracticeSession | null {
  if (!s || typeof s !== 'object' || !s.id) return null;
  return {
    id: String(s.id),
    title: String(s.title || '导入的记录'),
    createdAt: Number(s.createdAt) || Date.now(),
    updatedAt: Number(s.updatedAt) || Date.now(),
    messages: Array.isArray(s.messages) ? s.messages : [],
    correctedSentences: Array.isArray(s.correctedSentences) ? s.correctedSentences : [],
    diaryGenerated: !!s.diaryGenerated || !!s.diary,
    diary: s.diary ? sanitizeDiary(s.diary) : undefined,
    date: s.date || formatDate(new Date(Number(s.createdAt) || Date.now()))
  };
}

/** 校验并修复导入的日记对象 */
function sanitizeDiary(d: any): DiaryResult {
  return {
    mode: 'diary',
    title: String(d.title || 'Untitled'),
    date: String(d.date || ''),
    body: String(d.body || ''),
    highlight: String(d.highlight || ''),
    wordCount: Number(d.wordCount) || String(d.body || '').split(/\s+/).filter(Boolean).length
  };
}

/** 校验并修复导入的生词对象 */
function sanitizeVocab(v: any): VocabItem | null {
  if (!v || typeof v !== 'object' || !v.word) return null;
  return {
    id: String(v.id || `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    word: String(v.word),
    meaning: String(v.meaning || ''),
    example: String(v.example || ''),
    correctedExample: String(v.correctedExample || ''),
    errorType: String(v.errorType || 'vocabulary'),
    addedAt: Number(v.addedAt) || Date.now(),
    mastered: !!v.mastered,
    reviewCount: Number(v.reviewCount) || 0,
    sessionId: String(v.sessionId || '')
  };
}

/**
 * 解析纯文本日记（兼容 DiaryView/DayDiaryModal 的复制格式）：
 *   第一行：标题
 *   第二行：日期（如 "August 19, 2026" 或 "2026-08-19"）
 *   空行
 *   正文（可能带 "💡 今日练习亮点" 段落）
 */
function parsePlainTextDiary(text: string): PracticeSession {
  const lines = text.split('\n');
  const title = (lines[0] || '').trim() || 'Imported Diary';
  const dateLine = (lines[1] || '').trim();

  let highlight = '';
  let body = '';

  if (lines.length > 2) {
    let rest = lines.slice(2).join('\n').trim();
    // 去掉可能存在的空行开头
    rest = rest.replace(/^\n+/, '');

    // 提取中文亮点段（如果有）
    const hlMatch = rest.match(/今日练习亮点[：:]*\s*([\s\S]*?)$/);
    if (hlMatch) {
      highlight = hlMatch[1].trim();
      rest = rest.slice(0, hlMatch.index).trim();
    }

    body = rest;
  }

  // 尝试把日期行映射为 YYYY-MM-DD
  const date = resolveDate(dateLine);

  const now = Date.now();
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  return {
    id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${title}`,
    createdAt: now,
    updatedAt: now,
    messages: [],
    correctedSentences: [],
    diaryGenerated: true,
    diary: {
      mode: 'diary',
      title,
      date: dateLine,
      body,
      highlight,
      wordCount
    },
    date
  };
}

/** 把 "August 19, 2026" / "2026-08-19" / "2026/8/19" 解析为 YYYY-MM-DD */
function resolveDate(dateLine: string): string {
  if (!dateLine) return formatDate(new Date());

  // 已是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateLine)) return dateLine;

  // 英文月份格式
  const parsed = new Date(dateLine);
  if (!isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }

  return formatDate(new Date());
}

// ── 导入执行 ────────────────────────────────────────────

/**
 * 执行导入：按 id 去重，写入 IndexedDB
 */
export async function importData(
  parsed: ParsedImport,
  existingSessions: PracticeSession[],
  existingVocab: VocabItem[]
): Promise<ImportStats> {
  const stats: ImportStats = {
    sessionImported: 0,
    sessionSkipped: 0,
    vocabImported: 0,
    vocabSkipped: 0
  };

  const sessionIds = new Set(existingSessions.map(s => s.id));
  const vocabIds = new Set(existingVocab.map(v => v.id));
  const vocabWords = new Set(existingVocab.map(v => v.word.toLowerCase()));

  for (const s of parsed.sessions) {
    if (sessionIds.has(s.id)) {
      stats.sessionSkipped++;
      continue;
    }
    await saveSession(s);
    sessionIds.add(s.id);
    stats.sessionImported++;
  }

  for (const v of parsed.vocabulary) {
    if (vocabIds.has(v.id) || vocabWords.has(v.word.toLowerCase())) {
      stats.vocabSkipped++;
      continue;
    }
    await addVocabItem(v);
    vocabIds.add(v.id);
    vocabWords.add(v.word.toLowerCase());
    stats.vocabImported++;
  }

  return stats;
}
