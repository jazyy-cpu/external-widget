<#
.SYNOPSIS
    Stop the IRS external widget Spring Boot application.

.DESCRIPTION
    Finds the process by the TCP port it is listening on, not by process name -
    this machine runs several unrelated java processes (MCP servers and others)
    and a name-based kill would take them down too.

    Before stopping anything it confirms the process command line really belongs
    to this project, and refuses otherwise. Also stops the Maven launcher that
    spawned it, so no orphan is left holding the port.

.EXAMPLE
    .\scripts\stop-widget.ps1
#>
[CmdletBinding()]
param(
    [int]    $Port      = 443,
    [string] $MainClass = 'com.irs.irclass.widget.ExternalWidgetApplication',
    [switch] $Force     # stop the listener even if it cannot be tied to this project
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot

$conns = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $conns) {
    Write-Host "Nothing is listening on port $Port - already stopped."
    return
}

$stopped = @()
foreach ($procId in ($conns.OwningProcess | Sort-Object -Unique)) {

    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
    if (-not $proc) { continue }

    # Spring Boot 4 launches with an @argfile, so the project path is usually NOT on
    # the command line - the main class is, and identifies the app just as precisely.
    $mine = $proc.CommandLine -and (
                ($proc.CommandLine -like "*$project*") -or
                ($proc.CommandLine -like "*$MainClass*"))
    if (-not $mine -and -not $Force) {
        Write-Warning ("PID $procId holds port $Port but its command line matches neither " +
                       "$project nor $MainClass, so it was left alone. " +
                       'Re-run with -Force only if you are sure.')
        Write-Host   ("  command line: " + $proc.CommandLine)
        continue
    }

    # stop the Maven launcher first so it cannot restart or linger
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.ParentProcessId)" -ErrorAction SilentlyContinue
    if ($parent -and $parent.CommandLine -and $parent.CommandLine -match 'maven|mvn') {
        Write-Host "Stopping Maven launcher PID $($parent.ProcessId)"
        Stop-Process -Id $parent.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Write-Host "Stopping application PID $procId"
    Stop-Process -Id $procId -Force
    $stopped += $procId
}

if (-not $stopped) { return }

# confirm the port is actually free before reporting success
for ($i = 0; $i -lt 20; $i++) {
    if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
        Write-Host "Stopped. Port $Port is free."
        return
    }
    Start-Sleep -Milliseconds 250
}
Write-Warning "Stopped PID(s) $($stopped -join ', ') but port $Port still shows a listener."
