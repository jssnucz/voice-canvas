import type { VoicePhase } from '@shared/types';

export function VoiceOverlay({ phase }: { phase: VoicePhase }) {
  if (phase === 'idle') return null;
  return (
    <div className="voice-overlay absolute inset-0 flex items-center justify-center">
      <div className="bg-gray-800/90 rounded-lg px-6 py-3 text-sm">
        {phase === 'listening' && '正在聆听...'}
        {phase === 'thinking-text' && '正在理解...'}
        {phase === 'thinking-visual' && '正在分析画面...'}
        {phase === 'executing' && '执行中...'}
      </div>
    </div>
  );
}
