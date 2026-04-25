import http from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.join(__dirname, "web");
const dataDir = path.join(__dirname, "data");
const configPath = path.join(dataDir, "ui-config.json");
const nodeLibraryPath = path.join(dataDir, "node-library.json");
const backupDir = path.join(dataDir, "backups");
const minimalConfigPath = path.join(dataDir, "mihomo-minimal.yaml");
const uiPort = 8877;

const MANAGED_BEGIN = "# >>> MIHOMO_UI_MANAGED_NODES_BEGIN";
const MANAGED_END = "# <<< MIHOMO_UI_MANAGED_NODES_END";

const defaultState = {
  mihomoExe: "C:\\Program Files\\mihomo-windows-amd64-v1.19.24\\mihomo-windows-amd64.exe",
  mihomoConfig: "C:\\Program Files\\mihomo-windows-amd64-v1.19.24\\config.yaml",
  controllerHost: "127.0.0.1",
  controllerPort: 9090,
  controllerSecret: "",
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

let state = { ...defaultState };
let nodes = [];
let mihomoProcess = null;
let mihomoStdoutTail = [];
let mihomoStderrTail = [];

function pushTail(tail, text) {
  tail.push(text);
  if (tail.length > 120) tail.shift();
}

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });
}

async function loadState() {
  await ensureDataDir();
  if (!existsSync(configPath)) {
    await saveState(defaultState);
    state = { ...defaultState };
    return;
  }
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    state = {
      ...defaultState,
      ...parsed,
      controllerPort: Number(parsed.controllerPort || defaultState.controllerPort),
    };
  } catch {
    state = { ...defaultState };
  }
}

async function saveState(next) {
  await ensureDataDir();
  await writeFile(configPath, JSON.stringify(next, null, 2), "utf8");
}

async function loadNodes() {
  await ensureDataDir();
  if (!existsSync(nodeLibraryPath)) {
    await saveNodes([]);
    nodes = [];
    return;
  }
  try {
    const raw = await readFile(nodeLibraryPath, "utf8");
    const parsed = JSON.parse(raw);
    nodes = Array.isArray(parsed) ? parsed : [];
  } catch {
    nodes = [];
  }
}

async function saveNodes(next) {
  nodes = next;
  await ensureDataDir();
  await writeFile(nodeLibraryPath, JSON.stringify(nodes, null, 2), "utf8");
}

