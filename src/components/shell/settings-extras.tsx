"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

const STYLE_STORAGE_KEY = "innoscale-conversation-style";

const STYLE_PRESETS = [
  {
    id: "conclusion",
    name: "结论先行",
    text: "先给出明确结论，再用不超过三条依据支撑；不要复述我的问题，不要铺垫。",
  },
  {
    id: "reviewer",
    name: "审稿人视角",
    text: "以严谨审稿人的视角审视我的假设，先指出漏洞与反例，再给出可执行的改进建议。",
  },
  {
    id: "reasoning",
    name: "逐步推导",
    text: "展示关键推理步骤与中间假设，每一步说明依据，最后给出明确结论。",
  },
  {
    id: "concise",
    name: "严谨简洁",
    text: "回答控制在 300 字以内，只陈述有依据的判断，不确定的地方明确标注。",
  },
];

export function ConversationStyleSettings() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(STYLE_STORAGE_KEY) || "";
      setText(value);
      setSaved(value);
      if (value) {
        const match = STYLE_PRESETS.find((preset) => preset.text === value);
        setActivePreset(match?.id ?? null);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const save = () => {
    const value = text.trim();
    try {
      if (value) window.localStorage.setItem(STYLE_STORAGE_KEY, value);
      else window.localStorage.removeItem(STYLE_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setSaved(value);
    window.dispatchEvent(
      new CustomEvent("innoscale:style-change", { detail: { value } }),
    );
    toast.success(value ? "对话风格已保存并应用" : "已恢复默认对话风格");
  };

  const applyPreset = (preset: (typeof STYLE_PRESETS)[number]) => {
    setText(preset.text);
    setActivePreset(preset.id);
  };

  return (
    <section id="st-panel-style" className="st-on">
      <div className="st-phead">
        <h1 className="st-ptitle">对话风格</h1>
        <p className="st-psub">定义 Innoscale 的回复方式，保存后对新对话生效</p>
      </div>

      <div className="cs-grid">
        <div className="cs-panel">
          <h3>快速预设</h3>
          <p className="cs-desc">选择一个起点，仍可继续编辑右侧内容</p>
          <div className="cs-presets">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`cs-preset${activePreset === preset.id ? " on" : ""}`}
                onClick={() => applyPreset(preset)}
              >
                <span>{preset.name}</span>
                {activePreset === preset.id ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
          <p className="cs-tip">风格要求会作为系统指令注入每一条新对话。</p>
        </div>

        <div className="cs-panel">
          <div className="cs-labelrow">
            <h3>风格要求</h3>
            <span className="cs-count">{text.length}/500</span>
          </div>
          <textarea
            className="cs-textarea"
            value={text}
            maxLength={500}
            placeholder="例如：回答先给结论，再列出三条依据；不确定处明确说明，不要编造文献。"
            onChange={(event) => {
              setText(event.target.value);
              setActivePreset(null);
            }}
          />
          <div className="cs-actions">
            <button type="button" className="cs-primary" onClick={save}>
              保存并应用
            </button>
            <button
              type="button"
              className="cs-ghost"
              onClick={() => {
                setText("");
                setActivePreset(null);
              }}
            >
              清空
            </button>
            {saved ? <span className="cs-live">已生效</span> : null}
          </div>
          <p className="cs-tip">仅影响保存后发起的新对话，历史消息不会被改写。</p>
        </div>
      </div>
    </section>
  );
}

/* ── 订阅（mock 数据） ─────────────────────────────────────────── */

type Plan = {
  id: "free" | "plus" | "pro";
  name: string;
  monthly: number;
  yearly: number;
  originalMonthly?: number;
  originalYearly?: number;
  tag?: string;
  desc: string;
  perks: string[];
  more: string[];
  featured?: boolean;
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "免费",
    monthly: 0,
    yearly: 0,
    tag: "当前方案",
    desc: "适合体验与轻量使用",
    perks: ["每月 300 算力", "基础对话与文献检索", "本地工作区", "社区支持"],
    more: [],
    cta: "当前方案",
  },
  {
    id: "plus",
    name: "Plus",
    monthly: 59,
    yearly: 499,
    originalMonthly: 99,
    originalYearly: 708,
    tag: "科研全流程",
    desc: "适合个人研究与日常任务",
    perks: [
      "每月 2,000 算力",
      "深度研究与长程记忆",
      "全部科研技能与 MCP 工具",
      "在线工作区与文件预览",
    ],
    more: ["3 个并行任务", "单文件 200MB", "优先队列"],
    featured: true,
    cta: "订阅 Plus",
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 159,
    yearly: 1299,
    originalMonthly: 299,
    originalYearly: 1908,
    tag: "团队与高性能",
    desc: "适合高强度研究与团队协作",
    perks: [
      "每月 8,000 算力",
      "Plus 全部权益",
      "团队空间与成员共享",
      "专属算力队列",
    ],
    more: ["10 个并行任务", "单文件 1GB", "优先支持"],
    cta: "订阅 Pro",
  },
];

export function SubscriptionSettings() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");

  return (
    <section id="st-panel-subscription" className="st-on">
      <div className="st-phead">
        <h1 className="st-ptitle">订阅</h1>
        <p className="st-psub">清晰的方案与透明价格，为个人与团队提供弹性算力</p>
      </div>

      <div className="sb-headrow">
        <div className="sb-cycle">
          <button
            type="button"
            className={cycle === "monthly" ? "on" : ""}
            onClick={() => setCycle("monthly")}
          >
            月付
          </button>
          <button
            type="button"
            className={cycle === "yearly" ? "on" : ""}
            onClick={() => setCycle("yearly")}
          >
            年付 <em>省 40%</em>
          </button>
        </div>
        <span className="sb-buyer">正在为「个人」购买</span>
      </div>

      <div className="sb-cards">
        {PLANS.map((plan) => {
          const price = cycle === "monthly" ? plan.monthly : plan.yearly;
          const original = cycle === "monthly" ? plan.originalMonthly : plan.originalYearly;
          return (
            <div key={plan.id} className={`sb-card${plan.featured ? " featured" : ""}`}>
              {plan.featured ? <span className="sb-ribbon">最受欢迎</span> : null}
              <div className="sb-cardhead">
                <h3>{plan.name}</h3>
                {plan.tag ? (
                  <span className={`sb-tag${plan.featured ? " accent" : ""}`}>{plan.tag}</span>
                ) : null}
              </div>
              <div className="sb-price">
                <b>¥{price}</b>
                <span>{cycle === "monthly" ? "/月" : "/年"}</span>
                {original ? <del>¥{original}</del> : null}
              </div>
              <p className="sb-desc">{plan.desc}</p>
              <button
                type="button"
                className={`sb-btn ${plan.featured ? "primary" : plan.id === "free" ? "ghost" : "outline"}`}
                disabled={plan.id === "free"}
              >
                {plan.cta}
              </button>
              <ul className="sb-perks">
                {plan.perks.map((perk) => (
                  <li key={perk}><Check size={13} />{perk}</li>
                ))}
              </ul>
              {plan.more.length > 0 ? (
                <>
                  <div className="sb-more">更多功能</div>
                  <ul className="sb-perks">
                    {plan.more.map((perk) => (
                      <li key={perk}><Check size={13} />{perk}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="sb-addon">
        <div>
          <h3>算力加量包</h3>
          <p>额度用完后可随时补充，90 天内有效</p>
        </div>
        <div className="sb-addon-right"><b>¥19</b><span>/ 500 算力</span><button type="button">购买</button></div>
      </div>

      <p className="sb-footnote">演示数据 · 订阅与支付接口尚未接入，当前页仅用于界面与交互评审。</p>
    </section>
  );
}

/* ── 用量（mock 数据） ─────────────────────────────────────────── */

const LEDGER = [
  { date: "11-27 14:12", type: "深度研究", detail: "靶点成药性调研", cost: -120, balance: 1840 },
  { date: "11-27 11:36", type: "文献检索", detail: "PubMed · KRAS G12D", cost: -10, balance: 1960 },
  { date: "11-26 17:05", type: "精读", detail: "PDF · JACS 2025", cost: -15, balance: 1970 },
  { date: "11-26 09:21", type: "对话", detail: "分子性质解释", cost: -5, balance: 1985 },
  { date: "11-25 20:40", type: "月度发放", detail: "会员额度", cost: 2000, balance: 2000 },
];

export function UsageSettings() {
  const [tab, setTab] = useState<"overview" | "ledger">("overview");

  return (
    <section id="st-panel-usage" className="st-on">
      <div className="st-phead">
        <h1 className="st-ptitle">用量</h1>
        <p className="st-psub">查看算力余额与消耗明细</p>
      </div>

      <div className="us-tabs">
        <button
          type="button"
          className={tab === "overview" ? "on" : ""}
          onClick={() => setTab("overview")}
        >
          概览
        </button>
        <button
          type="button"
          className={tab === "ledger" ? "on" : ""}
          onClick={() => setTab("ledger")}
        >
          消耗明细
        </button>
      </div>

      {tab === "overview" ? (
        <div className="us-overview">
          <div className="us-balance">
            <span>当前可用算力</span>
            <b>1,840</b>
            <em>本月 2,000 算力 · 已用 160</em>
            <button type="button">购买加量包</button>
          </div>
          <div className="us-bars">
            <div className="us-bar-card">
              <div className="us-barhead"><span>月度额度</span><b>1,840 / 2,000</b></div>
              <div className="us-track"><i style={{ width: "92%" }} /></div>
              <p>下次发放：12 月 25 日</p>
            </div>
            <div className="us-bar-card">
              <div className="us-barhead"><span>加量包</span><b>0 / 500</b></div>
              <div className="us-track addon"><i style={{ width: "0%" }} /></div>
              <p>暂无加量包</p>
            </div>
          </div>
          <div className="us-note">演示数据 · 实时用量需接入服务端账本后替换。</div>
        </div>
      ) : (
        <div className="us-ledger">
          <table>
            <thead>
              <tr><th>时间</th><th>类型</th><th>详情</th><th className="num">变动</th><th className="num">余额</th></tr>
            </thead>
            <tbody>
              {LEDGER.map((row) => (
                <tr key={`${row.date}-${row.detail}`}>
                  <td>{row.date}</td>
                  <td><span className={`us-kind${row.cost > 0 ? " plus" : ""}`}>{row.type}</span></td>
                  <td>{row.detail}</td>
                  <td className={`num${row.cost > 0 ? " plus" : ""}`}>{row.cost > 0 ? `+${row.cost}` : row.cost}</td>
                  <td className="num">{row.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
