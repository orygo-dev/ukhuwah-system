# Build signed Play Store AABs (student + optional teacher)
# Prefer running via C:\gs-mobile junction to avoid path apostrophe issues.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tool\build_play_aab.ps1 -Flavor student -BuildName 1.0.3 -BuildNumber 6
#   powershell -ExecutionPolicy Bypass -File tool\build_play_aab.ps1 -Flavor all -BuildName 1.0.3 -BuildNumber 6
#
# AdMob App IDs (required for release):
#   - Env: ADMOB_STUDENT_APP_ID / ADMOB_TEACHER_APP_ID
#   - Or file: android\admob.properties (gitignored; see admob.properties.example)

param(
  [ValidateSet("student", "teacher", "all")]
  [string]$Flavor = "student",
  [string]$BaseUrl = "https://ukhuwahsystem.navalogi.id",
  [string]$BuildName = "1.0.3",
  [int]$BuildNumber = 6
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$keyProps = Join-Path $root "android\key.properties"
$keystoreHint = Join-Path $root "android\app\upload-keystore.p12"
if (-not (Test-Path $keyProps)) {
  throw "Missing android\key.properties. Copy key.properties.example and fill secrets, or restore from GenPro-PlayStore-Keystore-BACKUP."
}
if (-not (Test-Path $keystoreHint)) {
  Write-Warning "upload-keystore.p12 not found at $keystoreHint - check storeFile in key.properties."
}

# Load AdMob IDs from android/admob.properties if env not set
$admobPropsPath = Join-Path $root "android\admob.properties"
if (Test-Path $admobPropsPath) {
  Get-Content $admobPropsPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $parts = $line.Split("=", 2)
      $k = $parts[0].Trim()
      $v = $parts[1].Trim()
      if ($k -and $v -and -not [Environment]::GetEnvironmentVariable($k)) {
        [Environment]::SetEnvironmentVariable($k, $v, "Process")
      }
    }
  }
}

$studentId = [Environment]::GetEnvironmentVariable("ADMOB_STUDENT_APP_ID")
$teacherId = [Environment]::GetEnvironmentVariable("ADMOB_TEACHER_APP_ID")
if ($Flavor -in @("student", "all") -and [string]::IsNullOrWhiteSpace($studentId)) {
  throw "ADMOB_STUDENT_APP_ID missing. Set env or create android\admob.properties (see admob.properties.example)."
}
if ($Flavor -in @("teacher", "all") -and [string]::IsNullOrWhiteSpace($teacherId)) {
  throw "ADMOB_TEACHER_APP_ID missing. Set env or create android\admob.properties (see admob.properties.example)."
}

function Build-One([string]$name) {
  $target = if ($name -eq "teacher") { "lib/main_teacher.dart" } else { "lib/main.dart" }
  Write-Host "=== Building $name AAB (v$BuildName+$BuildNumber) ===" -ForegroundColor Cyan
  flutter build appbundle --release `
    --flavor $name `
    -t $target `
    --build-name=$BuildName `
    --build-number=$BuildNumber `
    --dart-define=GURUSPACE_BASE_URL=$BaseUrl
  if ($LASTEXITCODE -ne 0) { throw "flutter build appbundle failed for $name" }

  $aab = Join-Path $root "build\app\outputs\bundle\${name}Release\app-$name-release.aab"
  if (-not (Test-Path $aab)) { throw "AAB not found: $aab" }
  Write-Host "OK: $aab" -ForegroundColor Green
  return $aab
}

$flavors = if ($Flavor -eq "all") { @("student", "teacher") } else { @($Flavor) }
$outputs = @()
foreach ($f in $flavors) { $outputs += Build-One $f }

Write-Host ""
Write-Host "Upload these AAB files to Play Console:" -ForegroundColor Yellow
$outputs | ForEach-Object { Write-Host " - $_" }
