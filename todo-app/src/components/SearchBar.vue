<template>
  <div class="search-bar">
    <div class="search-input-wrap">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        :value="modelValue"
        type="text"
        placeholder="搜索待办..."
        class="search-input"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <button v-if="modelValue" class="clear-btn" @click="$emit('update:modelValue', '')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({ modelValue: String });
defineEmits(["update:modelValue"]);
</script>

<style scoped>
.search-bar { padding: 0 20px 8px; flex-shrink: 0; }

.search-input-wrap { position: relative; display: flex; align-items: center; }

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 9px 36px 9px 36px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  font-size: 13px;
  color: var(--text-primary);
}

.search-input::placeholder { color: var(--text-tertiary); }
.search-input { transition: all var(--transition); }
.search-input:focus { background: var(--glass-bg-hover); box-shadow: 0 0 0 2px var(--accent-light); border-color: var(--accent); }

.clear-btn {
  position: absolute;
  right: 8px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-tertiary);
  border: none;
  background: none;
}

.clear-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
</style>
