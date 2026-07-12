# OpenAI-Compatible Reasoning Effort Design

## Goal

Configure InnoClaw to use the OpenAI-compatible endpoint selected by the operator, default to the configured model, and apply one explicit reasoning-effort setting to every OpenAI language-model call.

For the current deployment, the operator-facing value `ultra` maps to the upstream API's highest supported value, `xhigh`. The upstream rejects the literal value `ultra` with HTTP 400 and accepts `xhigh` with HTTP 200.

## Scope

This change adds a server-side OpenAI reasoning-effort configuration contract. It does not add a settings-page control, change non-OpenAI providers, alter embedding calls, or claim that higher reasoning improves model quality. The deployment validation proves request compatibility and correct routing, not a benchmark improvement.

## Approaches Considered

1. **Central language-model wrapper (selected).** Parse the environment setting once when an OpenAI model is built, then use AI SDK middleware to inject `providerOptions.openai.reasoningEffort`. This covers chat, agent, and deep-research consumers without editing each route.
2. **Route-by-route provider options.** Pass the option to every `streamText` or `generateText` call. This is easy to miss and couples provider configuration to HTTP and orchestration code.
3. **Deployment-only hardcoding.** Patch the remote image for one model. This is difficult to test, is lost on upgrade, and hides a shared configuration contract.

## Configuration Contract

Add `OPENAI_REASONING_EFFORT` with these accepted values:

- `none`
- `minimal`
- `low`
- `medium`
- `high`
- `xhigh`
- `ultra`, as an operator-friendly alias normalized to `xhigh`

The setting is optional. When omitted, InnoClaw preserves the AI SDK and upstream defaults. Values are trimmed and compared case-insensitively. Any other non-empty value throws an explicit configuration error naming the variable and supported values.

The target deployment uses:

- `LLM_PROVIDER=openai`
- `LLM_MODEL=gpt-5.6-sol`
- `OPENAI_BASE_URL=http://47.88.18.125:8080/v1`
- `OPENAI_REASONING_EFFORT=ultra`

The API key remains a secret in the remote `.env.production.local` file and must never be committed or printed in validation output.

## Architecture

Create a focused module under `src/lib/ai/` that owns parsing and application of the reasoning-effort contract. It accepts a `LanguageModel` and a raw configuration value. When the setting is present, it wraps the model with AI SDK `defaultSettingsMiddleware` and injects:

```ts
providerOptions: {
  openai: {
    reasoningEffort: "xhigh",
  },
}
```

`src/lib/ai/provider.ts` applies this wrapper only to models built through the OpenAI provider, including the existing unknown-provider fallback that resolves through OpenAI compatibility. Gemini and the named per-model compatible providers retain their current behavior.

This boundary keeps provider wiring in `src/lib/ai/`, leaves UI components and route handlers unchanged, and makes every consumer of `getConfiguredModelWithProvider`, `getConfiguredModel`, or `getModelFromOverride` share the same default.

## Data Flow

1. Docker Compose loads the secret and model configuration into the container environment.
2. `getCurrentEnv()` resolves the latest environment value.
3. `buildLanguageModel()` creates the existing OpenAI chat model.
4. The reasoning module normalizes `OPENAI_REASONING_EFFORT`.
5. AI SDK middleware merges the normalized provider option into each generation or streaming request.
6. `@ai-sdk/openai` serializes it as `reasoning_effort: "xhigh"` for `/v1/chat/completions`.

Caller-supplied provider options retain precedence because the default-settings middleware merges defaults with call parameters.

## Error Handling

- Missing setting: preserve current behavior.
- `ultra`: normalize to `xhigh`.
- Supported standard value: pass through unchanged.
- Unsupported value: fail explicitly before sending a model request.
- Upstream rejection or timeout: surface through existing route error handling and container logs.
- Deployment failure: keep the current running container and configuration backup available for rollback until the replacement passes health checks.

## Testing and Verification

Unit tests cover:

- unset and blank values;
- every supported standard value;
- case and surrounding whitespace normalization;
- `ultra` to `xhigh` mapping;
- explicit rejection of unsupported values;
- middleware injection of `providerOptions.openai.reasoningEffort`;
- caller override precedence.

Repository validation runs the focused tests, the provider tests, TypeScript checking, and the production build as appropriate.

Deployment validation uses three layers:

1. Upstream `/v1/models` lists `gpt-5.6-sol`.
2. A direct request with literal `ultra` remains the negative compatibility baseline, while `xhigh` must return HTTP 200 and the requested answer.
3. An authenticated request through InnoClaw must use `openai/gpt-5.6-sol`, complete successfully, and leave container logs free of provider-option or upstream errors.

This verification establishes routing and parameter compatibility. It does not establish comparative quality, safety, robustness, cost, or latency improvements.

## Rollback

Before changing the remote environment, copy `.env.production.local` to a timestamped root-readable backup. Tag or retain the currently running image. If the new image fails its health or inference checks, restore the environment file and recreate the previous container from the retained image.
