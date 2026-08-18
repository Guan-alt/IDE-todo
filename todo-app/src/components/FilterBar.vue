<template>
  <div class="filter-bar">
    <div class="filter-tabs">
      <button
        v-for="tab in statusTabs"
        :key="tab.value"
        class="filter-tab"
        :class="{ active: completed === tab.value }"
        @click="$emit('update:completed', tab.value)"
      >
        {{ tab.label }}
        <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <div class="filter-controls">
      <select
        class="filter-select"
        :value="priority"
        @change="$emit('update:priority', $event.target.value)"
      >
        <option value="">全部优先级</option>
        <option value="high">高优先级</option>
        <option value="medium">中优先级</option>
        <option value="low">低优先级</option>
      </select>

      <select
        class="filter-select"
        :value="category"
        @change="$emit('update:category', $event.target.value)"
      >
        <option value="">全部分类</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>

      <select
        class="filter-select"
        :value="sort_by"
        @change="$emit('update:sort_by', $event.target.value)"
      >
        <option value="created_at">按时间</option>
        <option value="priority">按优先级</option>
        <option value="due_date">按截止日期</option>
        <option value="title">按标题</option>
      </select>

      <button class="sort-order-btn" @click="$emit('update:sort_order', sort_order === 'asc' ? 'desc' : 'asc')" :title="sort_order === 'asc' ? '升序' : '降序'">
        <svg v-if="sort_order === 'asc'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12l7-7 7 7"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 19V5M5 12l7 7 7-7"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  completed: String,
  priority: String,
  category: String,
  categories: { type: Array, default: () => [] },
  sort_by: String,
  sort_order: String,
  activeCount: Number,
  doneCount: Number,
});

defineEmits([
  "update:completed",
  "update:priority",
  "update:category",
  "update:sort_by",
  "update:sort_order",
]);

const statusTabs = computed(() => [
  { value: "all", label: "全部", count: undefined },
  { value: "active", label: "进行中", count: props.activeCount },
  { value: "done", label: "已完成", count: props.doneCount },
]);
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 8px;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 2px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 2px;
  flex-shrink: 0;
}

.filter-tab {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  border: none;
  background: none;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all var(--transition);
}

.filter-tab:hover { color: var(--text-primary); }

.filter-tab.active {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}

.tab-count {
  font-size: 10px;
  background: var(--bg-tertiary);
  padding: 1px 5px;
  border-radius: 8px;
  font-weight: 600;
}

.filter-controls {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
  margin-left: auto;
}

.filter-select {
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: var(--glass-bg);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.filter-select:focus { border-color: var(--accent); }

.sort-order-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  flex-shrink: 0;
}

.sort-order-btn:hover { background: var(--bg-tertiary); color: var(--accent); }
</style>
