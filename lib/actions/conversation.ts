"use server";

import { generateConversationTurn, ConversationMessage } from "@/lib/services/ai/conversation";
import { openai } from "@/lib/services/ai/client";

export async function submitConversationTurnAction(
  history: ConversationMessage[],
  wordsToPractice: string[],
  userInput?: string | FormData
) {
  let userText = "";

  // 1. Process User Input (if exists)
  if (userInput) {
    if (typeof userInput === 'string') {
        userText = userInput;
    } else if (userInput instanceof FormData) {
        const file = userInput.get('audio') as File;
        if (file) {
            try {
                // If using mock, return dummy text
                if (!process.env.OPENAI_API_KEY) {
                    userText = "This is a transcribed sentence.";
                } else {
                    const transcription = await openai.audio.transcriptions.create({
                        file: file,
                        model: "whisper-1",
                    });
                    userText = transcription.text;
                }
            } catch (e) {
                console.error("Whisper Error:", e);
                userText = "Error transcribing audio.";
            }
        }
    }
  }

  // 2. Append User Message to History (if valid)
  const newHistory = [...history];
  if (userText) {
      newHistory.push({ role: "user", content: userText });
  }

  // 3. Generate AI Response
  const result = await generateConversationTurn(newHistory, wordsToPractice);

  // 4. Return everything needed for Client to update state
  return {
    userText: userText, // Return recognized text so client can display it
    aiReply: result.reply,
    aiAudio: result.audioBase64,
    feedback: result.feedback
  };
}
