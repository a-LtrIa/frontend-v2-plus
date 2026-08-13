<template>
  <div class="magi-pool" :class="layout === 'horizontal' ? 'magi-pool-h' : ''">
    <!-- 候选池：拖入排序池生效 -->
    <div class="pool-zone pool-candidates" @dragover.prevent @drop="onCandidateDrop">
      <div class="pool-zone-title">{{ candidateTitle }}</div>
      <div class="pool-cards">
        <div
          v-for="item in visibleCandidates"
          :key="item.key"
          class="pool-card candidate"
          draggable="true"
          @dragstart="onCardDragStart(item.key, 'candidate')"
          @dragend="onCardDragEnd"
          @click="toggleToSorted(item.key)"
        >
          <slot name="candidate" :item="item" />
          <span class="pool-toggle">＋</span>
        </div>
        <span v-if="!visibleCandidates.length" class="pool-empty">已全部选中</span>
      </div>
    </div>

    <!-- 排序池：拖动排序决定权重，拖回候选池即移除 -->
    <div class="pool-zone pool-sorted" @dragover.prevent @drop="onSortedDrop">
      <div class="pool-zone-title">{{ sortedTitle }}</div>
      <div class="pool-cards pool-sorted-list">
        <template v-for="(item, idx) in selected" :key="item.key">
          <!-- 正负分隔线：默认一直存在，分隔线之后的维度为负向（减分） -->
          <div v-if="showSepBefore(idx)" class="pool-separator" @dragover.prevent="onSeparatorOver">
            <span class="pool-sep-icon">◤</span>
            负向 · 减分
            <span class="pool-sep-hint">拖入此区 = 反向扣分</span>
          </div>
          <div
            class="pool-card sorted"
            :class="{ neg: allowNegative && !item.pos }"
            draggable="true"
            @dragstart="onCardDragStart(item.key, 'sorted')"
            @dragend="onCardDragEnd"
            @dragover.prevent="onSortedOver(item.key)"
          >
            <slot name="card" :item="item" :neg="allowNegative && !item.pos" />
            <span class="pool-remove" @click.stop="removeFromSorted(item.key)">✕</span>
          </div>
        </template>
        <!-- 全为正向时，分隔线常驻在末尾 -->
        <div
          v-if="allowNegative && selected.length > 0 && negStartIndex === -1"
          class="pool-separator"
          @dragover.prevent="onSeparatorOver"
        >
          <span class="pool-sep-icon">◤</span>
          负向 · 减分
          <span class="pool-sep-hint">拖入此区 = 反向扣分</span>
        </div>
        <!-- 空态也常驻负向分隔线 -->
        <div v-if="allowNegative && !selected.length" class="pool-separator" @dragover.prevent="onSeparatorOver">
          <span class="pool-sep-icon">◤</span>
          负向 · 减分
          <span class="pool-sep-hint">拖入此区 = 反向扣分</span>
        </div>
        <span v-if="!selected.length" class="pool-empty">暂无已选</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  /** 候选条目 [{key, label, ...}] */
  candidates: { type: Array, required: true },
  /** 已选条目（v-model）：[{key, pos}]，pos=true 正向加分、pos=false 负向减分 */
  modelValue: { type: Array, required: true },
  /** 是否启用正负分隔线 */
  allowNegative: { type: Boolean, default: false },
  /** 已选条目是否从候选池中隐藏（维度池用；目标池允许重复添加） */
  hideSelectedCandidates: { type: Boolean, default: true },
  /** 布局：vertical 上下两栏 / horizontal 左候选右已选 */
  layout: { type: String, default: "vertical" },
  candidateTitle: { type: String, default: "候选池（拖入下方生效，或点击 ＋）" },
  sortedTitle: { type: String, default: "已选（越靠前权重越高，拖回上方或点 ✕ 移除）" },
});
const emit = defineEmits(["update:modelValue", "add"]);

const selected = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const selectedKeys = computed(() => selected.value.map((it) => it.key));
const visibleCandidates = computed(() =>
  props.hideSelectedCandidates ? props.candidates.filter((c) => !selectedKeys.value.includes(c.key)) : props.candidates
);

/** 第一个负向条目的下标（无负向时为 -1） */
const negStartIndex = computed(() => selected.value.findIndex((it) => it.pos === false));

/**
 * 有负向条目时，分隔线渲染在第一个负向前；
 * 全为正向 / 空态时由循环外的常驻分隔线兜底（渲染在末尾）。
 */
function showSepBefore(idx) {
  return props.allowNegative && idx === negStartIndex.value;
}

/** 稳定分区：正向在前、负向在后，各自保持原有顺序 */
function regroup(list) {
  return [...list.filter((it) => it.pos !== false), ...list.filter((it) => it.pos === false)];
}

