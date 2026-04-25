# 官方 UI 本地宿主（MetaCubeXD）

本目录用于在本地运行官方指定 UI（MetaCubeXD）。

## 功能

- 本地托管官方 UI 静态资源
- 运行时注入 `defaultBackendURL`
- 提供本地启动脚本与后端地址配置脚本

## 启动

### 方式 1：双击

```text
启动-官方UI.bat
```

### 方式 2：PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\start-official-ui.ps1
```

启动后访问：

```text
http://127.0.0.1:8878/
```

## 设置默认后端

```powershell
powershell -ExecutionPolicy Bypass -File .\set-official-backend.ps1 -BackendUrl "http://127.0.0.1:9090"
```

配置文件位置：

```text
mihomo-ui-official-host\data\official-ui-config.json
```
