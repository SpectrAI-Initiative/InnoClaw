"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  buildAuthPageHref,
  completeCliBrowserHandoff,
  parseCliHandoffParams,
} from "@/lib/auth/cli-handoff";
import { resolveRoleAwareRedirectPath } from "@/lib/auth/redirect-policy";
import { useAuthUser } from "@/lib/hooks/use-auth";
// 视觉对齐：demo 的品牌 logo（与欢迎页/左栏同一枚）
const BRAND_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNi43MiIgcnk9IjYuNzIiIGZpbGw9IiMxNTFDMkYiLz48cmVjdCB4PSI3LjA1IiB5PSI2LjU1IiB3aWR0aD0iMi42MiIgaGVpZ2h0PSIxMC45IiByeD0iMS4zMSIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xMC4zIDYuNTVoMy41YTMuMDUgMy4wNSAwIDAgMSAwIDUuOUgxMC4zeiIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xMC4zIDEyLjloMy4yYTIuOSAyLjkgMCAwIDEgMCA1LjZIMTAuM3oiIGZpbGw9IiNGRkZGRkYiLz48Y2lyY2xlIGN4PSIxMC42IiBjeT0iMTAuMTUiIHI9IjEuNiIgZmlsbD0iIzRBNUNGNSIvPjwvc3ZnPg==";

function resolvePostLoginPath(next: string | null, role: "admin" | "user"): string {
  // 本地 Demo 的落地页就是工作空间选择页，不走后台管理页。
  return resolveRoleAwareRedirectPath(next, role, "/");
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthDisabled } = useAuthUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cliHandoffLoading, setCliHandoffLoading] = useState(false);
  const redirectingRef = useRef(false);
  const registerHref = buildAuthPageHref("/register", searchParams);
  const cliHandoff = parseCliHandoffParams(searchParams);

  useEffect(() => {
    if (redirectingRef.current) return;
    if (isAuthDisabled) {
      window.location.replace("/");
      return;
    }
    if (isLoading || !user) return;
    if (cliHandoff) return;
    window.location.replace(resolvePostLoginPath(searchParams.get("next"), user.role));
  }, [cliHandoff, isAuthDisabled, isLoading, searchParams, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }
      await completeCliBrowserHandoff(searchParams);
      redirectingRef.current = true;
      window.location.replace(resolvePostLoginPath(searchParams.get("next"), data.user?.role === "admin" ? "admin" : "user"));
      return;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleCliHandoffClick() {
    setCliHandoffLoading(true);
    setError("");
    try {
      await completeCliBrowserHandoff(searchParams);
      redirectingRef.current = true;
      window.location.replace(resolvePostLoginPath(searchParams.get("next"), user?.role === "admin" ? "admin" : "user"));
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : "CLI 登录失败");
    } finally {
      setCliHandoffLoading(false);
    }
  }

  if (isAuthDisabled) {
    return <main className="ib-auth"><p className="ib-auth-redirect">认证已关闭，正在跳转…</p></main>;
  }
  if (user && !cliHandoff) {
    return <main className="ib-auth"><p className="ib-auth-redirect">正在跳转…</p></main>;
  }

  // CLI handoff 完成页 —— 保留原交互
  if (user && cliHandoff) {
    return (
      <main className="ib-auth">
        <div className="au-card au-card-cli">
          <div className="au-brand"><span className="au-logo" style={{ backgroundImage: `url("${BRAND_LOGO}")` }} /><span className="au-word">Innoscale</span></div>
          <div className="au-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3.4" y="7.3" width="17.2" height="12.1" rx="3.2"/><path d="M12 2.7v2.3M9.4 16.5h5.2"/><circle cx="9" cy="12.9" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12.9" r="1.1" fill="currentColor" stroke="none"/></svg>
          </div>
          <h1 className="au-title">完成 CLI 登录</h1>
          <p className="au-sub">授权 CLI 使用你当前的浏览器会话。</p>
          {error && <p className="au-err" role="alert">{error}</p>}
          <button className="au-btn" type="button" disabled={cliHandoffLoading} onClick={handleCliHandoffClick}>
            {cliHandoffLoading ? "正在完成…" : "完成 CLI 登录"}
          </button>
        </div>
      </main>
    );
  }

  // 登录卡 —— 对齐 demo
  return (
    <main className="ib-auth">
      <div className="au-card">
        <div className="au-brand"><span className="au-logo" style={{ backgroundImage: `url("${BRAND_LOGO}")` }} /><span className="au-word">Innoscale</span></div>
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div className="au-field">
            <label className="au-lb" htmlFor="email">邮箱</label>
            <input className="au-in" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@lab.com" required />
          </div>
          <div className="au-field">
            <label className="au-lb" htmlFor="password">密码</label>
            <input className="au-in" id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" required />
          </div>
          {error && <p className="au-err" role="alert">{error}</p>}
          <button className="au-btn" type="submit" disabled={loading}>{loading ? "登录中…" : "登录"}</button>
        </form>
        <p className="au-foot"><span>还没有账号？</span><Link className="au-link" href={registerHref}>创建一个</Link></p>
      </div>
    </main>
  );
}
