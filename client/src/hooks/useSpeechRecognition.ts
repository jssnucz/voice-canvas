import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean, confidence: number) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = 'zh-CN',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      onError?.('您的浏览器不支持语音识别。请使用 Chrome 或 Edge 浏览器。');
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
        onResult?.(finalTranscript, true, avgConfidence);
      } else if (interim) {
        onResult?.(interim, false, 1);
      }
    };

    recognition.onerror = (event: any) => {
      const errorMsg = event.error === 'no-speech'
        ? '未检测到语音'
        : event.error === 'audio-capture'
        ? '无法访问麦克风'
        : event.error === 'not-allowed'
        ? '麦克风权限被拒绝'
        : `语音识别错误: ${event.error}`;
      onError?.(errorMsg);
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

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      onError?.('语音识别不可用');
      return;
    }
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        onError?.(`启动语音识别失败: ${err.message}`);
      }
    }
  }, [onError]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    start,
    stop,
  };
}
