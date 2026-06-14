import { DiagramCanvas } from './components/canvas/DiagramCanvas';
import { VoiceOverlay } from './components/voice/VoiceOverlay';
import { VoiceButton } from './components/voice/VoiceButton';
import { TranscriptBar } from './components/voice/TranscriptBar';
import { ModeSwitcher } from './components/toolbar/ModeSwitcher';
import { DiagramHistory } from './components/toolbar/DiagramHistory';
import { useDiagramStore } from './store/diagramStore';

/** Check if the current browser supports Web Speech API and microphone access. */
function BrowserWarning() {
  const isChrome = /Chrome/i.test(navigator.userAgent);
  const isEdge = /Edg/i.test(navigator.userAgent);
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isHttps = location.protocol === 'https:';

  if ((isChrome || isEdge) && (isLocalhost || isHttps)) return null;

  return (
    <div className="bg-yellow-800/90 text-yellow-200 px-4 py-2 text-sm text-center">
      {!(isChrome || isEdge) && (
        <span>请使用 <strong>Chrome</strong> 或 <strong>Edge</strong> 浏览器。 </span>
      )}
      {!isLocalhost && !isHttps && (
        <span>请通过 <strong>localhost</strong> 或 <strong>HTTPS</strong> 访问，否则麦克风无法开启。</span>
      )}
    </div>
  );
}

export default function App() {
  const phase = useDiagramStore((s) => s.phase);
  const isListening = useDiagramStore((s) => s.phase === 'listening');

  return (
    <div className={`w-screen h-screen flex flex-col transition-all duration-500 ${isListening ? 'breathing-border' : ''}`}>
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <h1 className="text-lg font-semibold">AI 语音绘图工具</h1>
        <div className="flex items-center gap-3">
          <ModeSwitcher />
          <VoiceButton />
        </div>
      </header>
      <BrowserWarning />
      <main className="flex-1 relative">
        <DiagramHistory />
        <DiagramCanvas />
        <TranscriptBar />
        <VoiceOverlay phase={phase} />
      </main>
    </div>
  );
}
