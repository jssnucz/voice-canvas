import type { FastifyPluginAsync } from 'fastify';
import type { MultimodalRequest, LLMResponse } from '@shared/types';
import { callMultimodalLLM, callLLM, selectModel, MODEL_CHAT, MODEL_LITE } from '../services/llm.js';
import { SYSTEM_PROMPT } from '../prompts/system.js';
import { DIAGRAM_TYPE_PROMPTS } from '../prompts/diagramTypes.js';
import { LLMResponseSchema } from '../validators/command.js';
import { generateCanvasSummary } from '../utils/canvasSummary.js';

export const multimodalRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Body: MultimodalRequest }>('/multimodal', async (request, reply) => {
    const { utterance, imageBase64, diagramState } = request.body;

    const canvasSummary = generateCanvasSummary(diagramState);
    const diagramPrompt = DIAGRAM_TYPE_PROMPTS[diagramState.mode] || '';

    const visualInstruction = `
## 多模态视觉定位
用户发送了当前画布截图。请仔细观察图片，结合元素列表，找到用户指代的具体元素。
- 比较元素在图片中的位置、颜色、形状与用户描述
- 返回匹配到的 element id
- 无法确定时设 action: "query" 询问用户确认
`;

    const systemPrompt = SYSTEM_PROMPT + '\n' + diagramPrompt + '\n' + visualInstruction;
    const userMessage = `## 画布元素列表\n${canvasSummary}\n\n## 用户指令（含模糊指代，需视觉定位）\n${utterance}\n\n请根据截图视觉定位，输出 JSON。`;

    let lastError: Error | null = null;

    // Try multimodal first
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawResponse = await callMultimodalLLM({
          model: MODEL_CHAT,
          systemPrompt,
          userMessage,
          imageBase64,
          temperature: 0.2,
          maxTokens: 4096,
        });

        const parsed = JSON.parse(rawResponse);
        const validated = LLMResponseSchema.parse(parsed);

        return reply.send({
          commands: validated.commands,
          voiceReply: validated.voiceReply ?? undefined,
        });
      } catch (err: any) {
        lastError = err;
        // Only retry on network/API errors, not on JSON parse or Zod validation failures
        if (err instanceof SyntaxError || err.name === 'ZodError') {
          server.log.warn(`LLM response validation failed, not retrying: ${err.message}`);
          break;
        }
        server.log.warn(`Multimodal LLM attempt ${attempt + 1} failed: ${err.message}`);
      }
    }

    // Fallback: try text-only resolution
    server.log.warn('Multimodal failed, falling back to text-only');
    try {
      const rawResponse = await callLLM({
        model: MODEL_LITE,
        systemPrompt: SYSTEM_PROMPT + '\n' + diagramPrompt,
        userMessage: `## 画布元素\n${canvasSummary}\n\n## 用户指令\n${utterance}\n\n视觉定位失败，请根据文本上下文匹配最佳元素。输出 JSON。`,
        temperature: 0.3,
        maxTokens: 4096,
      });

      const parsed = JSON.parse(rawResponse);
      const validated = LLMResponseSchema.parse(parsed);

      return reply.send({
        commands: validated.commands,
        voiceReply: validated.voiceReply || '视觉定位失败，已根据文本上下文推测。',
      });
    } catch (err: any) {
      return reply.status(422).send({
        error: '视觉定位和文本消解均失败，请换个方式描述',
        detail: err.message,
      });
    }
  });
};
