/**
 * Centralized DAO exports for backward compatibility and convenience.
 * All DAO functions are organized by domain in separate files.
 */

// Learning Units & Lexical Groups
export {
    fetchLearningUnitFromLookupKey,
    fetchLearningUnitFromLabelAndFingerprint,
    fetchLexicalGroupFromFingerprint,
    upsertLookupKey,
    upsertLearningUnit,
} from "./learning-units";

// User Vocabulary
export {
    upsertUserVocab,
    deleteUserVocabForUser,
} from "./user-vocab";

// DRO (Defined Run-Ons)
export {
    fetchDrosByEntryUuid,
    fetchDroById,
    fetchDrosByDrp,
    insertDro,
    insertDros,
    upsertDro,
    deleteDrosByEntryUuid,
} from "./mw-dro";

// URO (Undefined Run-Ons)
export {
    fetchUrosByEntryUuid,
    fetchUroById,
    fetchUrosByUre,
    insertUro,
    insertUros,
    upsertUro,
    deleteUrosByEntryUuid,
} from "./mw-uro";

// Pronunciations
export {
    fetchPronunciationsByEntryUuid,
    fetchEntryLevelPronunciations,
    fetchPronunciationsByDroId,
    fetchPronunciationById,
    fetchPronunciationsByAudioBase,
    insertPronunciation,
    insertPronunciations,
    upsertPronunciation,
    deletePronunciationsByEntryUuid,
    deletePronunciationsByDroId,
} from "./mw-pronunciation";
