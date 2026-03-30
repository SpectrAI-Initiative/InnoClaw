import type { ModelMessage, UserContent, TextPart, ImagePart } from "ai";
import { extractPaperContent, extractPaperFullText, type PaperContentPart } from "./extract-paper-content";
import type { PaperArticleRef } from "./article-ref";

interface PaperModelContext {
  paperContent?: PaperContentPart[];
  retrievedEvidence?: string;
}

type UserContentPart = TextPart | ImagePart;

function paperContentToUserContent(parts: PaperContentPart[]): UserContentPart[] {
  const content: UserContentPart[] = [];

  for (const part of parts) {
    if (part.type === "text" && part.text) {
      content.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type === "image" && part.data && part.mimeType) {
      content.push({
        type: "image",
        image: Buffer.from(part.data, "base64"),
        mediaType: part.mimeType,
      });
    }
  }

  return content;
}

export async function buildPaperModelContext(
  article: PaperArticleRef,
  visionCapable: boolean,
  maxTextChars: number = 30_000,
  maxImagePages: number = 20,
): Promise<PaperModelContext> {
  if (visionCapable) {
    const paperContent = await extractPaperContent(article, true, maxImagePages);
    if (!paperContent) {
      return {};
    }

    const retrievedEvidence = paperContent
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n")
      .slice(0, maxTextChars);

    return {
      paperContent,
      retrievedEvidence: retrievedEvidence.length > 0 ? retrievedEvidence : undefined,
    };
  }

  const retrievedEvidence = await extractPaperFullText(article, maxTextChars);
  return {
    retrievedEvidence,
  };
}

export function buildPaperChatContextMessage(
  article: Pick<PaperArticleRef, "title">,
  context: PaperModelContext,
  supportsVision: boolean,
): ModelMessage | null {
  const useVision = supportsVision
    && context.paperContent
    && context.paperContent.some((part) => part.type === "image");

  if (useVision && context.paperContent) {
    const content: UserContent = [
      {
        type: "text",
        text: `## Grounding Context: Full paper pages for "${article.title ?? "this paper"}"\nUse both the extracted text and the page images below when answering.`,
      },
      ...paperContentToUserContent(context.paperContent),
    ];

    return {
      role: "user",
      content,
    };
  }

  if (context.retrievedEvidence) {
    return {
      role: "user",
      content: [
        {
          type: "text",
          text:
            `## Grounding Context: Full paper text for "${article.title ?? "this paper"}"\n` +
            "Use the following paper text as grounding context when answering.\n\n" +
            context.retrievedEvidence,
        },
      ],
    };
  }

  return null;
}
