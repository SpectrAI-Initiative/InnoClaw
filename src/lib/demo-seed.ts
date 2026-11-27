/**
 * 本地验证专用：首次进入工作空间时灌入演示数据。
 * - Agent 会话与消息存 localStorage（换浏览器也会各自 seed 一份）
 * - Deep Research 会话走 /api/deep-research/sessions（SQLite，带幂等标题检查）
 * 用 workspace 级标记保证只 seed 一次；用户之后的新建/删除不会被覆盖。
 */
import type { AgentSession } from "./hooks/use-agent-sessions";

const SEED_FLAG = "ib-demo-seeded:v1";
const DR_SEED_FLAG = "ib-demo-dr-seeded:v1";

/** 演示数据同样按账号隔离；key 带 scope 前缀，登录账号默认不灌入演示数据。 */
function scoped(scope: string, key: string): string {
  return `ib:${scope}:${key}`;
}

type DemoMessage = {
  id: string;
  role: "user" | "assistant";
  parts: Array<Record<string, unknown>>;
};

const QED_MESSAGES: DemoMessage[] = [
  { id: "qed-u1", role: "user", parts: [{ type: "text", text: "帮我重算这批化合物的 QED 和毒性，把风险最高的挑出来。" }] },
  {
    id: "qed-a1", role: "assistant", parts: [
      { type: "tool-bash", toolCallId: "qed-t1", state: "output-available", input: { command: "python retry_ens.py --qed --seed 3" }, output: { stdout: "412 rows · qed mean 0.612 · p10 0.181\nout    tox_qed_412.html", stderr: "", exitCode: 0 } },
      { type: "tool-bash", toolCallId: "qed-t2", state: "output-available", input: { command: "sed -i \"s/v1/v2/g\" tox.yml" }, output: { stdout: "", stderr: "exit  0 · 1 file changed", exitCode: 0 } },
      { type: "text", text: "重复完成：412 个化合物，QED 均值 0.612，p10 落在 0.181。最低的 23 个集中在 logP > 4.5 区间，和上一轮的 18 个相比多出的 5 个都是含三氟甲基的骨架。\n\n这 23 个已经单独导出成 tox_qed_412.html，hERG 风险排序放在第二列，方便你先看毒性再看成药性。" },
      { type: "tool-writeFile", toolCallId: "qed-t3", state: "output-available", input: { filePath: "QED_毒性重算_结论.md" }, output: { bytesWritten: 2867, path: "QED_毒性重算_结论.md" } },
    ],
  },
  { id: "qed-u2", role: "user", parts: [{ type: "text", text: "结论先写进一个 md，我要发给合作者。" }] },
  { id: "qed-a2", role: "assistant", parts: [{ type: "text", text: "已写入 QED_毒性重算_结论.md，包含方法参数、23 个高风险化合物的清单和 hERG 排序。" }] },
];

const OFFTARGET_MESSAGES: DemoMessage[] = [
  { id: "ot-u1", role: "user", parts: [{ type: "text", text: "帮我把上一版脱靶预测方法里假阳性的来源梳理一下。" }] },
  { id: "ot-a1", role: "assistant", parts: [{ type: "text", text: "我把 2,108 个 hit 按靶点家族重新聚了一次类。假阳性主要来自三类：激酶 ATP 口袋的保守性导致的交叉命中、荧光化合物的光谱干扰，以及细胞系表达量差异带来的背景漂移。\n\n建议先做一轮正交实验（SPR + CETSA）再进入命中确认。" }] },
  { id: "ot-u2", role: "user", parts: [{ type: "text", text: "把这三类的代表性化合物各挑 5 个出来。" }] },
  { id: "ot-a2", role: "assistant", parts: [{ type: "text", text: "已按类别各挑 5 个，共 15 个，附了原始 hit 编号和复测优先级。清单见 off_target_review.md。" }] },
  { id: "ot-u3", role: "user", parts: [{ type: "text", text: "再补一版可读的总结。" }] },
  { id: "ot-a3", role: "assistant", parts: [{ type: "text", text: "总结已生成：三类假阳性来源 + 正交实验建议 + 15 个代表化合物，可直接用于下周组会。" }] },
];

const DEMO_SESSIONS = [
  { id: "demo-offtarget", name: "脱靶预测方法...", messages: OFFTARGET_MESSAGES },
  { id: "demo-qed", name: "QED 与毒性重算", messages: QED_MESSAGES },
  { id: "demo-new", name: "新 Agent", messages: [] as DemoMessage[] },
];

function isSeeded(scope: string, workspaceId: string): boolean {
  try {
    const raw = localStorage.getItem(scoped(scope, SEED_FLAG));
    const done: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    return Boolean(done[workspaceId]);
  } catch {
    return false;
  }
}

function markSeeded(scope: string, workspaceId: string): void {
  try {
    const raw = localStorage.getItem(scoped(scope, SEED_FLAG));
    const done: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    done[workspaceId] = true;
    localStorage.setItem(scoped(scope, SEED_FLAG), JSON.stringify(done));
  } catch {
    // ignore
  }
}

/**
 * 同步 seed Agent 会话。在 useAgentSessions 读取 localStorage 之前调用。
 * 返回 seed 出的会话列表；若已 seed 过或已有会话，返回 null（让调用方走原有逻辑）。
 */
export function seedAgentSessions(scope: string, workspaceId: string): AgentSession[] | null {
  if (typeof window === "undefined" || isSeeded(scope, workspaceId)) return null;
  const sessionsKey = scoped(scope, `agent-sessions:${workspaceId}`);
  if (localStorage.getItem(sessionsKey)) {
    markSeeded(scope, workspaceId);
    return null;
  }

  const sessions: AgentSession[] = DEMO_SESSIONS.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: "2026-11-24T02:00:00.000Z",
  }));
  localStorage.setItem(sessionsKey, JSON.stringify(sessions));
  localStorage.setItem(scoped(scope, `agent-active-session:${workspaceId}`), "demo-new");
  for (const s of DEMO_SESSIONS) {
    if (s.messages.length) {
      localStorage.setItem(scoped(scope, `agent-messages:${workspaceId}:${s.id}`), JSON.stringify(s.messages));
    }
  }
  markSeeded(scope, workspaceId);
  return sessions;
}

/** 异步 seed Deep Research 会话（SQLite）。带幂等标题检查。 */
export async function seedDeepResearch(scope: string, workspaceId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const key = scoped(scope, `${DR_SEED_FLAG}:${workspaceId}`);
    if (localStorage.getItem(key)) return;
    const res = await fetch(`/api/deep-research/sessions?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (!res.ok) return;
    const list = (await res.json()) as Array<{ title?: string }>;
    if (!list.some((s) => s.title === "MARS: Multi-scale...")) {
      const created = await fetch("/api/deep-research/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, title: "MARS: Multi-scale..." }),
      });
      if (!created.ok) return; // 失败则下次再试
    }
    // 本地演示模式：把 MARS 会话填充为完整的「已完成」研究报告，避免展示 Failed。
    // 后端仅在本地验证模式（AUTH_MODE=disabled）下生效；内容均标注为演示数据。
    try {
      await fetch("/api/deep-research/demo-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
    } catch {
      // 演示 seed 失败不影响主流程
    }
    localStorage.setItem(key, "1");
    // 让左栏重新拉取 DR 列表
    window.dispatchEvent(new CustomEvent("deep-research-updated"));
  } catch {
    // 后端不可用时跳过，下次进入重试
  }
}
