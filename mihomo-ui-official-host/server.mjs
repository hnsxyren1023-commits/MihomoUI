import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const officialDistDir = path.join(rootDir, "mihomo-ui-official-dist");
const dataDir = path.join(__dirname, "data");
const configFile = path.join(dataDir, "official-ui-config.json");
const port = 8878;

const defaultConfig = {
  defaultBackendURL: "http://127.0.0.1:9090",
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function ensureRuntimeConfig() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(configFile)) {
    await writeFile(configFile, JSON.stringify(defaultConfig, null, 2), "utf8");
    return defaultConfig;
  }
  try {
    const raw = await readFile(configFile, "utf8");
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return { ...defaultConfig };
  }
}

function sendJson(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${port}`}`);

  if (url.pathname === "/api/config" && req.method === "GET") {
    const cfg = await ensureRuntimeConfig();
    return sendJson(res, 200, { ok: true, config: cfg });
  }

  if (url.pathname === "/api/config" && req.method === "POST") {
    const body = await readBody(req);
    const cfg = {
      defaultBackendURL: String(body.defaultBackendURL || defaultConfig.defaultBackendURL),
    };
    await mkdir(dataDir, { recursive: true });
    await writeFile(configFile, JSON.stringify(cfg, null, 2), "utf8");
    return sendJson(res, 200, { ok: true, config: cfg });
  }

  let pathname = url.pathname;
  if (pathname === "/" || pathname === "") pathname = "/index.html";

  if (pathname === "/config.js") {
    const cfg = await ensureRuntimeConfig();
    const js = `window.__METACUBEXD_CONFIG__ = { defaultBackendURL: ${JSON.stringify(cfg.defaultBackendURL)} };\n`;
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
    res.end(js);
    return;
  }

  const filePath = path.normalize(path.join(officialDistDir, pathname));
  if (!filePath.startsWith(officialDistDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mime[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600",
    });
    res.end(content);
  } catch {
    // SPA fallback
    try {
      const content = await readFile(path.join(officialDistDir, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
    }
  }
});

server.listen(port, () => {
  console.log(`Official MetaCubeXD host is running at http://127.0.0.1:${port}/`);
});
