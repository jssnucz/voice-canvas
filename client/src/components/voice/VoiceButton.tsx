import { useVoiceCommand } from '../../hooks/useVoiceCommand';

export function VoiceButton() {
  const { isListening, start, stop } = useVoiceCommand();

  return (
    <button
      onClick={isListening ? stop : start}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        isListening
          ? 'bg-red-600 hover:bg-red-700 animate-pulse'
          : 'bg-blue-600 hover:bg-blue-700'
      }`}
      title={isListening ? '点击停止' : '点击开始语音'}
    >
      {isListening ? '🔴 停止' : '🎤 开始语音'}
    </button>
  );
}
