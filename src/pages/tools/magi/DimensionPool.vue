<template>
  <SortablePool
    v-model="selected"
    :candidates="dims"
    allow-negative
    layout="horizontal"
    candidate-title="候选维度（点击 ＋ 或拖入右侧生效）"
    sorted-title="已选维度（越靠前权重越高；分隔线以下为负向减分；拖回左侧或点 ✕ 移除）"
  >
    <template #candidate="{ item }">
      <span>{{ labelOf(item.key) }}</span>
    </template>
    <template #card="{ item, neg }">
      <div class="dim-card">
        <div class="dim-card-head">
          <span class="dim-card-name">{{ labelOf(item.key) }}</span>
          <span class="pool-weight">×{{ weightOf(item.key) }}</span>
          <span class="dim-sign" :class="{ neg }" @click.stop="toggleSign(item.key)">
            {{ neg ? "减分" : "加分" }}
          </span>
        </div>
        <div class="dim-card-body">
          <div v-if="!goals.length" class="dim-no-goal">先在「② 大头」中添加目标并填写干员名，即可打分</div>
          <div v-for="g in goals" :key="g.id" class="dim-slider-row" draggable="false" @dragstart.stop.prevent>
            <span class="dim-slider-label" :title="g.operatorName || g.label">
              {{ g.operatorName || g.label }}
            </span>
            <el-slider v-model="scores[g.id][item.key]" :min="0" :max="10" show-stops size="small" />
            <span class="dim-slider-value">{{ scores[g.id][item.key] }}</span>
          </div>
        </div>
      </div>
    </template>
  </SortablePool>
</template>

<script setup>
import { computed } from "vue";
import SortablePool from "./SortablePool.vue";
import { zoneRankWeight } from "/src/utils/magi/smallHeadEngine.js";

const props = defineProps({
  /** 维度定义 [{key, label}] */
  dims: { type: Array, required: true },
  /** 已选维度（v-model）：[{key, pos}] */
  modelValue: { type: Array, required: true },
  /** 可打分的目标干员列表 [{id, operatorName, label}] */
  goals: { type: Array, default: () => [] },
  /** 评分数据（reactive）：scores[goalId][dimKey] = 0~10 */
  scores: { type: Object, required: true },
});
const emit = defineEmits(["update:modelValue"]);

const selected = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

function labelOf(key) {
  return props.dims.find((d) => d.key === key)?.label ?? key;
}

/** 权重显示：正负分区内各自从 1 计算（正向为正、负向为负），与决策引擎一致 */
function weightOf(key) {
  const r = zoneRankWeight(selected.value, key);
  return r ? r.weight.toFixed(2) : "1.00";
}

/** 点击加减分标签：切换方向（移动到另一区末尾） */
function toggleSign(key) {
  const list = [...selected.value];
  const from = list.findIndex((it) => it.key === key);
  if (from < 0) return;
  const item = list[from];
  item.pos = !item.pos;
  list.splice(from, 1);
  if (item.pos) {
    // 切回正向：插入正向区末尾（分隔线之前）
    const firstNeg = list.findIndex((it) => it.pos === false);
    list.splice(firstNeg === -1 ? list.length : firstNeg, 0, item);
  } else {
    // 切为负向：移到末尾（负向区末尾）
    list.push(item);
  }
  selected.value = list;
}
</script>

<style scoped>
.dim-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dim-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.dim-card-name {
  color: inherit;
}
.pool-weight {
  font-size: 11px;
  opacity: 0.75;
  font-weight: 400;
}
.dim-sign {
  margin-left: auto;
  font-size: 11px;
  font-weight: 400;
  color: #67c23a;
  border: 1px solid #b3e19d;
  background: #f0f9eb;
  border-radius: 10px;
  padding: 0 8px;
  cursor: pointer;
  line-height: 18px;
  user-select: none;
}
.dim-sign.neg {
  color: #f56c6c;
  border-color: #fbc4c4;
  background: #fef0f0;
}
.dim-card-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 2px;
}
.dim-no-goal {
  font-size: 12px;
  color: #c0c4cc;
  font-weight: 400;
  padding: 2px 0;
}
.dim-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dim-slider-label {
  font-size: 11px;
  color: #888;
  width: 56px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
}
.dim-slider-row :deep(.el-slider) {
  flex: 1;
}
.dim-slider-value {
  font-size: 11px;
  color: #409eff;
  font-weight: 600;
  width: 20px;
  text-align: right;
  flex-shrink: 0;
}
</style>
