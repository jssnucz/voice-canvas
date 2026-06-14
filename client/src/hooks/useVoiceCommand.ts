import { useCallback, useRef } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { useSpeechRecognition } from './useSpeechRecognition';
import { classifyIntent, splitUtterance, type ClassifiedIntent } from '../services/intentClassifier';
import { apiClient } from '../services/api';
import { buildDiagramState } from '../services/stateSerializer';
import type { LLMResponse, CanvasElement } from '@shared/types';

export function useVoiceCommand() {
  const store = useDiagramStore();
  const pendingExportRef = useRef(false);

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
          }, pipeline);
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

      // Pending export confirmation — check BEFORE any other command processing
      if (pendingExportRef.current) {
        pendingExportRef.current = false;
        if (/^(确认|好的|是|确定|可以|行|好|嗯|对)$/.test(transcript.trim())) {
          import('../services/exportImage').then(({ exportToPNG }) => {
            exportToPNG().catch((err) => store.setError(`导出失败: ${err.message}`));
          });
        }
        // If not confirmed, just cancel silently and continue processing
        return;
      }

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
      // Voice-triggered export — request confirmation
      if (/导出|保存.*图片|下载.*图/.test(transcript)) {
        pendingExportRef.current = true;
        import('../services/speechSynthesis').then(({ speak }) => {
          speak('确认导出图片吗？');
        });
        return;
      }

      if (confidence < 0.3) {
        store.setError('语音识别置信度过低，请重新说一遍');
        return;
      }

      store.setTranscript(transcript);

      // ---- Multi-command splitting (US-08) ----
      const parts = splitUtterance(transcript);
      if (parts.length > 1) {
        store.setPhase('thinking-text');

        // Pre-flight: classify all sub-commands without executing any.
        // If any needs LLM, delegate the entire utterance — no partial state changes.
        let simHasSelected = !!useDiagramStore.getState().selectedId;
        let simHasLastMentioned = !!useDiagramStore.getState().lastMentionedId;
        const intents: ClassifiedIntent[] = [];

        for (const part of parts) {
          const intent = classifyIntent(part, simHasSelected, simHasLastMentioned);
          intents.push(intent);
          // Simulate context propagation for classification of subsequent parts
          if (intent.type === 'local') {
            if (intent.localAction === 'create' || intent.localAction === 'command') {
              // Check if this command deletes the lastMentioned / selected target
              const cmdTargets = intent.commands?.[0]?.targets;
              if (intent.commands?.[0]?.action === 'delete') {
                if (cmdTargets?.includes('lastMentioned')) simHasLastMentioned = false;
                if (cmdTargets?.includes('selected')) simHasSelected = false;
              } else {
                // create / update / connect all set lastMentionedId
                simHasLastMentioned = true;
              }
            }
            if (intent.localAction === 'select') {
              simHasSelected = true;
            }
            if (intent.localAction === 'clear') {
              simHasLastMentioned = false;
              simHasSelected = false;
            }
          }
        }

        const allLocal = intents.every(i => i.type === 'local');
        if (!allLocal) {
          // Delegate entire original utterance to LLM — no state was modified
          const fallbackIntent = classifyIntent(transcript, simHasSelected, simHasLastMentioned);
          const pipeline = fallbackIntent.type === 'remote-generate'
            ? 'generate' : fallbackIntent.type === 'remote-query'
            ? 'query' : 'text';
          executeRemoteCommand(transcript, pipeline);
          return;
        }

        // All local — execute sequentially with localAction routing
        for (const intent of intents) {
          dispatchLocalIntent(intent, intent.utterance);
        }

        store.setPhase('executing');
        setTimeout(() => store.setPhase('idle'), 500);
        return;
      }

      const state = useDiagramStore.getState();
      const hasSelectedTarget = !!state.selectedId;
      const intent = classifyIntent(transcript, hasSelectedTarget, !!state.lastMentionedId);

      if (intent.type === 'local') {
        dispatchLocalIntent(intent, transcript);
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
    [executeRemoteCommand, store]
  );

  const { isListening, micPermission, start, stop } = useSpeechRecognition({
    lang: 'zh-CN',
    continuous: true,
    interimResults: true,
    onResult: handleFinalResult,
    onError: (err) => store.setError(err),
  });

  return { isListening, micPermission, start, stop };
}

// Dispatch a single local intent using its localAction discriminator (not reason string matching).
function dispatchLocalIntent(intent: ClassifiedIntent, utterance: string): void {
  const state = useDiagramStore.getState();

  switch (intent.localAction) {
    case 'undo':
      state.undo();
      return;
    case 'redo':
      state.redo();
      return;
    case 'clear':
      state.clearAll();
      return;
    case 'select': {
      const match = findElementByUtterance(utterance, state.elements);
      if (match) state.setSelected(match);
      return;
    }
    case 'zoom-in':
    case 'zoom-out':
    case 'fit-view':
      // Handled by React Flow controls — no store mutation needed
      return;
    case 'create':
    case 'command': {
      if (intent.commands && intent.commands.length > 0) {
        state.applyCommands(intent.commands, utterance);
      }
      return;
    }
    default:
      // Unknown or undefined localAction — if commands present, execute them
      if (intent.commands && intent.commands.length > 0) {
        state.applyCommands(intent.commands, utterance);
      }
  }
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
