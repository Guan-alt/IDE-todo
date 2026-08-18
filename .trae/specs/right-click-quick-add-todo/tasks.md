# Tasks
- [x] Task 1: 在 main.js 中实现应用内右键菜单「添加到待办」
  - [x] SubTask 1.1: 监听 mainWindow webContents 的 context-menu 事件，获取选中文本
  - [x] SubTask 1.2: 构建 Menu 上下文菜单，添加「添加到待办」菜单项
  - [x] SubTask 1.3: 点击菜单项后以选中文本为标题调用 quickAddTodo 创建待办
  - [x] SubTask 1.4: 创建待办后发送 IPC 事件弹出备注输入窗

- [x] Task 2: 注册全局快捷键 Ctrl+Shift+T
  - [x] SubTask 2.1: 使用 globalShortcut.register 注册 Ctrl+Shift+T
  - [x] SubTask 2.2: 触发时读取剪贴板 clipboard.readText()，若非空则创建待办
  - [x] SubTask 2.3: 创建待办后发送 IPC 事件弹出备注输入窗
  - [x] SubTask 2.4: 应用退出时注销快捷键

- [x] Task 3: 创建备注输入悬浮窗
  - [x] SubTask 3.1: 新建 `public/quick-add.html`，包含文本框 + 确认/跳过按钮，毛玻璃风格
  - [x] SubTask 3.2: 新建 `electron/quick-add-preload.js`，暴露 confirmNotes/skipNotes API
  - [x] SubTask 3.3: 在 main.js 中创建悬浮窗 BrowserWindow（无边框、透明、置顶、不抢焦点）
  - [x] SubTask 3.4: 悬浮窗定位在屏幕右下角，显示待办标题预览

- [x] Task 4: 连接备注输入与待办更新
  - [x] SubTask 4.1: 备注确认后通过 IPC 调用 quick-add:confirm 将备注追加到待办
  - [x] SubTask 4.2: 跳过/关闭时调用 quick-add:skip 不修改待办
  - [x] SubTask 4.3: 关闭悬浮窗时清理 pendingQuickTodo 状态

- [x] Task 5: 主窗口同步刷新
  - [x] SubTask 5.1: App.vue 监听 onQuickAddCreated/onQuickAddUpdated 事件，刷新待办列表

# Task Dependencies
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1] and [Task 3]
- [Task 5] depends on [Task 1]
- [Task 2] 和 [Task 1] 可并行
