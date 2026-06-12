import dagre from 'dagre';
import type { CanvasElement, CanvasEdge } from '@shared/types';

export function layoutFlowchart(
  elements: CanvasElement[],
  edges: CanvasEdge[]
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100, marginx: 40, marginy: 40 });

  for (const el of elements) {
    g.setNode(el.id, { width: el.size.width, height: el.size.height });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const el of elements) {
    const node = g.node(el.id);
    if (node) {
      positions.set(el.id, {
        x: node.x - el.size.width / 2,
        y: node.y - el.size.height / 2,
      });
    }
  }

  return positions;
}
