import type { UnifiedResult, DiaryResult, VocabItem } from '@/types';
import { getApiKey, sanitizeApiKey } from '@/lib/apiKey';

/**
 * 纯前端直连 DeepSeek API
 * API Key 存储在用户本地 localStorage 中，不上传任何服务器。
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// ── 系统提示词 ──────────────────────────────────────────

const SYSTEM_PROMPTS = {
  /** 统一模式：纠错 + 对话陪练 二合一 */
  unified: `You are an English writing tutor and conversation partner. For EVERY user message, do BOTH: (1) correct/translate it, (2) naturally continue the conversation.

Respond in this exact JSON structure (no markdown fences, no extra text):

{
  "mode": "unified",
  "original": "<user's input, verbatim>",
  "isChinese": <true if input is mainly Chinese, false if English>,
  "corrected": "<corrected English sentence — natural, idiomatic, grammar-perfect>",
  "explanation": "<1-2 sentences in Chinese explaining what was fixed or key translation choices. If input was already correct English, say '写得很好!' and add a small tip>",
  "suggestions": ["<1-2 alternative ways to say the same thing, from casual to formal>"],
  "followUp": "<a short, natural English follow-up question or comment to keep the conversation going. 1-2 sentences. Match the learner's level.>"
}

Rules:
- If input is Chinese: translate to natural English, explain key choices, then ask an English follow-up about the topic.
- If input is English with errors: correct the grammar, briefly explain in Chinese what was wrong, then respond naturally in English to what they said.
- If input is already correct English: acknowledge it ("写得很好!"), maybe offer an alternative expression, then continue the conversation naturally in English.
- Keep the conversation flowing — you're both a tutor AND a chat partner.
- followUp must ALWAYS be in English (the learner is practicing English).
- Be warm, encouraging, and genuinely interested in what the learner is saying.`,

  diary: `You are an English writing tutor. The user has finished a practice session and wants to generate an English diary entry from the sentences they practiced.

You will receive a JSON array of corrected English sentences (in chronological order). Weave them into a cohesive, natural diary entry.

Respond in this exact JSON structure (no markdown fences):

{
  "mode": "diary",
  "title": "<a short, catchy diary title in English>",
  "date": "<today's date in 'Month Day, Year' format>",
  "body": "<the full diary entry in English, 1-3 paragraphs, naturally incorporating all the practiced sentences>",
  "highlight": "<1-2 sentences in Chinese summarizing what the learner practiced or improved today>",
  "wordCount": <integer word count of the body>
}

Rules:
- Use ALL provided sentences, woven naturally into the narrative (not listed).
- Add transitional phrases so the entry flows like a real diary.
- Write in first person, past tense (as reflecting on the day).
- Keep the tone personal and reflective.
- The body should be 80-200 words.`,

  vocab: `You are an English vocabulary extraction expert. Given a user's original sentence, its corrected English version, and an English conversational reply (from the AI tutor), identify the key vocabulary words or phrases the learner should learn.
For EACH item, also provide a short simplified example sentence that contains the target word, drawn from the provided material.

Respond in this exact JSON structure (no markdown fences, no extra text):

{
  "items": [
    {
      "word": "<the English word or phrase>",
      "meaning": "<concise Chinese translation>",
      "errorType": "<grammar|spelling|translation|usage|vocabulary>",
      "example": "<a short simplified English sentence (5-15 words) that contains the target word, ideally trimmed from the corrected sentence or the conversational reply>"
    }
  ]
}

Rules:
- Extract 1-3 most important words/phrases per correction.
- Focus on words the learner actually got wrong or used awkwardly.
- If the input was Chinese and translated, extract useful English words from the translation.
- "meaning" should be concise Chinese (1-5 characters if possible).
- "errorType" must be one of: grammar, spelling, translation, usage, vocabulary.
- "example": keep it short, must contain the target word in its same inflected form (keep tense/plurality). Prefer cutting from the corrected sentence or conversational reply; do not invent long new sentences.
- If no significant vocabulary errors, return empty items array: {"items": []}.`,

  /** 单个单词查询（长按添加生词用） */
  lookupWord: `You are a concise English dictionary. Given an English word and its context sentence, provide a brief Chinese definition, classify the word, and supply a short example sentence drawn from the context.

Respond in this exact JSON (no markdown fences, no extra text):

{
  "word": "<the word>",
  "meaning": "<concise Chinese translation, 2-8 characters>",
  "errorType": "<vocabulary|grammar|usage|idiom|phrasal_verb>",
  "example": "<a short English sentence (3-15 words) taken from or lightly trimmed from the given context sentence, that contains the target word in its same inflected form>"
}

Rules:
- "meaning" must be short and accurate Chinese.
- "example": MUST contain the target word; trim the context to keep it short and readable. If the context doesn't contain the word (e.g. isolated word click), reuse the context as-is.
- "errorType": vocabulary for general words, grammar for function words, usage for tricky usage, idiom for fixed expressions, phrasal_verb for verb+preposition combos.`,

  /** 为存量生词生成必含目标词的简洁例句 */
  wordExample: `You are an English tutor. Given a single English word or phrase, write ONE short, natural, correct English sentence that CONTAINS that word/phrase (exactly as given, preserving tense/word form).

Respond in this exact JSON (no markdown fences, no extra text):

{
  "word": "<the word>",
  "example": "<one short English sentence (5-15 words) that contains the word>"
}

Rules:
- The example MUST contain the specified word/phrase verbatim (allow inflections like -s/-ed/-ing).
- Keep it short and easy for a learner.
- Use common, everyday vocabulary and grammar.
- Output only the JSON object.`
};

