<template>
  <SortablePool
    v-model="order"
    :candidates="candidateTypes"
    :hide-selected-candidates="false"
    candidate-title="目标类型（点击 ＋ 或拖入下方添加，可重复添加）"
    sorted-title="抽卡目标（拖动排序 = 优先级，越靠前越优先；拖回上方或点 ✕ 移除）"
    @add="(type) => emit('add', type)"
  >
    <template #candidate="{ item }">
      <span>{{ item.label }}</span>
    </template>
    <template #card="{ item }">
      <div v-if="goalOf(item.key)" class="goal-card">
        <div class="goal-card-head">
          <el-select
            :model-value="goalOf(item.key)?.level"
            size="small"
            style="width: 78px"
            @update:model-value="(lv) => setField(item.key, 'level', lv)"
          >
            <el-option v-for="lv in LEVELS" :key="lv" :label="`${lv}级`" :value="lv" />
          </el-select>
          <span class="goal-card-label">{{ goalOf(item.key)?.label }}</span>
        </div>
        <div class="goal-card-row">
          <span class="goal-field-label">目标干员</span>
          <el-input
            :model-value="goalOf(item.key)?.operatorName"
            size="small"
            placeholder="输入干员名（小头/兔头用）"
            style="width: 170px"
            @update:model-value="(v) => setField(item.key, 'operatorName', v)"
          />
          <template v-if="resolvedOf(item.key)?.probKey">
            <span class="magi-sep">·</span>
            <span class="goal-stat">
              概率 <b class="magi-number">{{ probabilityOf(item.key) }}%</b>
            </span>
            <span class="magi-sep">·</span>
            <span class="goal-stat">需 <b class="magi-number">{{ needOf(item.key) }}</b> 抽</span>
          </template>
          <template v-else>
            <span class="magi-sep">·</span>
            <span class="goal-field-label">所需抽数</span>
            <el-input-number
              :model-value="goalOf(item.key)?.need"
              :min="0"
              :max="9999"
              :step="10"
              size="small"
              controls-position="right"
              style="width: 118px"
              @update:model-value="(v) => setField(item.key, 'need', v)"
            />
          </template>
          <span v-if="goalOf(item.key)?.sparkCost" class="magi-hint">（井 {{ goalOf(item.key).sparkCost }} 必得）</span>
        </div>
      </div>
    </template>
  </SortablePool>
</template>

<script setup>
import { computed } from "vue";
import SortablePool from "./SortablePool.vue";
import { GOAL_TYPES } from "/src/utils/magi/probabilityEngine.js";

const props = defineProps({
  /** 目标列表 [{id, type, label, operatorName, level, need, sparkCost}] */
  goals: { type: Array, required: true },
  /** 解析后的目标（含概率/所需抽数），按 id 匹配 */
  resolvedGoals: { type: Array, default: () => [] },
});
const emit = defineEmits(["add", "update:goals"]);

const LEVELS = ["S", "A", "B", "C"];
const candidateTypes = GOAL_TYPES.map((t) => ({ key: t.type, label: t.label }));

/** 排序数据：仅存 id 顺序，pos 恒为 true（目标没有正负向） */
const order = computed({
  get: () => props.goals.map((g) => ({ key: g.id, pos: true })),
  set: (v) => {
    const byId = new Map(props.goals.map((g) => [g.id, g]));
    emit("update:goals", v.map((it) => byId.get(it.key)).filter(Boolean));
  },
});

function goalOf(id) {
  return props.goals.find((g) => g.id === id);
}
function resolvedOf(id) {
  return props.resolvedGoals.find((r) => r.id === id);
}
function probabilityOf(id) {
  const r = resolvedOf(id);
  return r?.probKey ? r.prob.toFixed(1) : "";
}
function needOf(id) {
  return resolvedOf(id)?.need ?? 0;
}
function setField(id, field, value) {
  const g = goalOf(id);
  if (g) g[field] = value;
}
</script>

<style scoped>
.goal-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.goal-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #409eff;
}
.goal-card-label {
  font-size: 13px;
}
.goal-card-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
  flex-wrap: wrap;
  font-weight: 400;
}
.goal-field-label {
  color: #999;
}
.goal-stat {
  font-weight: 400;
}
.magi-sep {
  margin: 0 2px;
  color: #c0c4cc;
}
.magi-number {
  color: #409eff;
}
.magi-hint {
  color: #999;
  font-size: 11px;
}
</style>
