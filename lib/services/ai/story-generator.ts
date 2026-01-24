import { openai } from "./client";
import storyMock from "./mocks/story.json";
import fs from "fs/promises";
import path from "path";

// Optional: Control mock usage via env var
const USE_MOCK = process.env.USE_MOCK_AI === "true" || !process.env.OPENAI_API_KEY;

export async function generateStory(words: { word: string; pos?: string; def?: string }[]): Promise<{ text: string; audioBase64: string | null }> {
  let storyText = "";

  if (USE_MOCK) {
    console.log("Using Mock AI Story Response");
    storyText = storyMock;
    // For mock audio, we can return null or a placeholder if available
    return { text: storyText, audioBase64: null };
  } else {
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

        storyText = response.choices[0]?.message?.content || "Failed to generate story.";
    } catch (error) {
        console.error("AI Story Generation Error:", error);
        return { text: storyMock, audioBase64: null };
    }
  }

  // Generate Audio (TTS)
  try {
      const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: storyText,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      const base64 = buffer.toString("base64");
      return { text: storyText, audioBase64: base64 };
  } catch (e) {
      console.error("TTS Error:", e);
      return { text: storyText, audioBase64: null };
  }
}
