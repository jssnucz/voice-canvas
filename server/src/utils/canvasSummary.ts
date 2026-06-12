import type { CommandRequest } from '@shared/types';

export function generateCanvasSummary(state: CommandRequest['diagramState']): string {
  const { mode, elements, edges, selectedId, lastMentionedId } = state;

  let summary = `当前图表类型: ${mode}\n`;
  summary += `画布元素 (${elements.length}个):\n`;

  for (const el of elements) {
    const aliases = el.voiceAliases.auto.join(', ');
    const selected = el.id === selectedId ? ' [已选中]' : '';
    const mentioned = el.id === lastMentionedId ? ' [最近提及]' : '';
    summary += `  - ${el.id}: ${el.type} "${el.label}" @ (${el.position.x}, ${el.position.y})${selected}${mentioned}`;
    if (aliases) summary += `  别名: ${aliases}`;
    summary += '\n';
  }

  summary += `连线 (${edges.length}条):\n`;
  for (const edge of edges) {
    summary += `  - ${edge.id}: ${edge.source} → ${edge.target} [${edge.type}]${edge.label ? ` "${edge.label}"` : ''}\n`;
  }

  return summary;
}
