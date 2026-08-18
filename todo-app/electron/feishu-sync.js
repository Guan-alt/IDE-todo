const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PROFILE_NAME = "todoapp";

// 飞书文档 XML 文本转义：仅转义标签内部文本，标签本身保持原样
function escapeXml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const PRIORITY_LABEL = { high: "高", medium: "中", low: "低" };
const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };

// 本地日期 YYYY-MM-DD
function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

// 单条待办格式化为 checkbox 文本：[优先级][分类] 标题（截止 日期）— 备注
function formatTodoLine(todo) {
  const parts = [];
  const p = PRIORITY_LABEL[todo.priority];
  if (p) parts.push("[" + p + "]");
  if (todo.category) parts.push("[" + escapeXml(todo.category) + "]");
 parts.push(escapeXml(todo.title));
 if (todo.due_date) parts.push("（截止 " + escapeXml(String(todo.due_date).replace("T", " ").slice(0, 16)) + "）");
  if (todo.notes) parts.push("— " + escapeXml(todo.notes));
  return parts.join(" ");
}

// 组内排序：未完成在前，再按优先级高到低
function sortWithinGroup(list) {
  return list.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
  });
}

// 将全部待办按创建日期分组，每组大标题为日期规则：
// 当天创建 -> 当天日期；历史日期 -> "创建日期 到 今天"
function formatTodosXml(todos) {
  const now = new Date();
  const today = dateStr(now);
  const ts = now.toLocaleString("zh-CN", { hour12: false });

  // 按创建日期分组
  const groups = {};
  for (const t of todos) {
    const d = t.created_at ? dateStr(new Date(t.created_at)) : today;
    if (!groups[d]) groups[d] = [];
    groups[d].push(t);
  }

  // 日期升序：历史在前，今天在后
  const dates = Object.keys(groups).sort();

  const lines = [];
  lines.push("<title>待办清单</title>");
  lines.push("<p><span text-color=\"gray\">最后同步：" + escapeXml(ts) + " · 共 " + todos.length + " 项</span></p>");
  lines.push("<hr/>");

  for (const d of dates) {
    let heading;
    if (d === today) {
      heading = escapeXml(d);
    } else {
      heading = escapeXml(d) + " 到 " + escapeXml(today);
    }
    lines.push("<h2>" + heading + "</h2>");
    const items = sortWithinGroup(groups[d]);
    for (const t of items) {
      lines.push("<checkbox done=\"" + (t.completed ? "true" : "false") + "\">" + formatTodoLine(t) + "</checkbox>");
    }
  }

  if (todos.length === 0) {
    lines.push("<p>暂无待办事项</p>");
  }
  return lines.join("\n");
}

let _cliCache = null;

// 定位 lark-cli 的 JS 入口脚本，用 Electron 自身以纯 Node 方式运行：
// process.execPath + ELECTRON_RUN_AS_NODE=1，避免 spawn .cmd 的 EINVAL，
// 且不经过 shell，文档链接特殊字符也安全。
function resolveLarkCli() {
  if (_cliCache) return _cliCache;
  const appData = process.env.APPDATA || "";
  // 优先直接用原生二进制：不经 run.js wrapper（其内部 execFileSync 不带 windowsHide，会弹黑框）
  const bin = path.join(appData, "npm", "node_modules", "@larksuite", "cli", "bin", "lark-cli.exe");
  try {
    fs.accessSync(bin);
    _cliCache = { cmd: bin, prependArgs: [], shell: false, env: { ...process.env } };
    return _cliCache;
  } catch (e2) { /* 回退到下方 node 入口 */ }
  const entry = path.join(appData, "npm", "node_modules", "@larksuite", "cli", "scripts", "run.js");
  try {
    fs.accessSync(entry);
    _cliCache = { cmd: process.execPath, prependArgs: [entry], shell: false, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } };
    return _cliCache;
  } catch (e) {
    // 兜底：经 PATH 调用
    _cliCache = { cmd: "lark-cli", prependArgs: [], shell: true, env: { ...process.env } };
    return _cliCache;
  }
}

