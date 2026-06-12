import RoundedRectNode from './RoundedRectNode';
import RectNode from './RectNode';
import DiamondNode from './DiamondNode';
import CylinderNode from './CylinderNode';
import ActorNode from './ActorNode';
import QueueNode from './QueueNode';
import CacheNode from './CacheNode';
import GatewayNode from './GatewayNode';

export const nodeTypes = {
  'rounded-rect': RoundedRectNode,
  'rect': RectNode,
  'diamond': DiamondNode,
  'cylinder': CylinderNode,
  'actor': ActorNode,
  'queue': QueueNode,
  'cache': CacheNode,
  'gateway': GatewayNode,
};
