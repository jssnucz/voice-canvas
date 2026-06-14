/**
 * Clean voice-to-text output before sending to intent classifier / LLM.
 * Removes filler words, normalizes punctuation, collapses repetition.
 */
export function cleanUtterance(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // 1. Strip sentence-starting filler words (loop: handle chained fillers like "嗯 啊 那个")
  const leadingFillerRe = /^(嗯+|啊+|额+|诶+|呃+|哦+|那个|这个|就是|然后|我想|我要|帮我|请|麻烦)\s*/;
  let prev = '';
  while (text !== prev) {
    prev = text;
    text = text.replace(leadingFillerRe, '');
  }

  // 2. Strip standalone filler words (between spaces, or at start/end)
  const fillers = ['嗯', '啊', '额', '诶', '呃', '哦', '那个', '这个', '就是', '然后'];
  for (const w of fillers) {
    text = text.replace(new RegExp(`(^|\\s)${w}(\\s|$)`, 'g'), '$1$2');
  }
  // Collapse double spaces from removed fillers
  text = text.replace(/\s{2,}/g, ' ').trim();

  // 3. Collapse repeated same-word stutters: "画画画一个矩形" → "画一个矩形"
  text = text.replace(/(\S)\1{2,}/g, '$1');

  // 4. Collapse repeated short segments: "画一个 画一个矩形" → "画一个矩形"
  text = text.replace(/(.{2,6})\s+\1/g, '$1');

  // 5. Normalize Chinese punctuation to Chinese commas
  text = text.replace(/[,，]{2,}/g, '，');
  text = text.replace(/[;；]{2,}/g, '；');
  text = text.replace(/[!！]{2,}/g, '！');
  text = text.replace(/[.。]{2,}/g, '。');
  text = text.replace(/\s{2,}/g, ' ');

  // 6. Strip trailing filler repetitions
  text = text.replace(/([，,]\s*)+$/, '');

  return text.trim();
}
