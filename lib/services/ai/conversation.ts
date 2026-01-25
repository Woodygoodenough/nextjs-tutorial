import { openai } from "./client";

// Optional: Control mock usage via env var
const USE_MOCK = process.env.USE_MOCK_AI === "true" || !process.env.OPENAI_API_KEY;

export type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ConversationResponse = {
  reply: string;
  audioBase64: string | null;
  feedback?: string; // Optional feedback on the user's last message
};

export async function generateConversationTurn(
  history: ConversationMessage[],
  wordsToPractice: string[]
): Promise<ConversationResponse> {

  if (USE_MOCK) {
    console.log("Using Mock AI Conversation Response");
    return {
        reply: "This is a mock response. I see you are practicing words: " + wordsToPractice.join(", ") + ". Tell me more!",
        audioBase64: null,
        feedback: "Your grammar looks perfect (Mock)."
    };
  }

  const systemPrompt = `
You are a friendly and encouraging vocabulary tutor.
Your goal is to help the user practice the following words: ${wordsToPractice.join(", ")}.

Guidelines:
1. Engage in a natural conversation.
2. If the user just spoke, briefly evaluate their grammar and usage (be gentle). Provide this in a separate "Feedback" section if possible, or subtly in the response.
3. Ask a follow-up question that encourages the user to use one of the target words.
4. Keep your responses concise (under 50 words) to keep the conversation flowing.
5. If the user asks for help, provide a definition or example.

Format your response as JSON:
{
  "feedback": "Feedback on user's last message (optional, null if start)",
  "reply": "Your conversational response and next question"
}
`;

  // Filter history to valid OpenAI roles and content
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content }))
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages as any,
      response_format: { type: "json_object" }, // Enforce JSON
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content received");

    const parsed = JSON.parse(content);

    // Generate Audio for the reply
    let audioBase64 = null;
    try {
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "shimmer", // Different voice for tutor?
            input: parsed.reply,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        audioBase64 = buffer.toString("base64");
    } catch (e) {
        console.error("TTS Error in conversation:", e);
    }

    return {
        reply: parsed.reply,
        feedback: parsed.feedback,
        audioBase64: audioBase64
    };

  } catch (error) {
    console.error("AI Conversation Error:", error);
    return {
        reply: "I'm having trouble connecting to my brain right now. Let's try again.",
        audioBase64: null,
        feedback: "System Error"
    };
  }
}