// ---------------- 拖动状态机 ----------------
let drag = null; // { key, source: 'candidate' | 'sorted' }

function onCardDragStart(key, source) {
  drag = { key, source };
}
function onCardDragEnd() {
  drag = null;
}

/** 排序池内拖动：同区重排；跨过分隔线则跟随目标方向（自动切换正/负） */
function onSortedOver(targetKey) {
  if (!drag || drag.source !== "sorted") return;
  const list = [...selected.value];
  const from = list.findIndex((it) => it.key === drag.key);
  const to = list.findIndex((it) => it.key === targetKey);
  if (from < 0 || to < 0 || from === to) return;
  const moved = { ...list[from] };
  const target = list[to];
  if (moved.pos === target.pos) {
    // 同区：插入到目标位置
    list.splice(from, 1);
    list.splice(to, 0, moved);
    selected.value = list;
  } else {
    // 跨区：卡片跟随目标方向，插入目标位置后重新分区
    moved.pos = target.pos;
    list.splice(from, 1);
    const insertAt = list.findIndex((it) => it.key === targetKey);
    list.splice(insertAt, 0, moved);
    selected.value = regroup(list);
  }
}

/** 拖过分隔线：切换为负向并移到负向区末尾 */
function onSeparatorOver() {
  if (!drag || drag.source !== "sorted") return;
  const list = [...selected.value];
  const from = list.findIndex((it) => it.key === drag.key);
  if (from < 0) return;
  const moved = { ...list[from], pos: false };
  list.splice(from, 1);
  list.push(moved);
  selected.value = regroup(list);
}

/** 拖放至排序池：候选卡加入（默认为正向），同时广播 add（供允许重复的池使用） */
function onSortedDrop() {
  if (drag && drag.source === "candidate") {
    pushCandidate(drag.key);
  }
  drag = null;
}

/** 拖放至候选池：排序卡移除 */
function onCandidateDrop() {
  if (drag && drag.source === "sorted") {
    selected.value = selected.value.filter((it) => it.key !== drag.key);
  }
  drag = null;
}

// ---------------- 点击辅助（移动端兜底） ----------------
/** 候选卡加入：写入已选并广播 add */
function pushCandidate(key) {
  const list = [...selected.value];
  if (!list.some((it) => it.key === key)) {
    list.push({ key, pos: true });
    selected.value = regroup(list);
  }
  emit("add", key);
}
function toggleToSorted(key) {
  pushCandidate(key);
}
function removeFromSorted(key) {
  selected.value = selected.value.filter((it) => it.key !== key);
}
</script>

<style scoped>
.magi-pool {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 左右布局：左候选、右已选 */
.magi-pool-h {
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
}
.magi-pool-h .pool-candidates {
  flex: 0 0 220px;
  max-width: 260px;
}
.magi-pool-h .pool-candidates .pool-cards {
  flex-direction: column;
  align-items: stretch;
}
.magi-pool-h .pool-candidates .pool-card {
  justify-content: space-between;
}
.magi-pool-h .pool-sorted {
  flex: 1;
  min-width: 0;
}
@media (max-width: 640px) {
  .magi-pool-h {
    flex-direction: column;
  }
  .magi-pool-h .pool-candidates {
    flex: none;
    max-width: none;
    width: 100%;
  }
}
.pool-zone {
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 10px 12px;
}
.pool-zone-title {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}
.pool-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 34px;
}
.pool-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 16px;
  font-size: 13px;
  cursor: grab;
  user-select: none;
}
.pool-card:active {
  cursor: grabbing;
}
.pool-card.candidate {
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  color: #666;
}
.pool-card.sorted {
  background: #ecf5ff;
  border: 1px solid #a0cfff;
  color: #409eff;
  font-weight: 600;
}
.pool-card.sorted.neg {
  background: #fef0f0;
  border-color: #fbc4c4;
  color: #f56c6c;
}
.pool-sorted-list {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.pool-separator {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 2px dashed #f56c6c;
  border-bottom: 2px dashed #f56c6c;
  color: #f56c6c;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 4px;
  background: rgba(245, 108, 108, 0.06);
  border-radius: 6px;
}
.pool-sep-icon {
  font-size: 14px;
}
.pool-sep-hint {
  font-weight: 400;
  font-size: 11px;
  opacity: 0.7;
}
.pool-toggle {
  color: #67c23a;
  font-weight: 700;
}
.pool-remove {
  color: #f56c6c;
  font-weight: 700;
  cursor: pointer;
  padding: 0 2px;
}
.pool-empty {
  font-size: 12px;
  color: #c0c4cc;
  align-self: center;
}
</style>
