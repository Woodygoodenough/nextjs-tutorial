import { CrosswordWord } from "@/lib/services/crossword/generator";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

type Props = {
  word: CrosswordWord;
  number: number;
  inputs: Map<string, string>;
  isSelected: boolean;
  onSelect: () => void;
  onInputChange: (x: number, y: number, char: string) => void;
  // If specific cell in word is selected, which index?
  selectedCharIndex: number | null;
  onCharSelect: (index: number) => void;
};

export function CrosswordInputStrip({
  word,
  number,
  inputs,
  isSelected,
  onSelect,
  onInputChange,
  selectedCharIndex,
  onCharSelect
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Scroll into view if selected
  useEffect(() => {
    if (isSelected && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  // Focus specific input if char selected
  useEffect(() => {
    if (isSelected && selectedCharIndex !== null && inputRefs.current[selectedCharIndex]) {
      inputRefs.current[selectedCharIndex]?.focus();
    }
  }, [isSelected, selectedCharIndex]);

  const chars = Array.from({ length: word.length }).map((_, i) => {
    const cx = word.direction === 'across' ? word.x + i : word.x;
    const cy = word.direction === 'across' ? word.y : word.y + i;
    return inputs.get(`${cx},${cy}`) || '';
  });

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace') {
      if (chars[index] === '') {
        // Move back
        if (index > 0) onCharSelect(index - 1);
      } else {
        // Clear current
        const cx = word.direction === 'across' ? word.x + index : word.x;
        const cy = word.direction === 'across' ? word.y : word.y + index;
        onInputChange(cx, cy, '');
      }
    } else if (e.key === 'ArrowRight') {
      if (index < word.length - 1) onCharSelect(index + 1);
    } else if (e.key === 'ArrowLeft') {
      if (index > 0) onCharSelect(index - 1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.slice(-1).toLowerCase(); // Take last char if multiple typed? or just strictly 1
    // Actually standard input behavior: replace content.
    if (/^[a-zA-Z]$/.test(val) || val === '') {
      const cx = word.direction === 'across' ? word.x + index : word.x;
      const cy = word.direction === 'across' ? word.y : word.y + index;
      onInputChange(cx, cy, val);
      if (val && index < word.length - 1) {
        onCharSelect(index + 1);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "p-3 rounded-lg border transition-all cursor-pointer",
        isSelected ? "border-primary bg-primary/5 shadow-md" : "border-transparent hover:bg-muted"
      )}
      onClick={() => {
        if (!isSelected) {
          onSelect();
          onCharSelect(0); // Default to first char
        }
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="font-bold text-lg min-w-[1.5rem]">{number}.</span>
        <span className="text-sm leading-tight pt-1">{word.clue}</span>
      </div>

      <div className="flex flex-wrap gap-1 ml-8">
        {chars.map((char, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el }}
            type="text"
            className={cn(
              "w-10 h-10 text-center uppercase font-bold text-sm border rounded bg-background focus:ring-2 focus:ring-primary focus:outline-none",
              isSelected ? "border-primary/50" : "border-muted-foreground/30"
            )}
            value={char}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onFocus={() => {
              if (!isSelected) onSelect();
              onCharSelect(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}
