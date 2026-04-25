import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.join(__dirname, "web");
const dataDir = path.join(__dirname, "data");
const configPath = path.join(dataDir, "ui-config.json");
const minimalConfigPath = path.join(dataDir, "mihomo-minimal.yaml");
const uiPort = 8877;

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
let mihomoProcess = null;
let mihomoStdoutTail = [];
let mihomoStderrTail = [];

function pushTail(tail, text) {
  tail.push(text);
  if (tail.length > 120) tail.shift();
}

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
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
  if (
    t.includes("econnrefused")
    || t.includes("failed to fetch")
    || t.includes("fetch failed")
    || t.includes("cannot connect")
    || t.includes("连接")
    || t.includes("refused")
  ) {
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
      tip: ok
        ? "Controller 可用。"
        : "检查 external-controller、secret、bind 地址（建议 127.0.0.1:9090）。",
    });

    report.summary = ok ? "ok" : "warning";
    return report;
  } catch (error) {
    const cls = classifyControllerErrorText(error.message);
    const tip =
      cls === "controller_unreachable"
        ? "无法连接 controller。检查 mihomo 是否运行、端口是否一致、external-controller 是否已开启。"
        : cls === "auth_failed"
          ? "secret 可能不匹配。请核对 config.yaml 中 secret 与 UI 设置。"
          : "请检查配置并重试。";
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
    throw new Error("mihomo 已在运行中");
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
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.message || `Controller request failed (${res.status})`);
  }
  return data;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "mihomo-ui", version: "0.1.0" });
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
        return sendJson(res, 400, { ok: false, error: "group 与 name 不能为空" });
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, url);
    if (handled !== false) return;
    return sendJson(res, 404, { ok: false, error: "API Not Found" });
  }
  return serveStatic(req, res, url);
});

server.listen(uiPort, () => {
  console.log(`Mihomo UI is running at http://127.0.0.1:${uiPort}/`);
});
