/**
 * 大头：理性决策引擎
 *
 * 核心问题："从资源和概率角度来看，现在抽卡是否值得？"
 * 理性价值 = 目标收益 - 资源成本 - 失败风险 - 机会成本
 *
 * 只考虑资源/概率/目标，不考虑"喜不喜欢"。
 */

function clampScore(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * @param {object} params
 * @param {number} params.totalDraws     当前总抽数
 * @param {number} params.safetyLine     资源安全线（达成目标后希望至少剩余）
 * @param {Array}  params.targets        已按优先级排序的目标：[{label, need, prob(0~1|null)}]
 */
export function bigHeadDecide({ totalDraws, safetyLine, targets }) {
  const allocatable = Math.max(0, totalDraws - safetyLine);
  let budget = allocatable;
  let consumed = 0;
  let completed = 0;
  const results = [];

  for (const t of targets) {
    const need = t.need || 0;
    if (need > 0 && budget >= need) {
      budget -= need;
      consumed += need;
      completed++;
      results.push({ ...t, status: "ok" });
    } else {
      results.push({ ...t, status: "fail" });
    }
  }

  const total = targets.length;
  const ratio = total ? completed / total : 0;
  const probList = targets.map((t) => t.prob).filter((p) => p !== null);
  const avgProb = probList.length ? probList.reduce((s, p) => s + p, 0) / probList.length : 0;

  const remaining = totalDraws - consumed;
  const breachSafety = remaining < safetyLine;

  // 评分：目标完成度 40 + 达成概率 25 + 资源富余 20 + 基础 15
  let score = 15 + 40 * ratio + 25 * avgProb + 20 * Math.max(0, Math.min(1, (totalDraws - safetyLine) / 300));
  if (breachSafety) score -= 40;
  score = clampScore(score);

  // 决策判定
  let decision = "skip";
  if (completed > 0) {
    decision = score >= 60 ? "pull" : score >= 40 ? "wait" : "skip";
  }
  // 全部完成且未突破安全线 → 强烈建议
  if (completed === total && total > 0 && !breachSafety) {
    decision = "pull";
    score = Math.max(score, 70);
  }
  // 一个都完不成 → 明确不抽
  if (completed === 0) {
    decision = "skip";
    score = Math.min(score, 30);
  }

  // 建议与停止条件
  const recommendedPulls = Math.min(consumed, allocatable);
  const stopCondition =
    completed > 0
      ? `完成前 ${completed} 个目标（含「${targets[completed - 1].label}」）后停止，预计消耗 ${consumed} 抽`
      : "当前预算无法保证任何目标，建议不抽";

  // 原因
  const reasons = [];
  if (breachSafety) reasons.push("突破资源安全线（预计剩余不足）");
  if (completed === total && total > 0) reasons.push("所有目标均可按优先级完成");
  else if (completed > 0) reasons.push(`仅能保证 ${completed}/${total} 个目标`);
  if (avgProb > 0.9) reasons.push("目标达成概率高");
  else if (avgProb > 0) reasons.push(`目标平均达成概率约 ${Math.round(avgProb * 100)}%`);
  if (allocatable <= 0) reasons.push("可用预算为 0，不存在可消耗资源");
  if (reasons.length === 0) reasons.push("理性评估：收益与风险均衡");

  return {
    head: "big",
    decision,
    score,
    recommendedPulls,
    stopCondition,
    reasons,
    highRisk: breachSafety,
    results,
    meta: { allocatable, consumed, completed, total, avgProb, remaining, safetyLine },
  };
}
