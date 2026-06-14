import type { FastifyPluginAsync } from 'fastify';
import type { CommandRequest, LLMResponse } from '@shared/types';
import { callLLM, selectModel } from '../services/llm.js';
import { SYSTEM_PROMPT } from '../prompts/system.js';
import { DIAGRAM_TYPE_PROMPTS } from '../prompts/diagramTypes.js';
import { LLMResponseSchema } from '../validators/command.js';
import { generateCanvasSummary } from '../utils/canvasSummary.js';

export const commandRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Body: CommandRequest & { intent?: string } }>('/command', async (request, reply) => {
    const { utterance, diagramState, intent = 'text' } = request.body;

    const canvasSummary = generateCanvasSummary(diagramState);
    const diagramPrompt = DIAGRAM_TYPE_PROMPTS[diagramState.mode] || '';

    const queryInstruction = intent === 'query' ? `
## 查询模式
用户正在查询画布状态。请：
1. 分析画布元素和连线
2. 用 voiceReply 中文口语回答
3. 不返回操作指令（commands 为空数组）
` : '';

    const systemPrompt = SYSTEM_PROMPT + '\n' + diagramPrompt + '\n' + queryInstruction;
    let userMessage = `## 当前画布状态\n${canvasSummary}\n\n## 用户指令\n${utterance}\n\n请输出 JSON 操作指令。`;

    const model = selectModel(intent as 'text' | 'visual' | 'generate' | 'query');

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawResponse = await callLLM({
          model,
          systemPrompt,
          userMessage,
          temperature: 0.3,
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
        // On JSON parse or Zod validation failure, retry with error feedback
        if (err instanceof SyntaxError || err.name === 'ZodError') {
          if (attempt === 0) {
            server.log.warn(`LLM response invalid, retrying with error: ${err.message}`);
            userMessage = `${userMessage}\n\n## 上次返回格式错误\n${err.message}\n请修正 JSON 格式，确保符合规范。`;
            continue;
          }
          server.log.warn(`LLM response validation failed twice: ${err.message}`);
          break;
        }
        server.log.warn(`LLM attempt ${attempt + 1} failed: ${err.message}`);
      }
    }

    server.log.error(`LLM command failed: ${lastError?.message}`);
    return reply.status(422).send({
      error: '指令解析失败，请换个方式描述',
      detail: lastError?.message,
    });
  });
};
