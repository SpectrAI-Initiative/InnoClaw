import { NextRequest } from "next/server";
import {
  buildDiscussionDemo,
  buildIdeationDemo,
  insightDemoModeEnabled,
  toNdjson,
} from "@/lib/ai/insight-demo-data";

/**
 * Local verification only: when the local LLM credential is a placeholder,
 * forward the agent chat stream to the real online Innoscale backend using a
 * local-only session. No credentials are stored in source code.
 */

type RemoteConfig = {
  baseUrl: string;
  email: string;
  password: string;
  workspaceId: string;
};

let cachedCookie = "";
let cachedCookieAt = 0;
let cachedCwd = "";

export function shouldUseRemoteAgent(): boolean {
  return Boolean(
    process.env.REMOTE_AGENT_EMAIL &&
      process.env.REMOTE_AGENT_PASSWORD &&
      process.env.REMOTE_AGENT_WORKSPACE_ID,
  );
}

/**
 * 远端文件代理是否启用。这是本地验证专用能力：生产环境默认关闭，
 * 必须显式设置 REMOTE_AGENT_FILE_PROXY=1 才会开启。
 *
 * 原因：代理使用固定的远端账号凭据读取文件，若在生产开启，
 * 会让「本地鉴权失败」的请求绕过归属校验去读远端工作区，构成越权风险。
 */
export function shouldProxyRemoteFiles(): boolean {
  return shouldUseRemoteAgent() && process.env.REMOTE_AGENT_FILE_PROXY === "1";
}

/**
 * 校验交给远端代理的路径：必须是绝对路径，且不含 .. 穿越段。
 * 远端同名 API 会做基于其自身工作区的归属校验，这里再加一层本地防穿越。
 */
function isValidRemoteProxyPath(filePath: string): boolean {
  if (!filePath.startsWith("/")) return false;
  return !filePath.split("/").some((segment) => segment === "..");
}

/**
 * 本地验证模式：Agent 实际在远端工作区执行，生成的文件只存在于远端磁盘。
 * 右侧预览的 /api/files/* 若只读本地磁盘会因路径不在本地工作区而 403/ENOENT。
 * 这里把文件读取转发到远端同名 API（复用远端登录 Cookie），使 md/pdf/图片等
 * 交付物能被正常打开。远端不可用时返回 null，由调用方回退本地逻辑。
 */
export async function proxyRemoteFileRequest(
  endpoint: "read" | "raw" | "browse",
  filePath: string,
): Promise<Response | null> {
  if (!shouldProxyRemoteFiles() || !isValidRemoteProxyPath(filePath)) return null;
  const cfg = getRemoteConfig();
  if (!cfg) return null;

  const url = `${cfg.baseUrl}/api/files/${endpoint}?path=${encodeURIComponent(filePath)}`;
  const send = (authCookie: string) =>
    fetch(url, {
      headers: { cookie: authCookie },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

  try {
    let cookie = await getCookie(cfg);
    let upstream = await send(cookie);
    if (upstream.status === 401 || upstream.status === 403) {
      cookie = await getCookie(cfg, true);
      upstream = await send(cookie);
    }
    if (!upstream.ok || !upstream.body) return null;
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      },
    });
  } catch {
    return null;
  }
}

/**
 * Local verification only: run a plain system/user prompt against the real
 * online model (via the online Agent endpoint) and return the assembled text.
 * Used by the local OpenAI-compatible relay so server-side callers such as
 * Deep Research can reach a working model when the local key is a placeholder.
 */
