import { getRandomWords } from "@/lib/actions/crossword";
import { submitConversationTurnAction } from "@/lib/actions/conversation";
import { ConversationClient } from "./conversation-client";
import { lusitana } from "@/app/ui/fonts";

export const dynamic = 'force-dynamic';

export default async function ConversationPage() {
  // 1. Fetch Words
  let words: { word: string; clue: string }[] = [];
  try {
    words = await getRandomWords(5);
  } catch (e) {
    console.error("Failed to fetch words", e);
  }

  if (words.length === 0) {
    words = [
        { word: "gratitude", clue: "The quality of being thankful" },
        { word: "resilient", clue: "Able to withstand or recover quickly from difficult conditions" }
    ];
  }

  const wordList = words.map(w => w.word);

  // 2. Get Initial Greeting
  // We pass empty history and no input to trigger the "System Start" behavior (AI starts)
  const initialTurn = await submitConversationTurnAction([], wordList);

  return (
    <main className="w-full max-w-5xl mx-auto px-4 h-[calc(100vh-6rem)] flex flex-col">
      <div className="mb-4 flex-none">
        <h1 className={`${lusitana.className} text-2xl md:text-3xl font-bold mb-1`}>
          AI Conversation Tutor
        </h1>
        <p className="text-muted-foreground text-sm">
            Practice: {wordList.join(", ")}
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <ConversationClient
            initialAiMessage={initialTurn.aiReply}
            initialAiAudio={initialTurn.aiAudio}
            wordsToPractice={wordList}
        />
      </div>
    </main>
  );
}
