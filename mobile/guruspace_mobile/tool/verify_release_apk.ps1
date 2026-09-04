# Verifies a Flutter release APK contains flutter_assets + MaterialIcons.
param(
  [Parameter(Mandatory = $true)][string]$ApkPath,
  [int]$MinFlutterAssets = 5
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path $ApkPath)) { throw "APK not found: $ApkPath" }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $ApkPath))
try {
  $fa = @($z.Entries | Where-Object { $_.FullName -like 'assets/flutter_assets/*' })
  $mi = @($z.Entries | Where-Object { $_.FullName -like '*MaterialIcons*' })
  Write-Host ("apk=" + (Resolve-Path $ApkPath))
  Write-Host ("size=" + (Get-Item $ApkPath).Length)
  Write-Host ("flutter_assets=" + $fa.Count)
  Write-Host ("MaterialIcons=" + $mi.Count)
  if ($fa.Count -lt $MinFlutterAssets -or $mi.Count -lt 1) {
    throw "APK missing flutter_assets or MaterialIcons. Rebuild via C:\gs-mobile after flutter clean."
  }
  Write-Host "VERIFY_OK"
} finally {
  $z.Dispose()
}
