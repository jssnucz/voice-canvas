import { z } from 'zod';

const VoiceAliasesSchema = z.object({
  auto: z.array(z.string()),
  manual: z.array(z.string()),
});

const ElementStyleSchema = z.object({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
});

const ElementPayloadSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    'rounded-rect', 'rect', 'diamond', 'cylinder',
    'ellipse', 'actor', 'queue', 'cache', 'gateway',
    'lifeline', 'sticky-note',
  ]).optional(),
  label: z.string().optional(),
  voiceAliases: VoiceAliasesSchema.optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  size: z.object({ width: z.number(), height: z.number() }).optional(),
  style: ElementStyleSchema.optional(),
  metadata: z.any().optional(),
});

const EdgePayloadSchema = z.object({
  type: z.enum(['solid', 'dashed']).optional(),
  label: z.string().optional(),
  id: z.string().optional(),
  style: z.object({
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
  }).optional(),
  source: z.string().optional(),
  target: z.string().optional(),
});

const DeltaCommandSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'move', 'connect', 'query']),
  targets: z.array(z.string()).default([]),
  payload: z.object({
    elements: z.array(ElementPayloadSchema).optional(),
    edges: z.array(EdgePayloadSchema).optional(),
    layout: z.enum(['vertical', 'horizontal', 'grid']).optional(),
  }).optional(),
  reasoning: z.string().optional(),
});

export const LLMResponseSchema = z.object({
  commands: z.array(DeltaCommandSchema),
  voiceReply: z.string().nullable().optional(),
});

export type ValidatedLLMResponse = z.infer<typeof LLMResponseSchema>;
