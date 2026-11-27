"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildAuthPageHref,
  completeCliBrowserHandoff,
  parseCliHandoffParams,
} from "@/lib/auth/cli-handoff";
import { resolveRoleAwareRedirectPath } from "@/lib/auth/redirect-policy";
import { useAuthUser } from "@/lib/hooks/use-auth";

const BRAND_LOGO =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNi43MiIgcnk9IjYuNzIiIGZpbGw9IiMxNTFDMkYiLz48cmVjdCB4PSI3LjA1IiB5PSI2LjU1IiB3aWR0aD0iMi42MiIgaGVpZ2h0PSIxMC45IiByeD0iMS4zMSIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xMC4zIDYuNTVoMy41YTMuMDUgMy4wNSAwIDAgMSAwIDUuOUgxMC4zeiIgZmlsbD0iI0ZGRkZGRiIvPjxwYXRoIGQ9Ik0xMC4zIDEyLjloMy4yYTIuOSAyLjkgMCAwIDEgMCA1LjZIMTAuM3oiIGZpbGw9IiNGRkZGRkYiLz48Y2lyY2xlIGN4PSIxMC42IiBjeT0iMTAuMTUiIHI9IjEuNiIgZmlsbD0iIzRBNUNGNSIvPjwvc3ZnPg==";

function resolvePostRegisterPath(next: string | null, role: "admin" | "user", requiresSetup = false): string {
  // 本地 Demo：注册完成直接进工作空间页，不跳转到后台设置。
  return resolveRoleAwareRedirectPath(next, role, "/");
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthDisabled } = useAuthUser();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cliHandoffLoading, setCliHandoffLoading] = useState(false);
  const redirectingRef = useRef(false);
  const loginHref = buildAuthPageHref("/login", searchParams);
  const cliHandoff = parseCliHandoffParams(searchParams);

  useEffect(() => {
    if (redirectingRef.current) return;
    if (isAuthDisabled) window.location.replace("/");
  }, [isAuthDisabled]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }
      await completeCliBrowserHandoff(searchParams);
      const role = data.user?.role === "admin" ? "admin" : "user";
      redirectingRef.current = true;
      window.location.replace(resolvePostRegisterPath(searchParams.get("next"), role, data.requiresSetup));
      return;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleCliHandoffClick() {
    setCliHandoffLoading(true);
    setError("");
    try {
      await completeCliBrowserHandoff(searchParams);
      const role = user?.role === "admin" ? "admin" : "user";
      router.replace(resolvePostRegisterPath(searchParams.get("next"), role));
      router.refresh();
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : "CLI 登录失败");
    } finally {
      setCliHandoffLoading(false);
    }
  }

  if (isAuthDisabled) {
    return <main className="ib-auth"><p className="ib-auth-redirect">认证已关闭，正在跳转…</p></main>;
  }
  if (user && cliHandoff) {
    return (
      <main className="ib-auth">
        <div className="au-card au-card-cli">
          <div className="au-brand"><span className="au-logo" style={{ backgroundImage: `url("${BRAND_LOGO}")` }} /><span className="au-word">Innoscale</span></div>
          <div className="au-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v12M3 8h10"/><circle cx="12" cy="17" r="3"/></svg>
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

  return (
    <main className="ib-auth">
      <div className="au-card">
        <div className="au-brand"><span className="au-logo" style={{ backgroundImage: `url("${BRAND_LOGO}")` }} /><span className="au-word">Innoscale</span></div>
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div className="au-field">
            <label className="au-lb" htmlFor="name">昵称</label>
            <input className="au-in" id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="怎么称呼你" />
          </div>
          <div className="au-field">
            <label className="au-lb" htmlFor="email">邮箱</label>
            <input className="au-in" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@lab.com" required />
          </div>
          <div className="au-field">
            <label className="au-lb" htmlFor="password">密码</label>
            <input className="au-in" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="至少 8 位" minLength={8} required />
          </div>
          {error && <p className="au-err" role="alert">{error}</p>}
          <button className="au-btn" type="submit" disabled={loading}>{loading ? "创建中…" : "创建账号"}</button>
        </form>
        <p className="au-foot"><span>已有账号？</span><Link className="au-link" href={loginHref}>登录</Link></p>
      </div>
    </main>
  );
}
