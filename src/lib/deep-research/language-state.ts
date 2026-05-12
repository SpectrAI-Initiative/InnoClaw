import type { LanguageState } from "./types";

/** Detect primary language from text using simple heuristics. */
function detectLanguage(text: string): string {
  const cjkChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const totalChars = text.replace(/\s/g, "").length;
  if (cjkChars && cjkChars.length > totalChars * 0.1) return "zh";

  const jpChars = text.match(/[\u3040-\u309f\u30a0-\u30ff]/g);
  if (jpChars && jpChars.length > 5) return "ja";

  const krChars = text.match(/[\uac00-\ud7af]/g);
  if (krChars && krChars.length > 5) return "ko";

  return "en";
}

export function resolveLanguageState(messages: { role: string; content: string }[]): LanguageState {
  const userMessages = messages.filter((message) => message.role === "user");
  const latestUserMessage = userMessages[userMessages.length - 1];
  const language = latestUserMessage ? detectLanguage(latestUserMessage.content) : "en";

  return {
    currentUserLanguage: language,
    preferredOutputLanguage: language,
    lastDetectedUserLanguage: language,
    lastLanguageUpdateAt: new Date().toISOString(),
  };
}
