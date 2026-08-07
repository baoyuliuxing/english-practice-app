/**
 * Vercel Serverless Function: /api/chat
 *
 * 作为前端与 DeepSeek API 之间的代理，保护 API Key 不暴露在前端代码中。
 * 支持三种模式: correct(纠错) | converse(对话陪练) | diary(生成日记)
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// ── 系统提示词 ──────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  correct: `You are an expert English writing tutor integrated into a language-learning app.

The learner may type in Chinese, English, or a mix of both (Chinglish). Your job is to help them practice **English writing**.

For EVERY user message, do the following — always respond in this exact JSON structure (no markdown fences, no extra text):

{
  "mode": "correct",
  "original": "<the user's original input, verbatim>",
  "isChinese": <true if the input is primarily Chinese / needs translation, false if it's already English>,
  "corrected": "<the corrected / translated English sentence — natural, idiomatic, grammar-perfect>",
  "explanation": "<brief explanation in Chinese of what was fixed and why; if input was Chinese, explain key translation choices>",
  "suggestions": ["<optional: 1-3 alternative ways to express the same idea, from casual to formal>"]
}

Rules:
- If the input is already correct English, still return it as "corrected" and note "写得很好!" in the explanation.
- If the input is Chinese, translate it into natural English and explain the key choices.
- If the input is mixed, extract the intended meaning and produce a clean English sentence.
- Keep explanations concise (1-3 sentences in Chinese).
- "corrected" must always be a complete, standalone English sentence.`,

  converse: `You are a friendly English conversation partner in a language-learning app.

The learner has just finished a correction round and now wants to practice conversational English. Continue the dialogue naturally.

Rules:
- Respond ONLY in English (the learner is practicing English output).
- Keep replies short and natural (1-3 sentences), like a real conversation.
- Ask follow-up questions to keep the dialogue going.
- If the learner writes in Chinese, gently encourage them to try English, but still respond to the content.
- Do NOT correct their grammar here — just converse. Correction mode is separate.
- Match the learner's level: if they use simple English, keep yours accessible; if advanced, raise the bar slightly.
- Be warm, curious, and encouraging.`,

  diary: `You are an English writing tutor. The user has finished a practice session and wants to generate an English diary entry from the sentences they practiced.

You will receive a JSON array of corrected English sentences (in chronological order). Your job is to weave them into a cohesive, natural diary entry.

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
- The body should be 80-200 words.`
};

// ── 请求体类型 ──────────────────────────────────────────────

interface ChatRequestBody {
  mode: 'correct' | 'converse' | 'diary';
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  userInput?: string;
  sentences?: string[];  // diary 模式用
}

// ── 主处理函数 ──────────────────────────────────────────────

export default async function handler(req: {
  method?: string;
  body?: ChatRequestBody | string;
}): Promise<{ status: number; body: any }> {

  if (req.method !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      status: 500,
      body: { error: 'Server missing DEEPSEEK_API_KEY environment variable. Please configure it in Vercel project settings.' }
    };
  }

  let body: ChatRequestBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return { status: 400, body: { error: 'Invalid JSON body' } };
  }

  const { mode, messages, userInput, sentences } = body;

  if (!mode || !SYSTEM_PROMPTS[mode]) {
    return { status: 400, body: { error: 'Invalid or missing "mode". Must be: correct | converse | diary' } };
  }

  // ── 构建请求消息 ────────────────────────────────────────

  let apiMessages: Array<{ role: string; content: string }>;

  if (mode === 'diary') {
    if (!sentences || sentences.length === 0) {
      return { status: 400, body: { error: 'Diary mode requires "sentences" array' } };
    }
    apiMessages = [
      { role: 'system', content: SYSTEM_PROMPTS.diary },
      { role: 'user', content: JSON.stringify(sentences, null, 2) }
    ];
  } else if (mode === 'correct') {
    if (!userInput) {
      return { status: 400, body: { error: 'Correct mode requires "userInput"' } };
    }
    apiMessages = [
      { role: 'system', content: SYSTEM_PROMPTS.correct },
      { role: 'user', content: userInput }
    ];
  } else {
    // converse
    if (!messages || messages.length === 0) {
      return { status: 400, body: { error: 'Converse mode requires "messages" array' } };
    }
    apiMessages = [
      { role: 'system', content: SYSTEM_PROMPTS.converse },
      ...messages
    ];
  }

  // ── 调用 DeepSeek API ──────────────────────────────────

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        temperature: mode === 'diary' ? 0.7 : mode === 'correct' ? 0.3 : 0.8,
        max_tokens: mode === 'diary' ? 800 : 500,
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      return {
        status: response.status,
        body: { error: `DeepSeek API error (${response.status}): ${errText}` }
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // ── 解析返回 ──────────────────────────────────────────

    if (mode === 'correct' || mode === 'diary') {
      // 尝试从可能包含 markdown fences 的内容中提取 JSON
      let jsonStr = content.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }
      // 尝试找到第一个 { 和最后一个 }
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }

      try {
        const parsed = JSON.parse(jsonStr);
        return { status: 200, body: parsed };
      } catch {
        // JSON 解析失败，返回原始内容
        console.error('Failed to parse JSON from AI response:', content);
        return {
          status: 200,
          body: {
            mode,
            raw: content,
            error: 'Failed to parse structured response'
          }
        };
      }
    }

    // converse 模式直接返回文本
    return {
      status: 200,
      body: {
        mode: 'converse',
        reply: content
      }
    };

  } catch (err: any) {
    console.error('Serverless function error:', err);
    return {
      status: 500,
      body: { error: `Internal server error: ${err?.message || 'unknown'}` }
    };
  }
}
