import type { VoicePhase } from '@shared/types';

export function VoiceOverlay({ phase }: { phase: VoicePhase }) {
  if (phase === 'idle') return null;

  return (
    <div className="voice-overlay absolute inset-0 flex items-center justify-center z-20">
      {phase === 'listening' && (
        <div className="bg-blue-900/80 text-blue-200 px-6 py-3 rounded-xl text-lg animate-pulse-breath">
          🎤 正在聆听...
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