export async function generateViaRemoteModel(params: {
  system?: string;
  prompt: string;
  locale?: string;
}): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const cfg = getRemoteConfig();
  if (!cfg) throw new Error("远程模型未配置");

  const messages: Array<{ role: string; parts: Array<{ type: string; text: string }> }> = [];
  if (params.system) {
    messages.push({ role: "system", parts: [{ type: "text", text: params.system }] });
  }
  messages.push({ role: "user", parts: [{ type: "text", text: params.prompt }] });

  const send = (authCookie: string, cwd: string) =>
    fetch(`${cfg.baseUrl}/api/agent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        cookie: authCookie,
      },
      body: JSON.stringify({
        messages,
        workspaceId: cfg.workspaceId,
        cwd,
        uiLocale: params.locale || "en",
      }),
      cache: "no-store",
    });

  let cookie = await getCookie(cfg);
  let cwd = await getRemoteCwd(cfg, cookie);
  let upstream = await send(cookie, cwd);
  if (upstream.status === 401 || upstream.status === 403) {
    cookie = await getCookie(cfg, true);
    cachedCwd = "";
    cwd = await getRemoteCwd(cfg, cookie);
    upstream = await send(cookie, cwd);
  }
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`远程模型 HTTP ${upstream.status}：${detail.slice(0, 300)}`);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let streamError = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const raw = trimmed.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const evt = JSON.parse(raw) as {
          type?: string;
          delta?: string;
          errorText?: string;
        };
        if (evt.type === "text-delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "error" && typeof evt.errorText === "string") {
          streamError = evt.errorText;
        }
      } catch {
        // ignore non-json events
      }
    }
  }
  if (streamError) throw new Error(streamError);
  return { text };
}

function getRemoteConfig(): RemoteConfig | null {
  const email = process.env.REMOTE_AGENT_EMAIL;
  const password = process.env.REMOTE_AGENT_PASSWORD;
  const workspaceId = process.env.REMOTE_AGENT_WORKSPACE_ID;
  if (!email || !password || !workspaceId) return null;
  return {
    baseUrl: (process.env.REMOTE_AGENT_BASE_URL || "http://innoscale.cn").replace(/\/$/, ""),
    email,
    password,
    workspaceId,
  };
}

async function login(cfg: RemoteConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`远程登录失败（HTTP ${res.status}）`);
  }

  const rawCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") || ""];
  const cookie = rawCookies
    .map((item) => item.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
  if (!cookie) {
    throw new Error("远程登录未返回会话 Cookie");
  }

  cachedCookie = cookie;
  cachedCookieAt = Date.now();
  return cookie;
}

async function getCookie(cfg: RemoteConfig, force = false): Promise<string> {
  if (!force && cachedCookie && Date.now() - cachedCookieAt < 30 * 60 * 1000) {
    return cachedCookie;
  }
  return login(cfg);
}

async function getRemoteCwd(cfg: RemoteConfig, cookie: string): Promise<string> {
  if (cachedCwd) return cachedCwd;
  const res = await fetch(
    `${cfg.baseUrl}/api/workspaces/${encodeURIComponent(cfg.workspaceId)}`,
    { headers: { cookie }, cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`读取远程工作空间失败（HTTP ${res.status}）`);
  }
  const workspace = (await res.json()) as { folderPath?: string };
  if (!workspace.folderPath) {
    throw new Error("远程工作空间没有 folderPath");
  }
  cachedCwd = workspace.folderPath;
  return cachedCwd;
}

function errorResponse(message: string, status = 502): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleRemoteAgent(req: NextRequest): Promise<Response> {
  const cfg = getRemoteConfig();
  if (!cfg) {
    return errorResponse("远程 Agent 未配置", 503);
  }

  let incoming: Record<string, unknown>;
  try {
    incoming = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("请求体不是合法 JSON", 400);
  }

  try {
    let cookie = await getCookie(cfg);
    const cwd = await getRemoteCwd(cfg, cookie);

    const payload: Record<string, unknown> = {
      ...incoming,
      workspaceId: cfg.workspaceId,
      cwd,
    };
    // Local skill ids are not guaranteed to exist online; keep the plain agent mode.
    delete payload.skillId;
    delete payload.paramValues;

    // The online deployment does not know about the UI-only SciReasoner alias
    // yet. Map it to a real callable model before forwarding.
    if (payload.llmProvider === "scireasoner" && payload.llmModel === "sci-reasoner") {
      payload.llmProvider = "deepseek";
      payload.llmModel = "deepseek-v4-pro";
    }

    // Conversation style is a local-only setting for now. Turn it into a
    // system message so the online agent applies it without a backend change.
    const style = payload.conversationStyle;
    delete payload.conversationStyle;
    if (typeof style === "string" && style.trim()) {
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      payload.messages = [
        {
          role: "system",
          parts: [
            {
              type: "text",
              text: `用户要求你遵循以下对话风格，请在本次及后续回复中始终遵守：\n${style.trim()}`,
            },
          ],
        },
        ...messages,
      ];
    }

    const send = (authCookie: string) =>
      fetch(`${cfg.baseUrl}/api/agent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          cookie: authCookie,
        },
        body: JSON.stringify(payload),
        signal: req.signal,
        cache: "no-store",
      });

    let upstream = await send(cookie);
    if (upstream.status === 401 || upstream.status === 403) {
      cookie = await getCookie(cfg, true);
      cachedCwd = "";
      upstream = await send(cookie);
    }

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return errorResponse(
        `远程对话接口 HTTP ${upstream.status}：${detail.slice(0, 400)}`,
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") || "text/event-stream",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`远程 Agent 代理失败：${message}`);
  }
}

/**
 * Local verification only: prefer the REAL online model for paper-study
 * ideation/discussion (via the working LLM relay), and fall back to clearly
 * labelled local demo data only when the real call fails or times out.
 * Set INSIGHT_DEMO_MODE=0 to disable the demo fallback.
 */
const PAPER_STUDY_REAL_TIMEOUT_MS = 30_000;

const IDEATE_STAGES = [
  { stageId: "hypothesis_generation", roleId: "ideator" },
  { stageId: "feasibility_review", roleId: "feasibility_checker" },
  { stageId: "experiment_design", roleId: "experimentalist" },
  { stageId: "review", roleId: "reviewer" },
  { stageId: "final_report", roleId: "scribe" },
];
const DISCUSS_STAGES = [
  { stageId: "agenda", roleId: "moderator" },
  { stageId: "evidence_summary", roleId: "librarian" },
  { stageId: "critique", roleId: "skeptic" },
  { stageId: "reproducibility_check", roleId: "reproducer" },
  { stageId: "convergence", roleId: "moderator" },
  { stageId: "final_report", roleId: "scribe" },
];

