import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface DiamondData {
  label: string;
  style: {
    fill: string;
    stroke: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
  };
}

function DiamondNode({ data, selected }: NodeProps<DiamondData>) {
  const { label, style } = data;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 80 }}>
      <svg width="140" height="80" className="absolute inset-0">
        <polygon
          points="70,0 140,40 70,80 0,40"
          fill={style.fill}
          stroke={selected ? '#60A5FA' : style.stroke}
          strokeWidth={selected ? 3 : 2}
        />
      </svg>
      <span
        className="relative z-10 text-center px-4"
        style={{ fontSize: style.fontSize, fontWeight: style.fontWeight, color: '#1F2937' }}
      >
        {label || '判断'}
      </span>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-500" />
      <Handle type="source" position={Position.Left} id="left" className="!bg-gray-500" />
    </div>
  );
}

export default memo(DiamondNode);
