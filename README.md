# MihomoUI

MihomoUI 是独立于 `Qproxyhub` 的第二条产品线，聚焦 `mihomo + UI` 的本地运维体验。

## 产品定位

- 自研轻量控制台：配置、启停、诊断、代理组切换
- 官方 UI 本地宿主：MetaCubeXD 本地托管与并行对比
- 双 UI 并存：一个偏引导诊断，一个偏深度管理

## 访问地址

- 自研 UI（MVP）：`http://127.0.0.1:8877/`
- 官方 UI 宿主（MetaCubeXD）：`http://127.0.0.1:8878/`

## 快速启动

### 自研 UI

```powershell
powershell -ExecutionPolicy Bypass -File .\start-mihomo-ui.ps1
```

### 官方 UI 宿主

```powershell
powershell -ExecutionPolicy Bypass -File .\mihomo-ui-official-host\start-official-ui.ps1
```

### 双 UI 对比启动

```text
启动-双UI对比.bat
```

## 运行要求

- Windows 10 / 11
- Node.js 24+
- 可用的 mihomo 内核

## 目录结构

```text
MihomoUI/
├─ web/                              # 自研 UI 前端
├─ server.mjs                        # 自研 UI 服务
├─ start-mihomo-ui.ps1
├─ 启动-MihomoUI.bat
├─ 启动-双UI对比.bat
├─ mihomo-ui-official-host/          # 官方 UI 本地宿主
│  ├─ server.mjs
│  ├─ start-official-ui.ps1
│  └─ set-official-backend.ps1
├─ tools/
│  └─ download-official-metacubexd.ps1
├─ docs/
│  └─ 官方UI调研与融合方案.md
└─ data/
```

## 关联仓库

- 测试/导出产品线：[`Qproxyhub`](https://github.com/hnsxyren1023-commits/Qproxyhub)

