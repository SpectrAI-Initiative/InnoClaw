# OpenAI-Compatible Reasoning Effort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply one validated OpenAI reasoning-effort setting to every OpenAI-compatible language-model call, including the operator alias `ultra` mapped to upstream-supported `xhigh`.

**Architecture:** Add a pure parser and a small AI SDK language-model wrapper under `src/lib/ai/`. `provider.ts` applies the wrapper only to the OpenAI provider and its unknown-provider OpenAI fallback, so every existing consumer inherits the setting without route-level changes; other providers and embeddings remain unchanged.

**Tech Stack:** TypeScript 6, AI SDK 6 `wrapLanguageModel`/`defaultSettingsMiddleware`, `@ai-sdk/openai`, Vitest 4, Next.js 16, Docker environment configuration.

---

## File Structure

- Create: `src/lib/ai/openai-reasoning.ts`
  - Parse `OPENAI_REASONING_EFFORT`, normalize `ultra`, and wrap an OpenAI language model.
- Create: `src/lib/ai/openai-reasoning.test.ts`
  - Accepted values, explicit errors, middleware injection, stream/generate, and caller precedence tests.
- Modify: `src/lib/ai/provider.ts`
  - Apply the wrapper in the OpenAI and unknown-provider fallback branches.
- Modify: `src/lib/ai/provider.test.ts`
  - Provider allow/deny wiring and live `.env.local` resolution tests.
- Modify: `.env.example`, `.env.production.example`
  - Document the new environment variable and `ultra` alias.
- Modify: `docs/getting-started/environment-variables.md`, `docs/docker.md`
  - Add the shared configuration contract and compatibility warning.
- Refresh: `docs/locales/zh_CN/LC_MESSAGES/*.po`
  - Update translation catalogs after English documentation changes.

---

### Task 1: Parse and Apply OpenAI Reasoning Effort

**Files:**
- Create: `src/lib/ai/openai-reasoning.ts`
- Create: `src/lib/ai/openai-reasoning.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `src/lib/ai/openai-reasoning.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import {
  applyOpenAIReasoningEffort,
  normalizeOpenAIReasoningEffort,
} from "./openai-reasoning";

describe("normalizeOpenAIReasoningEffort", () => {
  it.each(["none", "minimal", "low", "medium", "high", "xhigh"])(
    "accepts %s",
    (value) => expect(normalizeOpenAIReasoningEffort(value)).toBe(value),
  );

  it("maps the operator alias ultra to xhigh", () => {
    expect(normalizeOpenAIReasoningEffort(" Ultra ")).toBe("xhigh");
  });

  it.each([undefined, "", "   "])("preserves defaults for %s", (value) => {
    expect(normalizeOpenAIReasoningEffort(value)).toBeUndefined();
  });

  it("rejects unsupported values with the variable name", () => {
    expect(() => normalizeOpenAIReasoningEffort("extreme"))
      .toThrow(/OPENAI_REASONING_EFFORT.*none.*xhigh.*ultra/);
  });
});
```

- [ ] **Step 2: Run the test and verify missing-module failure**

Run: `npx vitest run src/lib/ai/openai-reasoning.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the parser**

Create `src/lib/ai/openai-reasoning.ts`:

```typescript
import {
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";

export const OPENAI_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export type OpenAIReasoningEffort = (typeof OPENAI_REASONING_EFFORTS)[number];

export function normalizeOpenAIReasoningEffort(
  raw: string | undefined,
): OpenAIReasoningEffort | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "ultra") return "xhigh";
  if ((OPENAI_REASONING_EFFORTS as readonly string[]).includes(normalized)) {
    return normalized as OpenAIReasoningEffort;
  }
  throw new Error(
    `OPENAI_REASONING_EFFORT must be one of ${OPENAI_REASONING_EFFORTS.join(", ")}, or ultra`,
  );
}

export function applyOpenAIReasoningEffort(
  model: LanguageModel,
  raw: string | undefined,
): LanguageModel {
  const reasoningEffort = normalizeOpenAIReasoningEffort(raw);
  if (!reasoningEffort) return model;
  return wrapLanguageModel({
    model,
    middleware: defaultSettingsMiddleware({
      settings: {
        providerOptions: {
          openai: { reasoningEffort },
        },
      },
    }),
  });
}
```

- [ ] **Step 4: Write failing middleware behavior tests**

Create a fake v3 model with `doGenerate` and `doStream` spies. Assert:

```typescript
const unchanged = applyOpenAIReasoningEffort(fakeModel, undefined);
expect(unchanged).toBe(fakeModel);

const wrapped = applyOpenAIReasoningEffort(fakeModel, "ultra");
await wrapped.doGenerate({ prompt: [] } as never);
expect(doGenerate).toHaveBeenCalledWith(expect.objectContaining({
  providerOptions: { openai: { reasoningEffort: "xhigh" } },
}));
```

