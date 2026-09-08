/**
 * 英语发音工具（Web Speech API，浏览器原生，零依赖）
 */

let cachedEnVoice: SpeechSynthesisVoice | null = null;
let voicesHooked = false;

/** 是否支持语音合成 */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** voices 异步加载：加载完成后清缓存，下次调用重新选最优英文音色 */
function hookVoicesChanged() {
  if (voicesHooked || !isSpeechSupported()) return;
  voicesHooked = true;
  window.speechSynthesis.onvoiceschanged = () => {
    cachedEnVoice = null;
  };
}

/** 朗读英文文本 */
export function speakEnglish(text: string, rate = 0.9): void {
  if (!isSpeechSupported()) return;
  hookVoicesChanged();

  const synth = window.speechSynthesis;
  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = rate;

  // 选英文音色（优先美音，其次任意英文）
  if (!cachedEnVoice) {
    const voices = synth.getVoices();
    cachedEnVoice =
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en-US')) ||
      voices.find(v => v.lang.startsWith('en')) ||
      null;
  }
  if (cachedEnVoice) utter.voice = cachedEnVoice;

  synth.speak(utter);
}
