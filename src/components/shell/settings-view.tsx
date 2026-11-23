"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import packageJson from "../../../package.json";
import { useAuthUser } from "@/lib/hooks/use-auth";
import { useFontSize } from "@/lib/hooks/use-font-size";
import { FONT_OPTIONS, useFontFamily } from "@/lib/hooks/use-font-family";
import { RuntimeSettings } from "@/components/settings/runtime-settings";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export function SettingsView() {
  const t = useTranslations("shell");
  const { user } = useAuthUser();
  const router = useRouter();
  const [section, setSection] = useState<"account" | "general" | "about" | "support">("account");
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

  const items = [
    ["account", t("account")],
    ["general", t("general")],
    ["about", t("about")],
    ...(SUPPORT_EMAIL ? [["support", t("support")] as const] : []),
  ] as const;

  return (
    <div className="flex h-full min-h-0">
      <nav className="w-44 shrink-0 border-r border-[#e7e7e8] p-3">
        {items.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-[13px] ${section === id ? "bg-[#f1f1ee] font-medium" : "hover:bg-[#f6f6f4]"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {section === "account" && (
          <section className="max-w-lg space-y-3">
            <h2 className="text-base font-semibold">{t("account")}</h2>
            <div className="rounded-xl border border-[#e7e7e8]">
              <div className="flex justify-between px-4 py-3 text-sm"><span>{t("email")}</span><span>{user?.email}</span></div>
              <div className="flex justify-between border-t border-[#e7e7e8] px-4 py-3 text-sm"><span>{t("name")}</span><span>{user?.name}</span></div>
              <button type="button" disabled={pending} onClick={logout} className="w-full border-t border-[#e7e7e8] px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50">
                {t("logout")}
              </button>
            </div>
          </section>
        )}
        {section === "general" && <GeneralSettings />}
        {section === "about" && (
          <section>
            <h2 className="text-base font-semibold">{t("about")}</h2>
            <p className="mt-2 text-sm text-[#57574f]">Innobuddy {packageJson.version}</p>
          </section>
        )}
        {section === "support" && SUPPORT_EMAIL && (
          <section>
            <h2 className="text-base font-semibold">{t("support")}</h2>
            <a className="mt-2 block text-sm underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </section>
        )}
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
    <div className="max-w-3xl space-y-6">
      <section>
        <h2 className="text-base font-semibold">{t("general")}</h2>
        <div className="mt-3 flex gap-2">
          {(["system", "light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`rounded-md border px-3 py-1.5 text-sm ${theme === value ? "border-[#1e1e1c] bg-[#1e1e1c] text-white" : "border-[#e7e7e8]"}`}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setLocale("zh")}>简体中文</button>
          <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setLocale("en")}>English</button>
        </div>
        <div className="mt-4 flex items-center gap-3 text-sm">
          <span>{t("fontSize")}</span>
          <button type="button" onClick={decrease} className="rounded border px-2">−</button>
          <span>{fontSize}px</span>
          <button type="button" onClick={increase} className="rounded border px-2">+</button>
          <button type="button" onClick={reset} className="rounded border px-2">{t("reset")}</button>
        </div>
        <label className="mt-4 block text-sm">
          {t("fontFamily")}
          <select
            className="mt-1 block rounded-md border border-[#e7e7e8] bg-white px-2 py-1"
            value={fontFamily}
            onChange={(event) => setFontFamily(event.target.value as typeof fontFamily)}
          >
            {FONT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="mt-2 text-xs underline" onClick={resetFont}>{t("reset")}</button>
      </section>
      <section>
        <h3 className="text-sm font-semibold">{t("runtime")}</h3>
        <RuntimeSettings />
      </section>
    </div>
  );
}
