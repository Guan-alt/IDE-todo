const { app, BrowserWindow, ipcMain, screen, Notification, shell, Menu, clipboard, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const { syncTodosToFeishu, pushTodosMessage, sendMarkdownMessage, syncWeeklyTodos, weekId, appendWeeklySummary, formatWeeklySummaryMarkdown, startAuthLogin, finishAuthLogin, getAuthStatus, logoutAuth } = require("./feishu-sync");

// 内存单例缓存 + debounce 异步落盘
const storePath = path.join(app.getPath("userData"), "todos.json");
let cache = null;
let writeTimer = null;

function readStore() {
  if (cache) return cache;
  try {
    if (fs.existsSync(storePath)) {
      cache = JSON.parse(fs.readFileSync(storePath, "utf-8"));
      return cache;
    }
  } catch (e) { /* ignore */ }
  cache = {
    todos: [],
    categories: [],
    settings: { feishuDocUrl: "", syncInterval: 0 },
  };
  return cache;
}

function writeStore(data) {
  cache = data;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      fs.writeFileSync(storePath, JSON.stringify(cache, null, 2), "utf-8");
    } catch (e) { /* ignore */ }
  }, 500);
}

// 定时同步定时器
let syncTimer = null;

// 执行一次同步：silent=true 表示定时触发，推送系统通知而不弹错误
async function doSync(silent) {
  const data = readStore();
  const settings = data.settings || {};
  const docUrl = settings.feishuDocUrl || "";
  const todos = data.todos || [];
  const masterUrl = settings.feishuMasterDocUrl || "";
  // 优先：设置了主文档链接则走周文档模式（每周一个子文档）
  if (masterUrl.trim()) {
    if (!settings.weeklyDocs) settings.weeklyDocs = {};
    const res = await syncWeeklyTodos(masterUrl, settings.weeklyDocs, todos);
    if (res.ok && res.docUrl) {
      settings.weeklyDocs[res.weekId] = res.docUrl;
      writeStore(data);
    }
    if (silent && Notification.isSupported()) {
      new Notification({
        title: "飞书定时同步",
        body: res.ok ? ("已同步 " + todos.length + " 项待办到当周文档" + (res.newCreated ? "（新建）" : "")) : ("同步失败：" + (res.error || "")),
      }).show();
    }
    return res;
  }
  // 回退：单文档覆盖模式
  if (!docUrl.trim()) {
    return { ok: false, error: "未设置飞书文档链接或主文档链接，请先在设置中填写" };
  }
  // 用已授权的飞书账号（用户身份）同步，文档归用户自己所有
  const res = await syncTodosToFeishu(docUrl, todos);
  if (silent && Notification.isSupported()) {
    new Notification({
      title: "飞书定时同步",
      body: res.ok ? ("已同步 " + todos.length + " 项待办到文档") : ("同步失败：" + (res.error || "")),
    }).show();
  }
  return res;
}

// 根据 syncInterval（分钟）启停定时同步；0=关闭
function setupSyncTimer() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  const data = readStore();
  const mins = Number(data.settings && data.settings.syncInterval) || 0;
  if (mins > 0) {
    syncTimer = setInterval(() => { doSync(true); }, mins * 60000);
  }
}


// ===== 待办提醒 =====
let reminderTimer = null;

function showMainWindow() {
  if (ballWindow && !ballWindow.isDestroyed()) hideBall();
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
}

function triggerReminder(todo) {
  try { shell.beep(); } catch (e) { /* ignore */ }
  if (Notification.isSupported()) {
    const n = new Notification({
      title: "待办提醒",
      body: todo.title || "有一项待办即将到期",
      silent: false,
    });
    n.on("click", () => showMainWindow());
    n.show();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("play-sound");
    if (!mainWindow.isVisible()) showMainWindow();
  }
}

