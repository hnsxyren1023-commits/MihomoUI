$ErrorActionPreference = "Stop"

param(
  [string]$TargetDir = "D:\Xcode\20260423_Qproxyhub\mihomo-ui-official"
)

$zip = Join-Path $env:TEMP "metacubexd-main.zip"
$extractRoot = Join-Path $env:TEMP "metacubexd-main"

Write-Host "下载官方源码（MetaCubeXD）..."
Invoke-WebRequest -Uri "https://codeload.github.com/MetaCubeX/metacubexd/zip/refs/heads/main" -OutFile $zip

if (Test-Path -LiteralPath $extractRoot) {
  Remove-Item -LiteralPath $extractRoot -Recurse -Force
}

Write-Host "解压源码..."
Expand-Archive -LiteralPath $zip -DestinationPath $env:TEMP -Force

if (Test-Path -LiteralPath $TargetDir) {
  Remove-Item -LiteralPath $TargetDir -Recurse -Force
}

Move-Item -LiteralPath $extractRoot -Destination $TargetDir

Write-Host "完成。源码目录：" $TargetDir
