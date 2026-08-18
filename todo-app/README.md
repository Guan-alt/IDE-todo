# Todo 待办清单

一个基于 **Vue 3 + Vite + Electron** 的桌面端待办清单应用。用网页技术做界面，再用 Electron 包装成可安装的 Windows 桌面软件。

## 功能特性

- **待办管理**：添加、编辑、删除、勾选完成（双击条目可快速编辑）
- **丰富字段**：标题、优先级（高 / 中 / 低）、截止日期、分类、备注
- **搜索与筛选**：按关键词搜索标题和备注；按状态（全部 / 进行中 / 已完成）和优先级过滤
- **灵活排序**：按时间、优先级、截止日期、标题排序，支持升降序切换
- **深色 / 浅色主题**：一键切换并记忆偏好，首次启动跟随系统
- **本地持久化**：数据保存在用户目录的 `todos.json`，关闭重开数据不丢
- **边缘吸附**：把窗口拖到屏幕左 / 右 / 上边缘会自动“藏”起来只留一条，鼠标靠近再展开
- **系统通知**：通过 Electron 原生通知提醒

## 技术栈

| 层 | 技术 | 作用 |
| --- | --- | --- |
| 渲染层（界面） | Vue 3 + Vite | 用网页技术绘制 UI |
| 桌面层 | Electron 33 | 提供窗口、本地文件读写、系统通知 |
| 打包 | electron-builder | 生成 Windows 安装包 |

## 目录结构

```
todo-app/
├── index.html              网页入口
├── package.json            依赖与脚本
├── vite.config.js          Vite 配置（开发端口 1420）
├── start-dev.bat           Windows 一键启动（Vite + Electron）
├── public/icon.svg         应用图标（矢量）
├── scripts/gen-icon.cjs    由 SVG 设计生成打包用 icon.png
├── src/                    Vue 前端源码
│   ├── main.js             入口
│   ├── App.vue             主界面
│   ├── style.css           全局样式 + 主题变量
│   ├── stores/todo.js      数据模型常量
│   └── components/
│       ├── SearchBar.vue   搜索框
│       ├── FilterBar.vue   筛选与排序条
│       ├── TodoItem.vue    单条待办
│       └── TodoForm.vue    新建 / 编辑表单
├── electron/               Electron 桌面层
│   ├── main.js             主进程：窗口、存储、IPC、边缘吸附
│   ├── preload.js          安全桥接 API
│   └── test.js             最简冒烟测试
└── dist/                   构建产物
```

## 快速开始

### 环境要求

- Node.js 18+
- Windows（打包脚本面向 Windows）

### 安装依赖

```bash
npm install
```

### 开发模式

- 仅前端热更新：`npm run dev`，然后浏览器打开 `http://localhost:1420`
- 桌面应用（Vite + Electron 同时启动）：双击 `start-dev.bat`，或手动执行

```bash
npm run electron:dev
```

### 打包

```bash
npm run electron:build
```

生成的安装包位于 `release/` 目录。

## 架构说明

界面（Vue）和桌面能力（Electron 主进程）通过 IPC 通信，数据流如下：

```
Vue 界面 ──调用 window.electronAPI.xxx──▶ preload.js(桥) ──ipcRenderer.invoke──▶ electron/main.js(主进程)
                                                                                      │
                                                                                 读写 todos.json
```

- `electron/preload.js` 用 `contextBridge` 把一组函数安全地挂到 `window.electronAPI`，网页不能直接访问 Node。
- `electron/main.js` 用 `ipcMain.handle(...)` 接收调用，对本地 JSON 文件做增删改查。
- 数据文件路径：系统用户目录下的 `todos.json`（见 `electron/main.js` 中的 `storePath`）。

## 常见问题

- **中文乱码**：源码均为 UTF-8 编码。`start-dev.bat` 是按系统 GBK 码页编写的批处理文件，用 UTF-8 编辑器打开会显示乱码，但直接运行不受影响。
- **打包图标**：Windows 打包需要 `public/icon.png`（至少 256×256）。运行 `node scripts/gen-icon.cjs` 可由 `public/icon.svg` 的设计栅格化生成该 PNG。
