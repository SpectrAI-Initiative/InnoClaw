import type { FileUIPart, UIMessage } from "ai";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read file as data URL"));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

export function isImageFilePart(part: unknown): part is FileUIPart {
  if (!part || typeof part !== "object") return false;

  const candidate = part as Partial<FileUIPart>;
  return (
    candidate.type === "file" &&
    typeof candidate.mediaType === "string" &&
    candidate.mediaType.startsWith("image/") &&
    typeof candidate.url === "string" &&
    candidate.url.length > 0
  );
}

export function extractImageFilesFromClipboard(
  clipboardData: DataTransfer | null,
): File[] {
  if (!clipboardData) return [];

  return Array.from(clipboardData.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file instanceof File);
}

export async function createImageFileParts(
  files: File[],
): Promise<FileUIPart[]> {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));

  return Promise.all(
    imageFiles.map(async (file) => ({
      type: "file" as const,
      mediaType: file.type,
      filename: file.name,
      url: await readFileAsDataUrl(file),
    })),
  );
}

export function getImageFileParts(message: UIMessage): FileUIPart[] {
  return message.parts?.filter(isImageFilePart) ?? [];
}
