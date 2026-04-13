# Agent Development

This page covers contributor expectations for agent-related features, tool-calling flows, and deep-research orchestration inside InnoClaw.

## Main Code Areas

Agent and research-execution behavior is spread across a few core areas:

- `src/app/api/agent/` and `src/app/api/deep-research/` for HTTP entry points
- `src/lib/ai/` for provider selection, prompts, runtime capability checks, and tool registration
- `src/lib/ai/tools/` for individual tool implementations and shared tool types
- `src/lib/agent/` for stream lifecycle and persistence behavior
- `src/lib/deep-research/` for doctrine loading, roles, orchestration, workflow policy, and execution helpers
- `src/lib/skills/` for skill import and repository-backed skill workflows
- `src/components/agent/` and `src/components/deep-research/` for UI surfaces that expose agent state and workflow progress

## Architectural Rules

- Keep route handlers thin. Parse input, validate context, select the right orchestration path, and hand off non-trivial logic to `src/lib/`.
- Keep prompts in prompt modules or doctrine/role files instead of embedding long prompt text inside route handlers or React components.
- Keep provider, model, and runtime-capability logic centralized in `src/lib/ai/` so behavior stays consistent across agent entry points.
- Treat `src/lib/ai/tool-names.ts` as the public contract for tool identity and privilege tiering.

## Agent Change Workflow

<div class="language-diagram language-diagram-en">

```{mermaid}
flowchart LR
    Start["Plan an agent change"] --> Type{"What changed?"}
    Type -- "Prompt or role" --> Prompt["Review prompt files, doctrine, parsers, and UI labels"]
    Type -- "Tool or privilege" --> Tool["Review tool names, gates, selectors, and allow/deny tests"]
    Type -- "Streaming or session" --> Stream["Review route, stream manager, persistence, and resume UI"]
    Type -- "Deep-research workflow" --> Research["Review doctrine, roles, workflow policy, routes, and UI states"]
    Prompt --> Verify["Add tests and update docs if contributor-facing"]
    Tool --> Verify
    Stream --> Verify
    Research --> Verify
    Verify --> Audit{"High-risk execution path?"}
    Audit -- "Yes" --> Approval["Confirm approval gates and audit trail remain intact"]
    Audit -- "No" --> Ship["Prepare handoff with changed contracts and validation"]
    Approval --> Ship
```
</div>

<div class="language-diagram language-diagram-zh">

```{mermaid}
flowchart LR
    Start["规划一次智能体变更"] --> Type{"变更类型是什么?"}
    Type -- "Prompt 或角色" --> Prompt["联查 prompt 文件、doctrine、解析器与 UI 标签"]
    Type -- "工具或权限" --> Tool["联查工具名称、门控、选择器与 allow/deny 测试"]
    Type -- "流式输出或会话" --> Stream["联查路由、stream manager、持久化与恢复 UI"]
    Type -- "Deep-research 工作流" --> Research["联查 doctrine、角色、工作流策略、路由与 UI 状态"]
    Prompt --> Verify["补充测试，并在影响贡献者时更新文档"]
    Tool --> Verify
    Stream --> Verify
    Research --> Verify
    Verify --> Audit{"是否涉及高风险执行路径?"}
    Audit -- "是" --> Approval["确认审批门控与审计链路仍然完整"]
    Audit -- "否" --> Ship["准备交接说明，并列出变更契约与验证"]
    Approval --> Ship
```
</div>

Use this workflow before you open a PR for agent-related changes. It is a quick way to catch the most common cross-layer regressions.

## Change Matrix

When you touch one of these agent-facing contracts, review the matching surfaces together:

- Prompt, doctrine, or role-text change: prompt modules, doctrine files, role registries, dependent parsers, and UI copy or status labels that assume those names or instructions.
- New tool or tool rename: `src/lib/ai/tool-names.ts`, the tool implementation, allow/deny logic, any selector UI, and contributor docs that describe the capability.
- Privilege-tier or approval-flow change: tool gating, runtime capability checks, UI affordances, and tests for both allowed and denied paths.
- Streaming or session-persistence change: the route entry point, `src/lib/agent/agent-stream-manager.ts`, persistence helpers, and UI components that resume or display in-flight state.
- Deep-research workflow change: doctrine loading, role registry, workflow policy, artifact/status types, API routes, and the UI components that assume those steps or states exist.

## Tooling And Privilege Boundaries

- Add new tool implementations under `src/lib/ai/tools/`.
- Use shared tool context and validation helpers instead of introducing ad hoc filesystem or shell access.
- Default new tools to least privilege. If a capability can mutate infrastructure or trigger remote execution, gate it like the existing high-privilege tool sets.
- Keep tool names stable unless you are intentionally performing a contract migration. Renames require tests, docs, and any UI selector surfaces to be updated together.
- Do not let prompt text become the only guardrail for risky capabilities. Hard privilege boundaries belong in typed runtime checks and tool registration.

## Streaming, Sessions, And UI State

- If you change how agent streams are produced or consumed, review `src/lib/agent/agent-stream-manager.ts` and mounted UI behavior together.
- Preserve resume and persistence semantics when the panel unmounts, tabs switch, or background work continues.
- Be careful with localStorage-backed keys and session identifiers. Treat them as shared contracts between route, runtime, and UI layers.
- Prefer explicit transition states and surfaced errors over silent fallback behavior that hides dropped events, unsupported tools, or resume failures.

## Deep-Research And Multi-Role Flows

- Keep doctrine loading, role definitions, and workflow policy aligned across `researcher-doctrine.ts`, `role-registry.ts`, and `workflow-policy.ts`.
- When changing role prompts or collaboration behavior, review the corresponding API routes and UI components that assume those artifacts, steps, or statuses exist.
- High-risk execution paths should remain approval-driven and auditable.
- When adding a new role, artifact type, or workflow status, verify how it appears in persistence, export/reporting paths, and the operator-facing review surfaces.

## Failure Handling And Observability

- Return explicit, typed failure states where the client or operator needs to react differently.
- Log enough request, session, provider, or tool context to debug orchestration failures without reproducing everything from scratch.
- Avoid silent provider fallback or tool suppression unless the user experience clearly communicates what capability was skipped.
- Keep approval checkpoints and audit trails intact when changing remote execution, cluster operations, or other high-risk flows.

## Testing Expectations

Choose tests based on the layer you changed:

- Route behavior: `src/app/api/**/route.test.ts`
- Provider or model-selection behavior: tests under `src/lib/ai/`
- Tool contract or parsing behavior: tests under `src/lib/ai/` or `src/lib/skills/`
- Stream/session persistence behavior: tests near `src/lib/agent/` or affected UI helpers
- Deep-research workflow logic: tests under `src/lib/deep-research/`

At minimum, new agent-facing behavior should include coverage for:

- validation and error paths
- privilege or tool-access boundaries
- provider/runtime branching where behavior differs
- any persisted session or workflow state changes

## Agent Contributor Checklist

Before requesting review for agent-related work, confirm:

- the relevant contract surfaces from the change matrix were reviewed together
- tests cover both success and failure or deny paths
- docs were updated if another contributor or operator needs to understand the new capability
- handoff notes call out changed tool names, approval boundaries, persisted keys, workflow statuses, or environment requirements

## Documentation Expectations

Update contributor docs when agent-related changes affect:

- setup or required environment variables
- available tools, privilege boundaries, or execution gates
- contributor workflow for testing, debugging, or local development
- route or workflow contracts that another developer is likely to extend

If a change is primarily internal but creates a new developer extension point, document that extension point here or in the most relevant development page.
