$ErrorActionPreference = "Stop"

$nodeExe = "C:\Program Files\nodejs\node.exe"
$serverScript = Join-Path $PSScriptRoot "server.mjs"

if (-not (Test-Path -LiteralPath $nodeExe)) {
  throw "未找到 Node.js：$nodeExe"
}

if (-not (Test-Path -LiteralPath $serverScript)) {
  throw "未找到脚本：$serverScript"
}

& $nodeExe $serverScript
