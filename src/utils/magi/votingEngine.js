/**
 * MAGI 投票引擎
 *
 * 规则（对齐项目文档）：
 * - 普通决策：2/3 多数决（pull 记为赞成票）
 * - 高风险决策：需 3/3 全票通过
 *   高风险判定：突破资源安全线 / 一次消耗超过 100 抽 / 可能导致资源归零
 *
 * MAGI 只负责建议，最终资源风险由玩家确认。
 */

/** 判断是否为高风险决策 */
export function isHighRisk({ bigHead, totalDraws }) {
  if (bigHead?.highRisk) return true;
  if (bigHead?.recommendedPulls > 100) return true;
  if (totalDraws > 0 && bigHead?.recommendedPulls >= totalDraws) return true; // 可能导致资源归零
  return false;
}

/** 单头 decision → 赞成票 */
function voteOf(decision) {
  return decision === "pull" ? 1 : 0;
}

/**
 * @param {object} params
 * @param {object} params.bigHead    大头输出
 * @param {object} params.smallHead  小头输出
 * @param {object} params.rabbitHead 兔头输出
 * @param {number} params.totalDraws 当前总抽数
 */
export function magiVote({ bigHead, smallHead, rabbitHead, totalDraws }) {
  const votes = [bigHead, smallHead, rabbitHead].map((h) => ({
    head: h.head,
    decision: h.decision,
    vote: voteOf(h.decision),
    score: h.score,
  }));

  const yes = votes.filter((v) => v.vote === 1).length;
  const no = 3 - yes;
  const highRisk = isHighRisk({ bigHead, totalDraws });
  const required = highRisk ? 3 : 2;
  const passed = yes >= required;

  // 最终建议：通过 → 抽；未通过 → 不抽；2:1 通过但高风险未全票 → 谨慎
  let decision = "skip";
  if (passed) decision = "pull";
  else if (yes === 2 && highRisk) decision = "wait";

  return {
    votes,
    vote: `${yes}:${no}`,
    yes,
    no,
    highRisk,
    required,
    passed,
    decision,
    recommendedPulls: bigHead.recommendedPulls,
    stopCondition: bigHead.stopCondition,
  };
}
