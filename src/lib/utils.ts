import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract filename from a file path, handling both Unix and Windows separators.
 */
export function getFileName(filePath: string, fallback = ""): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || fallback;
}
