"use server";

import { gradeResponse } from "@/lib/services/ai/grading";

export async function gradeResponseAction(question: string, context: string, answer: string) {
  return await gradeResponse(question, context, answer);
}
