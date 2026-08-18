# 轻量化重构与性能优化 Spec

## Why
当前应用存在 App.vue 过大(983 行)、主进程同步 IO 阻塞、backdrop-filter 叠加导致 GPU 负担、大量调试日志和重复代码等问题，需重构以提升运行效率和可维护性。

## What Changes
- 抽离 `SettingsDialog.vue` 子组件，从 App.vue 迁出飞书设置弹窗及相关 ~15 个 ref
- 改造存储层：readStore/writeStore 改为内存单例缓存 + 异步 debounce 落盘，消除每次 CRUD 4 次全量同步 IO
- filteredTodos 加防抖，避免每键入一个字符触发全量过滤+排序
- 列表项(TodoItem)去掉 backdrop-filter，仅在顶层容器保留毛玻璃
- 移除所有调试 console.log
- 删除死代码：TodoItem 的 titleUrls/allUrls、test.js
- 消除三处 executeJavaScript 刷新重复，抽取 refreshMainWindow() 统一函数
- 消除 feishu-sync.js 周总结统计逻辑重复，抽取 computeWeeklyStats()
- 缓存 resolveLarkCli() 结果，避免重复同步探测
- 统一 reminder_enabled 默认值
- vite build 优化：manualChunks 拆分 vue、build.target 设为 es2022

## Impact
- Affected code: electron/main.js, electron/feishu-sync.js, src/App.vue, src/components/TodoItem.vue, src/components/TodoForm.vue, src/style.css, vite.config.js, src/stores/todo.js
- 新增文件: src/components/SettingsDialog.vue

## ADDED Requirements

### Requirement: 内存缓存存储层
系统 SHALL 在主进程维护内存单例数据对象，CRUD 操作只修改内存，异步 debounce 落盘到 JSON 文件。

#### Scenario: 添加待办
- **WHEN** 用户通过任意方式添加待办
- **THEN** 主进程只修改内存中的 todos 数组，debounce 500ms 后写入文件，不阻塞 IPC 返回

#### Scenario: 读取待办
- **WHEN** 渲染进程调用 getTodos
- **THEN** 直接返回内存中的数据，不读盘

### Requirement: SettingsDialog 子组件
系统 SHALL 将飞书设置弹窗抽离为独立的 SettingsDialog.vue 组件，通过 props/v-model 与父组件通信。

#### Scenario: 打开设置
- **WHEN** 用户点击设置按钮
- **THEN** 渲染 SettingsDialog 组件，飞书登录/同步/快捷键等状态由该组件管理

### Requirement: 防抖搜索过滤
系统 SHALL 对搜索输入做防抖处理(200ms)，避免每次键入都触发全量过滤+排序。

#### Scenario: 快速输入
- **WHEN** 用户快速键入多个字符
- **THEN** 只在停止输入 200ms 后执行一次过滤+排序

### Requirement: 轻量化毛玻璃
系统 SHALL 仅在顶层容器(.app)使用 backdrop-filter，列表项和下拉控件不叠加毛玻璃效果。

#### Scenario: 长列表滚动
- **WHEN** 待办列表项较多
- **THEN** 每个 item 不做 backdrop-filter 合成，GPU 负担降低

### Requirement: 统一刷新函数
系统 SHALL 提供统一的 refreshMainWindow() 函数，消除三处重复的 executeJavaScript 刷新代码。

## MODIFIED Requirements

### Requirement: 全局存储读写
原每次 CRUD 全量同步读写 JSON 文件，改为内存单例 + debounce 异步落盘。

### Requirement: App.vue 组件结构
原 App.vue 983 行包含设置弹窗，重构后设置弹窗迁出，App.vue 降至约 450 行。

## REMOVED Requirements

### Requirement: 调试日志
**Reason**: 大量 console.log 影响生产环境输出和性能
**Migration**: 直接移除所有 [shortcut]/[quickAdd]/[App] 调试日志

### Requirement: TodoItem 死代码
**Reason**: titleUrls/allUrls 两个 computed 未被模板使用
**Migration**: 直接删除

### Requirement: test.js 临时文件
**Reason**: Hello Electron 测试文件，不应打进安装包
**Migration**: 删除文件
