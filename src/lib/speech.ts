/**
 * 英语发音工具（Web Speech API，浏览器原生，零依赖）
 *
 * 针对移动端的兼容处理：
 * 1. voices 异步加载：首次 getVoices() 常为空列表，需 voiceschanged 后重选
 * 2. 无英语语音包：国产设备常见，speak() 静默失败 → onstart 超时检测并回调告知
 * 3. 连续点击：cancel 后同 tick 的 speak 在部分浏览器会被吞 → 延迟一拍
 * 4. Chrome 偶发 paused 状态 → speak 后补一次 resume()
 */

let cachedEnVoice: SpeechSynthesisVoice | null = null;
let voicesHooked = false;

/** 是否支持语音合成（按钮显隐用） */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function hookVoices() {
  if (voicesHooked || !isSpeechSupported()) return;
  voicesHooked = true;
  // Android：voices 列表在 voiceschanged 触发后才可用
  window.speechSynthesis.onvoiceschanged = () => {
    cachedEnVoice = null; // 清缓存，下次重新挑
  };
}

/** 挑选英语音色：优先美音高质量引擎，退而求其次任意英文 */
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

/**
 * 朗读英文文本
 * @param onError 失败回调（静默失败兜底 + onerror），用于向用户提示原因
 */
export function speakEnglish(
  text: string,
  rate = 0.9,
  onError?: (message: string) => void
): void {
  if (!isSpeechSupported()) {
    onError?.('此浏览器不支持语音朗读');
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

  // 生命周期跟踪（用于静默失败检测）
  let started = false;
  let ended = false;
  utter.onstart = () => { started = true; };
  utter.onend = () => { ended = true; };
  utter.onerror = (ev: SpeechSynthesisErrorEvent) => {
    ended = true;
    if (ev.error === 'not-allowed') {
      onError?.('浏览器禁止了语音播放，请检查浏览器权限');
    } else if (['synthesis-failed', 'language-unavailable', 'voice-unavailable'].includes(ev.error)) {
      onError?.('设备缺少英语语音包：系统设置 → 辅助功能 → 文字转语音，安装/切换英语引擎');
    } else {
      onError?.('发音失败，请检查媒体音量');
    }
  };

  const doSpeak = () => {
    try {
      synth.speak(utter);
      synth.resume(); // Chrome 偶发 paused 状态
    } catch {
      onError?.('发音失败，请重试');
    }
  };

  if (synth.speaking || synth.pending) {
    // 正在朗读：cancel 后同 tick speak 会被吞，延迟一拍
    synth.cancel();
    setTimeout(doSpeak, 80);
  } else {
    doSpeak();
  }

  // 静默失败兜底：1 秒内既没开始也没报错 → 大概率无可用 TTS 引擎
  setTimeout(() => {
    if (!started && !ended) {
      try { synth.cancel(); } catch { /* ignore */ }
      onError?.('无法朗读：设备可能缺少英语语音包（系统设置 → 文字转语音），或媒体音量被静音');
    }
  }, 1000);
}
