import { openai } from "./client";
import { WordDetail } from "@/lib/actions/library";

export async function generateStory(words: { word: string; pos?: string; def?: string }[]): Promise<string> {
  const wordsList = words.map(w => {
    return `- ${w.word} (${w.pos || 'unknown'}): ${w.def || 'no definition'}`;
  }).join("\n");

  const prompt = `
Create an interesting, creative short story that naturally incorporates the following vocabulary words.
The story can be a conversation, a fable, a news report, or any engaging format.
Ensure the words are used correctly in context, respecting their part of speech and meaning.

Vocabulary Words:
${wordsList}

Output only the story text.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a creative writing tutor helping students learn vocabulary through stories." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "Failed to generate story.";
  } catch (error) {
    console.error("AI Story Generation Error:", error);
    return "Sorry, I couldn't generate a story at this time.";
  }
}
