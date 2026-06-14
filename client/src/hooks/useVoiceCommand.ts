import { useCallback, useEffect, useRef } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { useSpeechRecognition } from './useSpeechRecognition';
import { classifyIntent, splitUtterance, type ClassifiedIntent } from '../services/intentClassifier';
import { apiClient } from '../services/api';
import { buildDiagramState } from '../services/stateSerializer';
import { cleanUtterance, isUtteranceNoise } from '../services/utteranceCleaner';
import { makeConnectCommand } from '@shared/types';
import type { LLMResponse, CanvasElement } from '@shared/types';

// Layer 3a: volume + confidence joint noise gate thresholds
const NOISE_GATE_VOLUME_LOW = 20;   // RMS < 20% → likely not speech
const NOISE_GATE_CONFIDENCE_LOW = 0.5; // confidence < 0.5 → likely noise
const NOISE_GATE_VOLUME_VERY_LOW = 10; // RMS < 10% → almost certainly noise

export function useVoiceCommand() {
  const store = useDiagramStore();
  const pendingExportRef = useRef(false);

  // Call useSpeechRecognition FIRST so audioLevelRef/noiseStateRef are available
  // when handleFinalResult (defined below) references them via closure.
  // Use a ref to wire the onResult callback since handleFinalResult is defined after this call.
  const onResultRef = useRef<(transcript: string, isFinal: boolean, confidence: number) => void>(undefined);
  const { isListening, micPermission, audioLevel, noiseState, noiseLevel, audioLevelRef, noiseStateRef, start, stop } = useSpeechRecognition({
    lang: 'zh-CN',
    continuous: true,
    interimResults: true,
    onResult: (...args) => onResultRef.current?.(...args),
    onError: (err) => store.setError(err),
  });

  // Push audio state via useEffect. Uses the stable Zustand setState (not the
  // per-render `store` object whose reference changes on every update).
  useEffect(() => {
    useDiagramStore.setState({
      audioState: { level: audioLevel, state: noiseState, noiseLevel },
    });
  }, [audioLevel, noiseState, noiseLevel]);

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

      // ── Layer 3a: Volume + Confidence Joint Noise Gate ──
      const currentLevel = audioLevelRef.current;
      const isNoise = isUtteranceNoise(transcript);

      // Rule A: Low volume + low confidence → almost certainly noise
      if (currentLevel < NOISE_GATE_VOLUME_LOW && confidence < NOISE_GATE_CONFIDENCE_LOW) {
        console.log('[noise-gate] blocked: low volume + low confidence',
          { level: currentLevel, confidence });
        return;
      }

      // Rule B: Very low volume + noise text pattern → discard
      if (currentLevel < NOISE_GATE_VOLUME_VERY_LOW && isNoise) {
        console.log('[noise-gate] blocked: very low volume + noise text',
          { level: currentLevel, transcript: transcript.slice(0, 30) });
        return;
      }

      // Safety: high confidence always passes (regardless of volume)
      // Safety: high volume (≥20) always passes (regardless of confidence)
      // These are implicit — they fall through to the code below.

      // Clean voice-to-text noise: filler words, stutters, repetitions
      const cleaned = cleanUtterance(transcript);
      if (!cleaned) return; // everything was noise after cleaning

      // Pending export confirmation — check BEFORE any other command processing
      if (pendingExportRef.current) {
        pendingExportRef.current = false;
        if (/^(确认|好的|是|确定|可以|行|好|嗯|对)$/.test(cleaned.trim())) {
          import('../services/exportImage').then(({ exportToPNG }) => {
            exportToPNG().catch((err) => store.setError(`导出失败: ${err.message}`));
          });
        }
        // If not confirmed, just cancel silently and continue processing
        return;
      }

      // Voice-triggered mode switching
      if (/切换.*流程图|流程图模式/.test(cleaned)) {
        store.setMode('flowchart');
        return;
      }
      if (/切换.*架构图|架构图模式/.test(cleaned)) {
        store.setMode('architecture');
        return;
      }
      if (/切换.*时序图|时序图模式/.test(cleaned)) {
        store.setMode('sequence');
        return;
      }
      // Voice-triggered export — request confirmation
      if (/导出|保存.*图片|下载.*图/.test(cleaned)) {
        pendingExportRef.current = true;
        import('../services/speechSynthesis').then(({ speak }) => {
          speak('确认导出图片吗？');
        });
        return;
      }

      store.setTranscript(transcript); // show raw to user

      // ---- Multi-command splitting (US-08) ----
      const parts = splitUtterance(cleaned);
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
          const fallbackIntent = classifyIntent(cleaned, simHasSelected, simHasLastMentioned);
          const pipeline = fallbackIntent.type === 'remote-generate'
            ? 'generate' : fallbackIntent.type === 'remote-query'
            ? 'query' : 'text';
          executeRemoteCommand(cleaned, pipeline);
          return;
        }

        // All local — execute sequentially, re-classifying each command
        // with fresh store state to ensure context (selectedId, lastMentionedId)
        // reflects changes from previously executed commands (Bug 5 fix).
        for (const part of parts) {
          const currentState = useDiagramStore.getState();
          const freshIntent = classifyIntent(part, !!currentState.selectedId, !!currentState.lastMentionedId);
          if (freshIntent.type === 'local') {
            dispatchLocalIntent(freshIntent, part);
          }
        }

        store.setPhase('executing');
        setTimeout(() => store.setPhase('idle'), 500);
        return;
      }

      const state = useDiagramStore.getState();
      const hasSelectedTarget = !!state.selectedId;
      const intent = classifyIntent(cleaned, hasSelectedTarget, !!state.lastMentionedId);

      if (intent.type === 'local') {
        dispatchLocalIntent(intent, cleaned);
      } else {
        const pipeline = intent.type === 'remote-visual'
          ? 'visual'
          : intent.type === 'remote-generate'
          ? 'generate'
          : intent.type === 'remote-query'
          ? 'query'
          : 'text';
        executeRemoteCommand(cleaned, pipeline);
      }
    },
    [executeRemoteCommand, store]
  );

  // Wire handleFinalResult to speech recognition (hook called above, before this callback existed)
  onResultRef.current = handleFinalResult;

  return { isListening, micPermission, audioLevel, noiseState, start, stop };
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
    case 'connect': {
      // Bug 3 fix: three silent-failure scenarios addressed:
      // 1. No primary target → try finding both from utterance
      // 2. No other target → speak error feedback
      // 3. Self-match → exclude primary's names from search, pick different element

      const primaryId = state.selectedId || state.lastMentionedId;

      // Build a filtered utterance that excludes the primary element's names
      // to prevent findElementByUtterance from matching the primary itself.
      let filteredUtterance = utterance;
      if (primaryId) {
        const primaryEl = state.elements[primaryId];
        if (primaryEl) {
          const names = [primaryEl.label, ...primaryEl.voiceAliases.auto, ...primaryEl.voiceAliases.manual]
            .filter(Boolean);
          for (const name of names) {
            filteredUtterance = filteredUtterance.replace(name, '');
          }
        }
      }

      const otherTarget = findElementByUtterance(filteredUtterance, state.elements);

      if (primaryId && otherTarget && primaryId !== otherTarget) {
        const connectCmd = makeConnectCommand(primaryId, otherTarget, { type: 'solid' });
        state.applyCommands([connectCmd], utterance);
      } else if (!primaryId && !otherTarget) {
        // No reference point at all — need user to select or name an element
        import('../services/speechSynthesis').then(({ speak }) => {
          speak('请先选中一个节点，或说出要连线的两个节点名称');
        });
      } else if (!otherTarget) {
        import('../services/speechSynthesis').then(({ speak }) => {
          speak('未找到要连接的目标节点，请再说一次');
        });
      }
      // If primaryId === otherTarget (self-match), silently skip
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
