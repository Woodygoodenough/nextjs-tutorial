"use server";

import { gradeResponse } from "@/lib/services/ai/grading";
import { openai } from "@/lib/services/ai/client";

export async function gradeResponseAction(question: string, context: string, answer: string | FormData) {
  let answerText = "";

  if (typeof answer === 'string') {
      answerText = answer;
  } else if (answer instanceof FormData) {
      // Handle audio blob
      const file = answer.get('audio') as File;
      if (!file) {
          throw new Error("No audio file provided");
      }

      // Transcribe using Whisper
      // Note: OpenAI Node SDK 'audio.transcriptions.create' expects a File-like object.
      // In Server Actions, `File` object from FormData works with `openai` v4.
      try {
          const transcription = await openai.audio.transcriptions.create({
              file: file,
              model: "whisper-1",
          });
          answerText = transcription.text;
      } catch (e) {
          console.error("Whisper Error:", e);
          // If no API key or error, fallback to dummy text for testing if needed
          if (!process.env.OPENAI_API_KEY) {
              answerText = "I understood the word correctly.";
          } else {
              throw new Error("Failed to transcribe audio.");
          }
      }
  }

  const result = await gradeResponse(question, context, answerText);
  return { ...result, transcript: answerText };
}
