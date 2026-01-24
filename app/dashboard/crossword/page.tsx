import { generateCrossword } from "@/lib/services/crossword/generator";
import { CrosswordClient } from "./crossword-client";
import { lusitana } from "@/app/ui/fonts";

export const dynamic = 'force-dynamic';

export default function CrosswordPage() {
  // Hardcoded words for MVP as requested
  const words = [
    { word: "mercury", clue: "A heavy silver-white poisonous metallic chemical element" },
    { word: "calendar", clue: "A system for fixing the beginning, length, and divisions of the civil year" },
    { word: "current", clue: "Occurring in or belonging to the present time" },
    { word: "carrot", clue: "A long orange root eaten as a vegetable" },
    { word: "create", clue: "To bring into existence" },
    { word: "review", clue: "To view or see again" },
    { word: "session", clue: "A meeting or series of meetings" },
    { word: "vertex", clue: "The top of the head" }
  ];

  const puzzle = generateCrossword(words);

  return (
    <main className="w-full">
      <div className="mb-8">
        <h1 className={`${lusitana.className} text-2xl md:text-3xl font-bold mb-2`}>
          Crossword
        </h1>
        <p className="text-muted-foreground">
          Test your vocabulary with a crossword puzzle.
        </p>
      </div>

      <CrosswordClient puzzle={puzzle} />
    </main>
  );
}
