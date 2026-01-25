import { openai } from "./client";
import questionsMock from "./mocks/questions.json";

const USE_MOCK = process.env.USE_MOCK_AI === "true" || !process.env.OPENAI_API_KEY;

export interface Question {
  id: string;
  word: string;
  question: string;
  audioBase64: string | null;
}

export async function generateQuestions(story: string, words: { word: string }[]): Promise<Question[]> {
  let questionsData: { word: string; question: string }[] = [];

  if (USE_MOCK) {
    console.log("Using Mock AI Questions Response");
    questionsData = questionsMock;
  } else {
    const wordList = words.map(w => w.word).join(", ");

    const prompt = `
Based on the following story, generate one specific question for each of the vocabulary words used: ${wordList}.
The question should ask the student to explain the word or its usage in the context of the story, in their own words.
Return the result as a JSON array of objects with keys: "word" and "question".

Story:
${story}
`;

    try {
        const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "You are a tutor checking comprehension. Return only JSON." },
            { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
            const parsed = JSON.parse(content);
            const raw = parsed.questions || parsed;
            if (Array.isArray(raw)) questionsData = raw;
        }
    } catch (error) {
        console.error("AI Question Generation Error:", error);
        questionsData = questionsMock;
    }
  }

  // Generate Audio for each question
  const questionsWithAudio = await Promise.all(
      questionsData.map(async (q, i) => {
          let audioBase64: string | null = null;
          if (!USE_MOCK) {
              try {
                  const mp3 = await openai.audio.speech.create({
                      model: "tts-1",
                      voice: "nova",
                      input: q.question,
                  });
                  const buffer = Buffer.from(await mp3.arrayBuffer());
                  audioBase64 = buffer.toString("base64");
              } catch (e) {
                  console.error(`TTS Error for question ${i}:`, e);
              }
          }
          return {
              id: `q-${i}`,
              word: q.word,
              question: q.question,
              audioBase64
          };
      })
  );

  return questionsWithAudio;
}
