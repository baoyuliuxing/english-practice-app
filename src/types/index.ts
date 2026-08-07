// ── 核心类型定义 ────────────────────────────────────────────

/** 会话模式（二合一：纠错 + 对话陪练） */
export type AppMode = 'unified';

/** 消息角色 */
export type MessageRole = 'user' | 'assistant';

/** 统一结果（AI 同时纠错 + 对话引导） */
export interface UnifiedResult {
  mode: 'unified';
  /** 用户原始输入 */
  original: string;
  /** 是否为中文输入需要翻译 */
  isChinese: boolean;
  /** 纠正/翻译后的正确英文句子 */
  corrected: string;
  /** 纠错解释（中文） */
  explanation: string;
  /** 替代表达建议 */
  suggestions?: string[];
  /** AI 的英文对话引导（自然接话） */
  followUp: string;
}

/** 日记结果（diary 模式 AI 返回的结构） */
export interface DiaryResult {
  mode: 'diary';
  title: string;
  date: string;
  body: string;
  highlight: string;
  wordCount: number;
}

/** 聊天消息（UI 渲染用） */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  /** 用户原始输入内容 */
  content: string;
  /** 统一纠错+对话结果（仅 assistant 消息） */
  result?: UnifiedResult;
  /** 时间戳 */
  timestamp: number;
}

/** 一次练习会话 */
export interface PracticeSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  /** 所有已纠正的英文句子（用于生成日记） */
  correctedSentences: string[];
  /** 是否已生成日记 */
  diaryGenerated: boolean;
  /** 生成的日记 */
  diary?: DiaryResult;
  /** 该会话关联的日期（YYYY-MM-DD），用于日历索引 */
  date?: string;
}

/** ── 词汇本类型 ────────────────────────────────────────── */

/** 词汇条目 */
export interface VocabItem {
  id: string;
  word: string;
  meaning: string;
  example: string;
  correctedExample: string;
  errorType: string;
  addedAt: number;
  mastered: boolean;
  reviewCount: number;
  sessionId: string;
}

/** ── 日历/日记工作台类型 ──────────────────────────────── */

export interface DayDiary {
  date: string;
  diary?: DiaryResult;
  sessionId?: string;
  sentenceCount: number;
  hasPractice: boolean;
  isManual: boolean;
}
