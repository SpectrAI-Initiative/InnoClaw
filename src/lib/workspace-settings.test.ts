import { describe, expect, it } from "vitest";
import { normalizeWorkspaceBrowseSettings } from "./workspace-settings";

describe("normalizeWorkspaceBrowseSettings", () => {
  it("uses the first role-aware root when the default path is blank", () => {
    expect(
      normalizeWorkspaceBrowseSettings({
        workspaceRoots: ["/research/users/user-a", "/projects/users/user-a"],
        defaultBrowsePath: "",
      }),
    ).toEqual({
      workspaceRoots: ["/research/users/user-a", "/projects/users/user-a"],
      defaultBrowsePath: "/research/users/user-a",
    });
  });

  it("preserves an explicit role-aware default path", () => {
    expect(
      normalizeWorkspaceBrowseSettings({
        workspaceRoots: ["/research/users/user-a"],
        defaultBrowsePath: "/research/users/user-a/current",
      }),
    ).toEqual({
      workspaceRoots: ["/research/users/user-a"],
      defaultBrowsePath: "/research/users/user-a/current",
    });
  });

  it("does not invent a desktop fallback when roots are absent", () => {
    expect(normalizeWorkspaceBrowseSettings({})).toEqual({
      workspaceRoots: [],
      defaultBrowsePath: "",
    });
  });
});
