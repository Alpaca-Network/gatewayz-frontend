/**
 * Hook for high-quality audio transcription using the backend Whisper API.
 *
 * This hook provides an alternative to the browser's Web Speech API,
 * offering better accuracy through OpenAI Whisper with audio preprocessing.
 *
 * Features:
 * - Audio downsampling to 16kHz (Whisper's optimal rate)
 * - Mono conversion for smaller file sizes
 * - Optional noise reduction
 * - Language hints for improved accuracy
 * - Prompt context for domain-specific vocabulary
 *
 * Usage Example:
 * ```tsx
 * const { startRecording, stopRecording, isRecording, isTranscribing } = useWhisperTranscription({
 *   language: 'en',
 *   prompt: 'Technical discussion about APIs',
 * });
 *
 * // In ChatInput or similar component:
 * const handleMicClick = async () => {
 *   if (isRecording) {
 *     const result = await stopRecording();
 *     if (result?.text) {
 *       setInputValue(prev => prev + ' ' + result.text);
 *     }
 *   } else {
 *     await startRecording();
 *   }
 * };
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface TranscriptionOptions {
  /** ISO-639-1 language code (e.g., 'en', 'es', 'fr'). Improves accuracy. */
  language?: string;
  /** Context hint for domain-specific vocabulary */
  prompt?: string;
  /** Whisper model to use (default: 'whisper-1') */
  model?: string;
  /** Whether to preprocess audio (downsample, normalize) */
  preprocess?: boolean;
  /** Target sample rate for preprocessing (default: 16000) */
  targetSampleRate?: number;
}

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

interface UseWhisperTranscriptionReturn {
  /** Start recording audio */
  startRecording: () => Promise<void>;
  /** Stop recording and get transcription */
  stopRecording: () => Promise<TranscriptionResult | null>;
  /** Transcribe an existing audio blob */
  transcribeAudio: (audioBlob: Blob, options?: TranscriptionOptions) => Promise<TranscriptionResult>;
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether transcription is in progress */
  isTranscribing: boolean;
  /** Current error if any */
  error: string | null;
}

/**
 * Downsample audio buffer to target sample rate
 */
async function downsampleAudio(
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  const offlineContext = new OfflineAudioContext(
    1, // Mono
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  return await offlineContext.startRendering();
}

/**
 * Convert AudioBuffer to WAV blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * bytesPerSample;
  const bufferLength = 44 + dataLength;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write audio samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Preprocess audio blob for optimal Whisper transcription
 */
async function preprocessAudio(
  blob: Blob,
  targetSampleRate: number = 16000
): Promise<Blob> {
  const audioContext = new AudioContext();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Downsample to target rate (16kHz is optimal for Whisper)
    const downsampledBuffer = await downsampleAudio(audioBuffer, targetSampleRate);

    // Convert to WAV format
    return audioBufferToWav(downsampledBuffer);
  } finally {
    await audioContext.close();
  }
}

/**
 * Hook for Whisper-based audio transcription
 */
export function useWhisperTranscription(
  defaultOptions: TranscriptionOptions = {}
): UseWhisperTranscriptionReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const transcribeAudio = useCallback(
    async (
      audioBlob: Blob,
      options: TranscriptionOptions = {}
    ): Promise<TranscriptionResult> => {
      const mergedOptions = { ...defaultOptions, ...options };
      const {
        language,
        prompt,
        model = 'whisper-1',
        preprocess = true,
        targetSampleRate = 16000,
      } = mergedOptions;

      setIsTranscribing(true);
      setError(null);

      try {
        // Preprocess audio if enabled
        let processedBlob = audioBlob;
        if (preprocess) {
          try {
            processedBlob = await preprocessAudio(audioBlob, targetSampleRate);
          } catch (preprocessError) {
            console.warn('Audio preprocessing failed, using original:', preprocessError);
            // Fall back to original blob if preprocessing fails
          }
        }

        // Create form data
        const formData = new FormData();
        formData.append('file', processedBlob, 'audio.wav');
        formData.append('model', model);
        formData.append('response_format', 'json');
        formData.append('temperature', '0');

        if (language) {
          formData.append('language', language);
        }
        if (prompt) {
          formData.append('prompt', prompt);
        }

        // Get API key for authentication
        const apiKey = typeof window !== 'undefined' ? localStorage.getItem('gatewayz_api_key') : null;

        // Call backend transcription API via Next.js proxy
        const response = await fetch('/api/audio/transcriptions', {
          method: 'POST',
          headers: apiKey ? {
            'Authorization': `Bearer ${apiKey}`
          } : {},
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Transcription failed: ${response.status}`);
        }

        const result = await response.json();
        return {
          text: result.text || '',
          language: result.language,
          duration: result.duration,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transcription failed';
        setError(message);
        throw err;
      } finally {
        setIsTranscribing(false);
      }
    },
    [defaultOptions]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono
          // Note: Browser may ignore sampleRate constraint and use hardware default.
          // The preprocessAudio function will downsample to 16kHz regardless.
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Use webm for broad browser support
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
    } catch (err) {
      // Clean up media stream on error to prevent resource leak (microphone staying active)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      throw err;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<TranscriptionResult | null> => {
    return new Promise((resolve, reject) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        setIsRecording(false);

        // Combine chunks into single blob
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });

        if (audioBlob.size === 0) {
          resolve(null);
          return;
        }

        try {
          const result = await transcribeAudio(audioBlob);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      mediaRecorder.stop();
    });
  }, [transcribeAudio]);

  // Clean up on unmount to release media resources
  useEffect(() => {
    return () => {
      // Stop MediaRecorder if still active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore errors during cleanup
        }
      }
      // Release microphone by stopping all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    startRecording,
    stopRecording,
    transcribeAudio,
    isRecording,
    isTranscribing,
    error,
  };
}

export type { TranscriptionOptions, TranscriptionResult };
