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
  nodeName: document.getElementById("nodeName"),
  nodeType: document.getElementById("nodeType"),
  nodeServer: document.getElementById("nodeServer"),
  nodePort: document.getElementById("nodePort"),
  nodeUsername: document.getElementById("nodeUsername"),
  nodePassword: document.getElementById("nodePassword"),
  nodeUuid: document.getElementById("nodeUuid"),
  nodeSni: document.getElementById("nodeSni"),
  nodeNetwork: document.getElementById("nodeNetwork"),
  nodeWsPath: document.getElementById("nodeWsPath"),
  nodeWsHost: document.getElementById("nodeWsHost"),
  nodeMport: document.getElementById("nodeMport"),
  nodeInsecure: document.getElementById("nodeInsecure"),
  nodeCreateBtn: document.getElementById("nodeCreateBtn"),
  nodeUpdateBtn: document.getElementById("nodeUpdateBtn"),
  nodeResetBtn: document.getElementById("nodeResetBtn"),
  loadNodesBtn: document.getElementById("loadNodesBtn"),
  applyNodesBtn: document.getElementById("applyNodesBtn"),
  nodeTip: document.getElementById("nodeTip"),
  nodeTableBody: document.getElementById("nodeTableBody"),
  loadBackupsBtn: document.getElementById("loadBackupsBtn"),
  backupSelect: document.getElementById("backupSelect"),
  rollbackBtn: document.getElementById("rollbackBtn"),
  backupTip: document.getElementById("backupTip"),
};

let editingNodeId = "";
let nodeCache = [];

