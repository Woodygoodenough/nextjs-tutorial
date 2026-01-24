import { ReviewSettings, DEFAULT_REVIEW_SETTINGS } from "@/domain/review/reviewSettings";

export type Mastery = 0 | 1 | null;

type ReviewResult = {
    nextReviewAt: Date;
    newProgress: number;
    mastery: Mastery;
}
function clamp(x: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, x));
}

function addDays(date: Date, days: number): Date {
    const ms = days * 24 * 60 * 60 * 1000;
    return new Date(date.getTime() + ms);
}
export async function getNextReviewDate(
    progress: number,
    mastery: Mastery,
    lastReviewedAt: Date,
    settings: ReviewSettings = DEFAULT_REVIEW_SETTINGS
): Promise<ReviewResult> {
    const {
        targetRecall,
        minIntervalDays,
        maxIntervalDays,
        baseStabilityDays,
        growthPerProgress,
        passBoost,
        failPenalty,
        failIntervalScale,
    } = settings;
    if (mastery === null) {
        return {
            nextReviewAt: addDays(lastReviewedAt, minIntervalDays),
            newProgress: progress,
            mastery: mastery,
        }
    }

    // ---- 1) Binary mastery for now ----
    const isPass = mastery >= 0.5;

    // ---- 2) Update progress ----
    let nextProgress = progress + (isPass ? passBoost : -failPenalty);
    nextProgress = Math.max(0, nextProgress);
    // Ensure progress is an integer for DB compatibility
    nextProgress = Math.round(nextProgress);

    // ---- 3) Progress → stability (days) ----
    let stabilityDays =
        baseStabilityDays * Math.exp(growthPerProgress * nextProgress);
    stabilityDays = Math.max(minIntervalDays, stabilityDays);

    // ---- 4) Target-recall scheduling ----
    // R(t) = exp(-t / S)  =>  t = -S * ln(R)
    const intervalForTarget =
        -stabilityDays * Math.log(clamp(targetRecall, 0.01, 0.999));

    const intervalDays = clamp(
        isPass
            ? intervalForTarget
            : intervalForTarget * failIntervalScale,
        minIntervalDays,
        maxIntervalDays
    );

    return {
        nextReviewAt: addDays(lastReviewedAt, intervalDays),
        newProgress: nextProgress,
        mastery: mastery,
    }
}

export async function getPercentageProgress(progress: number): Promise<number> {
    return 100 * (1 - Math.exp(-0.1 * progress));
}