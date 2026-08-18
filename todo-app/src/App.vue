<template>
  <div class="app" :data-theme="theme">
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-title">待办清单</h1>
        <span class="todo-count">{{ activeCount }} 项待完成</span>
      </div>
      <div class="header-right">
        <button class="icon-btn theme-btn" @click="toggleTheme" :title="theme === 'dark' ? '切换亮色模式' : '切换深色模式'">
          <svg v-if="theme === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <button class="icon-btn ball-btn" @click="handleEnterBall" title="收起为悬浮球">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
           <circle cx="12" cy="12" r="9"/>
         </svg>
       </button>
        <button class="icon-btn settings-btn" @click="openSettings" title="设置">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="icon-btn close-btn" @click="handleClose" title="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </header>

    <SearchBar v-model="searchText" />
    <FilterBar
      v-model:completed="filterCompleted"
      v-model:priority="filterPriority"
      v-model:category="filterCategory"
      :categories="categories"
      v-model:sort_by="sortBy"
      v-model:sort_order="sortOrder"
      :activeCount="activeCount"
      :doneCount="doneCount"
    />

    <div class="todo-list-container">
      <TransitionGroup name="slide" tag="div" class="todo-list">
        <TodoItem
          v-for="todo in filteredTodos"
          :key="todo.id"
          :todo="todo"
          @edit="editTodo"
          @delete="confirmDelete"
          @toggle="handleToggle"
        />
      </TransitionGroup>

      <div v-if="filteredTodos.length === 0 && todos.length > 0" class="empty-state">
        <p>没有匹配的待办事项</p>
      </div>
      <div v-else-if="todos.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" opacity="0.5">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <p>暂无待办事项</p>
        <span>点击下方按钮添加新任务</span>
      </div>
    </div>

    <div class="app-footer">
      <button class="add-btn" @click="openForm">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>添加待办</span>
      </button>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <TodoForm
          v-if="showForm"
          :editingTodo="editingTodo"
          :categories="categories"
          @close="closeForm"
          @save="handleSave"
        />
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
          <div class="confirm-dialog">
            <p>确定要删除这个待办事项吗？</p>
            <div class="confirm-actions">
              <button class="btn btn-secondary" @click="deleteTarget = null">取消</button>
            <button class="btn btn-danger" @click="handleDelete">删除</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <SettingsDialog
      v-model="showSettings"
      v-model:feishuDocUrl="feishuDocUrl"
      v-model:feishuMasterDocUrl="feishuMasterDocUrl"
      v-model:syncInterval="syncInterval"
      v-model:dailyFeishuTime="dailyFeishuTime"
      v-model:quickAddShortcut="quickAddShortcut"
      @close="closeSettings"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { PRIORITY_ORDER } from "./stores/todo.js";
import TodoItem from "./components/TodoItem.vue";
import TodoForm from "./components/TodoForm.vue";
import SearchBar from "./components/SearchBar.vue";
import FilterBar from "./components/FilterBar.vue";
import SettingsDialog from "./components/SettingsDialog.vue";

const api = window.electronAPI;

const todos = ref([]);
const categories = ref([]);
const theme = ref("light");
const showForm = ref(false);
const editingTodo = ref(null);
const deleteTarget = ref(null);
const searchText = ref("");
const debouncedSearch = ref("");
let searchTimer = null;
watch(searchText, (val) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedSearch.value = val;
  }, 200);
});
const filterCompleted = ref("all");
const filterPriority = ref("");
const filterCategory = ref("");
const sortBy = ref("priority");
const sortOrder = ref("desc");
const showSettings = ref(false);
const feishuDocUrl = ref("");
const feishuMasterDocUrl = ref("");
const syncInterval = ref(0);
const dailyFeishuTime = ref("");
const quickAddShortcut = ref("");

const activeCount = computed(() => todos.value.filter((t) => !t.completed).length);
const doneCount = computed(() => todos.value.filter((t) => t.completed).length);

const filteredTodos = computed(() => {
  let result = [...todos.value];

  if (debouncedSearch.value) {
    const s = debouncedSearch.value.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(s) || t.notes.toLowerCase().includes(s));
  }

  if (filterPriority.value) {
    result = result.filter((t) => t.priority === filterPriority.value);
  }

  if (filterCategory.value) {
    result = result.filter((t) => t.category === filterCategory.value);
  }

  if (filterCompleted.value === "active") {
    result = result.filter((t) => !t.completed);
  } else if (filterCompleted.value === "done") {
    result = result.filter((t) => t.completed);
  }

  result.sort((a, b) => {
    let cmp = 0;
    switch (sortBy.value) {
      case "priority":
        // 缺失优先级视为最低，避免 NaN 导致排序失效
        cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
        break;
      case "due_date":
        if (!a.due_date && !b.due_date) cmp = 0;
        else if (!a.due_date) cmp = 1;
        else if (!b.due_date) cmp = -1;
        else cmp = a.due_date.localeCompare(b.due_date);
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      default:
        cmp = a.created_at.localeCompare(b.created_at);
    }
    return sortOrder.value === "asc" ? cmp : -cmp;
  });

  return result;
});

