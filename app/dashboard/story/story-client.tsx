"use client";

import { useState } from "react";
import { Question } from "@/lib/services/ai/question-generator";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { gradeResponseAction } from "@/lib/actions/story";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type Props = {
  story: string;
  questions: Question[];
};

export function StorySessionClient({ story, questions }: Props) {
  const [currentStep, setCurrentStep] = useState<"story" | "questions">("story");
  const [qIndex, setQIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState<{ grade: 0 | 1; text: string } | null>(null);

  const currentQ = questions[qIndex];

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setGrading(true);
    try {
      const result = await gradeResponseAction(currentQ.question, story, answer);
      setFeedback({ grade: result.grade, text: result.feedback });
    } catch (e) {
      console.error(e);
      setFeedback({ grade: 0, text: "Failed to grade. Please try again." });
    } finally {
      setGrading(false);
    }
  };

  const handleNext = () => {
    setFeedback(null);
    setAnswer("");
    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      // Finished
      alert("Session Complete!"); // Ideally a summary screen
    }
  };

  if (currentStep === "story") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The Story</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
            {story}
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={() => setCurrentStep("questions")}>
            I'm ready for questions
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!currentQ) {
    return (
        <Card>
            <CardContent className="py-10 text-center">
                <p>No questions generated.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle>Question {qIndex + 1} of {questions.length}</CardTitle>
            <Badge variant="outline">{currentQ.word}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-medium text-lg">{currentQ.question}</p>

        {feedback ? (
            <div className={`p-4 rounded-lg border ${feedback.grade === 1 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30" : "bg-red-50 border-red-200 dark:bg-red-950/30"}`}>
                <div className="flex items-center gap-2 mb-2">
                    {feedback.grade === 1 ? <CheckCircle2 className="text-emerald-600" /> : <XCircle className="text-red-600" />}
                    <span className="font-bold">{feedback.grade === 1 ? "Pass" : "Fail"}</span>
                </div>
                <p className="text-sm">{feedback.text}</p>
            </div>
        ) : (
            <Textarea
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                className="resize-none"
            />
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {feedback ? (
            <Button onClick={handleNext}>
                {qIndex < questions.length - 1 ? "Next Question" : "Finish"}
            </Button>
        ) : (
            <Button onClick={handleSubmit} disabled={grading || !answer.trim()}>
                {grading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Answer
            </Button>
        )}
      </CardFooter>
    </Card>
  );
}
