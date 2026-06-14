import { useState } from 'react';
import { useVoiceCommand } from '../../hooks/useVoiceCommand';
import { requestMicrophonePermission } from '../../hooks/useSpeechRecognition';

export function VoiceButton() {
  const { isListening, micPermission, start, stop } = useVoiceCommand();
  const [fixing, setFixing] = useState(false);

  const handleFixPermission = async () => {
    setFixing(true);
    const result = await requestMicrophonePermission();
    setFixing(false);
    if (result.ok) {
      // Refresh the page so the permission state resets
      window.location.reload();
    } else {
      alert(result.error + '\n\n' + result.fixHint);
    }
  };

  // Browser unsupported
  if (micPermission === 'unsupported') {
    return (
      <button disabled className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-400 cursor-not-allowed">
        🚫 浏览器不支持
      </button>
    );
  }

  // Permission denied — show fix button
  if (micPermission === 'denied') {
    return (
      <button
        onClick={handleFixPermission}
        disabled={fixing}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-700 transition-all"
        title="点击后请在浏览器弹窗中允许麦克风权限，然后手动刷新页面"
      >
        {fixing ? '⏳ 请允许权限...' : '🔒 麦克风已禁用 (点击修复)'}
      </button>
    );
  }

  // Normal state
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
