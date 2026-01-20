import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getPercentageProgress } from '@/domain/review/scheduler';
import Link from 'next/link';
import { PronunciationButton } from '@/components/pronunciation-button';
import type { LibraryUnit } from '@/app/lib/actions/library';

type LibraryUnitCardProps = {
  unit: LibraryUnit;
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

export async function LibraryUnitCard({ unit }: LibraryUnitCardProps) {
  const progressPercentage = await getPercentageProgress(unit.progress);
  const progressColor = getProgressColor(progressPercentage);
  const progressBgColor = getProgressBgColor(progressPercentage);

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never reviewed';
    
    // Convert to Date object if it's a string
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
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

  return (
    <Link href={`/dashboard/library/words/${unit.unitId}`} className="block">
      <Card className="transition-all duration-200 cursor-pointer hover:shadow-lg hover:border-primary/50 hover:scale-[1.01]">
        <CardContent className="p-3">
          <div className="space-y-2">
            {/* Header: Label and pronunciation button */}
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-base truncate flex-1">{unit.label}</h3>
              <PronunciationButton />
            </div>

          {/* Short definition */}
          {unit.shortdef && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {unit.shortdef}
            </p>
          )}

          {/* Footer: Progress bar and last reviewed date */}
          <div className="flex items-center gap-3 pt-1">
            {/* Compact progress bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className={cn("text-xs font-medium", {
                  "text-red-600 dark:text-red-400": progressPercentage < 30,
                  "text-amber-600 dark:text-amber-400": progressPercentage >= 30 && progressPercentage < 60,
                  "text-blue-600 dark:text-blue-400": progressPercentage >= 60 && progressPercentage < 85,
                  "text-emerald-600 dark:text-emerald-400": progressPercentage >= 85,
                })}>
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <div className={cn("h-1.5 w-full rounded-full overflow-hidden", progressBgColor)}>
                <div
                  className={cn("h-full transition-all duration-300", progressColor)}
                  style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                />
              </div>
            </div>

            {/* Last reviewed date */}
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {formatDate(unit.lastReviewedAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
