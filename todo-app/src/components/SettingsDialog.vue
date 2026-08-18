<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="$emit('close')">
        <div class="settings-dialog">
          <h2 class="settings-title">飞书同步</h2>
          <p class="settings-desc">将待办同步到指定的飞书文档。每次同步会用当前待办清单<b>覆盖</b>该文档全部内容，请使用专用文档。</p>
          <div class="auth-section">
            <div class="auth-status">
              <span v-if="authStatus && authStatus.loggedIn" class="auth-ok">
                已登录：{{ authStatus.userName }}
                <span v-if="!authStatus.tokenValid" class="auth-warn">（令牌失效，请重新登录）</span>
              </span>
              <span v-else class="auth-none">未登录飞书账号</span>
            </div>
            <div class="auth-actions">
              <button
                v-if="!authStatus || !authStatus.loggedIn || !authStatus.tokenValid"
                class="btn btn-primary btn-sm"
                :disabled="loginBusy"
                @click="handleLoginStart"
              >{{ loginBusy ? "请稍候..." : "登录飞书账号" }}</button>
              <button
                v-if="loginStarted && !loginDone"
                class="btn btn-primary btn-sm"
                :disabled="loginFinishing"
                @click="handleLoginFinish"
              >{{ loginFinishing ? "验证中..." : "我已完成授权" }}</button>
              <button
                v-if="authStatus && authStatus.loggedIn && authStatus.tokenValid"
                class="btn btn-secondary btn-sm"
                :disabled="logoutBusy"
                @click="handleLogout"
              >{{ logoutBusy ? "退出中..." : "退出登录" }}</button>
            </div>
            <p class="settings-hint">登录后用你自己的飞书账号同步，文档归你所有，无需共享给应用。换电脑/换人只需重新登录一次。</p>
          </div>
          <label class="settings-label">主文档链接（周文档模式，留空则用下方单文档）</label>
          <input
            v-model="feishuMasterDocUrl"
            class="settings-input"
            type="text"
            placeholder="粘贴一个飞书文档 URL 作为总目录；每周自动新建子文档"
          />
          <p class="settings-hint">设置后，每次同步会为当周新建/覆盖一个子文档，主文档里追加各周链接；周日晚 22:00 自动统计本周完成情况并追加到当周文档、发飞书消息。</p>
          <label class="settings-label">飞书文档链接</label>
          <input
            v-model="feishuDocUrl"
            class="settings-input"
            type="text"
            placeholder="粘贴飞书文档 URL（如 https://xxx.feishu.cn/docx/...）"
          />
          <label class="settings-label">定时同步间隔（分钟，0=关闭）</label>
          <input
            v-model="syncInterval"
            class="settings-input"
            type="number"
            min="0"
            step="1"
            placeholder="如 30 表示每 30 分钟自动同步一次"
          />
          <label class="settings-label">快速添加待办快捷键</label>
          <div class="shortcut-input-wrap">
            <input
              v-model="quickAddShortcut"
              class="settings-input shortcut-input"
              type="text"
              placeholder="Ctrl+Shift+T"
              @keydown.prevent="handleShortcutInput"
            />
            <button v-if="quickAddShortcut" class="btn btn-secondary btn-sm shortcut-reset" @click="quickAddShortcut = ''">重置</button>
          </div>
          <p class="settings-hint">在输入框中按下快捷键组合即可设置，留空恢复默认 Ctrl+Shift+T。选中任意文字复制后按此快捷键快速添加待办。</p>
          <label class="settings-label">每日定时推送未完成待办到飞书（留空=关闭）</label>
          <input
            v-model="dailyFeishuTime"
            class="settings-input"
            type="time"
          />
          <button class="btn btn-secondary btn-sm" :disabled="testPushBusy" @click="handleTestDailyPush">
            {{ testPushBusy ? "推送中..." : "立即测试推送" }}
          </button>
          <p v-if="testPushStatus" class="settings-status" :class="testPushStatus.ok ? 'status-ok' : 'status-err'">{{ testPushStatus.msg }}</p>
          <button class="btn btn-secondary btn-sm" :disabled="summaryBusy" @click="handleTestWeeklySummary">
            {{ summaryBusy ? "总结中..." : "立即测试周总结" }}
          </button>
          <p v-if="summaryStatus" class="settings-status" :class="summaryStatus.ok ? 'status-ok' : 'status-err'">{{ summaryStatus.msg }}</p>
          <div class="settings-actions">
            <button class="btn btn-secondary" @click="handleClose">关闭</button>
            <button class="btn btn-primary" :disabled="syncing" @click="handleFeishuSync">
              {{ syncing ? "同步中..." : "立即同步" }}
            </button>
          </div>
          <p v-if="syncStatus" class="settings-status" :class="syncStatus.ok ? 'status-ok' : 'status-err'">{{ syncStatus.msg }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  modelValue: Boolean,
  feishuDocUrl: String,
  feishuMasterDocUrl: String,
  syncInterval: [Number, String],
  dailyFeishuTime: String,
  quickAddShortcut: String,
});

