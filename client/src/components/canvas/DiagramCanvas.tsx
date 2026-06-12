import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagramStore } from '../../store/diagramStore';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import type { CanvasElement, CanvasEdge } from '@shared/types';

function elementToReactFlowNode(el: CanvasElement): Node {
  return {
    id: el.id,
    type: el.type as string,
    position: el.position,
    width: el.size.width,
    height: el.size.height,
    data: {
      label: el.label,
      style: el.style,
    },
    selected: false,
  };
}

function canvasEdgeToReactFlowEdge(edge: CanvasEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type === 'dashed' ? 'dashed' : 'solid',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
    label: edge.label,
  };
}

export function DiagramCanvas() {
  const elements = useDiagramStore((s) => s.elements);
  const edges = useDiagramStore((s) => s.edges);
  const setSelected = useDiagramStore((s) => s.setSelected);
  const moveElement = useDiagramStore((s) => s.moveElement);
  const phase = useDiagramStore((s) => s.phase);

  const rfNodes: Node[] = useMemo(
    () => Object.values(elements).map(elementToReactFlowNode),
    [elements]
  );

  const rfEdges: Edge[] = useMemo(
    () => edges.map(canvasEdgeToReactFlowEdge),
    [edges]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'select') {
          setSelected(change.selected ? change.id : null);
        }
      }
    },
    [setSelected]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      moveElement(node.id, node.position.x, node.position.y);
    },
    [moveElement]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelected(node.id);
    },
    [setSelected]
  );

  const onPaneClick = useCallback(() => {
    setSelected(null);
  }, [setSelected]);

  const isVisualProcessing = phase === 'thinking-visual';

  return (
    <div
      className={`w-full h-full transition-all duration-300 ${
        isVisualProcessing ? 'opacity-70 grayscale-[30%]' : ''
      }`}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'solid',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
        }}
      >
        <Background color="#374151" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-700 !fill-gray-400" />
        <MiniMap
          style={{ background: '#1F2937' }}
          maskColor="rgba(0,0,0,0.5)"
          nodeColor={(n) => {
            const el = elements[n.id];
            return el?.style.fill || '#374151';
          }}
        />
      </ReactFlow>
    </div>
  );
}
