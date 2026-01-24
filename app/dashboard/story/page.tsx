import { generateStory } from "@/lib/services/ai/story-generator";
import { generateQuestions } from "@/lib/services/ai/question-generator";
import { getRandomWords } from "@/lib/actions/crossword";
import { StorySessionClient } from "./story-client";
import { lusitana } from "@/app/ui/fonts";

export const dynamic = 'force-dynamic';

export default async function StoryPage() {
  // Fetch random words to review
  let words: { word: string; clue: string }[] = [];
  try {
    words = await getRandomWords(5);
  } catch (e) {
    console.error("Failed to fetch words for story", e);
  }

  // Fallback if DB empty or error
  if (words.length === 0) {
    words = [
        { word: "mercury", clue: "A heavy silver-white poisonous metallic chemical element" },
        { word: "calendar", clue: "System of time" },
        { word: "current", clue: "Flow of water" }
    ];
  }

  // Generate Story
  const story = await generateStory(words.map(w => ({ word: w.word, def: w.clue })));

  // Generate Questions
  const questions = await generateQuestions(story, words.map(w => ({ word: w.word })));

  return (
    <main className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className={`${lusitana.className} text-2xl md:text-3xl font-bold mb-2`}>
          AI Story Review
        </h1>
        <p className="text-muted-foreground">
          Read the story containing your review words, then answer the questions.
        </p>
      </div>

      <StorySessionClient story={story} questions={questions} />
    </main>
  );
}
