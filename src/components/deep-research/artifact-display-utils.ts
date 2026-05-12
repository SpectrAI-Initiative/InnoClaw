export function normalizeDisplayList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }
        if (item && typeof item === "object" && "name" in item && typeof item.name === "string") {
          return item.name.trim();
        }
        return "";
      })
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (value && typeof value === "object" && "name" in value && typeof value.name === "string") {
    const trimmed = value.name.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  return [];
}

export function truncateDisplayList(items: readonly string[], maxItems: number): string {
  if (items.length <= maxItems) {
    return items.join(", ");
  }

  return `${items.slice(0, maxItems).join(", ")} +${items.length - maxItems} more`;
}
