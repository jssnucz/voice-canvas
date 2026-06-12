import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface CylinderData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function CylinderNode({ data, selected }: NodeProps<CylinderData>) {
  const { label, style } = data;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 80 }}>
      <svg width="140" height="80" className="absolute inset-0">
        <ellipse cx="70" cy="12" rx="70" ry="12" fill={style.fill} stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={selected ? 3 : 2} />
        <rect x="0" y="12" width="140" height="56" fill={style.fill} stroke="none" />
        <line x1="0" y1="12" x2="0" y2="68" stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={selected ? 3 : 2} />
        <line x1="140" y1="12" x2="140" y2="68" stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={selected ? 3 : 2} />
        <ellipse cx="70" cy="68" rx="70" ry="12" fill={style.fill} stroke={selected ? '#60A5FA' : style.stroke} strokeWidth={selected ? 3 : 2} />
        <ellipse cx="70" cy="12" rx="70" ry="12" fill="none" stroke={style.stroke} strokeWidth={1} strokeDasharray="4 2" opacity="0.5" />
      </svg>
      <span
        className="relative z-10 text-center px-4"
        style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, color: '#1F2937', marginTop: 10 }}
      >
        {label || '数据库'}
      </span>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export default memo(CylinderNode);
