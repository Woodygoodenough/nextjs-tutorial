"use client";

import { useState, useEffect, useRef } from "react";
import { CrosswordGrid, Direction } from "@/lib/services/crossword/generator";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  puzzle: CrosswordGrid | null;
};

export function CrosswordClient({ puzzle }: Props) {
  const router = useRouter();

  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [direction, setDirection] = useState<Direction>('across');
  const [inputs, setInputs] = useState<Map<string, string>>(new Map());
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Focus trap for keyboard input
  const gridRef = useRef<HTMLDivElement>(null);

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

  const handleCellClick = (x: number, y: number) => {
    if (!grid[y][x]) return; // Clicked on empty space

    if (selectedCell?.x === x && selectedCell?.y === y) {
      // Toggle direction if clicking same cell
      setDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell({ x, y });
      // Smart direction: if word starts here, or belongs to a word in current direction?
      // For MVP, just keep current direction unless invalid, then switch?
      // Or checking if the cell is part of an Across word vs Down word.
      // Let's rely on toggle for now.
    }

    // Focus the hidden input or grid to capture keys
    gridRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell) return;

    if (e.key === 'ArrowRight') {
      moveSelection(1, 0);
    } else if (e.key === 'ArrowLeft') {
      moveSelection(-1, 0);
    } else if (e.key === 'ArrowDown') {
      moveSelection(0, 1);
    } else if (e.key === 'ArrowUp') {
      moveSelection(0, -1);
    } else if (e.key === 'Backspace') {
      // Delete current cell and move back
      updateInput(selectedCell.x, selectedCell.y, '');
      moveCursorBackward();
    } else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
      // Type char
      updateInput(selectedCell.x, selectedCell.y, e.key.toLowerCase());
      moveCursorForward();
    }
  };

  const updateInput = (x: number, y: number, char: string) => {
    const newInputs = new Map(inputs);
    newInputs.set(`${x},${y}`, char);
    setInputs(newInputs);
  };

  const moveSelection = (dx: number, dy: number) => {
    if (!selectedCell) return;
    let nx = selectedCell.x + dx;
    let ny = selectedCell.y + dy;

    // Bounds check
    if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx]) {
      setSelectedCell({ x: nx, y: ny });
    }
  };

  const moveCursorForward = () => {
    if (direction === 'across') moveSelection(1, 0);
    else moveSelection(0, 1);
  };

  const moveCursorBackward = () => {
    if (direction === 'across') moveSelection(-1, 0);
    else moveSelection(0, -1);
  };

  const checkSolution = () => {
    setRevealed(true);
    let allCorrect = true;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x]) {
          const input = inputs.get(`${x},${y}`);
          if (input !== grid[y][x]) {
            allCorrect = false;
          }
        }
      }
    }
    setIsCorrect(allCorrect);
  };

  // Determine highlighted cells (current word)
  const highlightedCells = new Set<string>();
  if (selectedCell) {
    // Find the word that contains selectedCell in the current direction
    // This requires iterating placedWords
    const currentWord = placedWords.find(w => {
        if (w.direction !== direction) return false;
        if (direction === 'across') {
            return w.y === selectedCell.y && selectedCell.x >= w.x && selectedCell.x < w.x + w.length;
        } else {
            return w.x === selectedCell.x && selectedCell.y >= w.y && selectedCell.y < w.y + w.length;
        }
    });

    if (currentWord) {
        for (let i = 0; i < currentWord.length; i++) {
            const cx = currentWord.direction === 'across' ? currentWord.x + i : currentWord.x;
            const cy = currentWord.direction === 'across' ? currentWord.y : currentWord.y + i;
            highlightedCells.add(`${cx},${cy}`);
        }
    } else {
        // If no word found in this direction (e.g. user selected 'across' on a vertical-only cell),
        // maybe we should auto-switch direction?
        // For now, just highlight the cell itself.
        highlightedCells.add(`${selectedCell.x},${selectedCell.y}`);
    }
  }

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
            {/* Grid */}
            <div
                className="overflow-auto bg-muted/20 p-4 rounded-lg border outline-none"
                ref={gridRef}
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
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

                            const isError = revealed && inputVal && inputVal !== char;
                            const isSuccess = revealed && inputVal === char;

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

            {/* Clues */}
            <div className="flex-1 grid md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto">
                <div>
                    <h3 className="font-bold mb-3 border-b pb-1 sticky top-0 bg-background">Across</h3>
                    <ul className="space-y-2 text-sm">
                        {placedWords
                            .filter(w => w.direction === 'across')
                            .sort((a, b) => (numbersMap.get(`${a.x},${a.y}`) || 0) - (numbersMap.get(`${b.x},${b.y}`) || 0))
                            .map(w => {
                                // Highlight clue if active
                                const isActive = selectedCell && direction === 'across' && highlightedCells.has(`${w.x},${w.y}`); // Simplified check
                                return (
                                    <li
                                        key={w.word}
                                        className={cn(
                                            "p-1 rounded cursor-pointer hover:bg-muted",
                                            isActive && "bg-blue-100 dark:bg-blue-900/30 font-medium"
                                        )}
                                        onClick={() => {
                                            setSelectedCell({ x: w.x, y: w.y });
                                            setDirection('across');
                                            gridRef.current?.focus();
                                        }}
                                    >
                                        <span className="font-bold mr-1">{numbersMap.get(`${w.x},${w.y}`)}.</span>
                                        {w.clue}
                                    </li>
                                );
                            })}
                    </ul>
                </div>
                <div>
                    <h3 className="font-bold mb-3 border-b pb-1 sticky top-0 bg-background">Down</h3>
                    <ul className="space-y-2 text-sm">
                        {placedWords
                            .filter(w => w.direction === 'down')
                            .sort((a, b) => (numbersMap.get(`${a.x},${a.y}`) || 0) - (numbersMap.get(`${b.x},${b.y}`) || 0))
                            .map(w => {
                                const isActive = selectedCell && direction === 'down' && highlightedCells.has(`${w.x},${w.y}`);
                                return (
                                    <li
                                        key={w.word}
                                        className={cn(
                                            "p-1 rounded cursor-pointer hover:bg-muted",
                                            isActive && "bg-blue-100 dark:bg-blue-900/30 font-medium"
                                        )}
                                        onClick={() => {
                                            setSelectedCell({ x: w.x, y: w.y });
                                            setDirection('down');
                                            gridRef.current?.focus();
                                        }}
                                    >
                                        <span className="font-bold mr-1">{numbersMap.get(`${w.x},${w.y}`)}.</span>
                                        {w.clue}
                                    </li>
                                );
                            })}
                    </ul>
                </div>
            </div>
        </div>
    </div>
  );
}
