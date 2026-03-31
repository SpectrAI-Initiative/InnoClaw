import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
  getImageFileParts,
  isImageFilePart,
} from "./message-attachments";

describe("message attachments", () => {
  it("detects image file parts", () => {
    expect(
      isImageFilePart({
        type: "file",
        mediaType: "image/png",
        url: "data:image/png;base64,abc",
      }),
    ).toBe(true);

    expect(
      isImageFilePart({
        type: "file",
        mediaType: "text/plain",
        url: "data:text/plain;base64,abc",
      }),
    ).toBe(false);
  });

  it("extracts only image file parts from a message", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "user",
      parts: [
        { type: "text", text: "hello" },
        {
          type: "file",
          mediaType: "image/jpeg",
          url: "data:image/jpeg;base64,abc",
          filename: "one.jpg",
        },
        {
          type: "file",
          mediaType: "application/pdf",
          url: "data:application/pdf;base64,abc",
          filename: "two.pdf",
        },
      ],
    };

    expect(getImageFileParts(message)).toEqual([
      {
        type: "file",
        mediaType: "image/jpeg",
        url: "data:image/jpeg;base64,abc",
        filename: "one.jpg",
      },
    ]);
  });
});
