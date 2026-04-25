const els = {
  healthBadge: document.getElementById("healthBadge"),
  processBadge: document.getElementById("processBadge"),
  exeInput: document.getElementById("exeInput"),
  configInput: document.getElementById("configInput"),
  portInput: document.getElementById("portInput"),
  secretInput: document.getElementById("secretInput"),
  saveConfigBtn: document.getElementById("saveConfigBtn"),
  genConfigBtn: document.getElementById("genConfigBtn"),
  configTip: document.getElementById("configTip"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  diagBtn: document.getElementById("diagBtn"),
  versionText: document.getElementById("versionText"),
  diagBox: document.getElementById("diagBox"),
  stdoutBox: document.getElementById("stdoutBox"),
  stderrBox: document.getElementById("stderrBox"),
  loadGroupsBtn: document.getElementById("loadGroupsBtn"),
  groupsWrap: document.getElementById("groupsWrap"),
};

function setBadge(el, text, cls) {
  el.textContent = text;
  el.className = `badge ${cls}`;
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function loadHealth() {
  try {
    await request("/api/health");
    setBadge(els.healthBadge, "本地服务已连接", "pass");
  } catch {
    setBadge(els.healthBadge, "本地服务离线", "fail");
  }
}

async function loadConfig() {
  const data = await request("/api/config");
  const cfg = data.config;
  els.exeInput.value = cfg.mihomoExe || "";
  els.configInput.value = cfg.mihomoConfig || "";
  els.portInput.value = cfg.controllerPort || 9090;
  els.secretInput.value = cfg.controllerSecret || "";
}

async function saveConfig() {
  const payload = {
    mihomoExe: els.exeInput.value.trim(),
    mihomoConfig: els.configInput.value.trim(),
    controllerPort: Number(els.portInput.value || 9090),
    controllerSecret: els.secretInput.value,
  };
  await request("/api/config", { method: "POST", body: JSON.stringify(payload) });
  els.configTip.textContent = "配置已保存。";
}

async function generateMinimalConfig() {
  const payload = {
    controllerPort: Number(els.portInput.value || 9090),
    controllerSecret: els.secretInput.value,
  };
  const data = await request("/api/config/generate-minimal", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  els.configInput.value = data.path;
  els.configTip.textContent = `已生成最小配置：${data.path}`;
}

async function refreshStatus() {
  const data = await request("/api/mihomo/status");
  if (data.running) {
    setBadge(els.processBadge, `mihomo 运行中（PID ${data.pid}）`, "pass");
  } else {
    setBadge(els.processBadge, "mihomo 未运行", "idle");
  }
  els.stdoutBox.textContent = (data.stdoutTail || []).join("\n") || "-";
  els.stderrBox.textContent = (data.stderrTail || []).join("\n") || "-";

  try {
    const version = await request("/api/mihomo/version");
    els.versionText.textContent = `版本：${JSON.stringify(version.data)}`;
  } catch (error) {
    els.versionText.textContent = `版本：读取失败（${error.message}）`;
  }
}

async function runDiagnosis() {
  const data = await request("/api/mihomo/diagnose");
  const report = data.report || {};
  const lines = [];
  lines.push(`诊断目标：${report.controllerBase || "-"}`);
  const checks = report.checks || [];
  for (const item of checks) {
    const mark = item.ok ? "✅" : "❌";
    lines.push(`${mark} ${item.key}: ${item.detail}`);
    if (item.tip) lines.push(`   建议：${item.tip}`);
  }
  lines.push(`结论：${report.summary === "ok" ? "可用" : report.summary === "warning" ? "部分异常" : "不可用"}`);
  els.diagBox.textContent = lines.join("\n");
}

async function startMihomo() {
  await request("/api/mihomo/start", { method: "POST" });
  await refreshStatus();
}

async function stopMihomo() {
  await request("/api/mihomo/stop", { method: "POST" });
  await refreshStatus();
}

function renderGroups(groups) {
  if (!groups.length) {
    els.groupsWrap.textContent = "未找到可切换的代理组（请检查配置中是否存在 proxy-groups）。";
    return;
  }
  els.groupsWrap.innerHTML = groups.map((group) => {
    const nodeButtons = group.all.map((node) => {
      const active = group.now === node ? "active" : "";
      return `<button class="node-btn ${active}" data-group="${encodeURIComponent(group.name)}" data-node="${encodeURIComponent(node)}">${node}</button>`;
    }).join("");
    return `
      <article class="group-card">
        <div class="group-head">
          <strong>${group.name}</strong>
          <span>当前：${group.now || "-"}</span>
        </div>
        <div class="nodes">${nodeButtons}</div>
      </article>
    `;
  }).join("");
}

async function loadGroups() {
  const data = await request("/api/mihomo/groups");
  renderGroups(data.groups || []);
}

els.saveConfigBtn.addEventListener("click", async () => {
  try {
    await saveConfig();
  } catch (error) {
    els.configTip.textContent = `保存失败：${error.message}`;
  }
});

els.genConfigBtn.addEventListener("click", async () => {
  try {
    await generateMinimalConfig();
  } catch (error) {
    els.configTip.textContent = `生成失败：${error.message}`;
  }
});

els.startBtn.addEventListener("click", async () => {
  try {
    await startMihomo();
  } catch (error) {
    alert(`启动失败：${error.message}`);
  }
});

els.stopBtn.addEventListener("click", async () => {
  try {
    await stopMihomo();
  } catch (error) {
    alert(`停止失败：${error.message}`);
  }
});

els.refreshBtn.addEventListener("click", refreshStatus);
els.diagBtn.addEventListener("click", async () => {
  try {
    await runDiagnosis();
  } catch (error) {
    els.diagBox.textContent = `诊断失败：${error.message}`;
  }
});
els.loadGroupsBtn.addEventListener("click", async () => {
  try {
    await loadGroups();
  } catch (error) {
    els.groupsWrap.textContent = `加载失败：${error.message}`;
  }
});

els.groupsWrap.addEventListener("click", async (event) => {
  const btn = event.target.closest(".node-btn");
  if (!btn) return;
  const group = decodeURIComponent(btn.dataset.group);
  const node = decodeURIComponent(btn.dataset.node);
  try {
    await request("/api/mihomo/select", {
      method: "POST",
      body: JSON.stringify({ group, name: node }),
    });
    await loadGroups();
  } catch (error) {
    alert(`切换失败：${error.message}`);
  }
});

async function init() {
  await loadHealth();
  await loadConfig();
  await refreshStatus();
  await runDiagnosis();
}

init().catch((error) => {
  els.configTip.textContent = `初始化失败：${error.message}`;
});
