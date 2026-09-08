/**
 * 英语发音工具
 *
 * 双通道策略：
 * 1. 首选：浏览器原生 speechSynthesis（离线、即时，但国产设备经常静默失败）
 * 2. 兜底：有道词典发音接口（国内直连、免密钥、单词短语均可）
 *    系统语音失败/不支持时自动切换，用户无感知
 *
 * 原生通道的兼容处理：
 * - voices 异步加载：首次 getVoices() 常为空，voiceschanged 后重选
 * - cancel 后同 tick 的 speak 在部分浏览器会被吞 → 延迟一拍
 * - Chrome 偶发 paused 状态 → speak 后补一次 resume()
 * - onstart 超时检测静默失败 → 切换到在线兜底
 */

let cachedEnVoice: SpeechSynthesisVoice | null = null;
let voicesHooked = false;
let currentAudio: HTMLAudioElement | null = null;

/** 是否支持语音合成 */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function hookVoices() {
  if (voicesHooked || !isSpeechSupported()) return;
  voicesHooked = true;
  // Android：voices 列表在 voiceschanged 触发后才可用
  window.speechSynthesis.onvoiceschanged = () => {
    cachedEnVoice = null;
  };
}

/** 挑选英语音色：优先美音引擎，退而求其次任意英文 */
function pickEnVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  if (cachedEnVoice) return cachedEnVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  cachedEnVoice =
    voices.find(v => v.lang === 'en-US' && /google|samsung|nuance/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang === 'en_GB') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null;
  return cachedEnVoice;
}

/** 在线兜底：有道词典发音（type=2 美音），国内直连无需配置 */
function playViaYoudao(text: string, onFail: () => void): void {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.play().catch(() => {
      if (currentAudio === audio) {
        currentAudio = null;
        onFail();
      }
    });
  } catch {
    onFail();
  }
}

/**
 * 朗读英文文本（自动选择可用通道）
 * @param onError 仅在两条通道都失败时回调
 */
export function speakEnglish(
  text: string,
  rate = 0.9,
  onError?: (message: string) => void
): void {
  // 停掉上一次的在线音频
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // 不支持原生语音 → 直接走在线
  if (!isSpeechSupported()) {
    playViaYoudao(text, () => onError?.('发音失败，请检查网络'));
    return;
  }

  hookVoices();
  const synth = window.speechSynthesis;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = rate;
  utter.volume = 1;

  const voice = pickEnVoice();
  if (voice) utter.voice = voice;

  let started = false;
  let handled = false; // 是否已触发兜底/报错

  /** 切换到在线兜底（并终止原生朗读） */
  const fallback = (failMsg: string) => {
    if (handled) return;
    handled = true;
    try { synth.cancel(); } catch { /* ignore */ }
    playViaYoudao(text, () => onError?.(failMsg));
  };

  utter.onstart = () => { started = true; };
  utter.onerror = (ev: SpeechSynthesisErrorEvent) => {
    if (started) return; // 已经播过了，忽略收尾错误
    const fatal = ['synthesis-failed', 'language-unavailable', 'voice-unavailable', 'not-allowed'];
    if (fatal.includes(ev.error)) {
      fallback('设备缺少英语语音包且网络发音失败，请检查网络');
    }
    // 其他错误（interrupted/canceled 等）静默忽略
  };

  const doSpeak = () => {
    try {
      synth.speak(utter);
      synth.resume(); // Chrome 偶发 paused
    } catch {
      fallback('发音失败，请检查网络');
    }
  };

  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(doSpeak, 80);
  } else {
    doSpeak();
  }

  // 静默失败兜底：1.2 秒内没开始朗读 → 原生通道哑了，切在线
  setTimeout(() => {
    if (!started && !handled) {
      fallback('设备缺少英语语音包且网络发音失败，请检查网络和媒体音量');
    }
  }, 1200);
}
