<template>
  <div class="magi-page">
    <header class="magi-header">
      <h1>MAGI 抽卡决策系统</h1>
      <p class="magi-desc">
        三个目标不同的决策引擎相互制衡：🧠 大头（理性资源）· ❤️ 小头（角色偏好）· 🐇 兔头（强度价值），
        投票给出建议。维度卡片支持拖动排序（排序=权重）与正负打分（加分/减分），预算自动沿用攒抽计算器。
        MAGI 只负责建议，最终决定权在你。
      </p>
    </header>

    <!-- 三头制衡三角形 -->
    <div class="magi-triangle-wrap">
      <svg viewBox="0 0 420 380" class="magi-triangle-svg">
        <polygon
          points="210,58 372,318 48,318"
          fill="rgba(64,158,255,0.03)"
          stroke="#dcdfe6"
          stroke-width="2"
          stroke-dasharray="4 4"
        />
        <!-- 三个顶点 -->
        <g v-for="h in triHeads" :key="h.key" :transform="`translate(${h.x},${h.y})`">
          <circle r="46" :fill="h.fill" :stroke="h.color" stroke-width="2.5" />
          <text y="-14" text-anchor="middle" font-size="24">{{ h.icon }}</text>
          <text y="10" text-anchor="middle" font-size="13" font-weight="700">{{ h.name }}</text>
          <text y="28" text-anchor="middle" font-size="14" font-weight="700" :fill="h.decColor">{{ h.decText }}</text>
          <text y="42" text-anchor="middle" font-size="11" fill="#999">{{ h.scoreText }}</text>
        </g>
        <!-- 中心投票结果 -->
        <g transform="translate(210,195)">
          <circle r="54" fill="#fff" stroke="#303133" stroke-width="2" />
          <text y="-10" text-anchor="middle" font-size="15" font-weight="700" :fill="centerColor">{{ centerMain }}</text>
          <text y="10" text-anchor="middle" font-size="13" font-weight="600">{{ centerVote }}</text>
          <text y="28" text-anchor="middle" font-size="10" fill="#909399">{{ centerSub }}</text>
        </g>
      </svg>
    </div>

    <!-- ① 选择卡池 -->
    <el-card shadow="never" class="magi-card">
      <template #header><span class="magi-card-title">① 选择目标卡池</span></template>
      <el-radio-group v-model="selectedBannerId" class="magi-schedule-group">
        <el-radio-button v-for="b in BANNERS" :key="b.id" :value="b.id" :disabled="b.disabled">
          <div class="magi-schedule-item">
            <div>{{ b.name }}</div>
            <div class="magi-schedule-date">{{ b.lastDrawDate }} 截止</div>
          </div>
        </el-radio-button>
      </el-radio-group>
      <div class="magi-schedule-meta">
        <el-tag size="small" :type="isCollab ? 'warning' : 'primary'">{{ currentBanner.activityType }}</el-tag>
        <el-tag size="small" type="info">{{ currentRuleset.name }}</el-tag>
        <el-tag v-if="currentRuleset.spark?.enabled" size="small" type="success">
          井 {{ currentRuleset.spark.count }} 抽（6★兑换 {{ currentRuleset.spark.sixStarCost }} 契约）
        </el-tag>
        <el-tag v-else size="small" type="warning">无井</el-tag>
        <el-tag v-if="!currentBanner.accuracyFlag" size="small" type="info">预测排期</el-tag>
      </div>
    </el-card>

    <!-- ② 大头：理性决策（预算 + 目标 + 兜底约束） -->
    <el-card shadow="never" class="magi-card">
      <template #header><span class="magi-card-title">② 大头：理性决策（🧠）</span></template>

      <div class="magi-sub-title">
        抽卡预算
        <el-tooltip content="自动沿用攒抽计算器的计算结果，无需再次填写" placement="top">
          <span class="magi-hint">（自动沿用攒抽计算器）</span>
        </el-tooltip>
      </div>
      <div v-if="drawResult" class="magi-budget">
        <div class="magi-budget-main">
          <span>预计总抽数：</span>
          <b class="magi-number magi-budget-total">{{ totalDraws }}</b>
          <span>抽</span>
          <el-tag v-if="currentRuleset.spark?.enabled && totalDraws >= currentRuleset.spark.count" type="success" size="small">
            够井（{{ currentRuleset.spark.count }}抽）
          </el-tag>
          <el-button size="small" link type="primary" class="magi-budget-refresh" @click="loadBudgetFromCalc">重新读取</el-button>
        </div>
        <div class="magi-budget-meta">
          来源：攒抽计算器 · {{ drawResult.scheduleName }} 至 {{ drawResult.scheduleEnd }} · 计算于 {{ savedAtText }}
        </div>
        <div class="magi-budget-chips">
          <span v-for="p in budgetParts" :key="p.label" class="magi-budget-chip">
            {{ p.label }} <b>{{ p.value }}</b>
          </span>
        </div>
      </div>
      <el-alert v-else type="warning" :closable="false" class="magi-budget-empty">
        <template #title>
          尚未在攒抽计算器完成计算，请先前往攒抽计算器得出预算，MAGI 将自动沿用。
        </template>
        <el-button size="small" type="primary" @click="goGachaCalc">前往攒抽计算器</el-button>
      </el-alert>

      <div class="magi-sub-title magi-sub-title-mt">抽卡目标（拖动排序 = 优先级）</div>
      <GoalPool :goals="goals" :resolved-goals="resolvedGoals" @add="addGoal" @update:goals="onGoalsReorder" />
      <div v-if="goals.length === 0" class="magi-hint">
        从上方目标类型中点 ＋ 添加目标；<el-link type="primary" :underline="false" @click="addDefaultGoals">添加一组示例目标</el-link>
      </div>

      <div class="magi-sub-title magi-sub-title-mt">兜底约束（资源安全线）</div>
      <div class="magi-remain-row">
        <span>达成目标后希望至少剩下</span>
        <el-input-number v-model="remainDraws" :min="0" :step="10" controls-position="right" size="small" />
        <span>抽</span>
      </div>
      <div class="magi-threshold-row">
        <span>概率接受阈值：</span>
        <el-radio-group v-model="threshold" size="small">
          <el-radio-button :value="0.5">50%</el-radio-button>
          <el-radio-button :value="0.6">60%</el-radio-button>
          <el-radio-button :value="0.7">70%</el-radio-button>
          <el-radio-button :value="0.8">80%</el-radio-button>
          <el-radio-button :value="0.9">90%</el-radio-button>
          <el-radio-button :value="1">100%</el-radio-button>
        </el-radio-group>
      </div>
    </el-card>

    <!-- ③ 小头：角色偏好 -->
    <el-card shadow="never" class="magi-card">
      <template #header><span class="magi-card-title">③ 小头：角色偏好（❤️）</span></template>
      <DimensionPool v-model="smallSelected" :dims="SMALL_HEAD_DIMS" :goals="scorableGoals" :scores="prefs" />
    </el-card>

    <!-- ④ 兔头：强度需求 -->
    <el-card shadow="never" class="magi-card">
      <template #header><span class="magi-card-title">④ 兔头：强度需求（🐇）</span></template>
      <DimensionPool v-model="rabbitSelected" :dims="RABBIT_HEAD_DIMS" :goals="scorableGoals" :scores="strengths" />
    </el-card>

    <!-- ⑤ MAGI 决议 -->
    <el-card v-if="magiResult" shadow="never" class="magi-card">
      <template #header><span class="magi-card-title">⑤ MAGI 三头决议</span></template>

      <!-- 投票横幅 -->
      <div class="magi-vote-banner" :class="magiResult.vote.passed ? 'magi-vote-pass' : 'magi-vote-fail'">
        <div class="magi-vote-title">
          <template v-if="magiResult.vote.passed">🔥 MAGI 建议：抽</template>
          <template v-else-if="magiResult.vote.decision === 'wait'">⚠️ MAGI 建议：谨慎观望</template>
          <template v-else>🚫 MAGI 建议：不抽</template>
          <span class="magi-vote-count">{{ magiResult.vote.vote }}</span>
          <el-tag v-if="magiResult.vote.highRisk" type="danger" size="small">高风险决策，需 {{ magiResult.vote.required }}/3 全票</el-tag>
        </div>
        <div class="magi-vote-sub">
          建议最多抽 <b class="magi-number">{{ magiResult.vote.recommendedPulls }}</b> 抽
          <span class="magi-sep">·</span>
          停止条件：{{ magiResult.vote.stopCondition }}
        </div>
      </div>

      <!-- 三头结果 -->
      <div class="magi-head-grid">
        <div v-for="h in heads" :key="h.key" class="magi-head-card" :class="`magi-head-${h.result.decision}`">
          <div class="magi-head-title">{{ h.icon }} {{ h.name }}
            <span class="magi-head-vote">{{ h.result.decision === "pull" ? "✅ 赞成" : "❌ 反对" }}</span>
          </div>
          <div class="magi-head-decision">{{ decisionText(h.result.decision) }}</div>
          <el-progress :percentage="h.result.score" :stroke-width="8" :color="h.color" />
          <div class="magi-head-score">{{ h.result.score }} / 100</div>
          <div v-if="h.result.stopCondition" class="magi-head-stop">停止：{{ h.result.stopCondition }}</div>
          <ul class="magi-head-reasons">
            <li v-for="(r, i) in h.result.reasons" :key="i">{{ r }}</li>
          </ul>
          <div v-if="h.key === 'big' && h.result.meta" class="magi-head-meta">
            可分配 {{ h.result.meta.allocatable }} 抽 · 可完成 {{ h.result.meta.completed }}/{{ h.result.meta.total }} 目标
          </div>
        </div>
      </div>

      <div class="magi-disclaimer">以上为算法建议，最终资源风险由玩家自行确认。MAGI 不直接执行抽卡。</div>
    </el-card>

    <el-alert
      v-else
      type="info"
      :closable="false"
      title="完成以上步骤后，MAGI 将在这里给出三头决议与投票结果"
    />

    <el-alert
      type="info"
      :closable="false"
      class="magi-tip"
      title="说明：预算自动沿用攒抽计算器结果；目标与维度卡片均可拖动排序（排序=重要程度）；维度卡片内可正负打分（加分/减分）；概率复用预计算表（限定池300井）。"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import DimensionPool from "./DimensionPool.vue";
