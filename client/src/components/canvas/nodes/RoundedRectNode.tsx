import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface RoundedRectData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function RoundedRectNode({ data, selected }: NodeProps<RoundedRectData>) {
  const { label, style } = data;
  return (
    <div
      className={`rounded-xl border-2 px-4 py-3 min-w-[120px] text-center transition-shadow ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-white' : ''
      }`}
      style={{
        backgroundColor: style.fill,
        borderColor: style.stroke,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: '#1F2937',
        width: 160,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      {label || '开始/结束'}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(RoundedRectNode);