function checkReminders() {
  const data = readStore();
  const now = Date.now();
  let changed = false;
  for (const t of data.todos) {
    if (t.completed || !t.reminder_enabled || !t.due_date || t.reminder_fired) continue;
    const due = new Date(t.due_date).getTime();
    if (isNaN(due)) continue;
    const offset = (Number(t.reminder_offset_minutes) || 0) * 60000;
    if (now >= due - offset) {
      triggerReminder(t);
      t.reminder_fired = true;
      changed = true;
    }
  }
  if (changed) writeStore(data);
}

function setupReminderTimer() {
  if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null; }
  reminderTimer = setInterval(checkReminders, 30000);
  checkReminders();
}

// ===== 每日定时推送未完成待办到飞书 =====
let dailyFeishuTimer = null;

async function doDailyFeishuPush() {
  const data = readStore();
  const pending = (data.todos || []).filter((t) => !t.completed);
  const auth = await getAuthStatus();
  if (!auth.loggedIn || !auth.openId) {
    if (Notification.isSupported()) {
      new Notification({ title: "每日待办推送", body: "推送失败：请先登录飞书账号" }).show();
    }
    return;
  }
  const res = await pushTodosMessage(auth.openId, pending);
  if (Notification.isSupported()) {
    new Notification({
      title: "每日待办推送",
      body: res.ok ? ("已推送 " + pending.length + "项未完成待办到飞书消息") : ("推送失败：" + (res.error || "")),
    }).show();
  }
}

function setupDailyFeishuTimer() {
  if (dailyFeishuTimer) { clearTimeout(dailyFeishuTimer); dailyFeishuTimer = null; }
  const data = readStore();
  const time = data.settings && data.settings.dailyFeishuTime;
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return;
  const parts = time.split(":").map(Number);
  const h = parts[0], m = parts[1];
  function scheduleNext() {
    const now = new Date();
    let next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    dailyFeishuTimer = setTimeout(async () => {
      await doDailyFeishuPush();
      scheduleNext();
    }, next.getTime() - now.getTime());
  }
  scheduleNext();
}

// 每周总结：周日晚 22:00 触发，把规则统计追加到当周文档并发飞书消息
let weeklySummaryTimer = null;
async function doWeeklySummary() {
  const data = readStore();
  const settings = data.settings || {};
  const todos = data.todos || [];
  const wid = weekId(new Date());
  const weeklyDocs = settings.weeklyDocs || {};
  const docUrl = weeklyDocs[wid];
  const auth = await getAuthStatus();
  let docRes = { ok: false, error: "无当周文档" };
  if (docUrl) {
    docRes = await appendWeeklySummary(docUrl, todos, wid);
  }
  let msgRes = { ok: false, skipped: true };
  if (auth.loggedIn && auth.openId) {
    const md = formatWeeklySummaryMarkdown(todos, wid);
    msgRes = await sendMarkdownMessage(auth.openId, md);
  }
  if (Notification.isSupported()) {
    const parts = [];
    parts.push(docRes.ok ? "文档已追加总结" : ("文档失败：" + (docRes.error || "")));
    parts.push(msgRes.ok ? "已发飞书消息" : (msgRes.skipped ? "未发消息（未登录）" : ("消息失败：" + (msgRes.error || ""))));
    new Notification({ title: "每周待办总结", body: parts.join("；") }).show();
  }
  return { doc: docRes, msg: msgRes };
}

// 定时器：每天检查，若为周日 22:00 则触发；之后排到下个周日 22:00
function setupWeeklySummaryTimer() {
  if (weeklySummaryTimer) { clearTimeout(weeklySummaryTimer); weeklySummaryTimer = null; }
  function scheduleNext() {
    const now = new Date();
    // 目标：本周日 22:00；若已过则下个周日 22:00
    let dayIdx = now.getDay(); // 周日=0
    let daysUntilSun = (7 - dayIdx) % 7;
    let next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSun, 22, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 7);
    weeklySummaryTimer = setTimeout(async () => {
      await doWeeklySummary();
      scheduleNext();
    }, next.getTime() - now.getTime());
  }
  scheduleNext();
}

