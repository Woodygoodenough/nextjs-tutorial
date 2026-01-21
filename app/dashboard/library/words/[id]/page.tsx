import { lusitana } from '@/app/ui/fonts';
import { getWordDetail } from '@/lib/actions/library';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPercentageProgress } from '@/domain/review/scheduler';
import { cn } from '@/lib/utils';

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function getProgressColor(percentage: number): string {
  if (percentage < 30) return 'bg-red-500';
  if (percentage < 60) return 'bg-amber-500';
  if (percentage < 85) return 'bg-blue-500';
  return 'bg-emerald-500';
}

function getProgressBgColor(percentage: number): string {
  if (percentage < 30) return 'bg-red-50 dark:bg-red-950/20';
  if (percentage < 60) return 'bg-amber-50 dark:bg-amber-950/20';
  if (percentage < 85) return 'bg-blue-50 dark:bg-blue-950/20';
  return 'bg-emerald-50 dark:bg-emerald-950/20';
}

const formatDate = (date: Date | string | null) => {
  if (!date) return 'Never reviewed';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Never reviewed';
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - dateObj.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return dateObj.toLocaleDateString();
};

export default async function WordDetailPage({ params }: Props) {
  const { id } = await params;
  const word = await getWordDetail(id);

  if (!word) {
    notFound();
  }

  const progressPercentage = await getPercentageProgress(word.progress);
  const progressColor = getProgressColor(progressPercentage);
  const progressBgColor = getProgressBgColor(progressPercentage);

  return (
    <main>
      <div className="mb-6">
        <Link href="/dashboard/library">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </Link>
        
        <div className="flex items-center justify-between">
          <h1 className={`${lusitana.className} text-2xl md:text-3xl font-bold`}>
            {word.label}
          </h1>
          <Button
            variant="outline"
            size="icon"
            aria-label="Pronounce"
          >
            <Volume2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Word Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {word.headwordRaw && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Headword</p>
                <p className="font-medium">{word.headwordRaw}</p>
              </div>
            )}

            {word.metaId && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Dictionary Entry ID</p>
                <p className="font-mono text-sm">{word.metaId}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground mb-1">Match Method</p>
              <Badge variant="outline">{word.matchMethod}</Badge>
            </div>

            {word.shortdef && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Definition</p>
                <p className="text-sm">{word.shortdef}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>Learning Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Progress</p>
                <span className={cn("text-sm font-medium", {
                  "text-red-600 dark:text-red-400": progressPercentage < 30,
                  "text-amber-600 dark:text-amber-400": progressPercentage >= 30 && progressPercentage < 60,
                  "text-blue-600 dark:text-blue-400": progressPercentage >= 60 && progressPercentage < 85,
                  "text-emerald-600 dark:text-emerald-400": progressPercentage >= 85,
                })}>
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <div className={cn("h-3 w-full rounded-full overflow-hidden", progressBgColor)}>
                <div
                  className={cn("h-full transition-all duration-300", progressColor)}
                  style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                />
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Last Reviewed</p>
              <p className="text-sm">{formatDate(word.lastReviewedAt)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Raw Progress Value</p>
              <p className="text-sm font-mono">{word.progress}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for future content */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            More detailed information about this word will be displayed here in the future.
            This may include full definitions, example sentences, etymology, and more.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
