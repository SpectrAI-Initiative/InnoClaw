// Barrel re-export — all prompt builders are now in domain-specific modules.
// Existing imports from "@/lib/ai/prompts" continue to work unchanged.
export * from "./chat-prompts";
export * from "./agent-prompts";
export * from "./paper-prompts";
export * from "./report-prompts";
