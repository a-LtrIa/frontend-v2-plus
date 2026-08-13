/**
 * 小头：角色偏好决策引擎
 *
 * 核心问题："我到底有多喜欢这个角色？"
 * 角色偏好拆为多个维度（而非单一 1~5 分），维度通过"拖动排序"体现优先级，
 * 排序越靠前权重越高，最终计算"角色主观效用值"。
 *
 * 收藏价值独立成维度（图鉴党："喜欢角色"和"想收集角色"分开）。
 */

/** 小头评分维度（候选池来源，用户可拖动选择/排序） */
export const SMALL_HEAD_DIMS = [
  { key: "art", label: "立绘" },
  { key: "chibi", label: "小人" },
  { key: "story", label: "剧情" },
  { key: "character", label: "人设" },
  { key: "voice", label: "配音" },
  { key: "artist", label: "画师" },
  { key: "fan", label: "二创" },
  { key: "xp", label: "特殊XP" },
  { key: "collection", label: "收藏价值" },
];

/** 创建默认评分对象（各维度 5 分，中立） */
export function createEmptyPref() {
  const pref = {};
  for (const d of SMALL_HEAD_DIMS) pref[d.key] = 5;
  return pref;
}

/** 维度 key → label */
export function dimLabelOf(key) {
  return SMALL_HEAD_DIMS.find((d) => d.key === key)?.label ?? key;
}

/**
 * 由排序位置生成权重：rank 1 → 1.5，rank n → 1.0（线性）
 * @param {number} rank  从 1 开始
 * @param {number} total 已选维度总数
 */
export function rankToWeight(rank, total) {
  if (total <= 1) return 1;
  return 1 + 0.5 * ((total - rank) / (total - 1));
}

/**
 * 计算单个维度在正负分区内的权重：
 * 正负各自按分区内排序计算权重（rank 1 → 1.5 线性递减），负向取负值。
 * 供页面权重显示与决策引擎的 dims 构造共用。
 * @param {Array}  list 已选维度 [{key, pos}]（pos=false 为负向）
 * @param {string} key  维度 key
 * @returns {{key: string, rank: number, weight: number, neg: boolean} | null}
 */
export function zoneRankWeight(list, key) {
  const item = list.find((it) => it.key === key);
  if (!item) return null;
  const neg = item.pos === false;
  const zone = list.filter((it) => (it.pos === false) === neg);
  const rank = zone.findIndex((it) => it.key === key) + 1;
  const weight = neg ? -rankToWeight(rank, zone.length) : rankToWeight(rank, zone.length);
  return { key, rank, weight, neg };
}

/**
 * @param {object} params
 * @param {Array}  params.goals 目标：[{label, pref, dims: [{key, weight}]}]
 *
 * dims.weight 支持正负：
 * - 正权重 = 正向加分维度（排序越靠前权重越高）
 * - 负权重 = 负向减分维度（用户明确反感/不感兴趣的维度，分数越高扣得越多）
 */
export function smallHeadDecide({ goals }) {
  if (!goals.length) {
    return { head: "small", decision: "skip", score: 0, recommendedPulls: 0, stopCondition: "未设置目标", reasons: ["未对任何角色进行偏好评分"], highRisk: false };
  }
  // 未选择任何偏好维度：不产生有效评分
  if (!goals.some((g) => (g.dims ?? []).length > 0)) {
    return { head: "small", decision: "skip", score: 0, recommendedPulls: 0, stopCondition: "未选择偏好维度", reasons: ["未选择任何偏好维度，请在「③ 小头」中拖入维度卡片并打分"], highRisk: false };
  }

  const perGoal = goals.map((g) => {
    const dims = g.dims ?? [];
    // 正向与负向分区各自归一化，最终净分 = 正向均分 - 负向均分
    let posSum = 0;
    let posWsum = 0;
    let negSum = 0;
    let negWsum = 0;
    for (const d of dims) {
      const v = g.pref?.[d.key] ?? 0;
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
      .filter((d) => d.weight >= 0 && (g.pref?.[d.key] ?? 0) >= 8)
      .map((d) => dimLabelOf(d.key));
    const badDims = dims
      .filter((d) => d.weight < 0 && (g.pref?.[d.key] ?? 0) >= 8)
      .map((d) => dimLabelOf(d.key));
    return { label: g.label, score, raw: Math.round(raw), topDims, badDims };
  });

  const raws = perGoal.map((g) => g.raw);
  const maxRaw = Math.max(...raws, 0);
  const avgRaw = raws.reduce((s, v) => s + v, 0) / raws.length;

  // 决策：最爱角色驱动（基于净分，负向减分会拉低决策）
  let decision = "skip";
  if (maxRaw >= 75) decision = "pull";
  else if (maxRaw >= 50) decision = "wait";
  else decision = "skip";

  const best = perGoal.reduce((a, b) => (b.score > a.score ? b : a), perGoal[0]);
  const reasons = [];
  if (best.score >= 75) reasons.push(`非常喜欢「${best.label}」`);
  if (best.topDims.length) reasons.push(`高分段：${best.topDims.slice(0, 3).join("、")}`);
  if (best.badDims.length) reasons.push(`减分项：${best.badDims.slice(0, 3).join("、")}`);
  if (avgRaw < 50) reasons.push("整体喜爱度一般（含负向维度扣分），抽卡动力不足");
  if (reasons.length === 0) reasons.push("喜爱度处于中等水平，可抽可不抽");

  return {
    head: "small",
    decision,
    score: Math.round(Math.max(0, maxRaw)),
    recommendedPulls: decision === "pull" ? 300 : 0,
    stopCondition: decision === "pull" ? "抽到最喜爱的目标后停止" : "建议暂不为此抽卡",
    reasons,
    highRisk: false,
    perGoal,
  };
}
