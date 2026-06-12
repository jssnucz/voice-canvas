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
      if (!_isFinal) return;

      if (confidence < 0.3) {
        store.setError('语音识别置信度过低，请重新说一遍');
        return;
      }

      const state = useDiagramStore.getState();
      const hasTarget = !!(state.selectedId || state.lastMentionedId);
      const intent = classifyIntent(transcript, hasTarget, !!state.lastMentionedId);

      store.setTranscript(transcript);

      if (intent.type === 'local') {
        // Handle special local-only actions
        if (/撤销|回退|撤回/.test(transcript)) {
          state.undo();
          return;
        }
        if (/重做|恢复|前进/.test(transcript)) {
          state.redo();
          return;
        }
        if (/清空|清除|全部删/.test(transcript)) {
          state.clearAll();
          return;
        }
        // Selection — find element by label/alias match
        if (/选中|选择|聚焦/.test(transcript)) {
          const match = findElementByUtterance(transcript, state.elements);
          if (match) {
            state.setSelected(match);
          }
          return;
        }
        // View controls
        if (/放大/.test(transcript) && !/缩小/.test(transcript) && !/放大镜/.test(transcript)) {
          // Zoom in — handled by React Flow controls for now
          return;
        }
        if (/缩小/.test(transcript)) {
          return;
        }
        if (/适应|适合|全部显示|全景/.test(transcript)) {
          return;
        }
        // Other local commands with DeltaCommands
        if (intent.commands && intent.commands.length > 0) {
          executeLocalCommands(intent.commands, transcript);
        }
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

// Helper: find element matching utterance
function findElementByUtterance(utterance: string, elements: Record<string, CanvasElement>): string | null {
  for (const el of Object.values(elements)) {
    if (el.label && utterance.includes(el.label)) return el.id;
    for (const alias of el.voiceAliases.auto) {
      if (utterance.includes(alias)) return el.id;
    }
    for (const alias of el.voiceAliases.manual) {
      if (utterance.includes(alias)) return el.id;
    }
  }
  return null;
}
