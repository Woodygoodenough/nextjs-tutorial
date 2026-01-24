"use client";

import { useState, useEffect, useRef } from "react";
import { CrosswordGrid, Direction } from "@/lib/services/crossword/generator";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { CrosswordInputStrip } from "@/components/crossword/input-strip";

type Props = {
  puzzle: CrosswordGrid | null;
};

export function CrosswordClient({ puzzle }: Props) {
  const router = useRouter();

  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  // Track direction preference. Defaults to 'across'.
  // If user selects a cell that only belongs to a 'down' word, we auto-switch.
  const [direction, setDirection] = useState<Direction>('across');

  const [inputs, setInputs] = useState<Map<string, string>>(new Map());
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    // Reset state when puzzle changes
    setInputs(new Map());
    setSelectedCell(null);
    setDirection('across');
    setRevealed(false);
    setIsCorrect(false);
  }, [puzzle]);

  if (!puzzle) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <p className="text-muted-foreground">Could not generate a crossword with the available words.</p>
          <Button onClick={() => router.refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { grid, width, height, placedWords } = puzzle;
  const cellSize = 34; // px

  // Build numbers map (x,y) -> number
  const numbersMap = new Map<string, number>();
  let nextNum = 1;
  const sortedForNumbering = [...placedWords].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
  });

  for (const w of sortedForNumbering) {
      const key = `${w.x},${w.y}`;
      if (!numbersMap.has(key)) {
          numbersMap.set(key, nextNum++);
      }
  }

  // Determine active word based on selection and direction
  let activeWord = null;
  if (selectedCell) {
      // Prioritize word in current direction
      activeWord = placedWords.find(w => {
          if (w.direction !== direction) return false;
          if (direction === 'across') {
              return w.y === selectedCell.y && selectedCell.x >= w.x && selectedCell.x < w.x + w.length;
          } else {
              return w.x === selectedCell.x && selectedCell.y >= w.y && selectedCell.y < w.y + w.length;
          }
      });

      // If not found in current direction, switch direction (if cell is part of another word)
      if (!activeWord) {
          const otherWord = placedWords.find(w => {
              if (w.direction === 'across') {
                  return w.y === selectedCell.y && selectedCell.x >= w.x && selectedCell.x < w.x + w.length;
              } else {
                  return w.x === selectedCell.x && selectedCell.y >= w.y && selectedCell.y < w.y + w.length;
              }
          });
          if (otherWord) {
              activeWord = otherWord;
              // We don't setDirection here to avoid render loops,
              // but we should probably sync them.
              // Actually, let's keep direction state separate for explicit toggling.
              // But for the purpose of "Active Word", we use the found one.
          }
      }
  }

  // Ensure direction matches active word if we found one
  // (Effectively syncs direction state if we auto-switched)
  // But doing this in render is bad practice?
  // Let's rely on handleCellClick to set direction correctly.

  const highlightedCells = new Set<string>();
  if (activeWord) {
      for (let i = 0; i < activeWord.length; i++) {
          const cx = activeWord.direction === 'across' ? activeWord.x + i : activeWord.x;
          const cy = activeWord.direction === 'across' ? activeWord.y : activeWord.y + i;
          highlightedCells.add(`${cx},${cy}`);
      }
  } else if (selectedCell) {
      highlightedCells.add(`${selectedCell.x},${selectedCell.y}`);
  }

  const handleCellClick = (x: number, y: number) => {
    if (!grid[y][x]) return;

    if (selectedCell?.x === x && selectedCell?.y === y) {
      // Toggle direction
      setDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      // Check if this cell belongs to current direction
      // If not, switch direction
      const belongsToAcross = placedWords.some(w => w.direction === 'across' && w.y === y && x >= w.x && x < w.x + w.length);
      const belongsToDown = placedWords.some(w => w.direction === 'down' && w.x === x && y >= w.y && y < w.y + w.length);

      let newDir = direction;
      if (direction === 'across' && !belongsToAcross && belongsToDown) newDir = 'down';
      else if (direction === 'down' && !belongsToDown && belongsToAcross) newDir = 'across';

      setSelectedCell({ x, y });
      setDirection(newDir);
    }
  };

  const handleInputChange = (x: number, y: number, char: string) => {
      const newInputs = new Map(inputs);
      newInputs.set(`${x},${y}`, char.toUpperCase());
      setInputs(newInputs);
  };

  const handleCharSelect = (word: typeof placedWords[0], index: number) => {
      const cx = word.direction === 'across' ? word.x + index : word.x;
      const cy = word.direction === 'across' ? word.y : word.y + index;
      setSelectedCell({ x: cx, y: cy });
      setDirection(word.direction);
  };

  const checkSolution = () => {
    setRevealed(true);
    let allCorrect = true;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x]) {
          const input = inputs.get(`${x},${y}`);
          if (input !== grid[y][x]?.toUpperCase()) {
            allCorrect = false;
          }
        }
      }
    }
    setIsCorrect(allCorrect);
  };

  // Determine active word index for scroll
  // We can pass `isSelected` to input strip.

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">
               {isCorrect ? <span className="text-emerald-600 flex items-center gap-2"><CheckCircle2 /> Puzzle Solved!</span> : "Solve the puzzle"}
            </h2>
            <div className="flex gap-2">
                <Button variant="outline" onClick={checkSolution}>Check</Button>
                <Button variant="outline" onClick={() => router.refresh()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    New Game
                </Button>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Grid (Read Only / Selection Only) */}
            <div className="overflow-auto bg-muted/20 p-4 rounded-lg border">
                <div
                    className="grid gap-[1px] bg-gray-300 dark:bg-gray-700 mx-auto"
                    style={{
                        gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
                        width: `calc(${width * cellSize}px + ${width - 1}px)`
                    }}
                >
                    {grid.map((row, y) => (
                        row.map((char, x) => {
                            const number = numbersMap.get(`${x},${y}`);
                            const key = `${x},${y}`;
                            const isCellSelected = selectedCell?.x === x && selectedCell?.y === y;
                            const isHighlighted = highlightedCells.has(key);
                            const inputVal = inputs.get(key);

                            const isError = revealed && inputVal && inputVal !== char?.toUpperCase();
                            const isSuccess = revealed && inputVal === char?.toUpperCase();

                            return (
                                <div
                                    key={key}
                                    onClick={() => handleCellClick(x, y)}
                                    className={cn(
                                        "relative w-[34px] h-[34px] flex items-center justify-center text-lg font-bold uppercase select-none cursor-pointer transition-colors",
                                        char
                                          ? "bg-white dark:bg-gray-900 text-foreground"
                                          : "bg-black dark:bg-gray-950 pointer-events-none",
                                        isHighlighted && !isCellSelected && "bg-blue-100 dark:bg-blue-900/40",
                                        isCellSelected && "bg-blue-200 dark:bg-blue-800 ring-2 ring-blue-500 z-10",
                                        isError && "bg-red-100 dark:bg-red-900/40 text-red-600",
                                        isSuccess && "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                                    )}
                                >
                                    {number && (
                                        <span className="absolute top-[1px] left-[1px] text-[8px] leading-none text-muted-foreground font-normal">
                                            {number}
                                        </span>
                                    )}
                                    {inputVal}
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>

            {/* Input Strips (Clues + Inputs) */}
            <div className="flex-1 grid md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto">
                <div>
                    <h3 className="font-bold mb-3 border-b pb-1 sticky top-0 bg-background z-20">Across</h3>
                    <div className="space-y-4">
                        {placedWords
                            .filter(w => w.direction === 'across')
                            .sort((a, b) => (numbersMap.get(`${a.x},${a.y}`) || 0) - (numbersMap.get(`${b.x},${b.y}`) || 0))
                            .map(w => {
                                const isSelected = activeWord === w; // Reference equality should work since data is static per render
                                // Calculate selected char index relative to word start
                                let charIdx = null;
                                if (isSelected && selectedCell) {
                                    if (w.direction === 'across') charIdx = selectedCell.x - w.x;
                                    else charIdx = selectedCell.y - w.y;
                                    // Safety
                                    if (charIdx < 0 || charIdx >= w.length) charIdx = null;
                                }

                                return (
                                    <CrosswordInputStrip
                                        key={w.word}
                                        word={w}
                                        number={numbersMap.get(`${w.x},${w.y}`) || 0}
                                        inputs={inputs}
                                        isSelected={isSelected}
                                        onSelect={() => {
                                            setSelectedCell({ x: w.x, y: w.y });
                                            setDirection(w.direction);
                                        }}
                                        onInputChange={handleInputChange}
                                        selectedCharIndex={charIdx}
                                        onCharSelect={(idx) => handleCharSelect(w, idx)}
                                    />
                                );
                            })}
                    </div>
                </div>
                <div>
                    <h3 className="font-bold mb-3 border-b pb-1 sticky top-0 bg-background z-20">Down</h3>
                    <div className="space-y-4">
                        {placedWords
                            .filter(w => w.direction === 'down')
                            .sort((a, b) => (numbersMap.get(`${a.x},${a.y}`) || 0) - (numbersMap.get(`${b.x},${b.y}`) || 0))
                            .map(w => {
                                const isSelected = activeWord === w;
                                let charIdx = null;
                                if (isSelected && selectedCell) {
                                    if (w.direction === 'across') charIdx = selectedCell.x - w.x;
                                    else charIdx = selectedCell.y - w.y;
                                    if (charIdx < 0 || charIdx >= w.length) charIdx = null;
                                }

                                return (
                                    <CrosswordInputStrip
                                        key={w.word}
                                        word={w}
                                        number={numbersMap.get(`${w.x},${w.y}`) || 0}
                                        inputs={inputs}
                                        isSelected={isSelected}
                                        onSelect={() => {
                                            setSelectedCell({ x: w.x, y: w.y });
                                            setDirection(w.direction);
                                        }}
                                        onInputChange={handleInputChange}
                                        selectedCharIndex={charIdx}
                                        onCharSelect={(idx) => handleCharSelect(w, idx)}
                                    />
                                );
                            })}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
