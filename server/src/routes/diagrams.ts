import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { DiagramListItem, DiagramDetail, CreateDiagramBody, UpdateDiagramBody } from '@shared/types';

const CreateBodySchema = z.object({
  name: z.string().optional(),
  mode: z.enum(['flowchart', 'architecture', 'sequence']).optional(),
  state: z.object({
    mode: z.enum(['flowchart', 'architecture', 'sequence']),
    elements: z.array(z.any()),
    edges: z.array(z.any()),
    selectedId: z.string().nullable(),
    lastMentionedId: z.string().nullable(),
  }),
});

const UpdateBodySchema = z.object({
  name: z.string().optional(),
  state: CreateBodySchema.shape.state.optional(),
});

export const diagramRoutes: FastifyPluginAsync = async (server) => {
  // List all diagrams
  server.get('/diagrams', async (request, reply) => {
    const { rows } = await request.server.db.query<DiagramListItem>(
      'SELECT id, name, mode, updated_at FROM diagrams ORDER BY updated_at DESC LIMIT 100'
    );
    return reply.send(rows);
  });

  // Get single diagram
  server.get<{ Params: { id: string } }>('/diagrams/:id', async (request, reply) => {
    const { rows } = await request.server.db.query<DiagramDetail>(
      'SELECT id, name, mode, state, created_at, updated_at FROM diagrams WHERE id = $1',
      [request.params.id]
    );
    if (rows.length === 0) {
      return reply.status(404).send({ error: '图表不存在' });
    }
    return reply.send(rows[0]);
  });

  // Create diagram
  server.post<{ Body: CreateDiagramBody }>('/diagrams', async (request, reply) => {
    const parsed = CreateBodySchema.parse(request.body);
    const { name = '未命名图表', mode = 'flowchart', state } = parsed;

    // Strip history from state before saving
    const cleanState = {
      mode: state.mode,
      elements: state.elements,
      edges: state.edges,
      selectedId: state.selectedId,
      lastMentionedId: state.lastMentionedId,
    };

    const { rows } = await request.server.db.query<DiagramDetail>(
      `INSERT INTO diagrams (name, mode, state) VALUES ($1, $2, $3)
       RETURNING id, name, mode, state, created_at, updated_at`,
      [name, mode, JSON.stringify(cleanState)]
    );
    return reply.status(201).send(rows[0]);
  });

  // Update diagram
  server.put<{ Params: { id: string }; Body: UpdateDiagramBody }>('/diagrams/:id', async (request, reply) => {
    const parsed = UpdateBodySchema.parse(request.body);
    const { id } = request.params;

    // Check exists
    const { rows: existing } = await request.server.db.query<{ id: string }>(
      'SELECT id FROM diagrams WHERE id = $1', [id]
    );
    if (existing.length === 0) {
      return reply.status(404).send({ error: '图表不存在' });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (parsed.name !== undefined) {
      sets.push(`name = $${paramIdx++}`);
      values.push(parsed.name);
    }
    if (parsed.state !== undefined) {
      const cleanState = {
        mode: parsed.state.mode,
        elements: parsed.state.elements,
        edges: parsed.state.edges,
        selectedId: parsed.state.selectedId,
        lastMentionedId: parsed.state.lastMentionedId,
      };
      sets.push(`state = $${paramIdx++}`);
      values.push(JSON.stringify(cleanState));
    }
    sets.push(`updated_at = now()`);

    values.push(id);
    const { rows } = await request.server.db.query<DiagramDetail>(
      `UPDATE diagrams SET ${sets.join(', ')} WHERE id = $${paramIdx}
       RETURNING id, name, mode, state, created_at, updated_at`,
      values
    );
    return reply.send(rows[0]);
  });

  // Delete diagram
  server.delete<{ Params: { id: string } }>('/diagrams/:id', async (request, reply) => {
    await request.server.db.query('DELETE FROM diagrams WHERE id = $1', [request.params.id]);
    return reply.status(204).send();
  });
};
