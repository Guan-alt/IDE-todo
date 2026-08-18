# Tasks

- [x] Task 1: 改造存储层为内存单例 + debounce 异步落盘
  - [x] SubTask 1.1: 在 main.js 创建内存数据对象 `let cache = null`，readStore 先返回缓存，缓存不存在时才读盘
  - [x] SubTask 1.2: writeStore 改为修改内存 + debounce 500ms 后 fs.writeFileSync，消除同步阻塞
  - [x] SubTask 1.3: updateCategories 复用已读的内存数据，不再重复 readStore+writeStore
  - [x] SubTask 1.4: checkReminders 使用内存数据而非读盘

- [x] Task 2: 抽离 SettingsDialog.vue 子组件
  - [x] SubTask 2.1: 新建 src/components/SettingsDialog.vue，迁移飞书设置弹窗 template(106-204 行)
  - [x] SubTask 2.2: 迁移约 15 个 settings 相关 ref(loginBusy/deviceCode/syncing 等)到 SettingsDialog
  - [x] SubTask 2.3: 迁移 handleLogin/Logout/Sync/TestPush/TestSummary/handleShortcutInput 等函数
  - [x] SubTask 2.4: 迁移 settings 弹窗相关 scoped CSS(~100 行)
  - [x] SubTask 2.5: App.vue 通过 props/v-model 与 SettingsDialog 通信，用 @close 关闭

- [x] Task 3: filteredTodos 防抖优化
  - [x] SubTask 3.1: 对 searchText 加 200ms 防抖(用 watch + setTimeout 或自定义 debounce)
  - [x] SubTask 3.2: filteredTodos 依赖防抖后的搜索值

- [x] Task 4: 轻量化毛玻璃效果
  - [x] SubTask 4.1: TodoItem.vue 去掉 .todo-item 的 backdrop-filter
  - [x] SubTask 4.2: FilterBar.vue 去掉 .filter-select/.sort-order-btn 的 backdrop-filter
  - [x] SubTask 4.3: SearchBar.vue 去掉 .search-input 的 backdrop-filter
  - [x] SubTask 4.4: style.css 的 transition: all 改为具体属性

- [x] Task 5: 移除调试日志和死代码
  - [x] SubTask 5.1: main.js 移除所有 [shortcut]/[quickAdd]/[App] 调试 console.log
  - [x] SubTask 5.2: App.vue 移除所有 console.log
  - [x] SubTask 5.3: TodoItem.vue 删除未使用的 titleUrls/allUrls computed
  - [x] SubTask 5.4: TodoItem.vue renderTitle 复用模块级 URL_RE，删除内联正则
  - [x] SubTask 5.5: 删除 electron/test.js

- [x] Task 6: 消除重复代码
  - [x] SubTask 6.1: main.js 抽取 refreshMainWindow() 统一刷新函数，替换三处重复的 executeJavaScript
  - [x] SubTask 6.2: main.js 抽取 writeErrorLog(err) 统一错误日志
  - [x] SubTask 6.3: feishu-sync.js 抽取 computeWeeklyStats() 消除周总结 XML/Markdown 重复逻辑
  - [x] SubTask 6.4: feishu-sync.js 缓存 resolveLarkCli() 结果到模块级变量
  - [x] SubTask 6.5: 统一 reminder_enabled 默认值(stores/todo.js 与 main.js quickAddTodo 一致)

- [x] Task 7: vite 构建优化
  - [x] SubTask 7.1: vite.config.js 增加 manualChunks 拆分 vue
  - [x] SubTask 7.2: 设置 build.target 为 es2022

# Task Dependencies
- [Task 2] depends on [Task 1] (存储层改好后再抽组件，避免并发修改 main.js 冲突)
- [Task 3] depends on [Task 2] (App.vue 瘦身后改防抖更清晰)
- [Task 4] 无依赖，可与 Task 1 并行
- [Task 5] 无依赖，可与 Task 1 并行
- [Task 6] depends on [Task 1] (refreshMainWindow 依赖存储层)
- [Task 7] 无依赖，可与任何 Task 并行
