"use client";

import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';

export function PronunciationButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      aria-label="Pronounce"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // TODO: Implement pronunciation functionality
      }}
      type="button"
    >
      <Volume2 className="h-4 w-4" />
    </Button>
  );
}
