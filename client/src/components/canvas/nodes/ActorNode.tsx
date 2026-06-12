import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface ActorData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function ActorNode({ data, selected }: NodeProps<ActorData>) {
  const { label, style } = data;
  const strokeColor = selected ? '#60A5FA' : style.stroke;
  const strokeW = selected ? 3 : 2;
  return (
    <div
      className="relative flex flex-col items-center justify-start pt-2"
      style={{ width: 60, height: 100 }}
    >
      {/* Stick figure: circle head + body lines */}
      <svg width="60" height="70" className="absolute top-0 left-0">
        {/* Head */}
        <circle cx="30" cy="12" r="10" fill={style.fill} stroke={strokeColor} strokeWidth={strokeW} />
        {/* Body */}
        <line x1="30" y1="22" x2="30" y2="50" stroke={strokeColor} strokeWidth={strokeW} />
        {/* Arms */}
        <line x1="10" y1="35" x2="50" y2="35" stroke={strokeColor} strokeWidth={strokeW} />
        {/* Left leg */}
        <line x1="30" y1="50" x2="12" y2="68" stroke={strokeColor} strokeWidth={strokeW} />
        {/* Right leg */}
        <line x1="30" y1="50" x2="48" y2="68" stroke={strokeColor} strokeWidth={strokeW} />
      </svg>
      <span
        className="absolute bottom-0 text-center w-full"
        style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, color: '#1F2937' }}
      >
        {label || '参与者'}
      </span>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(ActorNode);
