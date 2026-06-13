import OpenAI from 'openai';

const apiKey = process.env.DEEPSEEK_API_KEY || '';
const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

const client = new OpenAI({ apiKey, baseURL });

// Validate API key is set
if (!apiKey) {
  console.warn('[LLM] DEEPSEEK_API_KEY not set. LLM calls will fail with 401.');
}

export interface LLMCallOptions {
  model: string;  // Allow configurable model names via env vars (default: deepseek-v4-pro / deepseek-v4-flash)
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
}

export async function callLLM(options: LLMCallOptions): Promise<string> {
  const { model, systemPrompt, userMessage, temperature = 0.3, maxTokens = 4096, responseFormat = 'json_object' } = options;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return content;
}

export interface MultimodalLLMOptions {
  model: string;  // Allow configurable model names via env vars
  systemPrompt: string;
  userMessage: string;
  imageBase64: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callMultimodalLLM(options: MultimodalLLMOptions): Promise<string> {
  const { model, systemPrompt, userMessage, imageBase64, temperature = 0.2, maxTokens = 4096 } = options;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ],
      },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return content;
}

// Model name constants — configurable via environment variables
export const MODEL_CHAT = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-v4-pro';     // Complex reasoning + vision
export const MODEL_LITE = process.env.DEEPSEEK_LITE_MODEL || 'deepseek-v4-flash';   // Fast simple responses

export function selectModel(intent: 'text' | 'visual' | 'generate' | 'query'): LLMCallOptions['model'] {
  switch (intent) {
    case 'visual':
    case 'generate':
      return MODEL_CHAT;
    case 'text':
    case 'query':
    default:
      return MODEL_LITE;
  }
}