let mainWindow = null;
let ballWindow = null;
const BALL_SIZE = 44;
let dragOrigin = null; // 拖拽起始时球窗位置
let dragCursor = null; // 拖拽起始时光标屏幕坐标

// 开发模式加载 dev server，打包后加载 dist 静态文件
function loadTarget(filename) {
  const isDev = !app.isPackaged;
  const distPath = path.join(__dirname, "..", "dist", filename);
  return isDev ? { url: "http://localhost:1420/" + filename } : { path: distPath };
}

// 悬浮球边缘吸附：松开后可缩入屏幕边缘，仅露出 EDGE_REVEAL 像素
const EDGE_REVEAL = 20;
let ballSnap = null; // { side, hiddenX, fullX, y }
let ballAnimTimer = null;

function cancelBallAnim() {
  if (ballAnimTimer) { clearInterval(ballAnimTimer); ballAnimTimer = null; }
}

function animateBallX(targetX, duration = 220) {
  if (!ballWindow || ballWindow.isDestroyed()) return;
  cancelBallAnim();
  const start = ballWindow.getBounds().x;
  const startTime = Date.now();
  ballAnimTimer = setInterval(() => {
    if (!ballWindow || ballWindow.isDestroyed()) { cancelBallAnim(); return; }
    const t = Math.min(1, (Date.now() - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const x = Math.round(start + (targetX - start) * eased);
    ballWindow.setPosition(x, ballWindow.getBounds().y);
    if (t >= 1) cancelBallAnim();
  }, 16);
}

function snapBallToEdge() {
  if (!ballWindow || ballWindow.isDestroyed()) return;
  const b = ballWindow.getBounds();
  const wa = screen.getDisplayNearestPoint({ x: b.x + BALL_SIZE / 2, y: b.y + BALL_SIZE / 2 }).workArea;
  let side = null, hiddenX = null, fullX = null;
  if (b.x < wa.x) {
    side = "left";
    hiddenX = wa.x - BALL_SIZE + EDGE_REVEAL;
    fullX = wa.x;
  } else if (b.x + BALL_SIZE > wa.x + wa.width) {
    side = "right";
    hiddenX = wa.x + wa.width - EDGE_REVEAL;
    fullX = wa.x + wa.width - BALL_SIZE;
  }
  if (side) {
    ballSnap = { side, hiddenX, fullX, y: b.y };
    animateBallX(hiddenX);
  } else {
    ballSnap = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
    minWidth: 320,
    minHeight: 480,
    frame: false,
    transparent: true,
    resizable: true,
    center: true,
    show: false,
    title: "Todo - 待办清单",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const t = loadTarget("index.html");
  if (t.url) mainWindow.loadURL(t.url);
  else mainWindow.loadFile(t.path);

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // 应用内右键菜单：选中文本后右键可一键添加待办
  mainWindow.webContents.on("context-menu", (_, params) => {
    const selectedText = params.selectionText;
    if (!selectedText || !selectedText.trim()) return;
    const menu = Menu.buildFromTemplate([
      {
        label: "添加到待办",
        click: () => quickAddTodo(selectedText.trim()),
      },
    ]);
    menu.popup(mainWindow);
  });

  // 主窗关闭时一并销毁球窗，避免残留后台
  mainWindow.on("closed", () => {
    if (ballWindow) { ballWindow.destroy(); ballWindow = null; }
    mainWindow = null;
  });
}

// ===== 收起为悬浮球的动画 =====
let mainSnapTimer = null;

function cancelMainSnapAnim() {
  if (mainSnapTimer) { clearInterval(mainSnapTimer); mainSnapTimer = null; }
}

// 缓动函数：easeInOutQuart — 起步加速、结尾减速，收缩有"吸入"感
function easeInOutQuart(t) {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// 通用动画：同时改变位置、尺寸、透明度（合并为单次 setBounds + setOpacity）
function animateMainWindow(opts) {
  const { targetX, targetY, targetW, targetH, duration, startOpacity, endOpacity, onDone } = opts;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  cancelMainSnapAnim();
  const b = mainWindow.getBounds();
  const startX = b.x, startY = b.y, startW = b.width, startH = b.height;
  const startTime = Date.now();
  mainWindow.setOpacity(startOpacity);
  // 用 16ms 间隔（约60fps），配合 easeInOutQuart 缓动
  mainSnapTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) { cancelMainSnapAnim(); return; }
    const t = Math.min(1, (Date.now() - startTime) / duration);
    const eased = easeInOutQuart(t);
    const x = Math.round(startX + (targetX - startX) * eased);
    const y = Math.round(startY + (targetY - startY) * eased);
    const w = Math.round(startW + (targetW - startW) * eased);
    const h = Math.round(startH + (targetH - startH) * eased);
    // 合并：先设位置尺寸，再设透明度（减少跨进程调用）
    mainWindow.setBounds({ x, y, width: w, height: h });
    mainWindow.setOpacity(startOpacity + (endOpacity - startOpacity) * eased);
    if (t >= 1) {
      cancelMainSnapAnim();
      if (onDone) onDone();
    }
  }, 16);
}

// 收起到悬浮球位置：窗口向悬浮球方向缩小并淡出
function collapseToBall() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // 先创建悬浮球（不显示），获取其位置
  const ball = ensureBallWindow();
  const ballBounds = ball.getBounds();
  // 目标：缩小到悬浮球位置
  const targetW = BALL_SIZE;
  const targetH = BALL_SIZE;
  const targetX = ballBounds.x;
  const targetY = ballBounds.y;
  animateMainWindow({
    targetX, targetY, targetW, targetH,
    duration: 320,
    startOpacity: 1,
    endOpacity: 0,
    onDone: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
        mainWindow.setOpacity(1);
        ball.show();
      }
    },
  });
}