import GoalPool from "./GoalPool.vue";
import { BANNERS, getBannerRules, isCollaboration } from "/src/utils/magi/bannerRules.js";
import { getGoalType, resolveTarget } from "/src/utils/magi/probabilityEngine.js";
import { bigHeadDecide } from "/src/utils/magi/bigHeadEngine.js";
import {
  SMALL_HEAD_DIMS,
  createEmptyPref,
  zoneRankWeight,
  smallHeadDecide,
} from "/src/utils/magi/smallHeadEngine.js";
import {
  RABBIT_HEAD_DIMS,
  createEmptyStrength,
  rabbitHeadDecide,
} from "/src/utils/magi/rabbitHeadEngine.js";
import { magiVote } from "/src/utils/magi/votingEngine.js";

const router = useRouter();

const LEVELS = ["S", "A", "B", "C"];

// ---------------- 卡池 ----------------
const selectedBannerId = ref(BANNERS[0].id);
const currentBanner = computed(() => getBannerRules(selectedBannerId.value).banner);
const currentRuleset = computed(() => getBannerRules(selectedBannerId.value).ruleset);
const isCollab = computed(() => isCollaboration(currentBanner.value.activityType));

// ---------------- 抽数预算（自动沿用攒抽计算器） ----------------
const drawResult = ref(null);

