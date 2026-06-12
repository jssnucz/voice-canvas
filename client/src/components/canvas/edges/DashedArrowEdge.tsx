import { BaseEdge, getSmoothStepPath, type EdgeProps } from 'reactflow';

export default function DashedArrowEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, markerEnd, style } = props;
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY });

  return <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ stroke: '#94A3B8', strokeWidth: 2, strokeDasharray: '8 4', ...style }} />;
}
