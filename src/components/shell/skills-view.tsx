"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Search, Zap, Sparkles } from "lucide-react";
import { SkillImportDialog } from "@/components/skills/skill-import-dialog";
import { SkillClawHubImportDialog } from "@/components/skills/skill-clawhub-import-dialog";
import { useSkills } from "@/lib/hooks/use-skills";
import zhTranslations from "@/lib/skills/generated-zh-translations.json";
import type { Skill } from "@/types";

const PAGE_SIZE = 9; // demo: 3 列 × 3 行，一屏 9 个

const ZH_MAP = zhTranslations as Record<string, string>;

// 与生成脚本一致的 DJB2 哈希，用于精确匹配「技能 id + 描述」对应的 AI 中文译文。
function zhHash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) & 0xffffffff;
  return (h >>> 0).toString(16);
}

function skillZh(skill: Skill): string {
  const desc = skill.description ?? "";
  const exact = ZH_MAP[`${skill.id}:${zhHash(desc)}`];
  if (exact) return exact;
  const prefix = `${skill.id}:`;
  const fallbackKey = Object.keys(ZH_MAP).find((k) => k.startsWith(prefix));
  return fallbackKey ? ZH_MAP[fallbackKey] : desc;
}

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function SkillsView({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("skills");
  const tCommon = useTranslations("common");
  const { skills, isLoading, mutate } = useSkills(workspaceId);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [clawHubOpen, setClawHubOpen] = useState(false);
  // 每张卡片的 AI 翻译状态：true=显示中文，false/absent=显示英文原文
  const [translated, setTranslated] = useState<Record<string, boolean>>({});
  const [zhTexts, setZhTexts] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  const enabledCount = skills.filter((s) => s.isEnabled).length;

  function cardText(skill: Skill) {
    if (!translated[skill.id]) return skill.description ?? "";
    return zhTexts[skill.id] || skillZh(skill);
  }

  // 点击「AI 翻译」：优先用已生成的 AI 译文即时切换；缺失时再调用翻译接口。
  async function toggleTranslate(skill: Skill) {
    const id = skill.id;
    if (translated[id]) { setTranslated((prev) => ({ ...prev, [id]: false })); return; }
    setTranslatingId(id);
    try {
      if (!ZH_MAP[`${id}:${zhHash(skill.description ?? "")}`] && !zhTexts[id]) {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: [skill.description ?? ""], targetLanguage: "简体中文" }),
        });
        if (res.ok) {
          const data = (await res.json()) as { translations?: string[] };
          const zh = data.translations?.[0];
          if (zh) setZhTexts((prev) => ({ ...prev, [id]: zh }));
        }
      }
      setTranslated((prev) => ({ ...prev, [id]: true }));
    } finally {
      setTranslatingId(null);
    }
  }

  // 关键词筛选（对齐 demo 的搜索高亮）
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return skills.filter((s) =>
      !kw || (s.name ?? "").toLowerCase().includes(kw) || (s.slug ?? "").toLowerCase().includes(kw) || (s.description ?? "").toLowerCase().includes(kw)
    );
  }, [skills, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [q]);

  function hl(text: string) {
    const kw = q.trim();
    if (!kw) return esc(text ?? "");
    const i = (text ?? "").toLowerCase().indexOf(kw.toLowerCase());
    if (i < 0) return esc(text ?? "");
    return `${esc((text ?? "").slice(0, i))}<mark>${esc((text ?? "").slice(i, i + kw.length))}</mark>${esc((text ?? "").slice(i + kw.length))}`;
  }

  return (
    <div className="home sk2-scroll">
      <div className="wrap sk2-wrap">
        <div className="sk2-top">
          <div className="sk2-ttl"><span className="sk2-ttlb" />技能 <span className="sk2-num">{skills.length}</span></div>
          <div className="sk2-tools">
            <label className="searchbox sk2-search">
              <Search />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索技能名称或描述" aria-label="搜索技能" />
            </label>
          </div>
        </div>

        <div className="sk2-statusline">全部项目 / <b>{skills.length}</b> 个技能 · <b>{enabledCount}</b> 个已启用</div>

        {isLoading ? (
          <div className="sk2-empty">{tCommon("loading")}</div>
        ) : paged.length === 0 ? (
          <div className="sk2-empty">没有匹配的技能<span>换个关键词试试</span></div>
        ) : (
          <div className="sk2-cards">
            {paged.map((skill) => (
              <article className={`sk2-card${skill.isEnabled ? "" : " off"}`} key={skill.id}>
                <div className="sk2-cardhd">
                  <span className="sk2-cardico"><Zap /></span>
                  <span className="sk2-cardname" dangerouslySetInnerHTML={{ __html: hl(skill.name) }} />
                </div>
                <div className="sk2-cardslug">{skill.slug}</div>
                <div className={`sk2-carddesc${translated[skill.id] ? " zh" : " en"}`}>
                  <div className="sk2-carddesc-in" dangerouslySetInnerHTML={{ __html: hl(cardText(skill)) }} />
                </div>
                <div className="sk2-cardft">
                  <span className={`sk2-toggle${skill.isEnabled ? " on" : ""}`} onClick={async () => {
                    const res = await fetch(`/api/skills/${skill.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isEnabled: !skill.isEnabled }) });
                    if (!res.ok) { toast.error(t("edit")); return; }
                    mutate();
                  }}>{skill.isEnabled ? "已启用" : "已停用"}</span>
                  <button type="button" className="sk2-aibtn" disabled={translatingId === skill.id} onClick={() => void toggleTranslate(skill)}>
                    <Sparkles />{translatingId === skill.id ? "翻译中…" : translated[skill.id] ? "查看原文" : "AI翻译"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="sk2-foot">
          <span className="sk2-footinfo">第 {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} 个 / 共 {filtered.length} 个技能</span>
          <div className="sk2-pager">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={n === safePage ? "on" : ""} onClick={() => setPage(n)}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <SkillImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={mutate} />
      <SkillClawHubImportDialog open={clawHubOpen} onOpenChange={setClawHubOpen} onImported={mutate} />
    </div>
  );
}
