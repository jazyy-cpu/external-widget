<#
.SYNOPSIS
    One-time host setup so 3DDashboard can load the IRS widget over HTTPS.

.DESCRIPTION
    The Spring application serves the widget on https://external.solize.com/
    with the certificate in ~\.irs-certs\external-widget.p12 (see worklog entry
    2026-09-24-01). Three host-level things need administrator rights:

      1. hosts entry      - so this machine's browser resolves external.solize.com
      2. trusted root     - so the browser accepts our self-signed certificate
      3. firewall rule    - so the VM can reach us on the STABLE VMnet8 address
                            192.168.125.1 instead of the Wi-Fi address, which
                            changes with the network

    Every step is idempotent: running it twice changes nothing.
    Nothing here touches the platform VM - that side is done separately.

.NOTES
    Run from an ELEVATED PowerShell:
        powershell -ExecutionPolicy Bypass -File .\scripts\setup-https-host.ps1
#>
[CmdletBinding()]
param(
    [string] $HostName    = 'external.solize.com',
    [string] $Certificate = (Join-Path $env:USERPROFILE '.irs-certs\external-widget.crt'),
    [string] $GuestSubnet = '192.168.125.0/24',
    [int]    $Port        = 443
)

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'This script must run from an elevated PowerShell (Run as administrator).'
}
if (-not (Test-Path $Certificate)) {
    throw "Certificate not found: $Certificate - regenerate it, see worklog 2026-09-24-01."
}

# 1. hosts entry -----------------------------------------------------------
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$lines = Get-Content $hosts
if ($lines | Where-Object { $_ -match "^\s*[^#].*\s$([regex]::Escape($HostName))\s*$" }) {
    Write-Host "[ok]   hosts already maps $HostName"
} else {
    Add-Content -Path $hosts -Value "127.0.0.1`t$HostName"
    Write-Host "[add]  hosts: 127.0.0.1 $HostName"
}

# 2. trusted root ----------------------------------------------------------
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $Certificate
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store 'Root', 'LocalMachine'
$store.Open('ReadWrite')
try {
    if ($store.Certificates | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }) {
        Write-Host "[ok]   certificate already trusted ($($cert.Thumbprint))"
    } else {
        $store.Add($cert)
        Write-Host "[add]  trusted root: $($cert.Subject) ($($cert.Thumbprint))"
    }
} finally {
    $store.Close()
}

# 3. firewall rule ---------------------------------------------------------
$ruleName = "IRS external widget HTTPS ($Port) from VM"
if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
    Write-Host "[ok]   firewall rule already present"
} else {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $Port -RemoteAddress $GuestSubnet `
        -Profile Any -Description 'Lets the 3DEXPERIENCE VM fetch the widget from the host over VMnet8.' | Out-Null
    Write-Host "[add]  firewall: allow inbound TCP $Port from $GuestSubnet"
}

Write-Host ''
Write-Host 'Done. Next:'
Write-Host "  1. start the app   : mvn spring-boot:run   (needs WIDGET_KEYSTORE_PASSWORD in the environment)"
Write-Host "  2. check in browser: https://$HostName/WidgetPacket/IRSProjects/IRSProjects.html"
Write-Host "  3. on the VM, point $HostName at 192.168.125.1 (stable) instead of the Wi-Fi address."