// 通用：运行 lark-cli，可经 stdin 传入数据，返回 { ok, code, stdout, stderr, parsed }
function runLarkCli(args, stdinData) {
  return new Promise((resolve) => {
    const cli = resolveLarkCli();
    const fullArgs = [...cli.prependArgs, ...args];
    const child = spawn(cli.cmd, fullArgs, { windowsHide: true, shell: cli.shell, env: cli.env });
    let stdout = "";
    let stderr = "";
    let done = false;
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => {
      if (done) return;
      done = true;
      resolve({ ok: false, code: -1, stdout, stderr, error: err.message });
    });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      let parsed = null;
      try { parsed = JSON.parse(stdout); } catch (e) { /* 非JSON */ }
      resolve({ ok: code === 0 && !(parsed && parsed.ok === false), code, stdout, stderr, parsed });
    });
    if (stdinData != null) {
      child.stdin.write(stdinData);
    }
    child.stdin.end();
  });
}

// 为用户填入的飞书应用凭据创建/更新一个命名 profile（免 OAuth，用 bot 身份）
function ensureProfile(appId, appSecret) {
  return new Promise((resolve) => {
    if (!appId || !appSecret) {
      resolve({ ok: false, error: "缺少 appId 或 appSecret" });
      return;
    }
    const args = ["config", "init", "--name", PROFILE_NAME, "--app-id", appId, "--app-secret-stdin", "--brand", "feishu"];
    runLarkCli(args, appSecret + "\n").then((r) => {
      // config init 在凭据无效时仍会保存 profile，但会连网校验；只要保存即可
      if (r.code === 0 || (r.parsed && r.parsed.appId)) {
        resolve({ ok: true });
      } else if (r.parsed && r.parsed.ok === false) {
        // 凭据无效也会保存 profile，这里仍视为成功（同步时会真正报错）
        resolve({ ok: true, warning: r.parsed.error ? r.parsed.error.message : "凭据校验异常" });
      } else {
        resolve({ ok: false, error: r.stderr || r.stdout || "创建 profile 失败" });
      }
    });
  });
}

// 调用 lark-cli 把待办以 overwrite 方式写入指定飞书文档
// opts: { appId, appSecret } 有则用 bot 身份(--profile todoapp --as bot)，否则用当前用户身份
function syncTodosToFeishu(docUrl, todos, opts) {
  return new Promise((resolve) => {
    opts = opts || {};
    if (!docUrl || !docUrl.trim()) {
      resolve({ ok: false, error: "未设置飞书文档链接，请先在设置中填写" });
      return;
    }

    const content = formatTodosXml(todos);
    const args = [
      "docs", "+update",
      "--api-version", "v2",
      "--doc", docUrl.trim(),
      "--command", "overwrite",
      "--content", "-", // 内容从 stdin 传入
      "--json",
    ];
    // 有应用凭据 -> bot 身份（免 OAuth，文档需共享给应用）；否则用已授权的用户身份
    if (opts.appId && opts.appSecret) {
      args.push("--profile", PROFILE_NAME, "--as", "bot");
    }

    runLarkCli(args, content).then((r) => {
      if (r.parsed && r.parsed.ok === false) {
        const err = r.parsed.error || {};
        resolve({ ok: false, error: err.message || r.stderr || "同步失败", missingScopes: err.missing_scopes });
        return;
      }
      if (r.ok) {
        resolve({ ok: true, message: "已同步 " + todos.length + " 项待办到飞书文档" });
      } else {
        resolve({ ok: false, error: r.stderr || r.stdout || ("lark-cli 退出码 " + r.code) });
      }
    });
  });
}

// 未完成待办格式化为飞书消息 Markdown 文本（按优先级高到低排序）
function formatTodosMarkdown(todos) {
  const pending = (todos || []).filter((t) => !t.completed);
  const order = { high: 3, medium: 2, low: 1 };
  const emoji = { high: "🔴", medium: "🟡", low: "🟢" };
  const sorted = pending.slice().sort((a, b) => (order[b.priority] || 0) - (order[a.priority] || 0));
  const lines = [];
  lines.push("📋 未完成待办（共 " + pending.length + " 项）");
  lines.push("");
  if (sorted.length === 0) {
    lines.push("🎉 暂无未完成待办，继续保持！");
  } else {
    for (const t of sorted) {
      const e = emoji[t.priority] || "⚪";
      let line = e + " ";
      if (t.category) line += "【" + escapeXml(t.category) + "】 ";
      line += escapeXml(t.title || "");
      if (t.due_date) {
        const d = String(t.due_date).replace("T", " ").slice(0, 16);
        line += "（截止 " + d + "）";
      }
      if (t.notes) line += " — " + escapeXml(t.notes);
      lines.push(line);
    }
  }
  lines.push("");
  lines.push("> 发送时间：" + new Date().toLocaleString("zh-CN", { hour12: false }));
  return lines.join("\n");
}

