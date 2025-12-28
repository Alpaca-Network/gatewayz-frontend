"use client";

/**
 * Audio Player Component for TTS Output
 *
 * Features:
 * - Play/pause controls
 * - Progress bar with seek
 * - Volume control
 * - Playback speed control
 * - Duration display
 * - Download option
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface AudioPlayerProps {
  /** Audio source URL or base64 data URL */
  src: string;
  /** Optional title for the audio */
  title?: string;
  /** CSS class name */
  className?: string;
  /** Callback when audio starts playing */
  onPlay?: () => void;
  /** Callback when audio pauses */
  onPause?: () => void;
  /** Callback when audio ends */
  onEnded?: () => void;
  /** Auto-play the audio on mount */
  autoPlay?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function AudioPlayer({
  src,
  title,
  className,
  onPlay,
  onPause,
  onEnded,
  autoPlay = false,
  compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      onPause?.();
    } else {
      audio.play().catch((err) => {
        console.error("Failed to play audio:", err);
        setError("Failed to play audio");
      });
      onPlay?.();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, onPlay, onPause]);

  // Handle seeking
  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  }, []);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const newMuted = !isMuted;
    audio.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  // Handle playback rate change
  const cyclePlaybackRate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    audio.playbackRate = newRate;
    setPlaybackRate(newRate);
  }, [playbackRate]);

  // Restart from beginning
  const restart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audio.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Download audio
  const downloadAudio = useCallback(() => {
    const link = document.createElement("a");
    link.href = src;
    link.download = title ? `${title}.wav` : "audio.wav";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [src, title]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleError = () => {
      setError("Failed to load audio");
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      if (autoPlay) {
        audio.play().catch(console.error);
        setIsPlaying(true);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [autoPlay, onEnded]);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm",
          className
        )}
      >
        <span>{error}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-full bg-muted",
          className
        )}
      >
        <audio ref={audioRef} src={src} preload="metadata" />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={togglePlay}
          disabled={isLoading}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        <span className="text-xs text-muted-foreground min-w-[3rem]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 rounded-lg bg-muted border",
        className
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Title */}
      {title && (
        <div className="text-sm font-medium text-foreground">{title}</div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground min-w-[2.5rem]">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
          disabled={isLoading}
        />
        <span className="text-xs text-muted-foreground min-w-[2.5rem]">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Restart */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={restart}
            title="Restart"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          {/* Play/Pause */}
          <Button
            size="icon"
            variant="default"
            className="h-10 w-10"
            onClick={togglePlay}
            disabled={isLoading}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          {/* Playback speed */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={cyclePlaybackRate}
            title="Playback speed"
          >
            {playbackRate}x
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Volume */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            min={0}
            max={1}
            step={0.1}
            onValueChange={handleVolumeChange}
            className="w-20"
          />

          {/* Download */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={downloadAudio}
            title="Download audio"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AudioPlayer;
