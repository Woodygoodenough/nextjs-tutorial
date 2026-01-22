/**
 * Centralized DAO exports for backward compatibility and convenience.
 * All DAO functions are organized by domain in separate files.
 */

// Learning Units & Lexical Groups
export {
    fetchLearningUnitsFromLookupKey,
    fetchLearningUnitFromLabelAndFingerprint,
    fetchLexicalGroupFromFingerprint,
    upsertLearningUnit,
} from "@/lib/services/dao/learning-units";

// User Vocabulary
export {
    upsertUserVocab,
    deleteUserVocabForUser,
} from "@/lib/services/dao/user-vocab";

// DRO (Defined Run-Ons)
export {
    fetchDrosByEntryUuid,
    fetchDroById,
    fetchDrosByDrp,
    insertDro,
    insertDros,
    upsertDro,
    deleteDrosByEntryUuid,
} from "@/lib/services/dao/mw-dro";

// URO (Undefined Run-Ons)
export {
    fetchUrosByEntryUuid,
    fetchUroById,
    fetchUrosByUre,
    insertUro,
    insertUros,
    upsertUro,
    deleteUrosByEntryUuid,
} from "@/lib/services/dao/mw-uro";

// Pronunciations
export {
    fetchPronunciationsByOwner,
    fetchHwiPronunciations,
    fetchPronunciationsByDroId,
    fetchPronunciationsByUroId,
    fetchPronunciationById,
    fetchPronunciationsBySoundAudio,
    insertPronunciation,
    insertPronunciations,
    upsertPronunciation,
    deletePronunciationsByEntryUuid,
    deletePronunciationsByOwner,
} from "@/lib/services/dao/mw-pronunciation";

