/**
 * Clean voice-to-text output before sending to intent classifier / LLM.
 * Removes filler words, normalizes punctuation, collapses repetition.
 *
 * Layer 3c: Also provides noise-text detection for the volume+confidence
 * joint gate. Filler removal and noise discard are separate concerns:
 *   - cleanUtterance: removes fillers, preserves meaning
 *   - isUtteranceNoise: identifies text that should be discarded entirely
 */

// ── Noise text patterns (entire utterance should be discarded) ──

/** Single character repeated 3+ times — e.g. "哦哦哦", "嗯嗯嗯" */
const REPEATED_SINGLE_CHAR = /^(.)\1{2,}$/;

/** Pure digits, spaces, or punctuation — no meaningful content */
const PURE_SYMBOLS = /^[\d\s.,;:!！？?。，、；：…\-—]+$/;

/** Standalone noise words — discarded ONLY when the entire utterance is just this word.
 *  Conservative list: avoids words that could be part of valid commands ("喂" as wake word, etc.) */
const NOISE_WORDS = ['嗯', '啊', '额', '诶', '呃', '哦', '嗨'];

// ── Filler cleaning patterns ──

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
  // "然后" intentionally omitted — it's a semantic connector, not a filler
  const fillers = ['嗯', '啊', '额', '诶', '呃', '哦', '那个', '这个', '就是'];
  for (const w of fillers) {
    text = text.replace(new RegExp(`(^|\\s)${w}(\\s|$)`, 'g'), '$1$2');
  }
  // Collapse double spaces from removed fillers
  text = text.replace(/\s{2,}/g, ' ').trim();

  // 3. Collapse CJK character stutters: "画画画一个矩形" → "画一个矩形"
  // Only target CJK chars (U+4E00–U+9FFF, U+3400–U+4DBF) to avoid compressing
  // Latin abbreviations like "AAA" or digits like "111".
  text = text.replace(/([一-鿿㐀-䶿])\1{2,}/g, '$1');

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

/**
 * Layer 3c: Check if the raw utterance looks like environmental noise
 * rather than intentional speech. Used by the volume+confidence gate.
 *
 * Returns true if the text matches known noise patterns and should be discarded.
 */
export function isUtteranceNoise(raw: string): boolean {
  const text = raw.trim();
  if (!text) return true;

  // Single repeated character (e.g. "哦哦哦", "嗯嗯嗯嗯")
  if (REPEATED_SINGLE_CHAR.test(text)) return true;

  // Pure symbols/numbers (e.g. "123", "...", "！？")
  if (PURE_SYMBOLS.test(text)) return true;

  // Very short (< 2 meaningful chars after stripping spaces)
  if (text.replace(/\s/g, '').length < 2) return true;

  // Standalone noise word (conservative — only exact matches)
  if (NOISE_WORDS.includes(text)) return true;

  return false;
}
