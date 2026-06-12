import { useCallback, useRef } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { useSpeechRecognition } from './useSpeechRecognition';
import { classifyIntent } from '../services/intentClassifier';
import { apiClient } from '../services/api';
import { generateId } from '../utils/id';
import type { DeltaCommand, LLMResponse, CanvasElement } from '@shared/types';

export function useVoiceCommand() {
  const store = useDiagramStore();

  const executeLocalCommands = useCallback(
    (commands: DeltaCommand[], utterance: string) => {
      store.applyCommands(commands, utterance);
    },
    [store]
  );

  const executeRemoteCommand = useCallback(
    async (utterance: string, pipeline: 'text' | 'visual' | 'generate' | 'query') => {
      const state = useDiagramStore.getState();
      store.setPhase(pipeline === 'visual' ? 'thinking-visual' : 'thinking-text');

      try {
        let response: LLMResponse;

        if (pipeline === 'visual') {
          const { captureCanvas } = await import('../services/canvasSnapshot');
          const imageBase64 = await captureCanvas();
          response = await apiClient.multimodalCommand({
            utterance,
            imageBase64,
            diagramState: buildDiagramState(state),
          });
        } else {
          response = await apiClient.textCommand({
            utterance,
            diagramState: buildDiagramState(state),
          });
        }

        // Execute returned commands with history recording
        if (response.commands && response.commands.length > 0) {
          store.applyCommands(response.commands, utterance);
        }

        // Handle voice reply from AI
        if (response.voiceReply) {
          const { speak } = await import('../services/speechSynthesis');
          speak(response.voiceReply);
        }

        store.setPhase('executing');
        setTimeout(() => store.setPhase('idle'), 500);
      } catch (err: any) {
        store.setError(`指令执行失败: ${err.message}`);
        store.setPhase('idle');
      }
    },
    [store]
  );

  const handleFinalResult = useCallback(
    (transcript: string, _isFinal: boolean, confidence: number) => {
      if (!_isFinal) {
        store.setInterimTranscript(transcript);
        return;
      }

      store.setInterimTranscript(''); // Clear interim on final

      // Voice-triggered mode switching
      if (/切换.*流程图|流程图模式/.test(transcript)) {
        store.setMode('flowchart');
        return;
      }
      if (/切换.*架构图|架构图模式/.test(transcript)) {
        store.setMode('architecture');
        return;
      }
      if (/切换.*时序图|时序图模式/.test(transcript)) {
        store.setMode('sequence');
        return;
      }

      if (confidence < 0.3) {
        store.setError('语音识别置信度过低，请重新说一遍');
        return;
      }

      const state = useDiagramStore.getState();
      const hasTarget = !!(state.selectedId || state.lastMentionedId);
      const intent = classifyIntent(transcript, hasTarget, !!state.lastMentionedId);

      store.setTranscript(transcript);

      if (intent.type === 'local') {
        // Handle special local actions (no DeltaCommands from classifier)
        if (!intent.commands || intent.commands.length === 0) {
          if (intent.reason.includes('撤销')) { state.undo(); return; }
          if (intent.reason.includes('重做')) { state.redo(); return; }
          if (intent.reason.includes('清空')) { state.clearAll(); return; }
          if (intent.reason.includes('选择')) {
            const match = findElementByUtterance(transcript, state.elements);
            if (match) state.setSelected(match);
            return;
          }
          if (intent.reason.includes('缩放') || intent.reason.includes('视图')) {
            return; // Handled by React Flow controls
          }
          return;
        }
        // Commands present — execute them
        executeLocalCommands(intent.commands, transcript);
      } else {
        const pipeline = intent.type === 'remote-visual'
          ? 'visual'
          : intent.type === 'remote-generate'
          ? 'generate'
          : intent.type === 'remote-query'
          ? 'query'
          : 'text';
        executeRemoteCommand(transcript, pipeline);
      }
    },
    [executeLocalCommands, executeRemoteCommand, store]
  );

  const { isListening, start, stop } = useSpeechRecognition({
    lang: 'zh-CN',
    continuous: true,
    interimResults: true,
    onResult: handleFinalResult,
    onError: (err) => store.setError(err),
  });

  return { isListening, start, stop };
}

// Helper: build diagram state summary for API
function buildDiagramState(state: ReturnType<typeof useDiagramStore.getState>) {
  return {
    mode: state.mode,
    elements: Object.values(state.elements).map((el) => ({
      id: el.id,
      type: el.type,
      label: el.label,
      voiceAliases: el.voiceAliases,
      position: el.position,
      size: el.size,
      style: el.style,
    })),
    edges: state.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label,
      style: e.style,
    })),
    selectedId: state.selectedId,
    lastMentionedId: state.lastMentionedId,
  };
}

// Helper: find element matching utterance (longest match wins — avoids substring false matches)
function findElementByUtterance(utterance: string, elements: Record<string, CanvasElement>): string | null {
  let bestMatch: { id: string; length: number } | null = null;

  for (const el of Object.values(elements)) {
    // Check label
    if (el.label && utterance.includes(el.label)) {
      if (!bestMatch || el.label.length > bestMatch.length) {
        bestMatch = { id: el.id, length: el.label.length };
      }
    }
    // Check voice aliases
    for (const alias of el.voiceAliases.auto) {
      if (utterance.includes(alias)) {
        if (!bestMatch || alias.length > bestMatch.length) {
          bestMatch = { id: el.id, length: alias.length };
        }
      }
    }
    for (const alias of el.voiceAliases.manual) {
      if (utterance.includes(alias)) {
        if (!bestMatch || alias.length > bestMatch.length) {
          bestMatch = { id: el.id, length: alias.length };
        }
      }
    }
  }

  return bestMatch?.id ?? null;
}
