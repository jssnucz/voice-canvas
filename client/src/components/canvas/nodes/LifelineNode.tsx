import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export interface LifelineData {
  label: string;
  style: { fill: string; stroke: string; fontSize: number; fontWeight: 'normal' | 'bold' };
}

function LifelineNode({ data, selected }: NodeProps<LifelineData>) {
  const { label, style } = data;
  return (
    <div className="flex flex-col items-center" style={{ width: 120 }}>
      <div
        className={`border-2 px-3 py-1 text-center text-xs ${
          selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-white' : ''
        }`}
        style={{
          backgroundColor: style.fill === 'transparent' ? '#374151' : style.fill,
          borderColor: style.stroke,
          fontSize: style.fontSize,
          color: '#D1D5DB',
        }}
      >
        {label || '生命线'}
      </div>
      <div
        className="w-0 border-l-2 border-dashed"
        style={{ height: 380, borderColor: style.stroke }}
      />
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
    </div>
  );
}

export default memo(LifelineNode);