Repeat for `doStream`. Pass caller options `{ openai: { reasoningEffort: "low" } }` and assert the underlying model receives `low`, proving caller overrides beat defaults.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/lib/ai/openai-reasoning.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/openai-reasoning.ts src/lib/ai/openai-reasoning.test.ts
git commit -m "feat(ai): add OpenAI reasoning effort wrapper"
```

---

### Task 2: Wire the Wrapper Through the Central Provider Factory

**Files:**
- Modify: `src/lib/ai/provider.ts`
- Modify: `src/lib/ai/provider.test.ts`

- [ ] **Step 1: Add failing provider wiring tests**

Extend the OpenAI mock so fake models implement the v3 language-model shape. Set `OPENAI_REASONING_EFFORT=ultra`, build models through exported APIs, invoke `doGenerate`, and assert:

```typescript
await generatedModel("openai", "gpt-5.6-sol");
expect(openAIDoGenerate).toHaveBeenCalledWith(expect.objectContaining({
  providerOptions: { openai: { reasoningEffort: "xhigh" } },
}));

await generatedModel("custom-openai-compatible", "gpt-5.6-sol");
expect(openAIDoGenerate).toHaveBeenCalledWith(expect.objectContaining({
  providerOptions: { openai: { reasoningEffort: "xhigh" } },
}));
```

Build `anthropic`, `gemini`, `qwen`, `moonshot`, `deepseek`, `minimax`, `zhipu`, and `shlab` models and assert they are not wrapped with OpenAI reasoning settings.

Add a `.env.local` test proving `OPENAI_REASONING_EFFORT=high` overrides a stale process value without restarting the module.

- [ ] **Step 2: Run provider tests and verify failures**

Run: `npx vitest run src/lib/ai/provider.test.ts`

Expected: FAIL because `provider.ts` does not apply the wrapper.

- [ ] **Step 3: Apply the wrapper only at OpenAI boundaries**

Import `applyOpenAIReasoningEffort`. In `buildLanguageModel`, read `const env = getCurrentEnv()` and use:

```typescript
case "openai":
  return applyOpenAIReasoningEffort(
    openai.chat(modelId),
    env.OPENAI_REASONING_EFFORT,
  );
default:
  return applyOpenAIReasoningEffort(
    openai.chat(modelId),
    env.OPENAI_REASONING_EFFORT,
  );
```

Do not apply the wrapper to embedding models, Anthropic, Gemini, or named per-model compatible providers.

- [ ] **Step 4: Run AI tests and type checking**

Run:

```bash
npx vitest run src/lib/ai/openai-reasoning.test.ts src/lib/ai/provider.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/provider.ts src/lib/ai/provider.test.ts
git commit -m "feat(ai): apply configured OpenAI reasoning effort"
```

---

### Task 3: Document the Reasoning Configuration Contract

**Files:**
- Modify: `.env.example`
- Modify: `.env.production.example`
- Modify: `docs/getting-started/environment-variables.md`
- Modify: `docs/docker.md`
- Refresh: `docs/locales/zh_CN/LC_MESSAGES/*.po`

- [ ] **Step 1: Add non-secret environment examples**

Add after the default model variables:

```ini
# OpenAI reasoning effort: none|minimal|low|medium|high|xhigh.
# ultra is accepted as an alias for xhigh.
# OPENAI_REASONING_EFFORT=high
```

- [ ] **Step 2: Update operator documentation**

Document accepted values, trimming/case normalization, omission behavior, invalid-value failure, and the `ultra -> xhigh` alias. State that it applies only to OpenAI language-model calls and not embeddings or other providers.

- [ ] **Step 3: Refresh and build documentation**

Run:

```bash
cd docs
make update-po
make html
make html-zh
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add .env.example .env.production.example docs/getting-started/environment-variables.md docs/docker.md docs/locales/zh_CN/LC_MESSAGES
git commit -m "docs(ai): document OpenAI reasoning effort"
```

---

### Task 4: Verify Local and Upstream Compatibility

**Files:**
- No product-code changes expected.
- Store only redacted evidence in ignored scratch output.

- [ ] **Step 1: Run focused and repository checks**

Run:

```bash
npx vitest run src/lib/ai/openai-reasoning.test.ts src/lib/ai/provider.test.ts
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify the upstream model catalog without printing the key**

Send an authenticated GET to `http://47.88.18.125:8080/v1/models`, parse the JSON locally, and print only whether `gpt-5.6-sol` exists. Expected: HTTP 200 and model present.

- [ ] **Step 3: Preserve the negative compatibility baseline**

Send a minimal direct request with literal `reasoning_effort: "ultra"`, redact response bodies and credentials, and record only the status and error category. Expected: HTTP 400 unsupported reasoning effort.

- [ ] **Step 4: Verify the normalized upstream request**

Send the same request with `reasoning_effort: "xhigh"` and a deterministic prompt such as `Return exactly XHIGH_OK`. Expected: HTTP 200 and response containing `XHIGH_OK`.

- [ ] **Step 5: Leave integrated InnoClaw inference for the protected rollout**

The release is not accepted until an authenticated request through the deployed InnoClaw container succeeds with:

```ini
LLM_PROVIDER=openai
LLM_MODEL=gpt-5.6-sol
OPENAI_BASE_URL=http://47.88.18.125:8080/v1
OPENAI_REASONING_EFFORT=ultra
```

The remote API key must remain only in the protected environment file and never appear in command output, commits, or validation artifacts.
