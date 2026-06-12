import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface GatewayData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function GatewayNode({ data, selected }: NodeProps<GatewayData>) {
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
      {/* Router icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" className="mb-1">
        <circle cx="8" cy="3" r="2" fill={style.stroke} />
        <line x1="3" y1="13" x2="8" y2="7" stroke={style.stroke} strokeWidth="1.5" />
        <line x1="13" y1="13" x2="8" y2="7" stroke={style.stroke} strokeWidth="1.5" />
        <line x1="8" y1="7" x2="8" y2="3" stroke={style.stroke} strokeWidth="1.5" />
        <rect x="2" y="12" width="12" height="3" rx="1" fill={style.stroke} />
      </svg>
      <span
        style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, color: '#1F2937' }}
      >
        {label || 'API网关'}
      </span>
      <Handle type="target" position={Position.Left} id="left" className="!bg-gray-500" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-500" />
    </div>
  );
}

export default memo(GatewayNode);