const emit = defineEmits(["close", "update:feishuDocUrl", "update:feishuMasterDocUrl", "update:syncInterval", "update:dailyFeishuTime", "update:quickAddShortcut"]);

const api = window.electronAPI;

const authStatus = ref(null);
const loginBusy = ref(false);
const loginStarted = ref(false);
const loginFinishing = ref(false);
const loginDone = ref(false);
const deviceCode = ref("");
const logoutBusy = ref(false);
const syncing = ref(false);
const syncStatus = ref(null);
const testPushBusy = ref(false);
const testPushStatus = ref(null);
const summaryBusy = ref(false);
const summaryStatus = ref(null);

// 局部可编辑的设置值（与 props 同步）
const feishuDocUrl = ref(props.feishuDocUrl || "");
const feishuMasterDocUrl = ref(props.feishuMasterDocUrl || "");
const syncInterval = ref(props.syncInterval || 0);
const dailyFeishuTime = ref(props.dailyFeishuTime || "");
const quickAddShortcut = ref(props.quickAddShortcut || "");

watch(() => props.feishuDocUrl, (v) => feishuDocUrl.value = v || "");
watch(() => props.feishuMasterDocUrl, (v) => feishuMasterDocUrl.value = v || "");
watch(() => props.syncInterval, (v) => syncInterval.value = v || 0);
watch(() => props.dailyFeishuTime, (v) => dailyFeishuTime.value = v || "");
watch(() => props.quickAddShortcut, (v) => quickAddShortcut.value = v || "");

// 弹窗打开时加载认证状态
watch(() => props.modelValue, async (visible) => {
  if (visible) {
    syncStatus.value = null;
    loginStarted.value = false;
    loginDone.value = false;
    await loadAuthStatus();
  }
});

async function saveSettings() {
  if (!api) return;
  emit("update:feishuDocUrl", feishuDocUrl.value.trim());
  emit("update:feishuMasterDocUrl", feishuMasterDocUrl.value.trim());
  emit("update:syncInterval", Number(syncInterval.value) || 0);
  emit("update:dailyFeishuTime", dailyFeishuTime.value);
  emit("update:quickAddShortcut", quickAddShortcut.value.trim());
  await api.setSettings({
    feishuDocUrl: feishuDocUrl.value.trim(),
    feishuMasterDocUrl: feishuMasterDocUrl.value.trim(),
    syncInterval: Number(syncInterval.value) || 0,
    dailyFeishuTime: dailyFeishuTime.value,
    quickAddShortcut: quickAddShortcut.value.trim(),
  });
}

async function handleClose() {
  await saveSettings();
  emit("close");
}

function handleShortcutInput(e) {
  const key = e.key;
  if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(key)) return;
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  let keyName = key;
  if (key === " ") keyName = "Space";
  else if (key.length === 1) keyName = key.toUpperCase();
  parts.push(keyName);
  quickAddShortcut.value = parts.join("+");
}

async function loadAuthStatus() {
  if (!api) return;
  try {
    authStatus.value = await api.feishuAuthStatus();
  } catch (e) {
    authStatus.value = null;
  }
}

async function handleLogout() {
  if (!api) return;
  logoutBusy.value = true;
  syncStatus.value = null;
  try {
    const res = await api.feishuLogout();
    syncStatus.value = { ok: res.ok, msg: res.ok ? res.message : res.error };
    if (res.ok) await loadAuthStatus();
  } catch (e) {
    syncStatus.value = { ok: false, msg: "退出异常：" + (e.message || e) };
  } finally {
    logoutBusy.value = false;
  }
}

