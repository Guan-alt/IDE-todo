# 更新日志
本文件记录 todo-app 每次版本更新内容，按时间倒序排列。

## v1.3.0 — 飞书消息推送
**发布日期：2026-07-03**

### 新增
- **每日定时推送改为发飞书消息**：到点后机器人（bot）以私聊形式把未完成待办发给你本人，像有人给你发消息，而不是写入飞书文档。
  - 未完成待办按优先级从高到低排序（🔴 高 / 🟡 中 / 🟢 低）。
  - 每条含【分类】、标题、截止时间、备注。
  - 开头显示未完成总数，结尾显示发送时间。
- **「立即测试推送」按钮**：设置弹窗 → 每日推送时间输入框下方新增按钮，点击可立即触发一次推送，便于验证配置，不必等到定时点；按钮下方实时显示推送结果。

### 变更
- `doDailyFeishuPush` 不再依赖飞书文档链接，改为读取登录账号的 `openId`，用机器人身份发私聊消息。
- 消息发送改用本地默认飞书 profile（账号登录自动生成），不再写死 `--profile todoapp`，避免「profile not found」。
- 手动「立即同步」仍保持写入飞书文档（用户身份），行为不变。

### 修复
- 推送报错 `profile "todoapp" not found`：移除写死的 `--profile todoapp`，改用本地已配置的默认 profile（其 bot 身份为 ready）。
- 测试推送点击报 `feishuTestDailyPush is not a function`：开发模式下 preload.js 未热更新所致，重启 `electron:dev` 即恢复（非代码缺陷）。

### 文件改动
- `electron/feishu-sync.js`
  - 新增 `formatTodosMarkdown(todos)`：未完成待办按优先级排序并格式化为飞书消息 Markdown。
  - 新增 `pushTodosMessage(openId, todos)`：以 bot 身份通过 `lark-cli im +messages-send` 发送私聊消息。
  - 移除 `pushTodosMessage` 中写死的 `--profile todoapp`。
  - `module.exports` 导出新增的两个函数。
- `electron/main.js`
  - `require` 行加入 `pushTodosMessage`。
  - 重写 `doDailyFeishuPush`：`getAuthStatus()` 取 `openId` → `pushTodosMessage`，去掉文档链接依赖；未登录时提示「请先登录飞书账号」。
  - 新增 IPC handler `feishu:testDailyPush`，供前端触发即时测试推送。
- `electron/preload.js`
  - 暴露 `feishuTestDailyPush` 接口。
- `src/App.vue`
  - 新增 `testPushBusy` / `testPushStatus` 响应式状态。
  - 新增 `handleTestDailyPush` 方法。
  - 设置弹窗「每日定时推送」输入框下方加「立即测试推送」按钮及结果提示。

### 使用前提
- 已通过「飞书账号登录」登录（用于获取 `openId` 收消息）。
- 飞书应用（appId `cli_aab91aff4af81bc4`）需开通机器人权限 `im:message`（发送单聊消息），且应用可见范围覆盖本人。
- 设置「每日定时推送时间」（如 `09:00`），留空则关闭每日推送。

### 验证
- `npm run build` 构建通过（`✓ built`）。
- 重启 `npm run electron:dev` 后，设置 → 立即测试推送 可触发一次消息发送。

---

## v1.2.x — 待办提醒与时间设置（此前版本）
- 待办可设置具体完成时间（精确到小时）。
- 每条待办独立提醒，可自定义提前小时/分钟，默认提前 4 小时；提醒含声音 + 弹窗。
- 每日定时推送未完成待办到飞书（本版本起改为发消息）。
- TodoForm 时间选择 UI 优化为卡片式提醒区 + 开关切换。
- 悬浮球支持边缘吸附、收起按钮放大优化。
