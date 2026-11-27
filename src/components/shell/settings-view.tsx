"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserRound, SlidersHorizontal, LifeBuoy, ChevronRight, LogOut, RefreshCw, PenLine, CreditCard, BarChart3 } from "lucide-react";
import { useAuthUser } from "@/lib/hooks/use-auth";
import { useFontSize } from "@/lib/hooks/use-font-size";
import { FONT_OPTIONS, useFontFamily } from "@/lib/hooks/use-font-family";
import { ConversationStyleSettings, SubscriptionSettings, UsageSettings } from "./settings-extras";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@innoscale.ai";

/** account rows read a timestamp; a missing one stays a quiet dash */
function formatTime(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function SettingsView({ onBack }: { onBack: () => void }) {
  const t = useTranslations("shell");
  const { user } = useAuthUser();
  const router = useRouter();
  const [section, setSection] = useState<"account" | "general" | "style" | "subscription" | "usage" | "support">("account");
  const [pending, setPending] = useState(false);

  const logout = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error(t("logoutFailed"));
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("logoutFailed"));
    } finally {
      setPending(false);
    }
  };

  const items: { id: "account" | "general" | "style" | "subscription" | "usage" | "support"; label: string; icon: typeof UserRound }[] = [
    { id: "account", label: "账号与安全", icon: UserRound },
    { id: "general", label: "通用", icon: SlidersHorizontal },
    { id: "style", label: "对话风格", icon: PenLine },
    { id: "subscription", label: "订阅", icon: CreditCard },
    { id: "usage", label: "用量", icon: BarChart3 },
    ...(SUPPORT_EMAIL ? [{ id: "support" as const, label: "联系支持", icon: LifeBuoy }] : []),
  ];

  return (
    <div className="st-view">
      <nav className="st-nav">
        <div className="st-navhd">
          <button className="st-backbtn" type="button" onClick={onBack} aria-label="返回上一页" title="返回上一页">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <span className="st-navttl">设置</span>
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={`st-navitem${section === item.id ? " on" : ""}`} onClick={() => setSection(item.id)}>
              <Icon />{item.label}
            </button>
          );
        })}
      </nav>

      <div className="st-mainin">
        <div className="st-sheet">
          {/* 账号与安全 —— demo 的单张白卡只读行 */}
          {section === "account" && (
            <section id="st-panel-account" className="st-on">
              <div className="st-phead">
                <h1 className="st-ptitle">账号与安全</h1>
                <p className="st-psub">登录邮箱与账号管理</p>
              </div>
              <div className="st-acct-combo">
                <div className="ac-row"><span className="ac-k">账号</span><span className="ac-v">{user?.email}</span></div>
                <div className="ac-row"><span className="ac-k">昵称</span><span className="ac-v ac-nick">{user?.name}<ChevronRight /></span></div>
                <div className="ac-row"><span className="ac-k">用户 ID</span><span className="ac-v ac-mono">{user?.id}</span></div>
                <div className="ac-row"><span className="ac-k">最近登录</span><span className="ac-v ac-dim">{formatTime(user?.lastLoginAt)}</span></div>
                <div className="ac-row"><span className="ac-k">注册时间</span><span className="ac-v ac-dim">{formatTime(user?.createdAt)}</span></div>
                <div className="ac-row ac-action ac-logout" role="button" tabIndex={0} onClick={() => void logout()} aria-disabled={pending}><LogOut />退出登录</div>
              </div>
            </section>
          )}

          {/* 通用 —— demo 的三张卡片，从上到下 */}
          {section === "general" && <GeneralSettings />}

          {section === "style" && <ConversationStyleSettings />}
          {section === "subscription" && <SubscriptionSettings />}
          {section === "usage" && <UsageSettings />}

          {section === "support" && SUPPORT_EMAIL && (
            <section>
              <div className="st-phead"><h1 className="st-ptitle">联系支持</h1></div>
              <a className="st-srclink" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </section>
          )}

          {/* footer closes the column so the page never ends in a void */}
          <div className="st-foot">
            <span>Innoscale {process.env.NEXT_PUBLIC_APP_VERSION || "内测版"}</span>
            <span className="dot" />
            <span>偏好设置会保存在当前浏览器</span>
            {SUPPORT_EMAIL ? (
              <>
                <span className="dot" />
                <a href={`mailto:${SUPPORT_EMAIL}`}>反馈问题</a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const t = useTranslations("shell");
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { fontSize, increase, decrease, reset } = useFontSize();
  const { fontFamily, setFontFamily, reset: resetFont } = useFontFamily();

  const setLocale = (locale: string) => {
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`;
    router.refresh();
  };

  return (
    <section id="st-panel-general" className="st-on">
      <div className="st-phead"><h1 className="st-ptitle">通用</h1><p className="st-psub">调整外观与显示偏好</p></div>
      <div className="st-gen-grid">
        <div className="st-gen-card">
          <h3>主题风格</h3>
          <p className="st-gen-desc">选择界面的明暗风格</p>
          <div className="st-gen-ctl">
            <span>外观</span>
            <select className="st-gen-sel" value={theme ?? "system"} onChange={(e) => setTheme(e.target.value)}>
              <option value="system">跟随系统</option>
              <option value="light">亮色</option>
              <option value="dark">暗色</option>
            </select>
          </div>
          <div className="st-gen-ctl" style={{ marginTop: 12 }}>
            <span>语言</span>
            <button className="st-langbtn" type="button" onClick={() => setLocale("zh")}>简体中文</button>
            <button className="st-langbtn" type="button" onClick={() => setLocale("en")}>English</button>
          </div>
        </div>

        <div className="st-gen-card">
          <h3>字号</h3>
          <p className="st-gen-desc">调整界面文字大小，范围 12–24px</p>
          <div className="st-gen-ctl st-gen-stepper">
            <button className="st-gen-step" type="button" onClick={decrease} aria-label="减小字号">−</button>
            <b>{fontSize}px</b>
            <button className="st-gen-step" type="button" onClick={increase} aria-label="增大字号">+</button>
            <button className="st-gen-reset" type="button" onClick={reset}><RefreshCw />重置</button>
          </div>
        </div>

        <div className="st-gen-card">
          <h3>字体</h3>
          <p className="st-gen-desc">选择界面字体</p>
          <div className="st-gen-ctl">
            <select className="st-gen-sel" value={fontFamily} onChange={(e) => setFontFamily(e.target.value as typeof fontFamily)}>
              {FONT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <button className="st-gen-reset" type="button" onClick={resetFont}><RefreshCw />重置</button>
          </div>
          <p className="st-gen-sample">科研人员的个人 Agent · The quick brown fox jumps over the lazy dog 0123456789</p>
        </div>
      </div>
    </section>
  );
}
