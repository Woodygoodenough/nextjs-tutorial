"use client";

import { useState } from "react";
import { Question } from "@/lib/services/ai/question-generator";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { gradeResponseAction } from "@/lib/actions/story";
import { Loader2, CheckCircle2, XCircle, Volume2, Mic, PlayCircle } from "lucide-react";
import { AudioRecorder } from "@/components/ui/audio-recorder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  story: string;
  storyAudio?: string;
  questions: Question[];
};

export function StorySessionClient({ story, storyAudio, questions }: Props) {
  const [qIndex, setQIndex] = useState(0);

  // Input State
  const [textAnswer, setTextAnswer] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [inputType, setInputType] = useState<"audio" | "text">("audio");

  // Submission State
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState<{ grade: 0 | 1; text: string; transcript?: string } | null>(null);

  const currentQ = questions[qIndex];

  const handleSubmit = async () => {
    if (inputType === "text" && !textAnswer.trim()) return;
    if (inputType === "audio" && !audioBlob) return;

    setGrading(true);
    try {
      let payload: string | FormData;

      if (inputType === "audio" && audioBlob) {
        const formData = new FormData();
        // Append blob as a file with a filename
        formData.append("audio", audioBlob, "answer.webm");
        payload = formData;
      } else {
        payload = textAnswer;
      }

      const result = await gradeResponseAction(currentQ.question, story, payload);
      setFeedback({
        grade: result.grade,
        text: result.feedback,
        transcript: result.transcript
      });
    } catch (e) {
      console.error(e);
      setFeedback({ grade: 0, text: "Failed to grade. Please try again." });
    } finally {
      setGrading(false);
    }
  };

  const handleNext = () => {
    setFeedback(null);
    setTextAnswer("");
    setAudioBlob(null);
    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      // Finished
      alert("Session Complete! Great job.");
      // In a real app, redirect or show summary
    }
  };

  if (!currentQ) {
    return (
        <div className="text-center p-10">
            <p>No questions generated.</p>
        </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-start">
      {/* LEFT COLUMN: STORY */}
      <Card className="h-full flex flex-col border-primary/20 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-primary" />
            The Story
          </CardTitle>
          {storyAudio && (
            <div className="mt-4 bg-muted/30 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Audio Narration</p>
                <audio controls src={`data:audio/mp3;base64,${storyAudio}`} className="w-full h-8" />
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto max-h-[600px]">
          <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-sm md:text-base">
            {story}
          </div>
        </CardContent>
      </Card>

      {/* RIGHT COLUMN: QUESTIONS */}
      <Card className="flex flex-col border-primary/20 shadow-md sticky top-6">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Question {qIndex + 1} of {questions.length}
            </span>
            <Badge variant="secondary" className="text-sm px-3 py-1">{currentQ.word}</Badge>
          </div>

          <div className="space-y-4">
              {currentQ.audioBase64 && (
                  <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
                        onClick={() => {
                            const a = new Audio(`data:audio/mp3;base64,${currentQ.audioBase64}`);
                            a.play();
                        }}
                      >
                          <Volume2 className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">Play Question</span>
                  </div>
              )}
              <h3 className="font-semibold text-xl leading-tight">{currentQ.question}</h3>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
            {!feedback ? (
                <Tabs value={inputType} onValueChange={(v) => setInputType(v as "audio" | "text")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="audio">
                            <Mic className="mr-2 h-4 w-4" />
                            Voice Answer
                        </TabsTrigger>
                        <TabsTrigger value="text">
                            Text Answer
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="audio" className="space-y-4">
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/10">
                            <AudioRecorder onRecordingComplete={setAudioBlob} disabled={grading} />
                            {audioBlob && (
                                <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Audio recorded ready to submit
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                            Record your answer clearly.
                        </p>
                    </TabsContent>

                    <TabsContent value="text">
                        <Textarea
                            placeholder="Type your answer here..."
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(e.target.value)}
                            rows={5}
                            className="resize-none text-base"
                        />
                    </TabsContent>
                </Tabs>
            ) : (
                <div className={`p-5 rounded-lg border ${feedback.grade === 1 ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30" : "bg-red-50 border-red-200 dark:bg-red-950/30"}`}>
                    <div className="flex items-center gap-2 mb-3">
                        {feedback.grade === 1 ? <CheckCircle2 className="text-emerald-600 h-6 w-6" /> : <XCircle className="text-red-600 h-6 w-6" />}
                        <span className={`font-bold text-lg ${feedback.grade === 1 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                            {feedback.grade === 1 ? "Correct!" : "Incorrect"}
                        </span>
                    </div>
                    {feedback.transcript && (
                        <div className="mb-3 p-2 bg-white/50 dark:bg-black/20 rounded text-sm italic text-muted-foreground border">
                            " {feedback.transcript} "
                        </div>
                    )}
                    <p className="text-sm md:text-base leading-relaxed">{feedback.text}</p>
                </div>
            )}
        </CardContent>

        <CardFooter className="justify-end pt-2">
            {feedback ? (
                <Button onClick={handleNext} className="w-full md:w-auto">
                    {qIndex < questions.length - 1 ? "Next Question" : "Finish Review"}
                </Button>
            ) : (
                <Button
                    onClick={handleSubmit}
                    disabled={grading || (inputType === 'text' && !textAnswer) || (inputType === 'audio' && !audioBlob)}
                    className="w-full md:w-auto min-w-[140px]"
                >
                    {grading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {grading ? "Analyzing..." : "Submit Answer"}
                </Button>
            )}
        </CardFooter>
      </Card>
    </div>
  );
}