// ── 辅助：从 AI 文本中提取 JSON ──────────────────────────

function extractJson(content: string): any {
  let jsonStr = content.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();
  const first = jsonStr.indexOf('{');
  const last = jsonStr.lastIndexOf('}');
  if (first !== -1 && last !== -1) jsonStr = jsonStr.substring(first, last + 1);
  return JSON.parse(jsonStr);
}

// ── 核心：调用 DeepSeek API ──────────────────────────────

async function callDeepSeek(
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number
): Promise<any> {
  const rawKey = getApiKey();
  if (!rawKey) {
    throw new Error('请先在设置中配置 DeepSeek API Key');
  }
  // 二次清洗：确保请求头只含 ISO-8859-1 字符，
  // 否则 fetch 会抛 "String contains non ISO-8859-1 code point"
  const apiKey = sanitizeApiKey(rawKey);
  if (!apiKey) {
    throw new Error('API Key 含非法字符，请在设置中重新填写');
  }

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });
  } catch (err: any) {
    // 请求头非法 / 网络不可达等底层错误，转成可读提示
    const msg = String(err?.message || '');
    if (msg.includes('ISO-8859-1')) {
      throw new Error('API Key 含非法字符，请在设置中重新填写');
    }
    throw new Error('网络请求失败，请检查网络后重试');
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('DeepSeek API error:', res.status, errText);
    if (res.status === 401) throw new Error('API Key 无效，请检查设置中的 DeepSeek API Key');
    if (res.status === 429) throw new Error('请求过于频繁或额度不足，请稍后再试');
    throw new Error(`AI 服务异常 (${res.status})，请稍后重试`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── 对外暴露的 API 方法 ──────────────────────────────────

/** 统一纠错+对话（二合一） */
export async function unifiedChat(
  input: string,
  historyMessages: Array<{ role: string; content: string }>
): Promise<UnifiedResult> {
  // 取最近几条对话历史作为上下文
  const recentHistory = historyMessages.slice(-6);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS.unified },
    ...recentHistory,
    { role: 'user', content: input }
  ];
  const content = await callDeepSeek(messages, 0.5, 800);
  return extractJson(content);
}

/** 生成英文日记 */
export async function generateDiary(sentences: string[]): Promise<DiaryResult> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS.diary },
    { role: 'user', content: JSON.stringify(sentences, null, 2) }
  ];
  const content = await callDeepSeek(messages, 0.7, 800);
  return extractJson(content);
}

/** 提取词汇 */
export async function extractVocabulary(
  original: string,
  corrected: string,
  explanation: string,
  /** AI 的英文接话（可作为例句来源） */
  followUp?: string
): Promise<VocabItem[]> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS.vocab },
    { role: 'user', content: JSON.stringify({ original, corrected, explanation, conversationalReply: followUp || '' }, null, 2) }
  ];
  const content = await callDeepSeek(messages, 0.3, 400);
  const result = extractJson(content);

  if (!result.items || !Array.isArray(result.items)) return [];

  return result.items.map((item: any) => {
    const word = String(item.word || '').trim();
    const aiExample = String(item.example || '').trim();

    // 判断句子是否包含目标词（大小写不敏感、含词形尾缀 -s/-es/-ed/-ing 等）
    const contains = (s?: string) => {
      if (!s) return false;
      let re: RegExp;
      try {
        re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(?:'s|s|es|ed|ing|d)?\\b", 'i');
      } catch {
        re = new RegExp(word, 'i');
      }
      return re.test(s);
    };

    // 例句源：必须含目标词，优先原句 → AI 简化句 → 改正句
    const exampleSource = contains(original)
      ? original
      : contains(aiExample)
        ? aiExample
        : contains(corrected)
          ? corrected
          : aiExample || corrected || original;

    return {
      id: `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      word,
      meaning: item.meaning,
      // 展示例句：保证含目标词（原句优先），便于一眼定位
      example: exampleSource,
      original,
      correctedExample: corrected,
      highlight: word,
      errorType: item.errorType || 'vocabulary',
      addedAt: Date.now(),
      mastered: false,
      reviewCount: 0,
      sessionId: ''
    };
  });
}

/** 单个单词查询（长按添加生词） */
export async function lookupWord(
  word: string,
  context: string
): Promise<{ word: string; meaning: string; errorType: string; example?: string }> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS.lookupWord },
    { role: 'user', content: JSON.stringify({ word, context }) }
  ];
  const content = await callDeepSeek(messages, 0.1, 200);
  return extractJson(content);
}

/** 为存量/缺失例句的生词，生成一句必含目标词的简洁例句 */
export async function generateWordExample(
  word: string
): Promise<{ word: string; example: string }> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS.wordExample },
    { role: 'user', content: JSON.stringify({ word }) }
  ];
  const content = await callDeepSeek(messages, 0.4, 200);
  return extractJson(content);
}