async function handleLoginStart() {
  if (!api) return;
  loginBusy.value = true;
  loginDone.value = false;
  loginStarted.value = false;
  syncStatus.value = null;
  try {
    const res = await api.feishuLoginStart();
    if (res.ok) {
      deviceCode.value = res.device_code;
      loginStarted.value = true;
      syncStatus.value = { ok: true, msg: "浏览器已打开，请在飞书完成授权后点击「我已完成授权」" };
    } else {
      syncStatus.value = { ok: false, msg: res.error || "获取授权链接失败" };
    }
  } catch (e) {
    syncStatus.value = { ok: false, msg: "登录异常：" + (e.message || e) };
  } finally {
    loginBusy.value = false;
  }
}

async function handleLoginFinish() {
  if (!api || !deviceCode.value) return;
  loginFinishing.value = true;
  syncStatus.value = null;
  try {
    const res = await api.feishuLoginFinish(deviceCode.value);
    if (res.ok) {
      loginDone.value = true;
      loginStarted.value = false;
      syncStatus.value = { ok: true, msg: "飞书账号授权成功" };
      await loadAuthStatus();
    } else {
      syncStatus.value = { ok: false, msg: res.error || "授权失败，请重试" };
    }
  } catch (e) {
    syncStatus.value = { ok: false, msg: "验证异常：" + (e.message || e) };
  } finally {
    loginFinishing.value = false;
  }
}

async function handleFeishuSync() {
  if (!api) return;
  if (!feishuDocUrl.value.trim()) {
    syncStatus.value = { ok: false, msg: "请先填写飞书文档链接" };
    return;
  }
  syncing.value = true;
  syncStatus.value = null;
  try {
    await saveSettings();
    const res = await api.feishuSync();
    syncStatus.value = { ok: res.ok, msg: res.ok ? res.message : res.error };
  } catch (e) {
    syncStatus.value = { ok: false, msg: "同步异常：" + (e.message || e) };
  } finally {
    syncing.value = false;
  }
}

async function handleTestDailyPush() {
  if (!api) return;
  await saveSettings();
  testPushBusy.value = true;
  testPushStatus.value = null;
  try {
    await api.feishuTestDailyPush();
    testPushStatus.value = { ok: true, msg: "已触发推送，请在飞书查看消息；若未收到请确认已登录且应用有 im:message 权限" };
  } catch (e) {
    testPushStatus.value = { ok: false, msg: "推送异常：" + (e.message || e) };
  } finally {
    testPushBusy.value = false;
  }
}

async function handleTestWeeklySummary() {
  if (!api) return;
  await saveSettings();
  summaryBusy.value = true;
  summaryStatus.value = null;
  try {
    const res = await api.feishuTestWeeklySummary();
    const d = res && res.doc;
    const m = res && res.msg;
    let msg = (d && d.ok ? "文档已追加总结" : "文档失败：" + (d && d.error)) + "；";
    msg += m && m.ok ? "已发飞书消息" : (m && m.skipped ? "未发消息（未登录）" : "消息失败：" + (m && m.error));
    summaryStatus.value = { ok: (d && d.ok) || (m && m.ok), msg };
  } catch (e) {
    summaryStatus.value = { ok: false, msg: "总结异常：" + (e.message || e) };
  } finally {
    summaryBusy.value = false;
  }
}
</script>

<style scoped>
.settings-dialog {
  background: var(--bg-primary);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 92vw;
  max-width: 420px;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: var(--glass-shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.settings-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 0;
}

.settings-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-input {
  padding: 9px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.settings-input:focus {
  border-color: var(--accent);
}

.shortcut-input-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
}
.shortcut-input-wrap .shortcut-input {
  flex: 1;
  text-align: center;
  font-weight: 600;
  cursor: pointer;
}
.shortcut-reset {
  flex-shrink: 0;
}

.settings-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-tertiary);
  margin: -4px 0 0 0;
}

.auth-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}

.auth-status {
  font-size: 13px;
  color: var(--text-primary);
}

.auth-ok {
  color: var(--accent);
  font-weight: 600;
}

.auth-warn {
  color: var(--danger);
  font-weight: 400;
}

.auth-none {
  color: var(--text-secondary);
}

.auth-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settings-status {
  font-size: 12px;
  margin: 0;
  text-align: center;
}

.status-ok {
  color: var(--accent);
}

.status-err {
  color: var(--danger);
}
</style>
