import { useDiagramStore } from '../../store/diagramStore';
import type { DiagramMode } from '@shared/types';

const MODES: Array<{ mode: DiagramMode; label: string; icon: string }> = [
  { mode: 'flowchart', label: '流程图', icon: '🔄' },
  { mode: 'architecture', label: '架构图', icon: '🏗️' },
  { mode: 'sequence', label: '时序图', icon: '📊' },
];

export function ModeSwitcher() {
  const currentMode = useDiagramStore((s) => s.mode);
  const setMode = useDiagramStore((s) => s.setMode);

  return (
    <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1 text-sm">
      {MODES.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => setMode(mode)}
          className={`px-3 py-1 rounded-md transition-colors ${
            currentMode === mode
              ? 'bg-blue-600 text-white'
              : 'hover:bg-gray-600 text-gray-300'
          }`}
        >
          {icon} {label}
        </button>
      ))}
    </div>
  );
}
