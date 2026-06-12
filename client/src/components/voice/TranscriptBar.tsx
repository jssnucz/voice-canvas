import { useDiagramStore } from '../../store/diagramStore';

export function TranscriptBar() {
  const transcript = useDiagramStore((s) => s.transcript);
  const interimTranscript = useDiagramStore((s) => s.interimTranscript);
  const phase = useDiagramStore((s) => s.phase);
  const error = useDiagramStore((s) => s.error);

  const isListening = phase === 'listening';

  if (!isListening && !transcript && !error) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-lg w-full">
      {error && (
        <div className="bg-red-900/80 text-red-200 px-4 py-2 rounded-lg text-sm mb-2 animate-fade-in">
          ⚠️ {error}
        </div>
      )}
      {isListening && interimTranscript && (
        <div className="bg-gray-800/90 text-gray-300 px-4 py-2 rounded-lg text-sm animate-fade-in italic">
          {interimTranscript}
        </div>
      )}
      {transcript && (
        <div className="bg-blue-900/80 text-blue-200 px-4 py-2 rounded-lg text-sm animate-fade-in">
          &ldquo;{transcript}&rdquo;
        </div>
      )}
    </div>
  );
}
