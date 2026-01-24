
export type Direction = 'across' | 'down';

export interface CrosswordWord {
  word: string;
  clue: string;
  x: number;
  y: number;
  direction: Direction;
  length: number;
}

export interface CrosswordGrid {
  width: number;
  height: number;
  grid: (string | null)[][]; // 2D array of chars or null
  placedWords: CrosswordWord[];
}

export function generateCrossword(
  words: { word: string; clue: string }[],
  maxGridSize: number = 20
): CrosswordGrid | null {
  // Sort by length descending
  const sortedWords = [...words].sort((a, b) => b.word.length - a.word.length);

  if (sortedWords.length === 0) return null;

  // Initialize with the first word in the middle
  const placedWords: CrosswordWord[] = [];
  const gridMap = new Map<string, string>(); // "x,y" -> char

  const center = Math.floor(maxGridSize / 2);
  const firstWord = sortedWords[0];

  // Place first word horizontally
  const firstWordObj: CrosswordWord = {
    word: firstWord.word,
    clue: firstWord.clue,
    x: center - Math.floor(firstWord.word.length / 2),
    y: center,
    direction: 'across',
    length: firstWord.word.length,
  };

  placedWords.push(firstWordObj);
  for (let i = 0; i < firstWord.word.length; i++) {
    gridMap.set(`${firstWordObj.x + i},${firstWordObj.y}`, firstWord.word[i]);
  }

  // Helper to check collision
  const canPlace = (word: string, startX: number, startY: number, direction: Direction): boolean => {
    // Check bounds
    if (startX < 0 || startY < 0 || startX >= maxGridSize || startY >= maxGridSize) return false;
    if (direction === 'across' && startX + word.length > maxGridSize) return false;
    if (direction === 'down' && startY + word.length > maxGridSize) return false;

    // Check overlaps and adjacent cells
    for (let i = 0; i < word.length; i++) {
      const cx = direction === 'across' ? startX + i : startX;
      const cy = direction === 'across' ? startY : startY + i;
      const char = word[i];
      const existingChar = gridMap.get(`${cx},${cy}`);

      // 1. Intersection must match
      if (existingChar && existingChar !== char) return false;

      // 2. If it's an intersection (existingChar matches), that's good.
      // 3. If it's empty, we must ensure we are not "touching" other words incorrectly (parallel placement)
      if (!existingChar) {
        // Check neighbors to ensure we don't accidentally form invalid 2-letter words
        // If placing ACROSS, check UP and DOWN neighbors
        if (direction === 'across') {
           if (gridMap.has(`${cx},${cy-1}`) || gridMap.has(`${cx},${cy+1}`)) return false;
           // Also check Start-1 and End+1
           if (i === 0 && gridMap.has(`${cx-1},${cy}`)) return false;
           if (i === word.length - 1 && gridMap.has(`${cx+1},${cy}`)) return false;
        } else {
           // If placing DOWN, check LEFT and RIGHT neighbors
           if (gridMap.has(`${cx-1},${cy}`) || gridMap.has(`${cx+1},${cy}`)) return false;
           // Also check Start-1 and End+1
           if (i === 0 && gridMap.has(`${cx},${cy-1}`)) return false;
           if (i === word.length - 1 && gridMap.has(`${cx},${cy+1}`)) return false;
        }
      } else {
          // This is an intersection.
          // We don't need to check orthogonal neighbors because they belong to the crossing word.
      }
    }
    return true;
  };

  // Greedy placement for remaining words
  for (let i = 1; i < sortedWords.length; i++) {
    const wordData = sortedWords[i];
    const word = wordData.word;
    let placed = false;

    // Try to find intersection with existing words
    // We iterate through all placed words, and all chars in those words
    for (const placedWord of placedWords) {
        if (placed) break;

        for (let j = 0; j < placedWord.word.length; j++) {
            if (placed) break;
            const intersectChar = placedWord.word[j];
            const px = placedWord.direction === 'across' ? placedWord.x + j : placedWord.x;
            const py = placedWord.direction === 'across' ? placedWord.y : placedWord.y + j;

            // Find this char in the new word
            for (let k = 0; k < word.length; k++) {
                if (word[k] === intersectChar) {
                    // Try placing orthogonal
                    const newDir: Direction = placedWord.direction === 'across' ? 'down' : 'across';
                    const startX = newDir === 'across' ? px - k : px;
                    const startY = newDir === 'across' ? py : py - k;

                    if (canPlace(word, startX, startY, newDir)) {
                        // Place it
                        const newWord: CrosswordWord = {
                            word: word,
                            clue: wordData.clue,
                            x: startX,
                            y: startY,
                            direction: newDir,
                            length: word.length
                        };
                        placedWords.push(newWord);
                        for (let m = 0; m < word.length; m++) {
                            const cx = newDir === 'across' ? startX + m : startX;
                            const cy = newDir === 'across' ? startY : startY + m;
                            gridMap.set(`${cx},${cy}`, word[m]);
                        }
                        placed = true;
                        break;
                    }
                }
            }
        }
    }

    if (!placed) {
        console.log(`Could not place word: ${word}`);
        // For MVP, we just skip unplaceable words.
        // A better algo would backtrack or retry.
    }
  }

  // Convert map to grid
  const grid: (string | null)[][] = Array(maxGridSize).fill(null).map(() => Array(maxGridSize).fill(null));
  let minX = maxGridSize, maxX = 0, minY = maxGridSize, maxY = 0;

  for (const [key, char] of gridMap.entries()) {
      const [x, y] = key.split(',').map(Number);
      grid[y][x] = char;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
  }

  // Trim grid
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const trimmedGrid: (string | null)[][] = Array(height).fill(null).map(() => Array(width).fill(null));

  for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
          trimmedGrid[y - minY][x - minX] = grid[y][x];
      }
  }

  // Adjust coordinates
  const adjustedWords = placedWords.map(w => ({
      ...w,
      x: w.x - minX,
      y: w.y - minY
  }));

  return {
      width,
      height,
      grid: trimmedGrid,
      placedWords: adjustedWords
  };
}
