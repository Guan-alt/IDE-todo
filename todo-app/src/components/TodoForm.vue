<template>
  <div class="form-overlay" @click.self="$emit('close')">
    <div class="form-container">
      <div class="form-header">
        <h2>{{ editingTodo ? "编辑待办" : "新建待办" }}</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="form-body">
        <div class="form-group">
          <input
            ref="titleInput"
            v-model="form.title"
            type="text"
            placeholder="输入待办标题..."
            class="title-input"
            maxlength="200"
            required
          />
        </div>

        <div class="form-group">
          <label>优先级</label>
          <div class="priority-selector">
            <button
              v-for="p in priorities"
              :key="p.value"
              type="button"
              class="priority-option"
              :class="{ active: form.priority === p.value, [p.value]: true }"
              @click="form.priority = p.value"
            >{{ p.label }}</button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>完成时间</label>
            <input v-model="form.due_date" type="datetime-local" class="form-input datetime-input" />
          </div>
          <div class="form-group">
            <label>分类</label>
            <div class="category-input-wrap">
              <input
                v-model="form.category"
                type="text"
                list="category-datalist"
                placeholder="输入或选择分类"
                class="form-input"
                autocomplete="off"
              />
              <datalist id="category-datalist">
                <option v-for="cat in categories" :key="cat" :value="cat" />
              </datalist>
            </div>
          </div>
       </div>

        <div class="reminder-card" v-if="form.due_date">
          <div class="reminder-header">
            <div class="reminder-title">
              <svg class="reminder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2 2M5 3 2 6M19 3l3 3" />
              </svg>
              <span>到期提醒</span>
            </div>
            <button type="button" class="switch" :class="{ on: form.reminder_enabled }" @click="form.reminder_enabled = !form.reminder_enabled">
              <span class="switch-thumb"></span>
            </button>
          </div>
          <div class="reminder-body" v-if="form.reminder_enabled">
            <span class="reminder-prefix">提前</span>
            <div class="reminder-field">
              <input type="number" min="0" max="999" v-model.number="reminderHours" class="num-input" />
              <span class="field-label">小时</span>
            </div>
            <div class="reminder-field">
              <input type="number" min="0" max="59" v-model.number="reminderMinutes" class="num-input" />
              <span class="field-label">分钟</span>
            </div>
            <span class="reminder-hint">声音 + 弹窗</span>
          </div>
        </div>

        <div class="form-group">
          <label>备注</label>
          <textarea
            v-model="form.notes"
            placeholder="添加备注信息..."
            class="form-textarea"
            rows="3"
            maxlength="1000"
          ></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="$emit('close')">取消</button>
          <button type="submit" class="btn-submit" :disabled="!form.title.trim()">
            {{ editingTodo ? "保存" : "添加" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from "vue";

const props = defineProps({
  editingTodo: { type: Object, default: null },
  categories: { type: Array, default: () => [] },
});
const emit = defineEmits(["close", "save"]);

const titleInput = ref(null);

const reminderHours = ref(4);
const reminderMinutes = ref(0);

const priorities = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
];

const form = reactive({
  id: null,
  title: "",
  completed: false,
  priority: "medium",
  category: "",
 due_date: null,
 notes: "",
  reminder_enabled: true,
  reminder_offset_minutes: 240,
  reminder_fired: false,
 created_at: "",
  updated_at: "",
});

onMounted(async () => {
 if (props.editingTodo) {
   Object.assign(form, props.editingTodo);
 }
  const off = form.reminder_offset_minutes ?? 240;
  reminderHours.value = Math.floor(off / 60);
  reminderMinutes.value = off % 60;
 await nextTick();
  titleInput.value?.focus();
});

function handleSubmit() {
 if (!form.title.trim()) return;
  const offset = (reminderHours.value || 0) * 60 + (reminderMinutes.value || 0);
  emit("save", { ...form, reminder_offset_minutes: offset, reminder_fired: false });
}
</script>

<style scoped>
.form-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.form-container {
  background: var(--bg-primary);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--glass-shadow);
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}

.form-header h2 {
  font-size: 18px;
  font-weight: 700;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  border: none;
  background: none;
}

.close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.form-body { padding: 20px; }

.form-group { margin-bottom: 16px; }

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
  letter-spacing: 0.2px;
}

.title-input {
  width: 100%;
  padding: 12px 14px;
  font-size: 16px;
  font-weight: 500;
  border: 2px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
}
.title-input { transition: all var(--transition); }

.title-input:focus { border-color: var(--accent); background: var(--glass-bg-hover); }
.title-input:focus { box-shadow: 0 0 0 3px var(--accent-light); }

.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  font-size: 14px;
}

.form-input:focus { border-color: var(--accent); background: var(--glass-bg-hover); }

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  font-size: 14px;
  resize: vertical;
  min-height: 60px;
}

.form-textarea:focus { border-color: var(--accent); background: var(--glass-bg-hover); }


.datetime-input {
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.datetime-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.55;
}
.datetime-input:focus::-webkit-calendar-picker-indicator {
  opacity: 1;
}
.reminder-card {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  padding: 12px 14px;
}
.reminder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.reminder-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}
.reminder-icon { flex-shrink: 0; }
.switch {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: background var(--transition);
  flex-shrink: 0;
  padding: 0;
}
.switch.on { background: var(--accent); }
.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform var(--transition);
}
.switch.on .switch-thumb { transform: translateX(16px); }
.reminder-body {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-secondary);
}
.reminder-prefix { color: var(--text-secondary); font-weight: 500; }
.reminder-field {
  display: flex;
  align-items: center;
  gap: 4px;
}
.num-input {
  width: 52px;
  padding: 6px 6px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  color: var(--text-primary);
  -moz-appearance: textfield;
}
.num-input::-webkit-inner-spin-button,
.num-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.num-input:focus { border-color: var(--accent); outline: none; }
.field-label { font-size: 12px; color: var(--text-tertiary); }
.reminder-hint {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: 11px;
}
.priority-selector { display: flex; gap: 6px; }

.priority-option {
  flex: 1;
  padding: 8px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  border: 2px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-secondary);
  transition: all var(--transition);
}

.priority-option:hover { border-color: var(--text-tertiary); }

.priority-option.active.high { border-color: #e03131; background: #ffe3e3; color: #c92a2a; }
.priority-option.active.medium { border-color: #f08c00; background: #fff3bf; color: #e67700; }
.priority-option.active.low { border-color: #2f9e44; background: #d3f9d8; color: #2b8a3e; }

[data-theme="dark"] .priority-option.active.high { background: rgba(224, 49, 49, 0.15); color: #ff6b6b; }
[data-theme="dark"] .priority-option.active.medium { background: rgba(240, 140, 0, 0.15); color: #ffc078; }
[data-theme="dark"] .priority-option.active.low { background: rgba(47, 158, 68, 0.15); color: #69db7c; }

.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

.btn-cancel {
  padding: 10px 22px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
}

.btn-cancel:hover { background: var(--bg-hover); }

.btn-submit {
  padding: 10px 24px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  background: var(--accent);
  color: #fff;
  border: none;
}

.btn-submit:hover:not(:disabled) { background: var(--accent-hover); box-shadow: var(--shadow-accent); }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
