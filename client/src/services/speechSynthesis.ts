export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}
