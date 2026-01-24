import { openai } from "./client";

export interface Question {
  id: string;
  word: string;
  question: string;
}

export async function generateQuestions(story: string, words: { word: string }[]): Promise<Question[]> {
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
    if (!content) return [];

    const parsed = JSON.parse(content);
    // Expecting { "questions": [ ... ] } or direct array?
    // GPT typically wraps in a root object if asked for JSON object.
    const questions = parsed.questions || parsed;

    if (Array.isArray(questions)) {
      return questions.map((q: any, i: number) => ({
        id: `q-${i}`,
        word: q.word,
        question: q.question
      }));
    }
    return [];
  } catch (error) {
    console.error("AI Question Generation Error:", error);
    return [];
  }
}
