import type { UIMessage } from "ai";

/** Extract concatenated plain text from a UIMessage's text parts. */
export function getMessageText(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""
  );
}
