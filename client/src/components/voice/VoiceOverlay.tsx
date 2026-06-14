import type { VoicePhase } from '@shared/types';
import { useDiagramStore } from '../../store/diagramStore';

/** Color for the volume bar segment based on noise state */
function levelColor(state: string): string {
  switch (state) {
    case 'speech': return 'bg-green-400';
    case 'noise':  return 'bg-yellow-400';
    default:       return 'bg-gray-500';
  }
}

function stateLabel(state: string): string {
  switch (state) {
    case 'speech':  return '检测到语音';
    case 'noise':   return '环境噪声';
    default:        return '静音中';
  }
}

export function VoiceOverlay({ phase }: { phase: VoicePhase }) {
  // Precise selectors: only this component re-renders on audioState changes (~10Hz)
  const audioLevel = useDiagramStore((s) => s.audioState.level);
  const noiseState = useDiagramStore((s) => s.audioState.state);
  const noiseLevel = useDiagramStore((s) => s.audioState.noiseLevel);

  if (phase === 'idle') return null;

  return (
    <div className="voice-overlay absolute inset-0 flex items-center justify-center z-20">
      {phase === 'listening' && (
        <div className="bg-blue-900/80 text-blue-200 px-6 py-3 rounded-xl animate-pulse-breath flex items-center gap-4">
          {/* ── Layer 4: Real-time volume indicator ── */}
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col justify-end w-3 h-10 bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className={`w-full rounded-full transition-all duration-150 ${levelColor(noiseState)}`}
                style={{ height: `${Math.min(100, audioLevel)}%` }}
              />
            </div>
            <div className="text-xs leading-tight">
              <div className="text-gray-300">{stateLabel(noiseState)}</div>
              {noiseLevel === 'high' && (
                <div className="text-yellow-300 animate-pulse">
                  ⚠️ 环境噪音较大
                </div>
              )}
            </div>
          </div>
          <span>🎤 正在聆听...</span>
        </div>
      )}
      {phase === 'thinking-text' && (
        <div className="bg-gray-800/90 text-gray-300 px-6 py-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span>正在理解指令...</span>
          </div>
          <div className="mt-2 w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '60%' }} />
          </div>
        </div>
      )}
      {phase === 'thinking-visual' && (
        <div className="bg-purple-900/80 text-purple-200 px-6 py-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span>🔍 正在分析画面...</span>
          </div>
          <div className="mt-2 text-xs text-purple-300">视觉定位中，请稍候</div>
        </div>
      )}
      {phase === 'executing' && (
        <div className="bg-green-900/80 text-green-200 px-6 py-3 rounded-xl animate-pop-in">
          ✅ 完成
        </div>
      )}
    </div>
  );
}
