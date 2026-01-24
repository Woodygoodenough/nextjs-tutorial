"use client";

import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

function mwAudioUrlFromBaseFilename(audio: string): string {
  const a = audio.trim();
  const lower = a.toLowerCase();

  // MW audio subdirectory rules:
  // - starts with "bix" -> "bix"
  // - starts with "gg" -> "gg"
  // - starts with a number or punctuation -> "number"
  // - else: first letter
  const subdir =
    lower.startsWith('bix')
      ? 'bix'
      : lower.startsWith('gg')
        ? 'gg'
        : /^[^a-z]/i.test(a)
          ? 'number'
          : lower[0];

  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${a}.mp3`;
}

export function PronunciationButton(props: {
  soundAudio: string | null;
  className?: string;
  size?: 'icon' | 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default' | 'secondary' | 'destructive' | 'link';
  ariaLabel?: string;
}) {
  const { soundAudio, className, size = 'icon', variant = 'ghost', ariaLabel = 'Pronounce' } = props;
  const disabled = !soundAudio;

  const url = useMemo(() => (soundAudio ? mwAudioUrlFromBaseFilename(soundAudio) : null), [soundAudio]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Button
      variant={variant}
      size={size}
      className={className ?? "h-7 w-7 shrink-0"}
      aria-label={ariaLabel}
      disabled={disabled || isLoading}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!url) return;

        try {
          setIsLoading(true);
          // Stop any previous audio for this component instance.
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          const audio = new Audio(url);
          audioRef.current = audio;
          await audio.play();
        } finally {
          setIsLoading(false);
        }
      }}
      type="button"
    >
      <Volume2 className={disabled ? "h-4 w-4 opacity-30" : "h-4 w-4"} />
    </Button>
  );
}
