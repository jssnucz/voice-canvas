import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface QueueData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function QueueNode({ data, selected }: NodeProps<QueueData>) {
  const { label, style } = data;
  const strokeColor = selected ? '#60A5FA' : style.stroke;
  return (
    <div
      className={`relative flex flex-col items-center justify-center border-2 px-4 py-3 min-w-[140px] ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
      }`}
      style={{
        backgroundColor: style.fill,
        borderColor: strokeColor,
      }}
    >
      {/* Three horizontal bars icon */}
      <div className="flex flex-col items-center gap-[3px] mb-1">
        <div className="h-[3px] w-6 rounded" style={{ backgroundColor: style.stroke }} />
        <div className="h-[3px] w-6 rounded" style={{ backgroundColor: style.stroke }} />
        <div className="h-[3px] w-6 rounded" style={{ backgroundColor: style.stroke }} />
      </div>
      <span
        style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, color: '#1F2937' }}
      >
        {label || '消息队列'}
      </span>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(QueueNode);
