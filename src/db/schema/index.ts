/**
 * The full schema. Split by area for readability; Drizzle Kit reads this file.
 *
 * Embeddings (contact_preferences, properties, rag_chunks) are deliberately NOT here:
 * they need pgvector and belong to Phase 2 (matching) and Phase 4 (compliance corpus).
 * They arrive in their own migration so Phase 1 is not blocked on an extension it does
 * not yet use.
 */
export * from "./shared";
export * from "./tenancy";
export * from "./contacts";
export * from "./stock";
export * from "./engine";
export * from "./ops";