function loadBudgetFromCalc() {
  try {
    const raw = localStorage.getItem("LastDrawResult");
    drawResult.value = raw ? JSON.parse(raw) : null;
  } catch (e) {
    drawResult.value = null;
  }
}

const totalDraws = computed(() => drawResult.value?.totalDraw || 0);

const savedAtText = computed(() =>
  drawResult.value?.savedAt ? new Date(drawResult.value.savedAt).toLocaleString("zh-CN") : ""
);

const budgetParts = computed(() => {
  const r = drawResult.value;
  if (!r) return [];
  return [
    { label: "现有", value: r.existTotalDraw },
    { label: "日常", value: r.dailyTotalDraw },
    { label: "潜在", value: r.potentialTotalDraw },
    { label: "氪金", value: r.rechargeTotalDraw },
    { label: "活动", value: r.activityTotalDraw },
    { label: "其他", value: r.otherTotalDraw },
    { label: "搓玉", value: r.produceOrundumTotalDraw },
  ]
    // 各组成分项向下取整展示（如现有 45.6 → 45）
    .map((p) => ({ label: p.label, value: Math.floor(p.value || 0) }))
    .filter((p) => p.value > 0);
});

function goGachaCalc() {
  router.push("/tools/gachaCalc");
}

// ---------------- 目标 ----------------
let goalSeed = 0;
const goals = ref([]);
const remainDraws = ref(0);
const threshold = ref(0.8);

// 小头/兔头评分数据（按目标 id 索引）；已选维度 {key, pos}，pos=false 为负向减分；默认不选择任何维度
const prefs = reactive({});
const strengths = reactive({});
const smallSelected = ref([]);
const rabbitSelected = ref([]);

