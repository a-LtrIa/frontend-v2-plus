/**
 * 兔头：强度决策引擎
 *
 * 核心问题："这个角色对我的游戏体验到底有多大价值？"
 * 不是简单"角色强度评分"，而是"角色强度 × 玩家实际需求"。
 *
 * 维度通过"拖动排序"体现玩家重视的强度类型，排序越靠前权重越高；
 * "体系缺口"作为普通评分维度（玩家对每个角色打多少分，代表该角色填补缺口的价值），
 * 不再做独立的全局勾选与加成。
 */

/** 兔头评分维度（候选池来源，用户可拖动选择/排序） */
export const RABBIT_HEAD_DIMS = [
  { key: "afk", label: "挂机" },
  { key: "progression", label: "开荒" },
  { key: "bigNumbers", label: "大数字" },
  { key: "mechanics", label: "特殊机制" },
  { key: "systemFit", label: "体系缺口" },
  { key: "roguelike", label: "肉鸽" },
  { key: "specific", label: "特定强度" },
  { key: "professionTeam", label: "职业队" },
  { key: "futurePotential", label: "未来潜力" },
  { key: "versatility", label: "泛用性" },
];

/** 创建默认强度评分对象 */
export function createEmptyStrength() {
  const s = {};
  for (const d of RABBIT_HEAD_DIMS) s[d.key] = 5;
  return s;
}

/** 维度 key → label */
export function dimLabelOf(key) {
  return RABBIT_HEAD_DIMS.find((d) => d.key === key)?.label ?? key;
}

/**
 * @param {object} params
 * @param {Array}  params.goals 目标：[{label, strength, dims: [{key, weight}]}]
 *
 * dims.weight 支持正负：
 * - 正权重 = 正向加分维度（排序越靠前权重越高）
 * - 负权重 = 负向减分维度（用户明确不需要的强度类型，分数越高扣得越多）
 */
export function rabbitHeadDecide({ goals }) {
  if (!goals.length) {
    return { head: "rabbit", decision: "skip", score: 0, recommendedPulls: 0, stopCondition: "未设置目标", reasons: ["未对任何角色进行强度评估"], highRisk: false };
  }
  // 未选择任何强度维度：不产生有效评分
  if (!goals.some((g) => (g.dims ?? []).length > 0)) {
    return { head: "rabbit", decision: "skip", score: 0, recommendedPulls: 0, stopCondition: "未选择强度维度", reasons: ["未选择任何强度维度，请在「④ 兔头」中拖入维度卡片并打分"], highRisk: false };
  }

  const perGoal = goals.map((g) => {
    const dims = g.dims ?? [];
    // 正向与负向分区各自归一化，最终净分 = 正向均分 - 负向均分
    let posSum = 0;
    let posWsum = 0;
    let negSum = 0;
    let negWsum = 0;
    for (const d of dims) {
      const v = g.strength?.[d.key] ?? 0;
      if (d.weight >= 0) {
        posSum += v * d.weight;
        posWsum += d.weight;
      } else {
        negSum += v * -d.weight;
        negWsum += -d.weight;
      }
    }
    const posScore = posWsum ? (posSum / posWsum / 10) * 100 : 0;
    const negScore = negWsum ? (negSum / negWsum / 10) * 100 : 0;
    const raw = posScore - negScore;
    const score = Math.round(Math.max(0, Math.min(100, raw)));
    const topDims = dims
      .filter((d) => d.weight >= 0 && (g.strength?.[d.key] ?? 0) >= 8)
      .map((d) => dimLabelOf(d.key));
    const badDims = dims
      .filter((d) => d.weight < 0 && (g.strength?.[d.key] ?? 0) >= 8)
      .map((d) => dimLabelOf(d.key));
    return { label: g.label, score, raw: Math.round(raw), topDims, badDims };
  });

  const raws = perGoal.map((g) => g.raw);
  const maxRaw = Math.max(...raws, 0);

  let decision = "skip";
  if (maxRaw >= 75) decision = "pull";
  else if (maxRaw >= 50) decision = "wait";
  else decision = "skip";

  const best = perGoal.reduce((a, b) => (b.score > a.score ? b : a), perGoal[0]);
  const reasons = [];
  if (best.score >= 75) reasons.push(`「${best.label}」强度价值高`);
  if (best.topDims.length) reasons.push(`强项：${best.topDims.slice(0, 3).join("、")}`);
  if (best.badDims.length) reasons.push(`扣分项：${best.badDims.slice(0, 3).join("、")}`);
  if (reasons.length === 0) reasons.push("强度价值一般（含负向维度扣分），不建议为其投入资源");

  return {
    head: "rabbit",
    decision,
    score: Math.round(Math.max(0, maxRaw)),
    recommendedPulls: decision === "pull" ? 300 : 0,
    stopCondition: decision === "pull" ? "获得强度价值最高的目标后停止" : "建议暂不为此抽卡",
    reasons,
    highRisk: false,
    perGoal,
  };
}
