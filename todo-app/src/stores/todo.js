export const PRIORITY_LABELS = { high: "高", medium: "中", low: "低" };

// 高优先级数值最大，使降序(desc)排序时"高→中→低"在前
export const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };

export function createTodo(title = "") {
  return {
    id: null,
    title,
    completed: false,
    priority: "medium",
    category: "",
    due_date: null,
   notes: "",
    reminder_enabled: false,
    reminder_offset_minutes: 240,
    reminder_fired: false,
   created_at: "",
    updated_at: "",
  };
}