// 以 bot 身份把未完成待办作为飞书消息发送给指定用户(open_id)
// 需 bot 应用具备 im:message 权限且可见范围覆盖该用户
function pushTodosMessage(openId, todos) {
  return new Promise((resolve) => {
    if (!openId) {
      resolve({ ok: false, error: "未获取到飞书 open_id，请先登录飞书账号" });
      return;
    }
    const md = formatTodosMarkdown(todos);
    const args = [
      "im", "+messages-send",
      "--user-id", openId,
      "--markdown", md,
      "--as", "bot",
      "--json",
    ];
    runLarkCli(args).then((r) => {
      if (r.parsed && r.parsed.ok === false) {
        const err = r.parsed.error || {};
        resolve({ ok: false, error: err.message || r.stderr || "发送消息失败", missingScopes: err.missing_scopes });
        return;
      }
      if (r.ok) {
        resolve({ ok: true, message: "已发送未完成待办到飞书消息" });
      } else {
        resolve({ ok: false, error: r.stderr || r.stdout || ("lark-cli 退出码 " + r.code) });
      }
    });
  });
}

// 以 bot 身份发送任意 Markdown 消息给指定用户(open_id)
function sendMarkdownMessage(openId, markdown) {
  return new Promise((resolve) => {
    if (!openId) { resolve({ ok: false, error: "未获取到飞书 open_id，请先登录飞书账号" }); return; }
    if (!markdown) { resolve({ ok: false, error: "消息内容为空" }); return; }
    const args = ["im", "+messages-send", "--user-id", openId, "--markdown", markdown, "--as", "bot", "--json"];
    runLarkCli(args).then((r) => {
      if (r.parsed && r.parsed.ok === false) {
        const err = r.parsed.error || {};
        resolve({ ok: false, error: err.message || r.stderr || "发送消息失败", missingScopes: err.missing_scopes });
        return;
      }
      resolve(r.ok ? { ok: true, message: "已发送飞书消息" } : { ok: false, error: r.stderr || r.stdout || ("lark-cli 退出码 " + r.code) });
    });
  });
}

// 计算 ISO 周标识：YYYY-Www（自然周周一到周日）。用于区分当周文档。
function weekId(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return date.getUTCFullYear() + "-W" + String(weekNum).padStart(2, "0");
}

// 当周起止日期（周一 00:00 ~ 周日 23:59），用于统计本周涉及的待办
function weekRange(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - dayNum);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function weeklyDocTitle(wid) {
  return "待办清单 " + wid;
}

// 把待办写入/覆盖到当周文档；当周无文档则新建并记录 url，同时在主文档追加链接。
// weeklyDocs: { [weekId]: docUrl } 由调用方持久化
function syncWeeklyTodos(masterDocUrl, weeklyDocs, todos) {
  return new Promise((resolve) => {
    if (!masterDocUrl || !masterDocUrl.trim()) {
      resolve({ ok: false, error: "未设置主文档链接，请先在设置中填写" });
      return;
    }
    const wid = weekId(new Date());
    const existing = weeklyDocs && weeklyDocs[wid];
    const content = formatTodosXml(todos);
    if (existing) {
      const args = ["docs", "+update", "--doc", existing, "--command", "overwrite", "--content", "-", "--json"];
      runLarkCli(args, content).then((r) => {
        if (r.parsed && r.parsed.ok === false) {
          const err = r.parsed.error || {};
          resolve({ ok: false, error: err.message || r.stderr || "覆盖当周文档失败" });
          return;
        }
        resolve(r.ok ? { ok: true, weekId: wid, docUrl: existing, message: "已覆盖当周文档" } : { ok: false, error: r.stderr || r.stdout || ("lark-cli 退出码 " + r.code) });
      });
      return;
    }
    const titleXml = "<title>" + escapeXml(weeklyDocTitle(wid)) + "</title>";
    const createArgs = ["docs", "+create", "--parent-position", "my_library", "--content", "-", "--json"];
    runLarkCli(createArgs, titleXml + "\n" + content).then((cr) => {
      if (cr.parsed && cr.parsed.ok === false) {
        const err = cr.parsed.error || {};
        resolve({ ok: false, error: err.message || cr.stderr || "新建当周文档失败" });
        return;
      }
      const docUrl = cr.parsed && cr.parsed.data && cr.parsed.data.document && cr.parsed.data.document.url;
      if (!docUrl) {
        resolve({ ok: false, error: "新建文档成功但未返回链接" });
        return;
      }
      const linkXml = '<p><a href="' + escapeXml(docUrl) + '">' + escapeXml(weeklyDocTitle(wid)) + "</a></p>";
      const linkArgs = ["docs", "+update", "--doc", masterDocUrl.trim(), "--command", "append", "--content", "-", "--json"];
      runLarkCli(linkArgs, linkXml).then((lr) => {
        const warn = (lr.parsed && lr.parsed.ok === false) ? "主文档追加链接失败" : "";
        resolve({ ok: true, weekId: wid, docUrl: docUrl, newCreated: true, warning: warn, message: "已新建当周文档" + (warn ? "（" + warn + "）" : "") });
      });
    });
  });
}

