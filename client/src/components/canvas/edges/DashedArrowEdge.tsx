import { memo, useMemo } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from 'reactflow';

export default memo(function DashedArrowEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, style } = props;
  const [edgePath] = useMemo(
    () => getSmoothStepPath({ sourceX, sourceY, targetX, targetY }),
    [sourceX, sourceY, targetX, targetY]
  );

  return <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ stroke: '#1a1a1a', strokeWidth: 2, strokeDasharray: '8 4', ...style }} />;
});