// 从悬浮球位置还原：从悬浮球位置淡入并放大到完整窗口
function expandFromBall(targetX, targetY, targetW, targetH) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // 获取悬浮球当前位置作为起点
  const ballBounds = ballWindow ? ballWindow.getBounds() : null;
  const startX = ballBounds ? ballBounds.x : targetX;
  const startY = ballBounds ? ballBounds.y : targetY;
  const startW = BALL_SIZE;
  const startH = BALL_SIZE;
  // 先设置到悬浮球位置和小尺寸
  mainWindow.setBounds({ x: startX, y: startY, width: startW, height: startH });
  mainWindow.setOpacity(0);
  mainWindow.show();
  mainWindow.focus();
  // 展开时刷新待办列表（可能在收起期间有快速添加的待办）
  setTimeout(() => { refreshMainWindow(); }, 350);
  animateMainWindow({
    targetX, targetY, targetW, targetH,
    duration: 320,
    startOpacity: 0,
    endOpacity: 1,
  });
}

// 悬浮球窗口：无边框、透明、常驻置顶、不占任务栏
function ensureBallWindow() {
  if (ballWindow) return ballWindow;
  ballWindow = new BrowserWindow({
    width: BALL_SIZE,
    height: BALL_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const t = loadTarget("ball.html");
  if (t.url) ballWindow.loadURL(t.url);
  else ballWindow.loadFile(t.path);
 ballWindow.on("closed", () => { ballWindow = null; });
  // 吸附态：鼠标移入滑出完整球，移出缩回边缘
  ballWindow.on("mouse-enter", () => {
    if (ballSnap && !dragOrigin) animateBallX(ballSnap.fullX);
  });
  ballWindow.on("mouse-leave", () => {
    if (ballSnap && !dragOrigin) animateBallX(ballSnap.hiddenX);
  });
  // 初始位置：鼠标所在屏右侧居中（仅创建时设定，之后保留用户拖动位置）
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const wa = display.workArea;
  ballWindow.setBounds({
    x: wa.x + wa.width - BALL_SIZE,
    y: wa.y + Math.round((wa.height - BALL_SIZE) / 2),
    width: BALL_SIZE,
    height: BALL_SIZE,
  });
  return ballWindow;
}

function showBall() {
  const ball = ensureBallWindow();
  ball.setAlwaysOnTop(true, "floating");
  ball.show();
}

function hideBall() {
  if (ballWindow && !ballWindow.isDestroyed()) ballWindow.hide();
}

// ===== 快速添加待办 + 备注输入悬浮窗 =====
let quickAddWindow = null;
let pendingQuickTodo = null; // 暂存刚创建的待办，等备注确认后更新

// 以选中文本为标题创建待办，并弹出备注输入窗
// 统一刷新主窗口待办列表
function refreshMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          const todos = await window.electronAPI.getTodos();
          const cats = await window.electronAPI.getCategories();
          window.dispatchEvent(new CustomEvent('quick-add-refresh', { detail: { todos, cats } }));
        } catch(e) { /* ignore */ }
      })();
    `).catch(() => {});
  }
}

function quickAddTodo(title) {
  // 创建待办
  const data = readStore();
  const now = new Date().toISOString();
  const newTodo = {
    id: Date.now(),
    title: title,
    completed: false,
    priority: "medium",
    category: "",
    due_date: null,
    notes: "",
    reminder_enabled: false,
    reminder_offset_minutes: 240,
    reminder_fired: false,
    created_at: now,
    updated_at: now,
  };
  data.todos.unshift(newTodo);
  writeStore(data);
  updateCategories();
  pendingQuickTodo = newTodo;

  // 通知主窗口刷新列表（仅在主窗口已可见时刷新，不自动弹出主窗口）
  refreshMainWindow();

  // 弹出备注输入悬浮窗
  showQuickAddWindow(title);
}

function showQuickAddWindow(title) {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.close();
    quickAddWindow = null;
  }
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const winW = 360;
  const winH = 220;
  quickAddWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: wa.x + wa.width - winW - 20,
    y: wa.y + wa.height - winH - 20,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "quick-add-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const t = loadTarget("quick-add.html");
  if (t.url) {
    quickAddWindow.loadURL(t.url + "?title=" + encodeURIComponent(title));
  } else {
    quickAddWindow.loadFile(t.path, { query: { title: title } });
  }
  quickAddWindow.once("ready-to-show", () => {
    quickAddWindow.show();
    quickAddWindow.focus();
  });
  quickAddWindow.on("closed", () => { quickAddWindow = null; });
  // 失焦时自动关闭
  quickAddWindow.on("blur", () => {
    if (quickAddWindow && !quickAddWindow.isDestroyed()) {
      quickAddWindow.close();
    }
  });
}

// IPC: 备注确认 — 将备注追加到待办
ipcMain.handle("quick-add:confirm", (_, notes) => {
  // 先移除 blur 监听，防止窗口在处理过程中被自动关闭
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.removeAllListeners("blur");
  }
  if (pendingQuickTodo) {
    const data = readStore();
    const idx = data.todos.findIndex((t) => t.id === pendingQuickTodo.id);
    if (idx !== -1) {
      data.todos[idx].notes = notes;
      data.todos[idx].updated_at = new Date().toISOString();
      writeStore(data);
    }
    // 通知主窗口刷新（无论窗口是否可见，都发送 IPC 事件让前端拉取最新数据）
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("quick-add-updated", { id: pendingQuickTodo.id, notes });
      // 如果窗口可见，额外通过 executeJavaScript 刷新
      refreshMainWindow();
    }
    pendingQuickTodo = null;
  }
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.close();
  }
});

// IPC: 跳过备注 — 直接关闭悬浮窗
ipcMain.handle("quick-add:skip", () => {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.removeAllListeners("blur");
  }
  pendingQuickTodo = null;
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.close();
  }
});

// 注册/重新注册全局快捷键（从设置读取，默认 Ctrl+Shift+T）
function registerQuickAddShortcut() {
  // 先注销旧快捷键
  globalShortcut.unregisterAll();

  // 读取设置中的快捷键
  const data = readStore();
  const rawShortcut = (data.settings && data.settings.quickAddShortcut) || "";

  let accel = rawShortcut || "Control+Shift+T";
  // 将用户输入的 Ctrl 转为 Electron 的 Control 格式
  accel = accel.replace(/\bCtrl\b/g, "Control");

  // 检查是否被其他应用占用
  const isRegisteredByOther = globalShortcut.isRegistered(accel);

  // 尝试注册
  const ok = globalShortcut.register(accel, () => {
    let text = clipboard.readText();
    if (text && text.trim()) {
      quickAddTodo(text.trim());
    } else {
      // 剪贴板为空，提示用户先复制文字
      if (Notification.isSupported()) {
        new Notification({
          title: "Quick Add Todo",
          body: "Please copy text (Ctrl+C) first, then press the shortcut.",
        }).show();
      }
    }
  });

  if (!ok) {
    // 写入错误日志文件
    try {
      const logPath = path.join(__dirname, "..", "shortcut-error.log");
      fs.writeFileSync(logPath, `[${new Date().toISOString()}] register FAILED: ${accel}\n`, "utf-8");
    } catch (e) { /* ignore */ }
  }

  return ok;
}

// IPC: 待办 CRUD
ipcMain.handle("todos:getAll", () => readStore().todos);

ipcMain.handle("todos:add", (_, todo) => {
  const data = readStore();
  const now = new Date().toISOString();
  const newTodo = {
    ...todo,
    id: Date.now(),
    completed: false,
    created_at: now,
    updated_at: now,
  };
  data.todos.unshift(newTodo);
  writeStore(data);
  updateCategories();
  return newTodo;
});

ipcMain.handle("todos:update", (_, todo) => {
  const data = readStore();
  const idx = data.todos.findIndex((t) => t.id === todo.id);
  if (idx !== -1) {
    data.todos[idx] = { ...data.todos[idx], ...todo, updated_at: new Date().toISOString() };
    writeStore(data);
    updateCategories();
  }
  return data.todos[idx];
});

ipcMain.handle("todos:delete", (_, id) => {
  const data = readStore();
  data.todos = data.todos.filter((t) => t.id !== id);
  writeStore(data);
  updateCategories();
});

ipcMain.handle("todos:toggle", (_, { id, completed }) => {
  const data = readStore();
  const todo = data.todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = completed;
    todo.updated_at = new Date().toISOString();
    writeStore(data);
  }
});

ipcMain.handle("categories:getAll", () => readStore().categories);

// IPC: 设置（飞书文档链接等）
ipcMain.handle("settings:get", () => readStore().settings || { feishuDocUrl: "" });

ipcMain.handle("settings:set", (_, settings) => {
  const data = readStore();
  const oldShortcut = data.settings && data.settings.quickAddShortcut;
  data.settings = { ...(data.settings || {}), ...settings };
  writeStore(data);
  setupSyncTimer();
  setupDailyFeishuTimer();
  // 快捷键变更时重新注册
  if (settings.quickAddShortcut !== undefined && settings.quickAddShortcut !== oldShortcut) {
    registerQuickAddShortcut();
  }
  return data.settings;
});

// IPC: 同步待办到飞书文档
ipcMain.handle("feishu:sync", async () => doSync(false));

// IPC: 立即测试每日推送（发未完成待办到飞书消息给自己）
ipcMain.handle("feishu:testDailyPush", async () => doDailyFeishuPush());
ipcMain.handle("feishu:testWeeklySummary", async () => doWeeklySummary());

// IPC: 飞书账号登录（设备流 OAuth）
ipcMain.handle("feishu:authStatus", async () => getAuthStatus());

ipcMain.handle("feishu:loginStart", async () => {
  const res = await startAuthLogin();
  if (res.ok && res.verification_url) {
    shell.openExternal(res.verification_url);
  }
  return res;
});

ipcMain.handle("feishu:loginFinish", async (_, deviceCode) => finishAuthLogin(deviceCode));

// IPC: 退出飞书登录
ipcMain.handle("feishu:logout", async () => logoutAuth());

ipcMain.handle("notification:send", (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
});

// IPC: 在外部浏览器中打开 URL
ipcMain.handle("shell:openExternal", (_, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
});

// IPC: 悬浮球（收起到悬浮球位置 → 显示悬浮球）
ipcMain.handle("window:enterBall", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  collapseToBall();
});

ipcMain.handle("window:exitBall", () => {
  hideBall();
  if (mainWindow && !mainWindow.isDestroyed()) {
    const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const targetW = 380;
    const targetH = 620;
    const targetX = wa.x + Math.round((wa.width - targetW) / 2);
    const targetY = wa.y + Math.round((wa.height - targetH) / 2);
    expandFromBall(targetX, targetY, targetW, targetH);
  }
});

// IPC: 关闭窗口
ipcMain.handle("window:close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});
// IPC: 悬浮球自定义拖拽（不使用 -webkit-app-region:drag，避免与 click 冲突）
ipcMain.on("ball:dragStart", (_, { x, y }) => {
  if (!ballWindow || ballWindow.isDestroyed()) return;
  dragCursor = { x, y };
  dragOrigin = ballWindow.getBounds();
  cancelBallAnim();
  ballSnap = null;
});

ipcMain.on("ball:drag", (_, { x, y }) => {
  if (!ballWindow || ballWindow.isDestroyed() || !dragOrigin) return;
  let nx = dragOrigin.x + (x - dragCursor.x);
  let ny = dragOrigin.y + (y - dragCursor.y);
  // 限制在所在显示器工作区内，避免拖出屏幕
  const wa = screen.getDisplayNearestPoint({ x: nx + BALL_SIZE / 2, y: ny + BALL_SIZE / 2 }).workArea;
  // X 轴允许缩入屏幕边缘（仅露出 EDGE_REVEAL），Y 轴保持在工作区内
  nx = Math.max(wa.x - BALL_SIZE + EDGE_REVEAL, Math.min(nx, wa.x + wa.width - EDGE_REVEAL));
  ny = Math.max(wa.y, Math.min(ny, wa.y + wa.height - BALL_SIZE));
  ballWindow.setPosition(Math.round(nx), Math.round(ny));
});

ipcMain.on("ball:dragEnd", () => {
  dragOrigin = null;
  dragCursor = null;
  snapBallToEdge();
});

function updateCategories() {
  const data = readStore();
  data.categories = [...new Set(data.todos.map((t) => t.category).filter(Boolean))];
  writeStore(data);
}

function writeErrorLog(err) {
  try {
    fs.writeFileSync(path.join(__dirname, "..", "error.log"), err.stack || err.message);
  } catch (e) { /* ignore */ }
}

process.on("uncaughtException", (err) => {
  writeErrorLog(err);
  console.error(err);
});

app.whenReady().then(() => {
  try {
    createWindow();
    setupSyncTimer();
    setupReminderTimer();
    setupDailyFeishuTimer();
    setupWeeklySummaryTimer();
    // 注册全局快捷键（从设置读取，默认 Ctrl+Shift+T）
    registerQuickAddShortcut();
  } catch (err) {
    writeErrorLog(err);
  }
}).catch((err) => {
  writeErrorLog(err);
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
