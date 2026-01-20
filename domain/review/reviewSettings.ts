export interface ReviewSettings {
    targetRecall: number;

    minIntervalDays: number;
    maxIntervalDays: number;

    baseStabilityDays: number;
    growthPerProgress: number;

    passBoost: number;
    failPenalty: number;
    failIntervalScale: number;
}

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
    targetRecall: 0.9,

    minIntervalDays: 1,
    maxIntervalDays: 3650,

    baseStabilityDays: 1.2,
    growthPerProgress: 0.22,

    passBoost: 1.0,
    failPenalty: 1.5,
    failIntervalScale: 0.25,
};