// 统一计算本周统计数据，供 XML/Markdown 格式化复用
function computeWeeklyStats(todos) {
  const now = new Date();
  const range = weekRange(now);
  const inWeek = (t) => {
    const c = t.created_at ? new Date(t.created_at).getTime() : 0;
    const u = t.updated_at ? new Date(t.updated_at).getTime() : 0;
    return (c >= range.start.getTime() && c <= range.end.getTime()) || (u >= range.start.getTime() && u <= range.end.getTime());
  };
  const related = (todos || []).filter(inWeek);
  const total = related.length;
  const done = related.filter((t) => t.completed).length;
  const pending = total - done;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  const byCat = {};
  for (const t of related) {
    const k = t.category || "未分类";
    if (!byCat[k]) byCat[k] = { total: 0, done: 0 };
    byCat[k].total++;
    if (t.completed) byCat[k].done++;
  }
  const byPri = { high: { total: 0, done: 0 }, medium: { total: 0, done: 0 }, low: { total: 0, done: 0 } };
  for (const t of related) {
    const k = t.priority in byPri ? t.priority : "low";
    byPri[k].total++;
    if (t.completed) byPri[k].done++;
  }
  const undone = related.filter((t) => !t.completed);
  return { now, related, total, done, pending, rate, byCat, byPri, undone };
}

// 规则统计：本周（自然周）涉及的待办完成情况，返回 XML 文档片段
// 涉及 = 创建时间在本周 或 本周内有更新（completed 变更等）
function formatWeeklySummaryXml(todos, wid) {
  const s = computeWeeklyStats(todos);
  const { now, total, done, pending, rate, byCat, byPri, undone } = s;
  const lines = [];
  lines.push("<h2>本周总结（" + escapeXml(wid || weekId(now)) + "）</h2>");
  lines.push('<p><span text-color="gray">统计时间：' + escapeXml(now.toLocaleString("zh-CN", { hour12: false })) + "</span></p>");
  lines.push("<p>本周涉及待办 <b>" + total + "</b> 项，已完成 <b>" + done + "</b> 项，未完成 <b>" + pending + "</b> 项，完成率 <b>" + rate + "%</b>。</p>");
  if (total === 0) {
    lines.push("<p>本周无待办记录。</p>");
    return lines.join("\n");
  }
  lines.push("<h3>按分类</h3>");
  lines.push("<ul>");
  for (const k of Object.keys(byCat)) {
    const v = byCat[k];
    lines.push("<li>" + escapeXml(k) + "：" + v.done + "/" + v.total + " 完成</li>");
  }
  lines.push("</ul>");
  lines.push("<h3>按优先级</h3>");
  lines.push("<ul>");
  lines.push("<li>🔴 高：" + byPri.high.done + "/" + byPri.high.total + " 完成</li>");
  lines.push("<li>🟡 中：" + byPri.medium.done + "/" + byPri.medium.total + " 完成</li>");
  lines.push("<li>🟢 低：" + byPri.low.done + "/" + byPri.low.total + " 完成</li>");
  lines.push("</ul>");
  if (undone.length > 0) {
    lines.push("<h3>未完成清单</h3>");
    const sorted = undone.slice().sort((a, b) => (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0));
    for (const t of sorted) {
      lines.push("<checkbox done=\"false\">" + formatTodoLine(t) + "</checkbox>");
    }
  }
  return lines.join("\n");
}

// 规则统计的 Markdown 版本，用于发飞书消息
function formatWeeklySummaryMarkdown(todos, wid) {
  const s = computeWeeklyStats(todos);
  const { now, total, done, pending, rate, byCat } = s;
  const lines = [];
  lines.push("📊 本周待办总结（" + (wid || weekId(now)) + "）");
  lines.push("");
  lines.push("本周涉及 " + total + " 项，已完成 " + done + " 项，未完成 " + pending + " 项，完成率 " + rate + "%");
  if (total === 0) { lines.push("本周无待办记录。"); }
  else {
    lines.push("");
    lines.push("按分类：");
    for (const k of Object.keys(byCat)) { const v = byCat[k]; lines.push("  " + k + "：" + v.done + "/" + v.total); }
  }
  lines.push("");
  lines.push("> 发送时间：" + now.toLocaleString("zh-CN", { hour12: false }));
  return lines.join("\n");
}