function nextLevel() {
  const idx = Math.min(goals.value.length, LEVELS.length - 1);
  return LEVELS[idx];
}

function addGoal(type) {
  const typeDef = getGoalType(type);
  const goal = {
    id: ++goalSeed,
    type: typeDef.type,
    label: typeDef.label,
    operatorName: "",
    need: typeDef.defaultNeed,
    sparkCost: typeDef.sparkCost,
    level: nextLevel(),
  };
  goals.value.push(goal);
  prefs[goal.id] = createEmptyPref();
  strengths[goal.id] = createEmptyStrength();
}

function addDefaultGoals() {
  for (const type of ["limited", "limitedAll", "past200"]) {
    addGoal(type);
  }
  if (goals.value[0]) goals.value[0].operatorName = "示例限定干员";
}

/** 拖动排序后的目标数组回写，并清理已删除目标的评分数据 */
function onGoalsReorder(newGoals) {
  goals.value = newGoals;
  const ids = new Set(newGoals.map((g) => g.id));
  for (const id of Object.keys(prefs)) {
    if (!ids.has(Number(id))) delete prefs[id];
  }
  for (const id of Object.keys(strengths)) {
    if (!ids.has(Number(id))) delete strengths[id];
  }
}

/** 目标按拖动顺序即为优先级（第一目标优先保障） */
const resolvedGoals = computed(() =>
  goals.value.map((g) =>
    resolveTarget({ ...g, need: g.need }, currentBanner.value.activityType, threshold.value, totalDraws.value)
  )
);

const scorableGoals = computed(() => goals.value.filter((g) => g.operatorName.trim()));

// ---------------- MAGI 决议 ----------------
/** 维度列表 → 引擎权重：正负分区内各自按排序计算，负向取负 */
function zoneWeights(list) {
  return list
    .map(({ key }) => zoneRankWeight(list, key))
    .filter(Boolean)
    .map(({ key, weight }) => ({ key, weight }));
}

const magiResult = computed(() => {
  if (!resolvedGoals.value.length) return null;

  const big = bigHeadDecide({
    totalDraws: totalDraws.value,
    safetyLine: remainDraws.value,
    targets: resolvedGoals.value,
  });

  const named = scorableGoals.value;
  const smallDims = zoneWeights(smallSelected.value);
  const rabbitDims = zoneWeights(rabbitSelected.value);

  const small = smallHeadDecide({
    goals: named.map((g) => ({ label: g.operatorName, pref: prefs[g.id], dims: smallDims })),
  });
  const rabbit = rabbitHeadDecide({
    goals: named.map((g) => ({ label: g.operatorName, strength: strengths[g.id], dims: rabbitDims })),
  });

  const vote = magiVote({ bigHead: big, smallHead: small, rabbitHead: rabbit, totalDraws: totalDraws.value });

  return { big, small, rabbit, vote };
});

const heads = computed(() => {
  const r = magiResult.value;
  if (!r) return [];
  return [
    { key: "big", name: "大头 · 理性决策", icon: "🧠", result: r.big, color: "#409eff" },
    { key: "small", name: "小头 · 角色偏好", icon: "❤️", result: r.small, color: "#f56c6c" },
    { key: "rabbit", name: "兔头 · 强度价值", icon: "🐇", result: r.rabbit, color: "#67c23a" },
  ];
});

function decisionText(d) {
  return d === "pull" ? "抽" : d === "wait" ? "观望" : "不抽";
}
function decisionColor(d) {
  return d === "pull" ? "#67c23a" : d === "wait" ? "#e6a23c" : "#909399";
}

// ---------------- 三角形三头制衡 ----------------
const TRI_POS = { big: { x: 210, y: 58 }, small: { x: 48, y: 318 }, rabbit: { x: 372, y: 318 } };

const triHeads = computed(() => {
  const r = magiResult.value;
  if (!r) return [];
  const list = [
    { key: "big", icon: "🧠", name: "大头", result: r.big, color: "#409eff" },
    { key: "small", icon: "❤️", name: "小头", result: r.small, color: "#f56c6c" },
    { key: "rabbit", icon: "🐇", name: "兔头", result: r.rabbit, color: "#67c23a" },
  ];
  return list.map((h) => {
    const dec = h.result.decision;
    const decColor = decisionColor(dec);
    return {
      key: h.key,
      ...TRI_POS[h.key],
      icon: h.icon,
      name: h.name,
      color: h.color,
      decText: decisionText(dec),
      decColor,
      fill: `${decColor}1f`,
      scoreText: `${h.result.score} 分`,
    };
  });
});

