import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioLevelMonitor, type NoiseState, type NoiseLevel } from '../services/audioLevelMonitor';

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean, confidence: number) => void;
  onError?: (error: string) => void;
  onPermissionChange?: (state: 'prompt' | 'granted' | 'denied' | 'unsupported') => void;
  /** Called when sustained silence detected (may trigger auto-restart internally) */
  onSilence?: (durationMs: number) => void;
  /** Called when noise gate blocks a result (volume+confidence too low) */
  onNoiseBlocked?: () => void;
}

/**
 * Prime microphone permission via getUserMedia before starting speech recognition.
 * Enables noise suppression, echo cancellation, and auto gain control (Chrome/Edge).
 * Returns the MediaStream so callers can attach an AudioLevelMonitor.
 */
export async function requestMicrophonePermission(): Promise<
  { ok: true; stream: MediaStream } | { ok: false; error: string; fixHint: string }
> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      error: '浏览器不支持麦克风访问',
      fixHint: '请使用 Chrome 或 Edge 浏览器，并确保通过 HTTPS 或 localhost 访问',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: true,      // Layer 1: browser-native noise reduction
        echoCancellation: true,      // Layer 1: acoustic echo cancellation
        autoGainControl: true,       // Layer 1: automatic gain control
      },
    });
    return { ok: true, stream };
  } catch (err: any) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return {
        ok: false,
        error: '麦克风权限被拒绝',
        fixHint: '请点击浏览器地址栏左侧的锁图标，开启麦克风权限后刷新页面',
      };
    }
    if (err.name === 'NotFoundError') {
      return {
        ok: false,
        error: '未检测到麦克风设备',
        fixHint: '请插入麦克风或检查系统音频设备设置',
      };
    }
    if (err.name === 'NotReadableError') {
      return {
        ok: false,
        error: '麦克风被其他应用占用',
        fixHint: '请关闭其他正在使用麦克风的应用（如会议软件）后重试',
      };
    }
    return {
      ok: false,
      error: `麦克风访问失败: ${err.message}`,
      fixHint: '请检查系统麦克风设置',
    };
  }
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = 'zh-CN',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
    onPermissionChange,
    onSilence,
    onNoiseBlocked,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  // audioLevel/noiseState/noiseLevel kept in refs (updated at 10Hz by AudioMonitor).
  // React state for these is only updated on *transitions* to avoid per-sample re-renders
  // that make the page unresponsive. Consumers needing per-sample data read the refs.
  const audioLevelRef = useRef(0);
  const noiseStateRef = useRef<NoiseState>('silence');
  const noiseLevelRef = useRef<NoiseLevel>('low');
  const [displayNoiseState, setDisplayNoiseState] = useState<NoiseState>('silence');
  const [displayNoiseLevel, setDisplayNoiseLevel] = useState<NoiseLevel>('low');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const monitorRef = useRef<AudioLevelMonitor | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const onSilenceRef = useRef(onSilence);
  const onNoiseBlockedRef = useRef(onNoiseBlocked);
  onResultRef.current = onResult;
  onErrorRef.current = onError;
  onSilenceRef.current = onSilence;
  onNoiseBlockedRef.current = onNoiseBlocked;

  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
      monitorRef.current?.destroy();
      monitorRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Check initial permission state
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((status) => {
        setMicPermission(status.state as typeof micPermission);
        onPermissionChange?.(status.state as typeof micPermission);
        status.addEventListener('change', () => {
          setMicPermission(status.state as typeof micPermission);
          onPermissionChange?.(status.state as typeof micPermission);
        });
      }).catch(() => {
        setMicPermission('prompt');
      });
    }
  }, [onPermissionChange]);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setMicPermission('unsupported');
      onPermissionChange?.('unsupported');
      onErrorRef.current?.('您的浏览器不支持语音识别。请使用 Chrome 或 Edge 浏览器。');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';
      let confidence = 0;
      let resultCount = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
          confidence += result[0].confidence;
          resultCount++;
        } else {
          interim += result[0].transcript;
        }
      }

      const avgConfidence = resultCount > 0 ? confidence / resultCount : 1;

      if (finalTranscript) {
        // Pass raw result — noise gate is in useVoiceCommand.handleFinalResult
        onResultRef.current?.(finalTranscript, true, avgConfidence);
      } else if (interim) {
        onResultRef.current?.(interim, false, 1);
      }
    };

    recognition.onerror = (event: any) => {
      const errorMap: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝 — 请点击地址栏左侧的锁图标，开启麦克风权限后刷新页面',
        'audio-capture': '无法访问麦克风 — 请检查麦克风是否已连接，或被其他应用占用',
        'no-speech': '未检测到语音 — 请对着麦克风说话，或检查麦克风是否静音',
        'network': '网络语音识别服务不可用 — 请检查网络连接',
        'aborted': '语音识别已中止',
        'language-not-supported': '不支持的语言设置',
        'service-not-allowed': '语音识别服务被禁用 — 请使用 HTTPS 或 localhost 访问',
      };
      const errorMsg = errorMap[event.error] || `语音识别错误: ${event.error}`;
      onErrorRef.current?.(errorMsg);

      if (event.error === 'not-allowed') {
        setMicPermission('denied');
        onPermissionChange?.('denied');
      }
      setIsListening(false);
    };

    // Layer 3b: Silence auto-restart — when Web Speech API stops due to prolonged silence,
    // automatically restart recognition so the user doesn't have to manually re-enable.
    recognition.onend = () => {
      const monitor = monitorRef.current;
      const stream = streamRef.current;
      // Only auto-restart if we still have an active stream and were listening
      if (monitor?.isAvailable && stream?.active && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          return; // Successfully restarted — don't update isListening
        } catch {
          // If restart fails (e.g. already started), just fall through to setListening(false)
        }
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [lang, continuous, interimResults]);

  const start = useCallback(async () => {
    if (!recognitionRef.current) {
      onErrorRef.current?.('语音识别不可用 — 请使用 Chrome 或 Edge 浏览器');
      return;
    }

    // Acquire microphone stream (with noise suppression constraints)
    if (micPermission !== 'granted') {
      const result = await requestMicrophonePermission();
      if (!result.ok) {
        onErrorRef.current?.(`${result.error}。${result.fixHint}`);
        setMicPermission('denied');
        onPermissionChange?.('denied');
        return;
      }
      setMicPermission('granted');
      onPermissionChange?.('granted');

      // Keep stream alive for AudioLevelMonitor (was previously stopped immediately)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = result.stream;
    }

    // Ensure we have an active stream (re-acquire if previous was stopped)
    if (!streamRef.current || !streamRef.current.active) {
      const result = await requestMicrophonePermission();
      if (!result.ok) {
        onErrorRef.current?.(`${result.error}。${result.fixHint}`);
        return;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = result.stream;
    }

    // Create or recreate AudioLevelMonitor
    if (monitorRef.current) {
      monitorRef.current.destroy();
    }
    monitorRef.current = new AudioLevelMonitor(streamRef.current, {
      onLevel: (level, state) => {
        // Always update refs (noise gate needs per-sample data, no re-render)
        audioLevelRef.current = level;
        // Only update React state on transitions — avoids 10Hz re-renders
        if (state !== noiseStateRef.current) {
          noiseStateRef.current = state;
          setDisplayNoiseState(state);
        }
      },
      onSilence: (durationMs) => {
        onSilenceRef.current?.(durationMs);
        // Layer 3b: sustained silence → auto-restart recognition
        if (durationMs >= 5000 && recognitionRef.current) {
          try {
            recognitionRef.current.stop();
            recognitionRef.current.start();
          } catch {
            // Ignore restart errors
          }
        }
      },
      onNoiseLevelChange: (level) => {
        if (level !== noiseLevelRef.current) {
          noiseLevelRef.current = level;
          setDisplayNoiseLevel(level);
        }
      },
    });
    monitorRef.current.start();

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        onErrorRef.current?.(`启动语音识别失败: ${err.message}`);
      }
    }
  }, [micPermission, onError, onPermissionChange]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    monitorRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    micPermission,
    // Display values (React state, only updated on transitions — safe for rendering)
    audioLevel: audioLevelRef.current,
    noiseState: displayNoiseState,
    noiseLevel: displayNoiseLevel,
    // Refs for consumers that need per-sample data without re-renders (noise gate)
    audioLevelRef,
    noiseStateRef,
    start,
    stop,
  };
}