onMounted(async () => {
  const saved = localStorage.getItem("todo-theme");
  if (saved === "dark") {
    theme.value = "dark";
  } else if (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    theme.value = "dark";
  }

  if (api) {
    todos.value = await api.getTodos();
   categories.value = await api.getCategories();
    const s = await api.getSettings();
   feishuDocUrl.value = (s && s.feishuDocUrl) || "";
    feishuMasterDocUrl.value = (s && s.feishuMasterDocUrl) || "";
   syncInterval.value = Number((s && s.syncInterval) || 0);
    dailyFeishuTime.value = (s && s.dailyFeishuTime) || "";
    quickAddShortcut.value = (s && s.quickAddShortcut) || "";
    if (api.onPlaySound) api.onPlaySound(playSound);
    // 监听快速添加待办事件（右键菜单 / 全局快捷键）
    // 收到事件后直接重新拉取全部数据，确保列表刷新
    if (api.onQuickAddCreated) {
      api.onQuickAddCreated(async () => {
        todos.value = await api.getTodos();
        categories.value = await api.getCategories();
      });
    }
    if (api.onQuickAddUpdated) {
      api.onQuickAddUpdated(async () => {
        todos.value = await api.getTodos();
        categories.value = await api.getCategories();
      });
    }
    // 监听 executeJavaScript 触发的刷新事件（备用方案）
    window.addEventListener("quick-add-refresh", async (e) => {
      if (e.detail && e.detail.todos) {
        todos.value = e.detail.todos;
        categories.value = e.detail.cats || [];
      } else {
        todos.value = await api.getTodos();
        categories.value = await api.getCategories();
      }
    });
  }
});

watch(theme, (val) => localStorage.setItem("todo-theme", val));

// 切换到"按优先级"时自动设为降序，使高优先级在前
watch(sortBy, (val) => {
  if (val === "priority") sortOrder.value = "desc";
});

function toggleTheme() {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

async function handleEnterBall() {
  if (api) await api.enterBall();
}

async function handleClose() {
  if (api) await api.closeWindow();
}

function openSettings() {
  showSettings.value = true;
}

function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    /* 忽略音频错误 */
  }
}

function closeSettings() {
  showSettings.value = false;
}

function openForm() {
  editingTodo.value = null;
  showForm.value = true;
}

function editTodo(todo) {
  editingTodo.value = { ...todo };
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingTodo.value = null;
}

function confirmDelete(todo) {
  deleteTarget.value = todo;
}

async function handleDelete() {
  if (deleteTarget.value && api) {
    await api.deleteTodo(deleteTarget.value.id);
    todos.value = todos.value.filter((t) => t.id !== deleteTarget.value.id);
    categories.value = await api.getCategories();
  }
  deleteTarget.value = null;
}

async function handleToggle(todo) {
  if (api) {
    await api.toggleTodo(todo.id, !todo.completed);
    todo.completed = !todo.completed;
  }
}

async function handleSave(todo) {
  if (api) {
    if (todo.id) {
      await api.updateTodo(todo);
      const idx = todos.value.findIndex((t) => t.id === todo.id);
      if (idx !== -1) todos.value[idx] = todo;
    } else {
      const newTodo = await api.addTodo(todo);
      todos.value.unshift(newTodo);
    }
    categories.value = await api.getCategories();
  }
  closeForm();
}
</script>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--glass-shadow);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.app[data-theme="dark"] {
  background: var(--bg-primary);
  border-color: rgba(255, 255, 255, 0.08);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.app-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}
.app-title::after {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 2px;
  border-radius: 50%;
  background: var(--accent);
  vertical-align: 4px;
}

.todo-count {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.header-right {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  border: none;
  background: none;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.ball-btn:hover {
  background: var(--accent);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: var(--shadow-accent);
}

.ball-btn {
  width: 38px;
  height: 38px;
  background: rgba(76, 110, 245, 0.12);
  color: var(--accent);
  transition: all var(--transition);
}

.settings-btn:hover {
  color: var(--accent);
}

.close-btn:hover {
  background: rgba(224, 49, 49, 0.15);
  color: var(--danger);
}

.todo-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px 8px;
  min-height: 0;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 20px;
  gap: 10px;
}

.empty-state p {
  font-size: 15px;
  color: var(--text-secondary);
  font-weight: 500;
}
.empty-state svg { animation: floaty 3s ease-in-out infinite; }
@keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

.empty-state span {
  font-size: 13px;
  color: var(--text-tertiary);
}

.app-footer {
  flex-shrink: 0;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--glass-bg);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
}

.add-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border: none;
  transition: all var(--transition);
}

.add-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-accent);
}

.add-btn:active {
  transform: translateY(0);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.confirm-dialog {
  background: var(--bg-primary);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  min-width: 300px;
  box-shadow: var(--glass-shadow);
}

.confirm-dialog p {
  font-size: 15px;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  border: none;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-danger {
  background: var(--danger);
  color: #fff;
}

.btn-danger:hover {
  background: var(--danger-hover);
}
</style>
