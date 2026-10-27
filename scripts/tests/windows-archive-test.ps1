param([string]$WorkflowPath = "$PSScriptRoot/../../.github/workflows/build-desktop-app.yml")

$ErrorActionPreference = 'Stop'
$source = Get-Content $WorkflowPath -Raw
function Step([string]$name) {
  $pattern = '(?m)^      - name: ' + [regex]::Escape($name) + '\r?\n        run: \|\r?\n((?:          [^\r\n]*\r?\n|\s*\r?\n)+)'
  $match = [regex]::Match($source, $pattern)
  if (-not $match.Success) { throw "Missing workflow step: $name" }
  [scriptblock]::Create(($match.Groups[1].Value -replace '(?m)^          ', ''))
}
function Assert($condition, [string]$message) {
  if (-not $condition) { throw $message }
}

$extract = Step 'Extract raw Windows bundle'
$archive = Step 'Create and verify raw Windows archive'
$global:operations = [System.Collections.Generic.List[string]]::new()
$global:smokes = 0
$global:fault = ''

# Inject native exit statuses into the real workflow scripts, before a smoke
# could accidentally succeed using an old or partially extracted directory.
function global:ArchiveCommand([string]$operation, $arguments) {
  $global:operations.Add($operation)
  $global:LASTEXITCODE = 0
  if ($operation -eq $global:fault) { $global:LASTEXITCODE = 31; return }
  switch ($operation) {
    'create' { Set-Content ($arguments | Where-Object { $_ -like '*.zip' } | Select-Object -First 1) 'fixture archive' }
    'list' { 'lively.next-win-x64/'; 'lively.next-win-x64/lively.next.exe' }
  }
}
function global:tar {
  $operation = if ($args -ccontains '-c') { 'create' }
    elseif ($args -contains '-tf') { 'list' }
    elseif ($args -contains '-xf') { 'extract' } else { 'version' }
  ArchiveCommand $operation $args
}
function global:7z {
  $operation = switch ($args[0]) { 'a' { 'create' } 'l' { 'list' } 'x' { 'extract' } default { 'version' } }
  ArchiveCommand $operation $args
}
function global:node { $global:smokes++; $global:LASTEXITCODE = 0 }

$root = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
$savedTemp = $env:RUNNER_TEMP
$failures = 0
try {
  New-Item -ItemType Directory -Force "$root/dist/lively.next-win-x64", "$root/temp" | Out-Null
  Set-Content "$root/dist/lively.next-win-x64/lively.next.exe" 'old executable'
  $env:RUNNER_TEMP = "$root/temp"
  Push-Location $root
  try {
    foreach ($case in @(
      @{ Name = 'staging extraction failure'; Script = $extract; Fault = 'extract'; Message = 'Windows staging archive extraction failed' },
      @{ Name = 'archive creation failure'; Script = $archive; Fault = 'create'; Message = 'Windows archive creation failed' },
      @{ Name = 'archive listing failure'; Script = $archive; Fault = 'list'; Message = 'Windows archive listing failed' },
      @{ Name = 'archive extraction failure'; Script = $archive; Fault = 'extract'; Message = 'Windows archive extraction failed' },
      @{ Name = 'successful archive reaches smoke'; Script = $archive; Fault = ''; Message = '' }
    )) {
      $global:operations.Clear(); $global:smokes = 0; $global:fault = $case.Fault
      try {
        $caught = $null
        try { $output = & $case.Script *>&1 | Out-String } catch { $caught = $_ }
        if ($case.Fault) {
          Assert ($null -ne $caught) "$($case.Name): native error must stop the workflow"
          Assert ($caught.Exception.Message -eq $case.Message) "$($case.Name): expected '$($case.Message)', got '$($caught.Exception.Message)'"
          Assert ($global:smokes -eq 0) "$($case.Name): smoke must not run after a native error"
          Assert ($global:operations[-1] -eq $case.Fault) "$($case.Name): no archive command may run after the failed command"
        } else {
          Assert ($null -eq $caught) "successful archive must not throw: $caught"
          Assert ($global:smokes -eq 1) 'successful archive must invoke exactly one smoke'
          Assert ($output -match 'Windows archive: \d+ bytes; 2 entries') 'successful archive must report its byte size and entry count'
        }
        Write-Host "PASS: $($case.Name)"
      } catch {
        $failures++
        Write-Host "FAIL: $($case.Name): $_"
      }
    }
  } finally { Pop-Location }
} finally {
  $env:RUNNER_TEMP = $savedTemp
  Remove-Item $root -Recurse -Force
}
if ($failures) { throw "$failures Windows archive assertions failed" }
