# Todo — 桌面待办清单

一个基于 **Vue 3 + Vite + Electron** 的轻量级 Windows 桌面待办应用。支持悬浮球收起、全局快捷键快速添加、飞书文档同步、定时提醒推送。

## 功能特性

### 待办管理
- 添加、编辑、删除、勾选完成（双击条目可快速编辑）
- 丰富字段：标题、优先级（高/中/低）、截止日期、分类、备注
- URL 自动识别：标题和备注中的链接可高亮显示，Ctrl+右键直接打开

### 搜索与筛选
- 按关键词搜索标题和备注（200ms 防抖，输入流畅）
- 按状态（全部/进行中/已完成）和优先级过滤
- 按时间、优先级、截止日期、标题排序，支持升降序切换

### 悬浮球 & 窗口动画
- 收起为悬浮球：窗口向悬浮球位置收缩（easeInOutQuart 缓动曲线）
- 悬浮球拖拽自由移动，边缘吸附（左右上下四边）
- 从悬浮球展开时自动刷新待办列表

### 快速添加待办
- **全局快捷键**（默认 Ctrl+Shift+T）：复制任意文字后按快捷键，自动创建待办并弹出备注输入窗
- **右键菜单**：在应用内选中文本右键，选择「添加到待办」
- **自定义快捷键**：设置弹窗中点击输入框，按下任意组合键即可绑定
- 备注输入悬浮窗：毛玻璃风格，右下角弹出，支持 Ctrl+Enter 确认 / Escape 跳过

### 飞书同步
- 将待办清单同步到指定飞书文档（覆盖模式）
- 支持主文档 + 周子文档模式：每周自动新建子文档，主文档追加各周链接
- 定时同步间隔可配置（0 = 关闭）
- 每日定时推送未完成待办到飞书消息
- 周日自动统计本周完成情况，追加到当周文档并发飞书消息
- 飞书 OAuth 设备流登录，文档归用户所有

### 其他
- 深色/浅色主题一键切换并记忆偏好，首次启动跟随系统
- 本地持久化：数据保存在用户目录的 `todos.json`
- 内存缓存 + debounce 落盘：CRUD 操作不阻塞主进程
- Vite 构建优化：vue 独立 chunk，target es2022

## 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 渲染层 | Vue 3 + Vite 6 | 组件化 UI，scoped CSS |
| 桌面层 | Electron 33 | 窗口管理、IPC、全局快捷键、系统通知 |
| 同步层 | lark-cli | 飞书文档/消息同步，OAuth 登录 |
| 打包 | electron-builder | 生成 Windows 安装包 |

## 目录结构

```
todo-app/
├── index.html                  网页入口
├── package.json                依赖与脚本
├── vite.config.js              Vite 配置（端口 1420, es2022, manualChunks）
├── start-dev.bat               Windows 一键启动（Vite + Electron）
├── public/
│   ├── icon.svg / icon.png     应用图标
│   ├── ball.html               悬浮球页面
│   └── quick-add.html          备注输入悬浮窗页面
├── scripts/
│   └── gen-icon.cjs            由 SVG 生成打包用 PNG
├── src/                        Vue 前端源码
│   ├── main.js                 入口
│   ├── App.vue                 主界面（~450 行）
│   ├── style.css               全局样式 + 主题变量
│   ├── stores/todo.js           数据模型常量与工厂函数
│   └── components/
│       ├── SearchBar.vue       搜索框
│       ├── FilterBar.vue       筛选与排序条
│       ├── TodoItem.vue        单条待办
│       ├── TodoForm.vue       新建/编辑表单
│       └── SettingsDialog.vue  飞书设置弹窗
├── electron/                   Electron 桌面层
│   ├── main.js                 主进程：窗口、存储缓存、IPC、动画、快捷键
│   ├── preload.js              安全桥接 API
│   ├── quick-add-preload.js    备注窗桥接 API
│   └── feishu-sync.js          飞书同步模块
└── dist/                       构建产物
```

## 快速开始

### 环境要求

- Node.js 18+
- Windows（打包脚本面向 Windows）
- 飞书同步功能需要 [lark-cli](https://www.npmjs.com/package/@larksuite/cli)（`npm i -g @larksuite/cli`）

### 安装依赖

```bash
cd todo-app
npm install
```

### 开发模式

双击 `start-dev.bat`，或手动执行：

```bash
npm run electron:dev
```

启动后会同时运行 Vite 开发服务器（端口 1420）和 Electron 窗口。

### 打包

```bash
npm run electron:build
```

生成的安装包位于 `release/` 目录。

## 架构说明

### 整体数据流

```
Vue 界面 ──window.electronAPI.xxx──▶ preload.js ──ipcRenderer.invoke──▶ main.js(主进程)
                                                                         │
                                                                   内存缓存(debounce 落盘)
                                                                         │
                                                                   todos.json
```

- `preload.js` 用 `contextBridge` 安全暴露 API，网页不能直接访问 Node
- `main.js` 维护内存单例 `cache`，CRUD 只操作内存，500ms debounce 后批量写入文件
- 三个窗口共享数据：主窗口、悬浮球窗口(ball.html)、备注输入窗(quick-add.html)

### 悬浮球与窗口动画

- 收起：主窗口向悬浮球位置缩小 + 淡出（easeInOutQuart 缓动），完成后隐藏窗口显示悬浮球
- 展开：从悬浮球位置以小尺寸出现 + 淡入 + 放大到完整窗口，展开后 350ms 自动刷新列表
- 悬浮球支持拖拽和四边吸附

### 快速添加流程

```
用户复制文字 → Ctrl+Shift+T → 读取剪贴板 → 创建待办写入内存 → 弹出备注输入窗
                                                           ↓
                                          用户输入备注 → 确认 → 更新待办 → IPC 通知主窗口刷新
```

- 主窗口不可见时不弹出，下次展开时自动刷新
- 备注确认后通过 IPC + executeJavaScript 双通道通知前端刷新

### 飞书同步流程

```
设置弹窗 → OAuth 登录飞书 → 获取用户身份 → 调用 lark-cli 同步文档/发送消息
```

- 文档同步：全量覆盖指定飞书文档内容（XML 格式表格）
- 周文档：主文档作为目录，每周新建子文档，周日自动生成周总结
- 消息推送：将未完成待办以 Markdown 卡片消息推送到飞书

## 性能优化

- **内存缓存存储层**：readStore 返回内存单例，writeStore debounce 500ms 落盘，CRUD 不阻塞
- **搜索防抖**：200ms debounce，快速输入不触发多次全量过滤+排序
- **毛玻璃轻量化**：仅顶层容器保留 backdrop-filter，列表项和控件不叠加
- **vite 构建优化**：vue 独立 chunk 便于缓存，target es2022 减小包体
- **resolveLarkCli 缓存**：首次探测后缓存路径，避免重复同步 IO
- **computeWeeklyStats**：周总结统计逻辑统一抽取，消除 XML/Markdown 重复

## 常见问题

- **中文乱码**：源码均为 UTF-8 编码。`start-dev.bat` 是批处理文件，控制台输出可能因码页不同显示乱码，但功能不受影响。
- **打包图标**：Windows 打包需要 `public/icon.png`（至少 256x256）。运行 `node scripts/gen-icon.cjs` 可由 `public/icon.svg` 生成该 PNG。
- **快捷键无效**：确认快捷键未被其他应用占用；在设置弹窗中重新绑定；重启应用后生效。
- **飞书同步失败**：确认已安装 lark-cli 并完成 OAuth 登录；检查文档链接是否有编辑权限。
