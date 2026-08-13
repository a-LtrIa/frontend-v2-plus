/**
 * 卡池规则数据库与规则引擎（MAGI 决策系统专用）
 *
 * 设计原则（对齐项目文档）：
 * - 卡池规则与 MAGI 决策逻辑分离（本文件只描述游戏规则，不做决策）
 * - 卡池数据与规则代码分离（BANNERS 是数据，RULESETS 是规则）
 * - 未来规则变化时尽可能只改数据，而不是改决策引擎
 * - 特殊卡池允许独立规则，不假设所有卡池完全相同
 *
 * 注意：实际卡池规则以官方当期寻访公告为准，本文件仅用于程序建模。
 */

/** 寻访稀有度基础概率（参考 PRTS：6★2% / 5★8% / 4★50% / 3★40%） */
const BASE_RATES = { sixStar: 0.02, fiveStar: 0.08, fourStar: 0.5, threeStar: 0.4 };

/** 六星保底：2% 基础率，每抽 +2%，100 抽必定获得 */
const DEFAULT_SIX_STAR_PITY = { enabled: true, baseRate: 0.02, increment: 0.02, guaranteedAt: 100 };

// ---------- 规则集（Ruleset）：同一类卡池共用一套规则 ----------
export const RULESETS = {
  /** 常规限定池：300 抽井、数据契约 300 兑换 6★ */
  limited300: {
    id: "limited300",
    name: "常规限定（300井）",
    rates: BASE_RATES,
    sixStarPity: DEFAULT_SIX_STAR_PITY,
    tenPullGuarantee: { enabled: true, rarity: 5, firstTenOnly: true },
    pityCarryOver: false,
    spark: { enabled: true, count: 300, sixStarCost: 300, fiveStarCost: 75 },
    dataContract: { enabled: true, perPull: 1, expireToParametricModel: true },
  },

  /** 历史限定池（已降井）：200 数据契约即可兑换 6★ */
  limited200: {
    id: "limited200",
    name: "历史限定（降井，200兑换）",
    rates: BASE_RATES,
    sixStarPity: DEFAULT_SIX_STAR_PITY,
    tenPullGuarantee: { enabled: true, rarity: 5, firstTenOnly: true },
    pityCarryOver: false,
    spark: { enabled: true, count: 300, sixStarCost: 200, fiveStarCost: 75 },
    dataContract: { enabled: true, perPull: 1, expireToParametricModel: true },
  },

  /** 联动池：无井、无数据契约，特殊保底 */
  collaboration: {
    id: "collaboration",
    name: "联动寻访",
    rates: BASE_RATES,
    sixStarPity: DEFAULT_SIX_STAR_PITY,
    tenPullGuarantee: { enabled: true, rarity: 5, firstTenOnly: true },
    pityCarryOver: false,
    spark: { enabled: false },
    dataContract: { enabled: false },
  },

  /** 中坚寻访：承接已移出标准池的早期干员 */
  kernel: {
    id: "kernel",
    name: "中坚寻访",
    rates: BASE_RATES,
    sixStarPity: DEFAULT_SIX_STAR_PITY,
    tenPullGuarantee: { enabled: true, rarity: 5, firstTenOnly: true },
    pityCarryOver: true,
    spark: { enabled: false },
    dataContract: { enabled: false },
  },
};

// ---------- 卡池定义（Banner）：数据，与规则分离 ----------
export const BANNERS = [
  {
    id: "summer",
    name: "夏活",
    series: "summer",
    activityType: "夏活限定",
    rulesetId: "limited300",
    startDate: "2026-08-01",
    lastDrawDate: "2026-08-14",
    accuracyFlag: true,
    disabled: false,
  },
  {
    id: "p3r",
    name: "P3R联动",
    series: "collaboration",
    activityType: "联动限定",
    rulesetId: "collaboration",
    startDate: "2026-09-04",
    lastDrawDate: "2026-09-17",
    accuracyFlag: false,
    disabled: false,
  },
  {
    id: "thanksgiving",
    name: "感谢庆典",
    series: "celebration",
    activityType: "周年限定",
    rulesetId: "limited300",
    startDate: "2026-11-01",
    lastDrawDate: "2026-11-14",
    accuracyFlag: false,
    disabled: true,
  },
];

/** 规则引擎入口：根据卡池 id 解析出完整规则对象 */
export function getBannerRules(bannerId) {
  const banner = BANNERS.find((b) => b.id === bannerId) ?? BANNERS[0];
  const ruleset = RULESETS[banner.rulesetId] ?? RULESETS.limited300;
  return { banner, ruleset };
}

/** 是否为联动卡池（联动池无井、概率表使用联动键） */
export function isCollaboration(activityType) {
  return ["联动限定", "双联动限定", "联动限定复刻"].includes(activityType);
}
