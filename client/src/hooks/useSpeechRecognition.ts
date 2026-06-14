import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean, confidence: number) => void;
  onError?: (error: string) => void;
  onPermissionChange?: (state: 'prompt' | 'granted' | 'denied' | 'unsupported') => void;
}

/**
 * Prime microphone permission via getUserMedia before starting speech recognition.
 * Returns 'granted' if successful, or an error string if denied/unsupported.
 */
export async function requestMicrophonePermission(): Promise<
  { ok: true } | { ok: false; error: string; fixHint: string }
> {
  // Check if the browser supports getUserMedia
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      error: '浏览器不支持麦克风访问',
      fixHint: '请使用 Chrome 或 Edge 浏览器，并确保通过 HTTPS 或 localhost 访问',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop all tracks immediately — we only needed permission, not the actual stream
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
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
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

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
        // permissions.query may not be supported for microphone
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
        onResultRef.current?.(finalTranscript, true, avgConfidence);
      } else if (interim) {
        onResultRef.current?.(interim, false, 1);
      }
    };

    recognition.onerror = (event: any) => {
      // Map common Web Speech API errors to user-friendly messages with fix hints
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

    recognition.onend = () => {
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

    // Prime microphone permission via getUserMedia first
    // This triggers the browser's permission dialog BEFORE we start recognition
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
    }

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
    setIsListening(false);
  }, []);

  return {
    isListening,
    micPermission,
    start,
    stop,
  };
}
