# 官方 UI 本地部署（MetaCubeXD）

本目录用于在本地运行“官方指定 UI（MetaCubeXD）”。

## 已完成内容

- 已下载官方源码：`../mihomo-ui-official`
- 已下载官方预构建静态资源：`../mihomo-ui-official-dist`
- 已提供本地宿主服务：`server.mjs`（默认端口 `8878`）
- 已支持运行时注入 `defaultBackendURL`（通过 `config.js`）

## 启动

### 方式 1：双击

```text
启动-官方UI.bat
```

### 方式 2：PowerShell

```powershell
cd D:\Xcode\20260423_Qproxyhub\mihomo-ui-official-host
powershell -ExecutionPolicy Bypass -File .\start-official-ui.ps1
```

启动后访问：

```text
http://127.0.0.1:8878/
```

## 设置默认后端地址

默认是：

```text
http://127.0.0.1:9090
```

如需修改：

```powershell
powershell -ExecutionPolicy Bypass -File .\set-official-backend.ps1 -BackendUrl "http://127.0.0.1:9090"
```

## 配置文件

运行时配置保存在：

```text
mihomo-ui-official-host\data\official-ui-config.json
```

## 说明

- 本服务只负责托管官方预构建静态资源和注入 `config.js`。
- 真正的数据来自 mihomo external-controller（默认 `9090`）。
