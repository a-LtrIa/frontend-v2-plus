/**
 * 概率计算引擎（MAGI 决策系统专用）
 *
 * 职责：计算目标在 N 抽内获得的概率、达成目标所需抽数、井成本等。
 * 与决策逻辑解耦：本文件只负责"不确定性"的描述，不做"抽/不抽"判断。
 *
 * 概率来源：
 * - 限定池使用预计算的 limited_probability_table.json（0~299 抽概率表，300 井）
 * - 联动池使用同表中"怪猎一期"系列键（当前联动池概率建模近似）
 * - 无概率表的目标（往期限定/常驻六星/五星）按井成本或用户设定估算
 */

import probabilityTableData from "/src/static/json/tools/limited_probability_table.json";
import { isCollaboration } from "./bannerRules.js";

/** 概率表上限（超过按 100% 处理） */
const TABLE_LENGTH = 300;

// ---------- 目标类型定义 ----------
// prob 字段：映射概率表键位（limited=拿到限定 / all=限定+陪跑）
// sparkCost：走数据契约兑换（井）时的成本
// defaultNeed：无概率表目标时的估算所需抽数
export const GOAL_TYPES = [
  { type: "limited", label: "获得限定", prob: "limited", sparkCost: 300, defaultNeed: 0 },
  { type: "limitedAll", label: "获得限定+陪跑", prob: "all", sparkCost: 300, defaultNeed: 0 },
  { type: "past300", label: "特定往期限定（未降井，300井）", prob: null, sparkCost: 300, defaultNeed: 300 },
  { type: "past200", label: "特定往期限定（已降井，200井）", prob: null, sparkCost: 200, defaultNeed: 200 },
  { type: "fiveStar", label: "获得目标五星", prob: null, sparkCost: null, defaultNeed: 100 },
  { type: "standard6", label: "补充常驻六星", prob: null, sparkCost: null, defaultNeed: 34 },
  { type: "custom", label: "自定义目标", prob: null, sparkCost: null, defaultNeed: 100 },
];

export function getGoalType(type) {
  return GOAL_TYPES.find((t) => t.type === type) ?? GOAL_TYPES[GOAL_TYPES.length - 1];
}

/** 根据活动类型返回概率表键位 */
export function getProbabilityKeys(activityType) {
  if (isCollaboration(activityType)) {
    return {
      limited: "怪猎一期获得UP6星干员",
      all: "怪猎一期获得UP6星干员和全部2名UP5星干员",
    };
  }
  return { limited: "limited300", all: "all300" };
}

/** 读取概率表中第 pulls 抽处的概率（0~1），超过表长按 1 处理 */
function rawProbability(key, pulls) {
  if (pulls <= 0) return 0;
  if (pulls >= TABLE_LENGTH) return 1;
  const row = probabilityTableData[key];
  if (!row || row[pulls] === undefined) return 1;
  return row[pulls];
}

/** P(目标在 N 抽内获得)，返回 0~100 的百分数 */
export function probabilityAt(key, pulls) {
  return rawProbability(key, Math.floor(pulls)) * 100;
}

/** 反查概率表：达到 threshold（0~1）所需的最小抽数，未达到返回表长（300） */
export function findDrawsForProbability(key, threshold) {
  const row = probabilityTableData[key];
  if (!row) return TABLE_LENGTH;
  for (let i = 0; i < row.length; i++) {
    if (row[i] >= threshold) return i + 1;
  }
  return TABLE_LENGTH;
}

/**
 * 解析单个目标：得出所需抽数 need 与在给定抽数下的达成概率 prob（0~1，无概率表为 null）
 * @param {object} goal { type, need }  need 为用户自定义的所需抽数（概率型目标会覆盖）
 * @param {string} activityType 卡池活动类型
 * @param {number} threshold 概率接受阈值（0~1）
 * @param {number} pulls 当前总抽数
 */
export function resolveTarget(goal, activityType, threshold, pulls) {
  const typeDef = getGoalType(goal.type);
  const keys = getProbabilityKeys(activityType);

  // 概率型目标：所需抽数 = 达到阈值的最小抽数，概率 = 当前抽数下概率
  if (typeDef.prob) {
    const key = keys[typeDef.prob];
    return {
      ...goal,
      probKey: key,
      need: findDrawsForProbability(key, threshold),
      prob: rawProbability(key, Math.floor(pulls)),
      sparkCost: typeDef.sparkCost,
    };
  }

  // 井目标（往期限定）：走数据契约兑换，抽满即得
  if (typeDef.sparkCost) {
    return {
      ...goal,
      probKey: null,
      need: typeDef.sparkCost,
      prob: null,
      sparkCost: typeDef.sparkCost,
    };
  }

  // 无概率表目标：使用用户设定（默认估算值）
  return {
    ...goal,
    probKey: null,
    need: goal.need ?? typeDef.defaultNeed,
    prob: null,
    sparkCost: null,
  };
}
