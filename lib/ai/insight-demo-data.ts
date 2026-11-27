/**
 * 本地验证专用：研究构思 / 论文讨论的演示数据。
 * 当线上模型额度耗尽时，用格式与真实接口一致的多阶段内容填充界面，
 * 让用户能完整体验交互流程。所有内容明确标注为“演示数据”。
 * 开启方式：环境变量 INSIGHT_DEMO_MODE=1（默认开启）。
 */

export function insightDemoModeEnabled(): boolean {
  const value = (process.env.INSIGHT_DEMO_MODE ?? "1").trim();
  return value !== "0" && value.toLowerCase() !== "false";
}

const DEMO_NOTICE =
  "> ⚠️ **演示数据**：以下内容为本地演示样例（线上模型额度耗尽时的占位内容），非真实模型对本文的分析结果。";

function shortTitle(title: string): string {
  const cleaned = title.replace(/\s+/g, " ").trim();
  return cleaned.length > 60 ? `${cleaned.slice(0, 60)}…` : cleaned;
}

type DemoTurn = {
  stageId: string;
  roleId: string;
  content: string;
  timestamp: string;
};

const now = () => new Date().toISOString();

export function buildIdeationDemo(opts: {
  title: string;
  abstract?: string;
  userSeed?: string;
  mode?: string;
}): DemoTurn[] {
  const title = shortTitle(opts.title || "该论文");
  const seed = opts.userSeed?.trim();
  const seedLine = seed ? `\n\n用户关注点：${seed}` : "";
  const ts = now();
  return [
    {
      stageId: "hypothesis_generation",
      roleId: "ideator",
      content: `${DEMO_NOTICE}\n\n# 假设生成 · ${title}\n\n基于论文《${title}》的核心方法，提出以下可检验假设：\n\n1. **假设一**：将论文提出的核心机制迁移到更大规模数据场景时，性能增益随数据量的增加而单调上升，但边际收益在某一规模后递减。\n2. **假设二**：该方法对输入分布偏移的鲁棒性来源于其结构化归纳偏置，移除该偏置后泛化差距将显著扩大。\n3. **假设三**：在相同算力预算下，该方法的收敛速度优于基线，但优势主要集中在训练早期。${seedLine}\n\n以上为演示占位假设，用于展示多阶段构思流程。`,
      timestamp: ts,
    },
    {
      stageId: "feasibility_review",
      roleId: "feasibility_checker",
      content: `${DEMO_NOTICE}\n\n# 可行性评审\n\n- **假设一**：可行性高。可用公开数据集做规模消融，实验成本可控。\n- **假设二**：可行性中。需要构造分布偏移测试集，建议采用合成扰动 + 真实跨域数据双轨验证。\n- **假设三**：可行性高。直接记录训练曲线与 wall-clock 时间即可。\n\n主要风险：超参敏感性可能混淆结论，需固定随机种子并多次重复。\n\n*（演示数据）*`,
      timestamp: ts,
    },
    {
      stageId: "experiment_design",
      roleId: "experimentalist",
      content: `${DEMO_NOTICE}\n\n# 实验设计\n\n**总体方案**：三因素析因实验——数据规模（小/中/大）× 方法（本文/基线）× 分布（in-domain/out-of-domain）。\n\n**评价指标**：主指标为任务性能（如准确率/F1），辅指标为收敛步数、wall-clock 时间与显存占用。\n\n**对照组**：① 无结构化偏置的消融版；② 同参数量的强基线。\n\n**重复次数**：每个配置 3 个随机种子，报告均值 ± 标准差。\n\n*（演示数据）*`,
      timestamp: ts,
    },
    {
      stageId: "review",
      roleId: "reviewer",
      content: `${DEMO_NOTICE}\n\n# 审查与批评\n\n- 当前设计对“规模增益递减”的判定缺乏明确的统计检验，建议加入趋势显著性检验。\n- 分布偏移的构造方式可能引入混杂因素，需要证明扰动幅度在两组间可比。\n- 建议补充计算成本归一化后的性能对比，避免只比较绝对指标。\n\n*（演示数据）*`,
      timestamp: ts,
    },
    {
      stageId: "final_report",
      roleId: "scribe",
      content: `${DEMO_NOTICE}\n\n# 最终报告 · 研究构思汇总\n\n围绕《${title}》，本演示给出一条完整构思路径：\n\n1. 从核心机制出发提出三条可检验假设；\n2. 逐条评估可行性并识别主要风险；\n3. 设计三因素析因实验，明确指标、对照与重复策略；\n4. 通过同行评审补足统计与混杂因素控制。\n\n**后续建议**：优先落地假设三（成本最低），再推进假设一与假设二。\n\n> 本内容为界面演示样例，待线上模型额度恢复后，可切换回真实分析。`,
      timestamp: ts,
    },
  ];
}

export function buildDiscussionDemo(opts: {
  title: string;
  abstract?: string;
  mode?: string;
}): DemoTurn[] {
  const title = shortTitle(opts.title || "该论文");
  const ts = now();
  return [
    {
      stageId: "agenda",
      roleId: "moderator",
      content: `${DEMO_NOTICE}\n\n# 讨论议程 · ${title}\n\n本次演示讨论聚焦三个问题：\n1. 论文的核心主张是否成立？\n2. 证据链是否充分、有无反例？\n3. 可复现性与适用边界如何？\n\n*（演示数据）*`,
      timestamp: ts,
    },
    {
      stageId: "evidence_summary",
      roleId: "librarian",
      content: `${DEMO_NOTICE}\n\n# 证据梳理\n\n论文通过主实验与消融实验支撑其核心主张，整体证据方向一致。但部分关键数字来自单一数据集，跨数据集的一致性需要在正式分析中进一步核对。\n\n*（演示数据）*`,
      timestamp: ts,
    },
    {
      stageId: "critique",
      roleId: "skeptic",
      content: `${DEMO_NOTICE}\n\n# 批判性意见\n\n- 基线选择是否足够强？弱基线会夸大方法增益。\n- 消融实验是否隔离了单一变量？多个因素同时变化时归因不可靠。\n- 结论的外推范围需谨慎：在本文设定下成立，不代表在更广场景成立。\n\n*（演示数据）*`,
      timestamp: ts,
    },
    {
      stageId: "reproducibility_check",
      roleId: "reproducer",
      content: `${DEMO_NOTICE}\n\n# 可复现性检查\n\n关注点：随机种子、超参搜索范围、数据预处理细节是否完整披露。建议在正式分析中按清单逐项核对，并在相同环境下复跑主实验。\n\n*（演示数据）*`,
      timestamp: ts,
    },
    {
      stageId: "convergence",
      roleId: "moderator",
      content: `${DEMO_NOTICE}\n\n# 共识收敛\n\n经演示讨论形成以下共识：核心主张方向合理，但证据广度、基线强度与复现细节是主要薄弱环节，建议作为后续验证重点。\n\n*（演示数据）*`,
      timestamp: ts,
    },
    {
      stageId: "final_report",
      roleId: "scribe",
      content: `${DEMO_NOTICE}\n\n# 最终讨论报告\n\n汇总演示讨论的主要结论与待验证问题，供后续真实分析参考。\n\n> 本内容为界面演示样例，待线上模型额度恢复后可切换回真实讨论。`,
      timestamp: ts,
    },
  ];
}

export function toNdjson(turns: DemoTurn[]): string {
  return `${turns.map((t) => JSON.stringify(t)).join("\n")}\n`;
}