function setBadge(el, text, cls) {
  el.textContent = text;
  el.className = `badge ${cls}`;
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function pickNodePayload() {
  return {
    name: els.nodeName.value.trim(),
    type: els.nodeType.value,
    server: els.nodeServer.value.trim(),
    port: Number(els.nodePort.value || 0),
    username: els.nodeUsername.value.trim(),
    password: els.nodePassword.value.trim(),
    uuid: els.nodeUuid.value.trim(),
    sni: els.nodeSni.value.trim(),
    network: els.nodeNetwork.value.trim(),
    wsPath: els.nodeWsPath.value.trim(),
    wsHost: els.nodeWsHost.value.trim(),
    mport: els.nodeMport.value.trim(),
    insecure: els.nodeInsecure.checked,
  };
}

function fillNodeForm(node = null) {
  if (!node) {
    editingNodeId = "";
    els.nodeName.value = "";
    els.nodeType.value = "socks5";
    els.nodeServer.value = "";
    els.nodePort.value = "";
    els.nodeUsername.value = "";
    els.nodePassword.value = "";
    els.nodeUuid.value = "";
    els.nodeSni.value = "";
    els.nodeNetwork.value = "";
    els.nodeWsPath.value = "";
    els.nodeWsHost.value = "";
    els.nodeMport.value = "";
    els.nodeInsecure.checked = false;
    els.nodeTip.textContent = "已清空表单，当前为新增模式。";
    return;
  }
  editingNodeId = node.id;
  els.nodeName.value = node.name || "";
  els.nodeType.value = node.type || "socks5";
  els.nodeServer.value = node.server || "";
  els.nodePort.value = node.port || "";
  els.nodeUsername.value = node.username || "";
  els.nodePassword.value = node.password || "";
  els.nodeUuid.value = node.uuid || "";
  els.nodeSni.value = node.sni || "";
  els.nodeNetwork.value = node.network || "";
  els.nodeWsPath.value = node.wsPath || "";
  els.nodeWsHost.value = node.wsHost || "";
  els.nodeMport.value = node.mport || "";
  els.nodeInsecure.checked = Boolean(node.insecure);
  els.nodeTip.textContent = `正在编辑：${node.name}`;
}

function renderNodes(nodes) {
  nodeCache = nodes;
  if (!nodes.length) {
    els.nodeTableBody.innerHTML = "<tr><td colspan=\"6\">暂无节点</td></tr>";
    return;
  }
  els.nodeTableBody.innerHTML = nodes.map((node) => `
    <tr>
      <td>${node.name}</td>
      <td>${node.type}</td>
      <td>${node.server}</td>
      <td>${node.port}</td>
      <td>${(node.updatedAt || "").replace("T", " ").replace("Z", "")}</td>
      <td>
        <button data-act="edit" data-id="${node.id}">编辑</button>
        <button data-act="del" data-id="${node.id}" class="danger-lite">删除</button>
      </td>
    </tr>
  `).join("");
}

function renderBackups(backups) {
  if (!backups.length) {
    els.backupSelect.innerHTML = "<option value=\"\">暂无备份</option>";
    return;
  }
  els.backupSelect.innerHTML = backups.map((b) => `
    <option value="${b.name}">${b.name} (${Math.round((b.size || 0) / 1024)}KB)</option>
  `).join("");
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
    const mark = item.ok ? "✓" : "✗";
    lines.push(`${mark} ${item.key}: ${item.detail}`);
    if (item.tip) lines.push(`  建议：${item.tip}`);
  }
  const summary = report.summary === "ok" ? "可用" : report.summary === "warning" ? "部分异常" : "不可用";
  lines.push(`结论：${summary}`);
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
    els.groupsWrap.textContent = "未找到可切换的代理组。请检查 config.yaml 的 proxy-groups。";
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

async function loadNodes() {
  const data = await request("/api/nodes");
  renderNodes(data.nodes || []);
}

async function createNode() {
  const payload = pickNodePayload();
  await request("/api/nodes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await loadNodes();
  fillNodeForm();
  els.nodeTip.textContent = "节点已新增。";
}

async function updateNode() {
  if (!editingNodeId) {
    throw new Error("请先从列表中选择一个节点再编辑保存");
  }
  const payload = pickNodePayload();
  await request(`/api/nodes/${encodeURIComponent(editingNodeId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  await loadNodes();
  els.nodeTip.textContent = "节点已更新。";
}

async function deleteNode(id) {
  await request(`/api/nodes/${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadNodes();
  if (editingNodeId === id) fillNodeForm();
  els.nodeTip.textContent = "节点已删除。";
}

async function applyNodesToConfig() {
  const data = await request("/api/config/apply-nodes", { method: "POST", body: "{}" });
  els.backupTip.textContent = `写回完成：${data.nodeCount} 条节点，备份文件：${data.backupPath}`;
  await loadBackups();
}

async function loadBackups() {
  const data = await request("/api/config/backups");
  renderBackups(data.backups || []);
}

async function rollbackConfig() {
  const backupName = els.backupSelect.value;
  if (!backupName) throw new Error("请先选择一个备份");
  await request("/api/config/rollback", {
    method: "POST",
    body: JSON.stringify({ backupName }),
  });
  els.backupTip.textContent = `已回滚到：${backupName}`;
  await loadBackups();
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

els.nodeCreateBtn.addEventListener("click", async () => {
  try {
    await createNode();
  } catch (error) {
    els.nodeTip.textContent = `新增失败：${error.message}`;
  }
});

els.nodeUpdateBtn.addEventListener("click", async () => {
  try {
    await updateNode();
  } catch (error) {
    els.nodeTip.textContent = `更新失败：${error.message}`;
  }
});

els.nodeResetBtn.addEventListener("click", () => fillNodeForm());
els.loadNodesBtn.addEventListener("click", () => loadNodes().catch((e) => { els.nodeTip.textContent = e.message; }));
els.applyNodesBtn.addEventListener("click", () => applyNodesToConfig().catch((e) => { els.backupTip.textContent = e.message; }));
els.loadBackupsBtn.addEventListener("click", () => loadBackups().catch((e) => { els.backupTip.textContent = e.message; }));
els.rollbackBtn.addEventListener("click", () => rollbackConfig().catch((e) => { els.backupTip.textContent = e.message; }));

els.nodeTableBody.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-act]");
  if (!target) return;
  const id = target.dataset.id;
  if (target.dataset.act === "edit") {
    const node = nodeCache.find((n) => n.id === id);
    fillNodeForm(node || null);
    return;
  }
  if (target.dataset.act === "del") {
    if (!confirm("确定删除该节点吗？")) return;
    try {
      await deleteNode(id);
    } catch (error) {
      els.nodeTip.textContent = `删除失败：${error.message}`;
    }
  }
});

async function init() {
  await loadHealth();
  await loadConfig();
  await refreshStatus();
  await runDiagnosis();
  await loadNodes();
  await loadBackups();
}

fillNodeForm();
init().catch((error) => {
  els.diagBox.textContent = `初始化失败：${error.message}`;
});

setInterval(() => {
  refreshStatus().catch(() => {});
}, 5000);