// 把本周总结追加到当周文档末尾，并返回结果（不含发消息）
function appendWeeklySummary(docUrl, todos, wid) {
  return new Promise((resolve) => {
    if (!docUrl) { resolve({ ok: false, error: "缺少当周文档链接" }); return; }
    const xml = formatWeeklySummaryXml(todos, wid);
    const args = ["docs", "+update", "--doc", docUrl, "--command", "append", "--content", "-", "--json"];
    runLarkCli(args, xml).then((r) => {
      if (r.parsed && r.parsed.ok === false) {
        const err = r.parsed.error || {};
        resolve({ ok: false, error: err.message || r.stderr || "追加总结失败" });
        return;
      }
      resolve(r.ok ? { ok: true, message: "已追加本周总结到当周文档" } : { ok: false, error: r.stderr || r.stdout || ("lark-cli 退出码 " + r.code) });
    });
  });
}

// 发起设备流授权：返回 { ok, verification_url, device_code, expires_in }
function startAuthLogin() {
  return runLarkCli(["auth", "login", "--domain", "docs", "--recommend", "--no-wait", "--json"]).then((r) => {
    const p = r.parsed || {};
    if (p.verification_url && p.device_code) {
      return { ok: true, verification_url: p.verification_url, device_code: p.device_code, expires_in: p.expires_in };
    }
    return { ok: false, error: r.stderr || r.stdout || "获取授权链接失败" };
  });
}

// 用 device_code 完成授权（阻塞至用户在浏览器完成或超时）
function finishAuthLogin(deviceCode, timeoutMs) {
  return new Promise((resolve) => {
    if (!deviceCode) { resolve({ ok: false, error: "缺少 device_code" }); return; }
    const cli = resolveLarkCli();
    const fullArgs = [...cli.prependArgs, "auth", "login", "--device-code", deviceCode, "--json"];
    const child = spawn(cli.cmd, fullArgs, { windowsHide: true, shell: cli.shell, env: cli.env });
    let stdout = "";
    let stderr = "";
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { child.kill(); } catch (e) {}
      resolve({ ok: false, error: "授权超时，请在浏览器完成授权后重试" });
    }, timeoutMs || 120000);
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => {
      if (done) return;
      done = true; clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });
    child.on("close", (code) => {
      if (done) return;
      done = true; clearTimeout(timer);
      let parsed = null;
      try { parsed = JSON.parse(stdout); } catch (e) {}
      if (code === 0) {
        resolve({ ok: true, message: "飞书账号授权成功" });
      } else {
        const err = (parsed && parsed.error && parsed.error.message) || stderr || stdout || ("lark-cli 退出码 " + code);
        resolve({ ok: false, error: err });
      }
    });
  });
}

// 查询当前登录状态
function getAuthStatus() {
  return runLarkCli(["auth", "status", "--json"]).then((r) => {
    const p = r.parsed || {};
    const user = p.identities && p.identities.user;
    if (user && user.available) {
      return {
        ok: true,
        loggedIn: true,
        userName: user.userName || "",
        openId: user.openId || "",
        tokenValid: user.tokenStatus === "valid",
        scope: user.scope || "",
        expiresAt: user.expiresAt || "",
      };
    }
    return { ok: true, loggedIn: false };
  });
}

// 退出登录：清除本地 token
function logoutAuth() {
  return runLarkCli(["auth", "logout", "--json"]).then((r) => {
    if (r.parsed && r.parsed.ok === false) {
      return { ok: false, error: (r.parsed.error && r.parsed.error.message) || r.stderr || "退出登录失败" };
    }
    return { ok: r.ok, message: r.ok ? "已退出登录" : (r.stderr || r.stdout || ("lark-cli 退出码 " + r.code)) };
  });
}

module.exports = { syncTodosToFeishu, ensureProfile, formatTodosXml, escapeXml, dateStr, startAuthLogin, finishAuthLogin, getAuthStatus, logoutAuth, formatTodosMarkdown, pushTodosMessage, sendMarkdownMessage, weekId, weekRange, syncWeeklyTodos, formatWeeklySummaryXml, formatWeeklySummaryMarkdown, appendWeeklySummary };
