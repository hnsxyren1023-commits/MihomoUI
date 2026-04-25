# 官方 UI 调研与融合方案（MetaCubeXD + 我们的 Mihomo UI）

## 1. 官方项目与本地部署结论

官方指定 UI 选型：`MetaCubeX/metacubexd`

- 官方源码（用于研究代码、参数、部署方式）：
  - 本地可通过脚本下载：`tools/download-official-metacubexd.ps1`
  - 建议下载目录：`D:\Xcode\20260423_Qproxyhub\mihomo-ui-official`
- 官方预构建静态资源（用于稳定本地部署）：
  - 本地路径：`D:\Xcode\20260423_Qproxyhub\mihomo-ui-official-dist`
- 本地宿主服务（我们新增）：
  - 本地路径：`D:\Xcode\20260423_Qproxyhub\mihomo-ui-official-host`
  - 访问地址：`http://127.0.0.1:8878/`

这样做的好处是：

- 源码层可学习（满足“熟悉详细代码和参数”）
- 运行层可稳定（避免本机 pnpm 环境差异导致无法启动）

---

## 2. 官方代码与参数重点

基于 `package.json`、`nuxt.config.ts` 和官方 README，关键点如下：

- 技术栈：Nuxt 4（CSR）、Vue 3、Pinia、Tailwind
- 路由模式：Hash 模式（`hashMode: true`）
- 运行时后端参数：
  - `window.__METACUBEXD_CONFIG__.defaultBackendURL`
  - `NUXT_PUBLIC_DEFAULT_BACKEND_URL`（构建/运行时环境变量）
- 前提要求：mihomo 需开启 `external-controller`

官方推荐部署路径：

1. 直接使用 gh-pages 预构建静态资源
2. Docker 部署
3. 源码构建（pnpm）

---

## 3. 来自官方仓库与社区反馈的常见痛点

参考官方仓库 issue（2026 年近期）高频问题：

- 默认后端地址配置不直观或不生效（如 `DEFAULT_BACKEND_URL` 相关）
- “后端不可达”时交互体验差，用户不清楚该如何自检
- 特定浏览器兼容性问题（如 VIA、Safari）
- 配置编辑能力诉求强（希望直接在线修改配置）
- 更新入口与版本提示可理解性不足
- 部分交互细节（窗口行为、状态展示）易引起误判

---

## 4. 官方 UI 优点（建议保留）

- 代理组管理、日志、连接、规则等核心面板完整
- 视觉成熟，响应式适配较好
- 对 controller API 的覆盖广、功能深
- 社区活跃，迭代速度快

---

## 5. 与我们 UI 的融合策略（避免其缺点）

我们保持“双 UI 并行”，并在自研 UI 中强化以下点：

1. 启动引导更明确  
给出可执行路径检查、端口检查、controller 检查，减少“后端不可达”焦虑。

2. 错误可解释  
把“不可达”细分为：端口未开 / secret 不匹配 / CORS / 配置错误，并给修复建议。

3. 轻量运维入口  
保留“一键生成最小配置 + 启停 mihomo + 日志尾部”能力，降低使用门槛。

4. 双端协同  
官方 UI 负责“深度操作”，自研 UI 负责“引导和诊断”，两者通过同一个 controller 协同工作。

---

## 6. 当前可用结果（双 UI）

- 自研 UI（MVP）：`http://127.0.0.1:8877/`
- 官方 UI（MetaCubeXD）：`http://127.0.0.1:8878/`

可通过根目录脚本一键启动：

`D:\Xcode\20260423_Qproxyhub\启动-双UI对比.bat`
