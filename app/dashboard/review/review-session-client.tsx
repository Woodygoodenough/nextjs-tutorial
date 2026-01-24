"use client";

import { useState } from "react";
import { WordDetail } from "@/lib/actions/library";
import { ReviewCard } from "@/components/review/review-card";
import { ReviewSettings, ReviewSettingsSheet } from "@/components/review/review-settings";
import { submitReview } from "@/lib/actions/review";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  initialItems: WordDetail[];
};

export function ReviewSessionClient({ initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<WordDetail[]>(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [settings, setSettings] = useState<ReviewSettings>({
    autoPlay: true,
    showTitle: true,
    showDetails: false,
  });
  const [submitting, setSubmitting] = useState(false);

  // Stats for the session
  const [sessionStats, setSessionStats] = useState({
    reviewed: 0,
    remembered: 0,
  });

  const currentItem = items[currentIndex];
  const isComplete = currentIndex >= items.length;

  const handleReview = async (unitId: string, isRemembered: boolean) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Optimistic update: move to next immediately?
      // Or wait for server? Waiting is safer for data consistency, but slower.
      // Given the UI requirement "next card pops up", speed is key.
      // We'll fire and forget (or await but block UI). Blocking UI prevents double clicks.

      await submitReview(unitId, isRemembered);

      setSessionStats(prev => ({
        reviewed: prev.reviewed + 1,
        remembered: prev.remembered + (isRemembered ? 1 : 0)
      }));

      setCurrentIndex(prev => prev + 1);
    } catch (error) {
      console.error("Review submission failed:", error);
      alert("Failed to save review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = () => {
    // Refresh the page to fetch new items
    router.refresh();
  };

  if (isComplete) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl">Session Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              You reviewed {sessionStats.reviewed} words.
            </p>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">{sessionStats.remembered}</p>
                <p className="text-xs text-muted-foreground">Remembered</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{sessionStats.reviewed - sessionStats.remembered}</p>
                <p className="text-xs text-muted-foreground">Forgot</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
               <Button onClick={handleRefresh} className="w-full" size="lg">
                 <RotateCw className="mr-2 h-4 w-4" />
                 Review More
               </Button>
               <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
                 Back to Dashboard
               </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
           Word {currentIndex + 1} of {items.length}
        </div>
        <ReviewSettingsSheet settings={settings} onSettingsChange={setSettings} />
      </div>

      <ReviewCard
        key={currentItem.unitId}
        item={currentItem}
        settings={settings}
        onReview={handleReview}
      />
    </div>
  );
}
