# Local deploy checklist for FAQ extraction release (v1.5.15)
# Run from Schema Tools root: powershell -ExecutionPolicy Bypass -File scripts\_run-deploy-checklist.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

Write-Host '=== 1) FAQ extraction tests ===' -ForegroundColor Cyan
npm run test:faq-extraction
if ($LASTEXITCODE -ne 0) { throw "FAQ tests failed: $LASTEXITCODE" }

Write-Host '=== 2) HowTo extraction tests ===' -ForegroundColor Cyan
npm run test:howto-extraction
if ($LASTEXITCODE -ne 0) { throw "HowTo tests failed: $LASTEXITCODE" }

Write-Host '=== 3) Electron desktop build ===' -ForegroundColor Cyan
npm run build:desktop
if ($LASTEXITCODE -ne 0) { throw "Desktop build failed: $LASTEXITCODE" }

$buildInfo = Join-Path $env:LOCALAPPDATA 'SchemaTools\SchemaTools-win32-x64\resources\app\build-info.json'
$exe = Join-Path $env:LOCALAPPDATA 'SchemaTools\SchemaTools-win32-x64\SchemaTools.exe'
Write-Host "Build info: $buildInfo"
Get-Content $buildInfo
Write-Host "Exe: $exe"
Test-Path $exe

Write-Host '=== 4) Live schema verify (cache-bust) ===' -ForegroundColor Cyan
$cb = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$url = "https://schema.alanranger.com/how-to-improve-your-photography-composition_faq.json?cb=$cb"
$faq = Invoke-RestMethod -Uri $url -Headers @{ 'Cache-Control' = 'no-cache' }
$names = @($faq.mainEntity | ForEach-Object { $_.name })
Write-Host "Live FAQ count: $($names.Count)"
$names | ForEach-Object { Write-Host " - $_" }
$stale = @(
  'What is this photography technique about?',
  'How do I apply these techniques?',
  'What camera settings should I use?',
  'Do I need special equipment?',
  'How can I improve my results?'
)
$bad = $stale | Where-Object { $names -contains $_ }
if ($names.Count -ne 8) { throw "Expected 8 live questions, got $($names.Count)" }
if ($bad.Count) { throw "Stale questions still live: $($bad -join '; ')" }
Write-Host 'Live FAQ OK (8 questions, no stale set).' -ForegroundColor Green

Write-Host '=== DONE ===' -ForegroundColor Green
Write-Host 'Next: commit/push Schema Tools source (FAQ fix + v1.5.15) so Vercel updates.'
Write-Host 'alanranger-schema Lesson 34 FAQ already has 8 Qs at commit 9e3bda9 / 375711f — confirm remote matches live above.'
