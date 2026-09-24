<#
.SYNOPSIS
    Start the IRS external widget Spring Boot application over HTTPS.

.DESCRIPTION
    Supplies the two things the app needs that are not in the repository:
      - JAVA_HOME (Java 21)
      - WIDGET_KEYSTORE_PASSWORD, read from the persisted user environment
        variable, because a freshly spawned shell does not always inherit it

    Refuses to start if the port is already in use, so two instances can never
    fight over it. See worklog 2026-09-24-01 for the certificate and keystore.

.EXAMPLE
    .\scripts\start-widget.ps1
    Runs in the foreground; Ctrl+C stops it.

.EXAMPLE
    .\scripts\start-widget.ps1 -Background
    Starts detached and returns; stop it with .\scripts\stop-widget.ps1
#>
[CmdletBinding()]
param(
    [int]    $Port       = 443,
    [string] $JavaHome   = 'D:\SOFTWARES\openjdk-21.0.2_windows-x64_bin\jdk-21.0.2',
    [string] $Maven      = 'D:\SOFTWARES\apache-maven-3.9.9-bin\apache-maven-3.9.9\bin\mvn.cmd',
    [switch] $Background
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$pom     = Join-Path $project 'pom.xml'

# --- checks ---------------------------------------------------------------
foreach ($p in @($JavaHome, $Maven, $pom)) {
    if (-not (Test-Path $p)) { throw "Not found: $p" }
}

$busy = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($busy) {
    throw ("Port $Port is already in use by PID $($busy.OwningProcess -join ', '). " +
           'The app may already be running - use .\scripts\stop-widget.ps1 first.')
}

$pw = [Environment]::GetEnvironmentVariable('WIDGET_KEYSTORE_PASSWORD', 'User')
if ([string]::IsNullOrEmpty($pw)) {
    throw ('WIDGET_KEYSTORE_PASSWORD is not set for this user. The keystore cannot be ' +
           'opened without it - see worklog 2026-09-24-01 to recreate the keystore.')
}

# --- run -----------------------------------------------------------------
$env:JAVA_HOME                = $JavaHome
$env:WIDGET_KEYSTORE_PASSWORD = $pw

Write-Host "Starting on https://external.solize.com:$Port (project: $project)"

if ($Background) {
    $log = Join-Path $project 'target\widget-run.log'
    New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
    $p = Start-Process -FilePath $Maven -ArgumentList @('-f', "`"$pom`"", 'spring-boot:run') `
            -RedirectStandardOutput $log -RedirectStandardError "$log.err" `
            -WindowStyle Hidden -PassThru
    Write-Host "Started detached, launcher PID $($p.Id). Log: $log"
    Write-Host "Stop it with: .\scripts\stop-widget.ps1"
} else {
    & $Maven -f $pom spring-boot:run
}
