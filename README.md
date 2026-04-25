# MihomoUI

本仓库是独立于 `Qproxyhub` 的第二条产品线，专注于 `mihomo + UI`：

- 自研本地控制台（轻量运维 + 启动引导 + 连接诊断）
- 官方 UI（MetaCubeXD）本地宿主部署与并行对比

---

## 功能结构

### 1) 自研 UI（MVP）

路径：项目根目录（`server.mjs + web/`）  
默认地址：`http://127.0.0.1:8877/`

能力：

- 保存 mihomo 运行配置
- 一键生成最小配置
- 启动/停止 mihomo
- 读取代理组并手动切换节点
- 连接自检（端口/进程/controller 诊断）

### 2) 官方 UI 本地宿主（MetaCubeXD）

路径：`mihomo-ui-official-host/`  
默认地址：`http://127.0.0.1:8878/`

能力：

- 托管官方预构建静态资源
- 运行时注入 `defaultBackendURL`
- 提供本地配置接口与脚本

---

## 快速启动

### 自研 UI

```powershell
powershell -ExecutionPolicy Bypass -File .\start-mihomo-ui.ps1
```

### 官方 UI 本地宿主

```powershell
powershell -ExecutionPolicy Bypass -File .\mihomo-ui-official-host\start-official-ui.ps1
```

### 双 UI 对比

```text
启动-双UI对比.bat
```

---

## 官方源码获取

仓库内提供下载脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\download-official-metacubexd.ps1
```

默认下载到：`D:\Xcode\20260423_Qproxyhub\mihomo-ui-official`

---

## 目录说明

```text
MihomoUI/
├─ web/                              # 自研 UI 前端
├─ server.mjs                        # 自研 UI 后端
├─ start-mihomo-ui.ps1
├─ 启动-MihomoUI.bat
├─ mihomo-ui-official-host/          # 官方 UI 本地宿主
├─ tools/
│  └─ download-official-metacubexd.ps1
├─ docs/
│  └─ 官方UI调研与融合方案.md
└─ 启动-双UI对比.bat
```

---

## 关联仓库

测试/导出产品线请见：`Qproxyhub`  
（两个仓库代码已完全拆分，独立维护）
