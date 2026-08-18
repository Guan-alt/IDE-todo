const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Todo CRUD
  getTodos: () => ipcRenderer.invoke("todos:getAll"),
  addTodo: (todo) => ipcRenderer.invoke("todos:add", todo),
  updateTodo: (todo) => ipcRenderer.invoke("todos:update", todo),
  deleteTodo: (id) => ipcRenderer.invoke("todos:delete", id),
  toggleTodo: (id, completed) => ipcRenderer.invoke("todos:toggle", { id, completed }),

  // Categories
  getCategories: () => ipcRenderer.invoke("categories:getAll"),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings) => ipcRenderer.invoke("settings:set", settings),

 // Feishu sync
 feishuSync: () => ipcRenderer.invoke("feishu:sync"),
feishuTestDailyPush: () => ipcRenderer.invoke("feishu:testDailyPush"),
 feishuTestWeeklySummary: () => ipcRenderer.invoke("feishu:testWeeklySummary"),
feishuAuthStatus: () => ipcRenderer.invoke("feishu:authStatus"),
  feishuLoginStart: () => ipcRenderer.invoke("feishu:loginStart"),
  feishuLoginFinish: (deviceCode) => ipcRenderer.invoke("feishu:loginFinish", deviceCode),
  feishuLogout: () => ipcRenderer.invoke("feishu:logout"),

 // Notifications
 sendNotification: (title, body) => ipcRenderer.invoke("notification:send", { title, body }),
  onPlaySound: (cb) => ipcRenderer.on("play-sound", () => cb()),
  // 快速添加待办事件
  onQuickAddCreated: (cb) => ipcRenderer.on("quick-add-created", (_, todo) => cb(todo)),
  onQuickAddUpdated: (cb) => ipcRenderer.on("quick-add-updated", (_, data) => cb(data)),

  // Shell
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),

  // Window
  // 悬浮球
  enterBall: () => ipcRenderer.invoke("window:enterBall"),
  exitBall: () => ipcRenderer.invoke("window:exitBall"),
  // 关闭
  closeWindow: () => ipcRenderer.invoke("window:close"),
  // 悬浮球拖拽
  ballDragStart: (x, y) => ipcRenderer.send("ball:dragStart", { x, y }),
  ballDrag: (x, y) => ipcRenderer.send("ball:drag", { x, y }),
  ballDragEnd: () => ipcRenderer.send("ball:dragEnd"),
});
