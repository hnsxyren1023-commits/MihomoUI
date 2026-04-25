$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$customScript = Join-Path $root "start-mihomo-ui.ps1"
$officialScript = Join-Path $root "mihomo-ui-official-host\start-official-ui.ps1"

if (-not (Test-Path -LiteralPath $customScript)) {
  throw "Cannot find custom UI script: $customScript"
}

if (-not (Test-Path -LiteralPath $officialScript)) {
  throw "Cannot find official host script: $officialScript"
}

Write-Host "[1/2] Starting custom MihomoUI on 8877..."
Start-Process powershell -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $customScript)
) | Out-Null

Write-Host "[2/2] Starting official MetaCubeXD host on 8878..."
Start-Process powershell -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"{0}"' -f $officialScript)
) | Out-Null

Start-Sleep -Seconds 2

Write-Host "Opening browser tabs..."
Start-Process "http://127.0.0.1:8877/" | Out-Null
Start-Process "http://127.0.0.1:8878/" | Out-Null

Write-Host ""
Write-Host "Expected pages:"
Write-Host " - Custom UI:  http://127.0.0.1:8877/"
Write-Host " - Official UI: http://127.0.0.1:8878/"
Write-Host ""
Write-Host "Tips:"
Write-Host " - If 8878 shows connection refused, run tools\\download-official-metacubexd.ps1 and restart."
