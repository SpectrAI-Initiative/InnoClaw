# Collaboration

This page defines how contributors should collaborate in a shared repository, whether the other contributor is a human teammate or an automation tool.

## Shared-Tree Workflow

<div class="language-diagram language-diagram-en">

```{mermaid}
flowchart LR
    Start["Start work"] --> Status["Check git status"]
    Status --> Dirty{"Dirty or shared worktree?"}
    Dirty -- "No" --> Scope["Confirm task scope and contracts"]
    Dirty -- "Yes" --> ReRead["Re-read active files and identify unrelated changes"]
    ReRead --> Conflict{"Direct conflict?"}
    Conflict -- "Yes" --> Coordinate["Pause and coordinate before editing"]
    Conflict -- "No" --> Scope
    Scope --> Edit["Make focused edits"]
    Edit --> Contract{"Changed shared contract?"}
    Contract -- "Yes" --> Update["Update tests, docs, and handoff notes"]
    Contract -- "No" --> Validate["Run required validation"]
    Update --> Validate
    Validate --> Handoff["Share summary, contracts, validation, and follow-ups"]
```
</div>

<div class="language-diagram language-diagram-zh">

```{mermaid}
flowchart LR
    Start["开始工作"] --> Status["检查 git status"]
    Status --> Dirty{"是否为脏工作树或共享工作树?"}
    Dirty -- "否" --> Scope["确认任务范围与共享契约"]
    Dirty -- "是" --> ReRead["重读活跃文件并识别无关改动"]
    ReRead --> Conflict{"是否存在直接冲突?"}
    Conflict -- "是" --> Coordinate["暂停编辑并先协调"]
    Conflict -- "否" --> Scope
    Scope --> Edit["进行聚焦编辑"]
    Edit --> Contract{"是否修改了共享契约?"}
    Contract -- "是" --> Update["同步更新测试、文档与交接说明"]
    Contract -- "否" --> Validate["运行所需验证"]
    Update --> Validate
    Validate --> Handoff["共享摘要、契约、验证与后续事项"]
```
</div>

This is the default collaboration path when more than one contributor or tool may touch the tree.

## Shared-Tree Discipline

- Start by checking the current worktree state before large edits.
- Treat unrelated local changes as owned by someone else unless you have clear evidence they are disposable.
- Do not use destructive git commands to discard changes you did not make.
- Re-read files that are actively changing before editing them, especially large route handlers, shared utilities, and docs entry points.

## Before You Edit

- Decide whether the task is one concern or several. Split branches or PRs when the work mixes behavior changes, refactors, and contributor-workflow updates.
- Identify the shared contracts you might change before editing. Schema, env vars, route shapes, tool names, persisted client keys, and contributor commands all need explicit follow-through.
- Decide which validation commands and documentation updates will be required before you start writing code.

## Scope Discipline

- Keep each branch or PR focused on one engineering concern.
- Separate refactors from behavior changes unless the refactor is required to make the behavior change safe.
- Keep migrations, environment-variable changes, and API contract changes explicit rather than hiding them inside broad cleanup diffs.
- Keep generated artifacts that are required by the source change, such as migrations or `.po` updates, in the same change so reviewers can validate the full contract shift.

## Shared Contracts

Coordinate carefully when changing any of these repository-wide contracts:

- Database schema and migrations
- Environment variables and startup assumptions
- API request and response shapes
- Tool names, tool privilege levels, and skill contracts
- Persisted client/session keys such as localStorage-backed agent state
- Documentation entry points used by contributors

When you change a shared contract:

- update the relevant docs in the same change
- update tests for the contract boundary
- call out the change in the PR or handoff summary

## Reviewability

- Use descriptive branch names and Conventional Commits.
- Prefer reviewable patches over large mixed diffs.
- Include the exact verification commands you ran and the result you observed.
- For UI or workflow changes, include screenshots, short recordings, or precise reproduction notes when practical.

## Review And Handoff Checklist

Before asking for review or handing work to another contributor, include:

- what changed and the user-facing or maintainer-facing impact
- which shared contracts, migrations, or risky files deserve extra review
- the exact validation commands you ran and the result you observed
- any known follow-ups, rollout steps, or unresolved risks

Use a compact handoff format when possible:

```text
Summary:
Contracts:
Validation:
Follow-ups:
```

### Example Handoff

```text
Summary: Added repository and agent contribution flow diagrams to the development docs.
Contracts: Contributor guidance changed in AGENTS.md and docs/development/*.md; translation catalogs refreshed.
Validation: npm run lint; npm test; NEXT_TELEMETRY_DISABLED=1 npm run build; sphinx-build en/zh with -W --keep-going.
Follow-ups: Translate newly added Chinese msgstr entries if localized docs need complete coverage.
```

## Human And Automation Collaboration

- Point automation tools at `AGENTS.md` before asking them to edit the repository.
- Give automation bounded tasks with clear file or subsystem scope.
- Review generated diffs with the same skepticism you would apply to a human contribution.
- Re-run validation after automation work instead of trusting success claims from the tool.
- If an automation task changes contributor workflow, docs, or architecture boundaries, make sure the human reviewer sees those changes first.
- Tell automation what is out of bounds, which contracts are sensitive, and which verification commands are required before it starts editing.
- Treat automation summaries as hints, not truth. The reviewer is still responsible for the final contract, risk, and verification checks.

## Documentation And Translation Workflow

- English Markdown source files are the documentation source of truth.
- When English docs change, refresh `.po` files so translation drift is visible immediately.
- Keep repository-level contributor guidance aligned across `AGENTS.md`, `CONTRIBUTING.md`, and `docs/development/`.

## When To Stop And Coordinate

Pause and coordinate before proceeding if:

- another contributor's changes directly conflict with your task
- you need to rewrite a shared contract used by multiple subsystems
- you are unsure whether a local-only directory is actually being treated as source by someone else's workflow
- a migration or execution-path change could break existing environments without a clear rollout path
