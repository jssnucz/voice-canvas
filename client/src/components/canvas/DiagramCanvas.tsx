import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnConnect,
  type Connection,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagramStore } from '../../store/diagramStore';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { generateId } from '../../utils/id';
import { makeConnectCommand } from '@shared/types';
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
    markerEnd: { type: MarkerType.ArrowClosed, color: edge.style?.stroke || '#1a1a1a' },
    label: edge.label,
    // Bug 2 fix: preserve edge style (stroke color, stroke width)
    style: edge.style ? {
      stroke: edge.style.stroke,
      strokeWidth: edge.style.strokeWidth,
    } : undefined,
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

  // Persist manually-drawn connections via applyCommands (not addEdge)
  // so they get undo/redo history support.
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const state = useDiagramStore.getState();
      // Prevent duplicate edges
      const existing = state.edges.some(
        (e) => e.source === connection.source && e.target === connection.target
      );
      if (existing) return;
      const cmd = makeConnectCommand(connection.source, connection.target, { type: 'solid' });
      state.applyCommands([cmd], '手动连线');
    },
    []
  );

  // Bug 6 fix: allow clicking edges to select them, Del/Backspace to delete
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelected(edge.id);
    },
    [setSelected]
  );

  // Keyboard shortcut: Delete / Backspace removes selected edge
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const state = useDiagramStore.getState();
        if (state.selectedId) {
          // Check if selected is an edge
          const isEdge = state.edges.some((e) => e.id === state.selectedId);
          if (isEdge) {
            state.deleteEdge(state.selectedId!);
            state.setSelected(null);
            return;
          }
          // Check if selected is an element
          const isElement = state.selectedId in state.elements;
          if (isElement) {
            state.deleteElement(state.selectedId!);
            return;
          }
        }
      }
    },
    []
  );

  const isVisualProcessing = phase === 'thinking-visual';

  return (
    <div
      className={`w-full h-full transition-all duration-300 ${
        isVisualProcessing ? 'opacity-70 grayscale-[30%]' : ''
      }`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ outline: 'none' }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'solid',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#1a1a1a' },
        }}
      >
        <Background color="#d1d5db" gap={20} />
        <Controls className="!bg-white !border-gray-300 !fill-gray-600" />
        <MiniMap
          style={{ background: '#f9fafb' }}
          maskColor="rgba(0,0,0,0.08)"
          nodeColor={(n) => {
            const el = elements[n.id];
            return el?.style.fill || '#374151';
          }}
        />
      </ReactFlow>
    </div>
  );
}
