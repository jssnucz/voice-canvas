import Fastify from 'fastify';
import cors from '@fastify/cors';
import { commandRoutes } from './routes/command.js';
import { multimodalRoutes } from './routes/multimodal.js';

const server = Fastify({ logger: true });

if (!process.env.DEEPSEEK_API_KEY) {
  server.log.warn('DEEPSEEK_API_KEY not set — LLM endpoints will return errors');
}

await server.register(cors, { origin: true });

server.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

await server.register(commandRoutes, { prefix: '/api' });
await server.register(multimodalRoutes, { prefix: '/api' });

try {
  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.log('Server running on http://localhost:3001');
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