const centerColor = computed(() => {
  const v = magiResult.value?.vote;
  if (!v) return "#909399";
  return v.passed ? "#67c23a" : v.decision === "wait" ? "#e6a23c" : "#f56c6c";
});
const centerMain = computed(() => {
  const v = magiResult.value?.vote;
  if (!v) return "三头待命";
  if (v.passed) return "🔥 建议：抽";
  return v.decision === "wait" ? "⚠️ 观望" : "🚫 不抽";
});
const centerVote = computed(() => {
  const v = magiResult.value?.vote;
  if (!v) return "";
  return `${v.vote} 票${v.highRisk ? `（需${v.required}/3）` : ""}`;
});
const centerSub = computed(() => {
  const v = magiResult.value?.vote;
  return v ? "大头 × 小头 × 兔头 制衡" : "完成下方设置后决议";
});

onMounted(loadBudgetFromCalc);
</script>

<style scoped>
.magi-page {
  max-width: 1020px;
  margin: 0 auto;
  padding: 16px;
}
.magi-header {
  margin-bottom: 12px;
}
.magi-header h1 {
  margin: 0 0 8px;
  font-size: 22px;
}
.magi-desc {
  margin: 0;
  color: #888;
  font-size: 13px;
  line-height: 1.7;
}
.magi-triangle-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
.magi-triangle-svg {
  width: 100%;
  max-width: 460px;
  height: auto;
}
.magi-card {
  margin-bottom: 16px;
}
.magi-card-title {
  font-weight: 600;
}
.magi-schedule-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.magi-schedule-item {
  text-align: center;
  line-height: 1.3;
}
.magi-schedule-date {
  font-size: 11px;
  opacity: 0.7;
}
.magi-schedule-meta {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.magi-sub-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.magi-sub-title-mt {
  margin-top: 16px;
}
.magi-hint {
  color: #999;
  font-size: 12px;
  font-weight: normal;
}
.magi-sep {
  margin: 0 4px;
  color: #c0c4cc;
}
.magi-budget {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 10px 14px;
}
.magi-budget-main {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  flex-wrap: wrap;
}
.magi-budget-total {
  font-size: 1.6em;
}
.magi-budget-refresh {
  margin-left: auto;
}
.magi-budget-meta {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
}
.magi-budget-chips {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.magi-budget-chip {
  font-size: 12px;
  color: #666;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 1px 10px;
}
.magi-budget-chip b {
  color: #409eff;
}
.magi-budget-empty {
  margin: 0;
}
.magi-number {
  color: #409eff;
}
.magi-remain-row,
.magi-threshold-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
  flex-wrap: wrap;
}
.magi-threshold-row {
  margin-top: 10px;
}
.magi-vote-banner {
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.magi-vote-pass {
  background: rgba(19, 206, 102, 0.12);
  border: 1px solid rgba(19, 206, 102, 0.4);
}
.magi-vote-fail {
  background: rgba(255, 73, 73, 0.1);
  border: 1px solid rgba(255, 73, 73, 0.3);
}
.magi-vote-title {
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.magi-vote-count {
  font-size: 14px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  padding: 2px 8px;
  font-weight: 600;
}
.magi-vote-sub {
  margin-top: 6px;
  font-size: 13px;
  color: #555;
}
.magi-head-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
.magi-head-card {
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 14px;
}
.magi-head-pull {
  border-top: 3px solid #67c23a;
}
.magi-head-wait {
  border-top: 3px solid #e6a23c;
}
.magi-head-skip {
  border-top: 3px solid #909399;
}
.magi-head-title {
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.magi-head-vote {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
.magi-head-decision {
  font-size: 22px;
  font-weight: 800;
  margin: 6px 0;
}
.magi-head-pull .magi-head-decision {
  color: #67c23a;
}
.magi-head-wait .magi-head-decision {
  color: #e6a23c;
}
.magi-head-skip .magi-head-decision {
  color: #909399;
}
.magi-head-score {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}
.magi-head-stop {
  font-size: 12px;
  color: #555;
  margin-top: 8px;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 6px 8px;
}
.magi-head-reasons {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: #666;
  line-height: 1.8;
}
.magi-head-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.magi-disclaimer {
  margin-top: 14px;
  font-size: 12px;
  color: #999;
  text-align: center;
}
.magi-tip {
  margin-top: 8px;
}
</style>
