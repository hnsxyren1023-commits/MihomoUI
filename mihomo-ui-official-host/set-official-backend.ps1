param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $PSScriptRoot "data\official-ui-config.json"
$dir = Split-Path $configPath -Parent

if (-not (Test-Path -LiteralPath $dir)) {
  New-Item -ItemType Directory -Path $dir | Out-Null
}

$obj = @{
  defaultBackendURL = $BackendUrl
}

$obj | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
Write-Host "已设置官方 UI 默认后端：" $BackendUrl
