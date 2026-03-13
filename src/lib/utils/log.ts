/** Swallow a promise rejection with a warning log instead of silent ignore. */
export function logAndIgnore(context: string) {
  return (err: unknown) => {
    console.warn(`[${context}]`, err instanceof Error ? err.message : err);
  };
}
