import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface CacheData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function CacheNode({ data, selected }: NodeProps<CacheData>) {
  const { label, style } = data;
  const strokeColor = selected ? '#60A5FA' : style.stroke;
  return (
    <div
      className={`relative flex flex-col items-center justify-center border-2 border-dashed px-4 py-3 min-w-[120px] ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
      }`}
      style={{
        backgroundColor: style.fill,
        borderColor: strokeColor,
      }}
    >
      {/* Lightning bolt icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" className="mb-1">
        <path
          d="M8.5 0L2 9h4.5L6 16l8-10H9.5L10 0H8.5z"
          fill={style.stroke}
        />
      </svg>
      <span
        style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, color: '#1F2937' }}
      >
        {label || '缓存'}
      </span>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(CacheNode);
