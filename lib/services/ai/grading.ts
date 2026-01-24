import { openai } from "./client";

// Optional: Control mock usage via env var
const USE_MOCK = process.env.USE_MOCK_AI === "true" || !process.env.OPENAI_API_KEY;

export async function gradeResponse(question: string, context: string, studentAnswer: string): Promise<{ grade: 0 | 1; feedback: string }> {
  if (USE_MOCK) {
    console.log("Using Mock AI Grading");
    // Simple mock logic: If answer is longer than 3 chars, pass.
    const isPass = studentAnswer.length > 3;
    return {
        grade: isPass ? 1 : 0,
        feedback: isPass ? "Good job! (Mock Pass)" : "Please provide a more detailed answer. (Mock Fail)"
    };
  }

  const prompt = `
Question: ${question}
Story Context: ${context}
Student Answer: ${studentAnswer}

Evaluate the student's answer.
Did they understand the word correctly in this context?
Give a grade of 1 (Pass) or 0 (Fail).
Provide brief feedback explaining why.

Return JSON with keys: "grade" (number 0 or 1) and "feedback" (string).
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a fair tutor grading vocabulary comprehension. Return only JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { grade: 0, feedback: "Error grading." };

    const result = JSON.parse(content);
    return {
      grade: result.grade === 1 ? 1 : 0,
      feedback: result.feedback || "No feedback."
    };
  } catch (error) {
    console.error("AI Grading Error:", error);
    // If error occurs (e.g. rate limit), return a safe fallback or error
    return { grade: 0, feedback: "System error during grading. Please try again." };
  }
}
