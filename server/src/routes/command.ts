import type { FastifyPluginAsync } from 'fastify';
import type { CommandRequest, LLMResponse } from '@shared/types';

export const commandRoutes: FastifyPluginAsync = async (server) => {
  server.post<{ Body: CommandRequest }>('/command', async (request) => {
    const { utterance, diagramState } = request.body;

    const response: LLMResponse = {
      commands: [],
      voiceReply: `收到指令: "${utterance}"，画布上有 ${diagramState.elements.length} 个元素`,
    };

    return response;
  });
};
