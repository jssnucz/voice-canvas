import Fastify from 'fastify';
import cors from '@fastify/cors';
import { commandRoutes } from './routes/command.js';

const server = Fastify({ logger: true });

await server.register(cors, { origin: true });

server.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

await server.register(commandRoutes, { prefix: '/api' });

try {
  await server.listen({ port: 3001, host: '0.0.0.0' });
  console.log('Server running on http://localhost:3001');
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
