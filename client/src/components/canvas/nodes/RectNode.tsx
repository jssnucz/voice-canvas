import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface RectData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function RectNode({ data, selected }: NodeProps<RectData>) {
  const { label, style } = data;
  return (
    <div
      className={`border-2 px-4 py-3 min-w-[140px] text-center ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
      }`}
      style={{
        backgroundColor: style.fill,
        borderColor: style.stroke,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: '#1F2937',
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      {label || '处理'}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(RectNode);
