<template>
  <div class="todo-item" :class="[todo.priority, { completed: todo.completed }]" @dblclick="$emit('edit', todo)">
    <button class="check-btn" @click.stop="$emit('toggle', todo)" :class="{ checked: todo.completed }">
      <svg v-if="todo.completed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    </button>

    <div class="todo-content">
      <div class="todo-title-row">
        <span class="todo-title" v-html="renderTitle" @contextmenu.prevent="onTitleContext"></span>
        <span class="priority-badge" :class="todo.priority">{{ priorityLabel }}</span>
      </div>
      <div class="todo-meta" v-if="todo.due_date || todo.category || todo.notes">
        <span v-if="todo.due_date" class="meta-tag due-date" :class="{ overdue: isOverdue }">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          {{ formatDate(todo.due_date) }}
        </span>
        <span v-if="todo.category" class="meta-tag category">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>
          </svg>
          {{ todo.category }}
        </span>
        <span v-if="todo.notes" class="meta-tag notes-text" :title="todo.notes" @contextmenu.prevent="handleNotesRightClick">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
          </svg>
          <span class="notes-content">{{ todo.notes }}</span>
        </span>
      </div>
    </div>

    <div class="todo-actions">
      <button class="action-btn edit-btn" @click.stop="$emit('edit', todo)" title="编辑">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="action-btn delete-btn" @click.stop="$emit('delete', todo)" title="删除">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { PRIORITY_LABELS } from "../stores/todo.js";

const props = defineProps({ todo: Object });
const emit = defineEmits(["edit", "delete", "toggle"]);

const api = window.electronAPI;

const priorityLabel = computed(() => PRIORITY_LABELS[props.todo.priority] || "\u4e2d");

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

const notesUrls = computed(() => {
  if (!props.todo.notes) return [];
  return props.todo.notes.match(URL_RE) || [];
});

const renderTitle = computed(() => {
  const title = props.todo.title || "";
  if (!title) return "";
  const escaped = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(URL_RE, (m) => `<span class="todo-link" data-url="${m}" title="Ctrl+右键打开">${m}</span>`);
});

function handleNotesRightClick(e) {
  if (e.ctrlKey && notesUrls.value.length) {
    e.preventDefault();
    for (const u of notesUrls.value) {
      if (api && api.openExternal) api.openExternal(u);
    }
  }
}

// 标题内链接：Ctrl+右键打开
function onTitleContext(e) {
  const target = e.target;
  if (target && target.classList && target.classList.contains("todo-link")) {
    const url = target.getAttribute("data-url");
    if (url && e.ctrlKey) {
      e.preventDefault();
      if (api && api.openExternal) api.openExternal(url);
    }
  }
}

const isOverdue = computed(() => {
  if (!props.todo.due_date || props.todo.completed) return false;
  return new Date(props.todo.due_date).getTime() < Date.now();
});

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dateOnly = new Date(dateStr).toDateString();
  const todayOnly = today.toDateString();
  const tomorrowOnly = tomorrow.toDateString();

  let label;
  if (dateOnly === todayOnly) label = "今天";
  else if (dateOnly === tomorrowOnly) label = "明天";
  else label = `${d.getMonth() + 1}月${d.getDate()}日`;

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (hh + mm !== "0000") label += ` ${hh}:${mm}`;
  return label;
}
</script>

<style scoped>
.todo-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  transition: all var(--transition);
  cursor: default;
  position: relative;
  overflow: hidden;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.todo-item:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
}
.todo-item:hover .todo-actions { opacity: 1; }
.todo-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: transparent;
  transition: background var(--transition);
}
.todo-item.high::before { background: var(--danger); }
.todo-item.medium::before { background: var(--warning); }
.todo-item.low::before { background: var(--success); }
.todo-item.completed::before { opacity: 0.35; }

.todo-item.completed .todo-title {
  text-decoration: line-through;
  color: var(--text-tertiary);
}
.todo-item.completed { opacity: 0.7; }
.todo-item.completed:hover { opacity: 1; }

.check-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  background: none;
  color: transparent;
  transition: all var(--transition);
}

.check-btn:hover { border-color: var(--accent); }

.check-btn.checked {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.check-btn.checked svg { animation: pop 0.3s var(--transition-spring); }
@keyframes pop { 0% { transform: scale(0.4); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }

.todo-content { flex: 1; min-width: 0; }

.todo-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.todo-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;
}

.todo-title :deep(.todo-link) {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: rgba(76, 110, 245, 0.4);
  text-underline-offset: 2px;
  cursor: pointer;
  border-radius: 2px;
}
.todo-title :deep(.todo-link:hover) {
  text-decoration-color: var(--accent);
  background: var(--accent-light);
}

.priority-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}

.priority-badge.high { background: #ffe3e3; color: #c92a2a; }
.priority-badge.medium { background: #fff3bf; color: #e67700; }
.priority-badge.low { background: #d3f9d8; color: #2b8a3e; }

[data-theme="dark"] .priority-badge.high { background: rgba(224, 49, 49, 0.2); color: #ff6b6b; }
[data-theme="dark"] .priority-badge.medium { background: rgba(240, 140, 0, 0.2); color: #ffc078; }
[data-theme="dark"] .priority-badge.low { background: rgba(47, 158, 68, 0.2); color: #69db7c; }

.todo-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }

.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-secondary);
  padding: 3px 7px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.meta-tag.overdue { color: var(--danger); background: rgba(224, 49, 49, 0.08); }

.notes-text {
  max-width: 200px;
  overflow: hidden;
}
.notes-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.todo-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition);
  flex-shrink: 0;
}
.todo-item:focus-within .todo-actions { opacity: 1; }

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  border: none;
  background: none;
}

.action-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.delete-btn:hover { color: var(--danger); background: rgba(224, 49, 49, 0.1); }
</style>
