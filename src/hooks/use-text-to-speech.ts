"use client";

/**
 * Text-to-Speech Hook
 *
 * Provides a hook for converting text to speech using the Chatterbox TTS API.
 *
 * Features:
 * - Multiple models (Turbo, Multilingual, Original)
 * - Voice cloning from audio reference
 * - 23+ languages support
 * - Paralinguistic tags ([laugh], [cough], etc.)
 */

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/store/auth-store";
import { API_BASE_URL } from "@/lib/config";

export interface TTSOptions {
  /** TTS model to use */
  model?: "chatterbox-turbo" | "chatterbox-multilingual" | "chatterbox";
  /** Language code for multilingual model */
  language?: string;
  /** URL to audio file for voice cloning */
  voiceReferenceUrl?: string;
  /** Exaggeration level (0.0-2.0) for creative control */
  exaggeration?: number;
  /** CFG weight (0.0-1.0) for creative control */
  cfgWeight?: number;
}

export interface TTSResult {
  /** URL to generated audio (if using API) */
  audioUrl?: string;
  /** Base64 encoded audio data */
  audioBase64?: string;
  /** Audio duration in seconds */
  duration?: number;
  /** Audio format */
  format: string;
  /** Model used */
  model: string;
  /** Language used */
  language: string;
}

export interface UseTextToSpeechReturn {
  /** Generate speech from text */
  generateSpeech: (text: string, options?: TTSOptions) => Promise<TTSResult | null>;
  /** Whether TTS is currently generating */
  isGenerating: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Clear the error */
  clearError: () => void;
  /** Last generated audio result */
  lastResult: TTSResult | null;
}

const DEFAULT_OPTIONS: TTSOptions = {
  model: "chatterbox-turbo",
  language: "en",
  exaggeration: 1.0,
  cfgWeight: 0.5,
};

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TTSResult | null>(null);
  const { toast } = useToast();
  const { apiKey } = useAuthStore();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const generateSpeech = useCallback(
    async (text: string, options: TTSOptions = {}): Promise<TTSResult | null> => {
      if (!text.trim()) {
        setError("Text cannot be empty");
        return null;
      }

      if (text.length > 5000) {
        setError("Text too long (max 5000 characters)");
        return null;
      }

      setIsGenerating(true);
      setError(null);

      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      try {
        const response = await fetch(`${API_BASE_URL}/v1/tools/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            name: "text_to_speech",
            parameters: {
              text,
              model: mergedOptions.model,
              language: mergedOptions.language,
              voice_reference_url: mergedOptions.voiceReferenceUrl,
              exaggeration: mergedOptions.exaggeration,
              cfg_weight: mergedOptions.cfgWeight,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "TTS generation failed");
        }

        const result: TTSResult = {
          audioUrl: data.result?.audio_url,
          audioBase64: data.result?.audio_base64,
          duration: data.result?.duration,
          format: data.result?.format || "wav",
          model: data.result?.model || mergedOptions.model || "chatterbox-turbo",
          language: data.result?.language || mergedOptions.language || "en",
        };

        setLastResult(result);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to generate speech";
        setError(errorMessage);
        toast({
          title: "TTS Error",
          description: errorMessage,
          variant: "destructive",
        });
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [apiKey, toast]
  );

  return {
    generateSpeech,
    isGenerating,
    error,
    clearError,
    lastResult,
  };
}

export default useTextToSpeech;
