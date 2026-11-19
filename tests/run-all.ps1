# Runs every node test in 1to1\tests (and 1to1\test\*.test.js), then prints a pass/fail summary.
# Run from PowerShell:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Jordan\Desktop\Basketball Run\1to1\tests\run-all.ps1"

$ErrorActionPreference = 'Continue'
$testsDir = $PSScriptRoot
$appRoot  = Split-Path -Parent $testsDir
$otherDir = Join-Path $appRoot 'test'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'FAIL: node is not on PATH. Install Node.js LTS, then open a new PowerShell window.' -ForegroundColor Red
    exit 1
}

$files = @()
$files += Get-ChildItem -Path $testsDir -Filter '*.test.js' -File
if (Test-Path $otherDir) {
    $files += Get-ChildItem -Path $otherDir -Filter '*.test.js' -File
}
$files = @($files | Sort-Object FullName)

if ($files.Count -eq 0) {
    Write-Host 'No *.test.js files found.' -ForegroundColor Yellow
    exit 1
}

$results = @()
foreach ($f in $files) {
    $out  = & node $f.FullName 2>&1 | Out-String
    $code = $LASTEXITCODE
    $results += [pscustomobject]@{
        Name   = $f.Name
        Folder = $f.Directory.Name
        Pass   = ($code -eq 0)
        Output = $out
    }
}

Write-Host ''
foreach ($r in $results) {
    if ($r.Pass) {
        Write-Host ("PASS  {0}\{1}" -f $r.Folder, $r.Name) -ForegroundColor Green
    } else {
        Write-Host ("FAIL  {0}\{1}" -f $r.Folder, $r.Name) -ForegroundColor Red
    }
}

$failed = @($results | Where-Object { -not $_.Pass })
foreach ($r in $failed) {
    Write-Host ''
    Write-Host ("--- Output from {0}\{1} ---" -f $r.Folder, $r.Name) -ForegroundColor Red
    Write-Host $r.Output.TrimEnd()
}

$passed = $results.Count - $failed.Count
Write-Host ''
Write-Host ("Summary: {0} passed, {1} failed, {2} total" -f $passed, $failed.Count, $results.Count) -ForegroundColor Cyan

if ($failed.Count -gt 0) { exit 1 }
exit 0
