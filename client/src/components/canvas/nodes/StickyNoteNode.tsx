import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface StickyData {
  label: string;
  style: { fill: string; stroke: string; fontSize: number; fontWeight: 'normal' | 'bold' };
}

function StickyNoteNode({ data, selected }: NodeProps<StickyData>) {
  const { label, style } = data;
  return (
    <div
      className={`border-2 px-3 py-2 min-w-[120px] text-xs rotate-1 transition-shadow ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
      }`}
      style={{
        backgroundColor: style.fill,
        borderColor: style.stroke,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: '#1F2937',
        boxShadow: '2px 2px 4px rgba(0,0,0,0.3)',
      }}
    >
      📌 {label || '便签'}
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(StickyNoteNode);