function sendJson(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function getControllerBaseUrl() {
  return `http://${state.controllerHost}:${state.controllerPort}`;
}

function getControllerHeaders() {
  if (!state.controllerSecret) return {};
  return { Authorization: `Bearer ${state.controllerSecret}` };
}

function getProcessStatus() {
  return {
    running: Boolean(mihomoProcess && !mihomoProcess.killed),
    pid: mihomoProcess?.pid || null,
    stdoutTail: mihomoStdoutTail.slice(-30),
    stderrTail: mihomoStderrTail.slice(-30),
  };
}

function classifyControllerErrorText(text = "") {
  const t = String(text).toLowerCase();
  if (t.includes("401") || t.includes("403") || t.includes("unauthorized") || t.includes("forbidden")) {
    return "auth_failed";
  }
  if (t.includes("econnrefused") || t.includes("failed to fetch") || t.includes("fetch failed") || t.includes("refused")) {
    return "controller_unreachable";
  }
  return "unknown";
}

async function diagnoseController() {
  const report = {
    controllerBase: getControllerBaseUrl(),
    checks: [],
    summary: "unknown",
  };

  report.checks.push({
    key: "mihomo_exe",
    ok: existsSync(state.mihomoExe),
    detail: state.mihomoExe,
    tip: "确认路径存在且可执行。",
  });

  report.checks.push({
    key: "mihomo_config",
    ok: existsSync(state.mihomoConfig),
    detail: state.mihomoConfig,
    tip: "确认配置文件路径正确。",
  });

  report.checks.push({
    key: "process_running",
    ok: Boolean(mihomoProcess && !mihomoProcess.killed),
    detail: mihomoProcess ? `pid=${mihomoProcess.pid}` : "未运行",
    tip: "如果未运行，请先点击“启动 mihomo”。",
  });

  try {
    const res = await fetch(`${getControllerBaseUrl()}/version`, {
      headers: getControllerHeaders(),
    });
    const txt = await res.text();
    let data = {};
    try {
      data = txt ? JSON.parse(txt) : {};
    } catch {}

    const ok = res.ok;
    report.checks.push({
      key: "controller_version",
      ok,
      detail: ok ? JSON.stringify(data) : `status=${res.status}`,
      tip: ok ? "Controller 可用。" : "检查 external-controller、secret、端口是否一致。",
    });

    report.summary = ok ? "ok" : "warning";
    return report;
  } catch (error) {
    const cls = classifyControllerErrorText(error.message);
    const tip = cls === "controller_unreachable"
      ? "无法连接 controller。请检查 mihomo 是否运行、端口是否一致。"
      : cls === "auth_failed"
        ? "secret 不匹配。请核对 UI 设置与 config.yaml。"
        : "请检查配置后重试。";
    report.checks.push({
      key: "controller_version",
      ok: false,
      detail: error.message,
      tip,
    });
    report.summary = "error";
    return report;
  }
}

function generateMinimalConfigYaml(controllerPort, secret) {
  return [
    "mixed-port: 7890",
    "allow-lan: false",
    "mode: Rule",
    "log-level: info",
    "ipv6: false",
    "",
    `external-controller: 127.0.0.1:${controllerPort}`,
    `secret: "${secret}"`,
    "",
    "proxies:",
    '  - name: "DIRECT"',
    "    type: direct",
    "",
    "proxy-groups:",
    '  - name: "PROXY"',
    "    type: select",
    "    proxies:",
    '      - "DIRECT"',
    "",
    "rules:",
    "  - MATCH,PROXY",
    "",
  ].join("\n");
}

async function startMihomo() {
  if (mihomoProcess && !mihomoProcess.killed) {
    throw new Error("mihomo 已在运行中。");
  }
  if (!existsSync(state.mihomoExe)) {
    throw new Error(`未找到 mihomo 可执行文件：${state.mihomoExe}`);
  }
  if (!existsSync(state.mihomoConfig)) {
    throw new Error(`未找到 mihomo 配置文件：${state.mihomoConfig}`);
  }

  mihomoStdoutTail = [];
  mihomoStderrTail = [];

  mihomoProcess = spawn(state.mihomoExe, ["-f", state.mihomoConfig], {
    cwd: path.dirname(state.mihomoConfig),
    windowsHide: true,
  });

  mihomoProcess.stdout?.setEncoding("utf8");
  mihomoProcess.stderr?.setEncoding("utf8");
  mihomoProcess.stdout?.on("data", (d) => pushTail(mihomoStdoutTail, String(d).trim()));
  mihomoProcess.stderr?.on("data", (d) => pushTail(mihomoStderrTail, String(d).trim()));
  mihomoProcess.on("exit", (code) => {
    pushTail(mihomoStdoutTail, `process exited with code ${code}`);
    mihomoProcess = null;
  });
}

async function stopMihomo() {
  if (!mihomoProcess || mihomoProcess.killed) return false;
  mihomoProcess.kill("SIGTERM");
  return true;
}

async function requestController(pathname, init = {}) {
  const res = await fetch(`${getControllerBaseUrl()}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getControllerHeaders(),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error(data?.message || `Controller request failed (${res.status})`);
  }
  return data;
}

function normalizeNode(input = {}) {
  const now = new Date().toISOString();
  const type = String(input.type || "socks5").toLowerCase();
  const clean = {
    id: String(input.id || randomUUID()),
    name: String(input.name || "").trim(),
    type,
    server: String(input.server || "").trim(),
    port: Number(input.port || 0),
    username: String(input.username || "").trim(),
    password: String(input.password || "").trim(),
    uuid: String(input.uuid || "").trim(),
    sni: String(input.sni || "").trim(),
    insecure: Boolean(input.insecure),
    network: String(input.network || "").trim(),
    wsPath: String(input.wsPath || "").trim(),
    wsHost: String(input.wsHost || "").trim(),
    obfs: String(input.obfs || "").trim(),
    obfsPassword: String(input.obfsPassword || "").trim(),
    mport: String(input.mport || "").trim(),
    createdAt: String(input.createdAt || now),
    updatedAt: now,
  };
  return clean;
}

function validateNode(node) {
  if (!node.name) throw new Error("节点名称不能为空");
  if (!node.server) throw new Error("服务器地址不能为空");
  if (!Number.isFinite(node.port) || node.port < 1 || node.port > 65535) {
    throw new Error("端口必须是 1~65535 的数字");
  }
  const type = node.type;
  if (!["socks5", "http", "hy2", "vless", "vmess"].includes(type)) {
    throw new Error("暂不支持该节点类型");
  }
  if (["vless", "vmess"].includes(type) && !node.uuid) {
    throw new Error(`${type} 节点必须填写 uuid`);
  }
  if (["socks5", "http", "hy2"].includes(type) && !node.password && !node.username) {
    // allow empty auth for open endpoints but warn in UI later
  }
}

function yamlQuote(v) {
  return `"${String(v ?? "").replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function buildYamlLinesForNode(node, indent = "  ") {
  const lines = [
    `${indent}- name: ${yamlQuote(node.name)}`,
    `${indent}  type: ${node.type}`,
    `${indent}  server: ${node.server}`,
    `${indent}  port: ${node.port}`,
  ];
  if (node.type === "socks5" || node.type === "http") {
    if (node.username) lines.push(`${indent}  username: ${yamlQuote(node.username)}`);
    if (node.password) lines.push(`${indent}  password: ${yamlQuote(node.password)}`);
    if (node.type === "socks5") lines.push(`${indent}  udp: false`);
  }
  if (node.type === "hy2") {
    if (node.password) lines.push(`${indent}  password: ${yamlQuote(node.password)}`);
    if (node.sni) lines.push(`${indent}  sni: ${node.sni}`);
    if (node.obfs) lines.push(`${indent}  obfs: ${node.obfs}`);
    if (node.obfsPassword) lines.push(`${indent}  obfs-password: ${yamlQuote(node.obfsPassword)}`);
    if (node.mport) {
      lines.push(`${indent}  ports: ${yamlQuote(node.mport)}`);
      lines.push(`${indent}  hop-interval: 30`);
    }
    if (node.insecure) lines.push(`${indent}  skip-cert-verify: true`);
  }
  if (node.type === "vless") {
    lines.push(`${indent}  uuid: ${yamlQuote(node.uuid)}`);
    lines.push(`${indent}  udp: true`);
    lines.push(`${indent}  tls: true`);
    if (node.sni) lines.push(`${indent}  servername: ${node.sni}`);
    if (node.insecure) lines.push(`${indent}  skip-cert-verify: true`);
    if (node.network) lines.push(`${indent}  network: ${node.network}`);
    if (node.network === "ws" || node.wsPath || node.wsHost) {
      lines.push(`${indent}  ws-opts:`);
      lines.push(`${indent}    path: ${yamlQuote(node.wsPath || "/")}`);
      if (node.wsHost) {
        lines.push(`${indent}    headers:`);
        lines.push(`${indent}      Host: ${node.wsHost}`);
      }
    }
  }
  if (node.type === "vmess") {
    lines.push(`${indent}  uuid: ${yamlQuote(node.uuid)}`);
    lines.push(`${indent}  alterId: 0`);
    lines.push(`${indent}  cipher: auto`);
    lines.push(`${indent}  udp: true`);
    if (node.network) lines.push(`${indent}  network: ${node.network}`);
    if (node.sni) {
      lines.push(`${indent}  tls: true`);
      lines.push(`${indent}  servername: ${node.sni}`);
      if (node.insecure) lines.push(`${indent}  skip-cert-verify: true`);
    }
    if (node.network === "ws" || node.wsPath || node.wsHost) {
      lines.push(`${indent}  ws-opts:`);
      lines.push(`${indent}    path: ${yamlQuote(node.wsPath || "/")}`);
      if (node.wsHost) {
        lines.push(`${indent}    headers:`);
        lines.push(`${indent}      Host: ${node.wsHost}`);
      }
    }
  }
  return lines;
}

function buildManagedNodeBlock(nodeList) {
  const lines = [MANAGED_BEGIN];
  for (const node of nodeList) {
    lines.push(...buildYamlLinesForNode(node));
  }
  lines.push(MANAGED_END);
  return lines;
}

function findTopLevelKeyLine(line) {
  if (!line) return false;
  if (line.startsWith(" ") || line.startsWith("\t")) return false;
  return /^[A-Za-z0-9_-]+:\s*/.test(line);
}

function removeManagedBlock(lines) {
  const begin = lines.findIndex((l) => l.includes(MANAGED_BEGIN));
  const end = lines.findIndex((l) => l.includes(MANAGED_END));
  if (begin !== -1 && end !== -1 && end >= begin) {
    lines.splice(begin, end - begin + 1);
  }
  return lines;
}

function injectManagedNodesIntoConfig(rawConfig, nodeList) {
  const lines = rawConfig.replace(/\r\n/g, "\n").split("\n");
  const clean = removeManagedBlock([...lines]);
  const proxiesIdx = clean.findIndex((l) => l.trim() === "proxies:");
  const block = buildManagedNodeBlock(nodeList);

  if (proxiesIdx === -1) {
    const next = [...clean];
    if (next.length && next[next.length - 1].trim() !== "") next.push("");
    next.push("proxies:");
    next.push(...block);
    return `${next.join("\n")}\n`;
  }

  let sectionEnd = clean.length;
  for (let i = proxiesIdx + 1; i < clean.length; i += 1) {
    if (findTopLevelKeyLine(clean[i])) {
      sectionEnd = i;
      break;
    }
  }

  const before = clean.slice(0, sectionEnd);
  while (before.length > proxiesIdx + 1 && before[before.length - 1].trim() === "") before.pop();
  before.push(...block);
  const after = clean.slice(sectionEnd);
  return `${[...before, ...after].join("\n")}\n`;
}

async function createBackup(configFile) {
  await ensureDataDir();
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupName = `config-backup-${stamp}.yaml`;
  const backupPath = path.join(backupDir, backupName);
  await copyFile(configFile, backupPath);
  return backupPath;
}

async function listBackups() {
  await ensureDataDir();
  const items = await readdir(backupDir);
  const rows = [];
  for (const name of items) {
    if (!name.toLowerCase().endsWith(".yaml")) continue;
    const fullPath = path.join(backupDir, name);
    const info = await stat(fullPath);
    rows.push({
      name,
      fullPath,
      size: info.size,
      mtime: info.mtime.toISOString(),
    });
  }
  rows.sort((a, b) => String(b.mtime).localeCompare(String(a.mtime)));
  return rows;
}

async function applyManagedNodesToConfig() {
  if (!existsSync(state.mihomoConfig)) {
    throw new Error(`配置文件不存在：${state.mihomoConfig}`);
  }
  const backupPath = await createBackup(state.mihomoConfig);
  const raw = await readFile(state.mihomoConfig, "utf8");
  const next = injectManagedNodesIntoConfig(raw, nodes);
  await writeFile(state.mihomoConfig, next, "utf8");
  return {
    ok: true,
    backupPath,
    targetConfig: state.mihomoConfig,
    nodeCount: nodes.length,
  };
}

async function rollbackConfig(backupName) {
  const backupPath = path.join(backupDir, backupName);
  if (!existsSync(backupPath)) {
    throw new Error("指定备份不存在");
  }
  if (!existsSync(state.mihomoConfig)) {
    throw new Error("当前配置路径不存在，无法回滚");
  }
  await createBackup(state.mihomoConfig);
  await copyFile(backupPath, state.mihomoConfig);
  return {
    ok: true,
    targetConfig: state.mihomoConfig,
    restoredFrom: backupPath,
  };
}

function toPublicNode(node) {
  return {
    ...node,
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "mihomo-ui", version: "0.2.0" });
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    return sendJson(res, 200, { ok: true, config: state });
  }

  if (req.method === "POST" && url.pathname === "/api/config") {
    const body = await readJsonBody(req);
    const next = {
      ...state,
      ...body,
      controllerPort: Number(body.controllerPort || state.controllerPort),
    };
    state = next;
    await saveState(state);
    return sendJson(res, 200, { ok: true, config: state });
  }

  if (req.method === "POST" && url.pathname === "/api/config/generate-minimal") {
    const body = await readJsonBody(req);
    const port = Number(body.controllerPort || state.controllerPort || 9090);
    const secret = String(body.controllerSecret || state.controllerSecret || "");
    const yaml = generateMinimalConfigYaml(port, secret);
    await writeFile(minimalConfigPath, yaml, "utf8");
    state = { ...state, mihomoConfig: minimalConfigPath, controllerPort: port, controllerSecret: secret };
    await saveState(state);
    return sendJson(res, 200, { ok: true, path: minimalConfigPath, config: state });
  }

  if (req.method === "POST" && url.pathname === "/api/config/apply-nodes") {
    try {
      const result = await applyManagedNodesToConfig();
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/config/backups") {
    const backups = await listBackups();
    return sendJson(res, 200, { ok: true, backups });
  }

  if (req.method === "POST" && url.pathname === "/api/config/rollback") {
    try {
      const body = await readJsonBody(req);
      if (!body.backupName) return sendJson(res, 400, { ok: false, error: "backupName 不能为空" });
      const result = await rollbackConfig(String(body.backupName));
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/nodes") {
    return sendJson(res, 200, { ok: true, nodes: nodes.map(toPublicNode) });
  }

  if (req.method === "POST" && url.pathname === "/api/nodes") {
    try {
      const body = await readJsonBody(req);
      const node = normalizeNode(body);
      validateNode(node);
      if (nodes.some((n) => n.name === node.name)) {
        return sendJson(res, 400, { ok: false, error: "节点名称重复，请换一个名称" });
      }
      await saveNodes([node, ...nodes]);
      return sendJson(res, 201, { ok: true, node: toPublicNode(node) });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/nodes/")) {
    try {
      const id = decodeURIComponent(url.pathname.split("/").pop() || "");
      const target = nodes.find((n) => n.id === id);
      if (!target) return sendJson(res, 404, { ok: false, error: "节点不存在" });
      const body = await readJsonBody(req);
      const merged = normalizeNode({
        ...target,
        ...body,
        id,
        createdAt: target.createdAt,
      });
      validateNode(merged);
      if (nodes.some((n) => n.id !== id && n.name === merged.name)) {
        return sendJson(res, 400, { ok: false, error: "节点名称重复，请换一个名称" });
      }
      const next = nodes.map((n) => (n.id === id ? merged : n));
      await saveNodes(next);
      return sendJson(res, 200, { ok: true, node: toPublicNode(merged) });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/nodes/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (!nodes.some((n) => n.id === id)) return sendJson(res, 404, { ok: false, error: "节点不存在" });
    const next = nodes.filter((n) => n.id !== id);
    await saveNodes(next);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/mihomo/status") {
    return sendJson(res, 200, { ok: true, ...getProcessStatus() });
  }

  if (req.method === "POST" && url.pathname === "/api/mihomo/start") {
    try {
      await startMihomo();
      return sendJson(res, 200, { ok: true, ...getProcessStatus() });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/mihomo/stop") {
    const stopped = await stopMihomo();
    return sendJson(res, 200, { ok: true, stopped });
  }

  if (req.method === "GET" && url.pathname === "/api/mihomo/version") {
    try {
      const data = await requestController("/version");
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/mihomo/diagnose") {
    try {
      const report = await diagnoseController();
      return sendJson(res, 200, { ok: true, report });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/mihomo/groups") {
    try {
      const data = await requestController("/proxies");
      const groups = Object.entries(data.proxies || {})
        .filter(([, value]) => Array.isArray(value?.all) && value.all.length > 0)
        .map(([name, value]) => ({
          name,
          type: value.type || "",
          now: value.now || "",
          all: value.all || [],
          history: value.history || [],
        }));
      return sendJson(res, 200, { ok: true, groups });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/mihomo/select") {
    try {
      const body = await readJsonBody(req);
      if (!body.group || !body.name) {
        return sendJson(res, 400, { ok: false, error: "group 和 name 不能为空" });
      }
      await requestController(`/proxies/${encodeURIComponent(body.group)}`, {
        method: "PUT",
        body: JSON.stringify({ name: body.name }),
      });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  return false;
}

async function serveStatic(req, res, url) {
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";
  const absPath = path.normalize(path.join(webRoot, pathname));
  if (!absPath.startsWith(webRoot)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const content = await readFile(absPath);
    const ext = path.extname(absPath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
}

await loadState();
await loadNodes();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (handled !== false) return;
      return sendJson(res, 404, { ok: false, error: "API Not Found" });
    }
    return serveStatic(req, res, url);
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(uiPort, () => {
  console.log(`Mihomo UI is running at http://127.0.0.1:${uiPort}/`);
});
