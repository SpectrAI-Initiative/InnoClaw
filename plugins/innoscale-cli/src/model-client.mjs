export async function getModelSettings(apiClient) {
  const { payload } = await apiClient.requestJson("/api/settings", {
    timeoutMs: 10_000,
  });
  return {
    provider: payload.llmProvider,
    model: payload.llmModel,
  };
}

export function parseModelCommandArgs(args, currentProvider) {
  if (!Array.isArray(args) || args.length === 0) {
    return { action: "show" };
  }

  if (args[0] !== "set") {
    throw new Error("Usage: /model | /model set <model> | /model set <provider> <model>");
  }

  if (args.length === 2) {
    return {
      action: "set",
      provider: currentProvider,
      model: args[1],
    };
  }

  if (args.length >= 3) {
    return {
      action: "set",
      provider: args[1],
      model: args.slice(2).join(" "),
    };
  }

  throw new Error("Usage: /model | /model set <model> | /model set <provider> <model>");
}

export async function setModelSettings(apiClient, { provider, model }) {
  const trimmedProvider = typeof provider === "string" ? provider.trim() : "";
  const trimmedModel = typeof model === "string" ? model.trim() : "";
  if (!trimmedProvider || !trimmedModel) {
    throw new Error("Both provider and model are required.");
  }

  await apiClient.requestJson("/api/settings", {
    method: "PATCH",
    body: {
      llm_provider: trimmedProvider,
      llm_model: trimmedModel,
    },
    timeoutMs: 10_000,
  });

  return {
    provider: trimmedProvider,
    model: trimmedModel,
  };
}
