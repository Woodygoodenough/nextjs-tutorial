"use client";

import { useState } from "react";
import { CrosswordGrid } from "@/lib/services/crossword/generator";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  puzzle: CrosswordGrid | null;
};

export function CrosswordClient({ puzzle }: Props) {
  if (!puzzle) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">Could not generate a crossword with the available words.</p>
        </CardContent>
      </Card>
    );
  }

  const { grid, width, height, placedWords } = puzzle;
  const cellSize = 30; // px

  // Build numbers map (x,y) -> number
  const numbersMap = new Map<string, number>();
  let nextNum = 1;
  // Sort words by y, then x to assign numbers in reading order
  const sortedForNumbering = [...placedWords].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
  });

  // Assign numbers to start positions
  // Note: One start position might have two words (Across and Down). They share the number.
  for (const w of sortedForNumbering) {
      const key = `${w.x},${w.y}`;
      if (!numbersMap.has(key)) {
          numbersMap.set(key, nextNum++);
      }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
        {/* Grid */}
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
                        return (
                            <div
                                key={`${x}-${y}`}
                                className={cn(
                                    "relative w-[30px] h-[30px] flex items-center justify-center text-sm font-bold uppercase select-none",
                                    char ? "bg-white dark:bg-gray-900 text-foreground" : "bg-black dark:bg-gray-950"
                                )}
                            >
                                {number && (
                                    <span className="absolute top-[1px] left-[1px] text-[8px] leading-none text-muted-foreground">
                                        {number}
                                    </span>
                                )}
                                {char}
                            </div>
                        );
                    })
                ))}
            </div>
        </div>

        {/* Clues */}
        <div className="flex-1 grid md:grid-cols-2 gap-6">
            <div>
                <h3 className="font-bold mb-3 border-b pb-1">Across</h3>
                <ul className="space-y-2 text-sm">
                    {placedWords
                        .filter(w => w.direction === 'across')
                        .sort((a, b) => (numbersMap.get(`${a.x},${a.y}`) || 0) - (numbersMap.get(`${b.x},${b.y}`) || 0))
                        .map(w => (
                            <li key={w.word}>
                                <span className="font-bold mr-1">{numbersMap.get(`${w.x},${w.y}`)}.</span>
                                {w.clue}
                            </li>
                        ))}
                </ul>
            </div>
            <div>
                <h3 className="font-bold mb-3 border-b pb-1">Down</h3>
                <ul className="space-y-2 text-sm">
                    {placedWords
                        .filter(w => w.direction === 'down')
                        .sort((a, b) => (numbersMap.get(`${a.x},${a.y}`) || 0) - (numbersMap.get(`${b.x},${b.y}`) || 0))
                        .map(w => (
                            <li key={w.word}>
                                <span className="font-bold mr-1">{numbersMap.get(`${w.x},${w.y}`)}.</span>
                                {w.clue}
                            </li>
                        ))}
                </ul>
            </div>
        </div>
    </div>
  );
}