type GeneratedTurn = { stageId: string; roleId: string; content: string; timestamp: string };

async function generateRealPaperStudy(params: {
  endpoint: "ideate" | "discuss";
  title: string;
  abstract?: string;
  userSeed?: string;
}): Promise<GeneratedTurn[]> {
  const isIdeate = params.endpoint === "ideate";
  const stages = isIdeate ? IDEATE_STAGES : DISCUSS_STAGES;
  const stageList = stages
    .map((s, i) => `${i + 1}. stageId="${s.stageId}"：${isIdeate
      ? ["提出可检验假设", "评估可行性与风险", "给出可落地的实验设计", "批判性审查并补漏", "汇总为最终构思"][i]
      : ["拟定讨论议程", "梳理论文证据", "提出批判性意见", "检查可复现性", "收敛共识", "汇总讨论报告"][i]}`)
    .join("\n");
  const system = [
    "你是一名严谨的科研助手。请围绕给定论文生成结构化内容。",
    "只输出一个 JSON 对象，不要输出任何解释文字，格式为：",
    `{"turns":[${stages.map(() => '{"stageId":"...","content":"该阶段要点"}').join(",")}]}`,
    `必须包含以下 ${stages.length} 个阶段，顺序一致：\n${stageList}`,
    "每个阶段的 content 用 1-2 句中文、约 40-80 字给出该阶段的核心要点，务必简短具体，禁止输出“演示数据”字样。",
  ].join("\n");
  const prompt = [
    `论文标题：${params.title}`,
    `摘要：${params.abstract || "（未提供摘要）"}`,
    params.userSeed ? `用户关注点：${params.userSeed}` : "",
    isIdeate ? "请给出研究构思。" : "请展开学术讨论。",
  ].filter(Boolean).join("\n");

  const result = await generateViaRemoteModel({ system, prompt, locale: "zh-CN" });
  const match = result.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("真实模型未返回结构化内容");
  const parsed = JSON.parse(match[0]) as { turns?: Array<{ stageId?: string; content?: string }> };
  const rawTurns = Array.isArray(parsed.turns) ? parsed.turns : [];
  const turns = rawTurns
    .filter((t) => typeof t.content === "string" && t.content.trim())
    .map((t, i) => ({
      stageId: t.stageId || stages[i]?.stageId || `stage_${i + 1}`,
      roleId: stages.find((s) => s.stageId === t.stageId)?.roleId || stages[i]?.roleId || "assistant",
      content: (t.content as string).trim(),
      timestamp: new Date().toISOString(),
    }));
  if (turns.length === 0) throw new Error("真实模型返回内容为空");
  return turns;
}

export async function handleRemotePaperStudy(
  req: NextRequest,
  endpoint: "ideate" | "discuss",
): Promise<Response> {
  const cfg = getRemoteConfig();
  if (!cfg) return errorResponse("远程服务未配置", 503);

  let articleInfo: { title: string; abstract?: string } = { title: "该论文" };
  let userSeed: string | undefined;
  let mode: string | undefined;
  try {
    const payload = (await req.json()) as Record<string, unknown>;
    if (payload.article && typeof payload.article === "object") {
      const article = payload.article as { title?: string; abstract?: string };
      articleInfo = {
        title: typeof article.title === "string" ? article.title : "该论文",
        abstract: typeof article.abstract === "string" ? article.abstract : undefined,
      };
    }
    userSeed = typeof payload.userSeed === "string" ? payload.userSeed : undefined;
    mode = typeof payload.mode === "string" ? payload.mode : undefined;
  } catch {
    // ignore malformed body; fall through to defaults
  }

  const ndjsonHeaders = {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-cache, no-transform",
  };

  // ① 真实数据优先：走本地 LLM 中继（已验证可调用线上真实模型），带超时。
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("真实模型响应超时")), PAPER_STUDY_REAL_TIMEOUT_MS),
    );
    const turns = await Promise.race([
      generateRealPaperStudy({ endpoint, title: articleInfo.title, abstract: articleInfo.abstract, userSeed }),
      timeout,
    ]);
    return new Response(toNdjson(turns), { status: 200, headers: ndjsonHeaders });
  } catch (error) {
    console.error("Real paper study failed, will use demo fallback:", error);
  }

  // ② 真实接口调不通 → 演示数据兜底（内容明确标注为演示）
  if (insightDemoModeEnabled()) {
    const turns = endpoint === "ideate"
      ? buildIdeationDemo({ title: articleInfo.title, abstract: articleInfo.abstract, userSeed, mode })
      : buildDiscussionDemo({ title: articleInfo.title, abstract: articleInfo.abstract, mode });
    return new Response(toNdjson(turns), { status: 200, headers: ndjsonHeaders });
  }
  return errorResponse(
    `真实模型不可用，且演示数据已关闭（INSIGHT_DEMO_MODE=0）`,
    502,
  );
}
