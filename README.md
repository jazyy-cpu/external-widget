# IRCLASS external widget

This Spring Boot application is the foundation for the IRCLASS external widget, following the direction of the earlier proof of concept. It currently exposes only a small status endpoint while the widget's integration, security, and user interface are defined.

## Technology baseline

- Spring Boot 4.1.1 (stable when scaffolded on 2026-09-23)
- Spring Framework 7.0.9 or later, managed by Spring Boot
- Java 17 or later (the project targets Java 17)
- Maven 3.6.3 or later

The selected Spring Boot version and requirements are based on the official Spring Boot project page and system requirements:

- https://spring.io/projects/spring-boot
- https://docs.spring.io/spring-boot/system-requirements.html

## Run locally

The application serves **HTTPS on port 443** - 3DDashboard loads widgets over
HTTPS only. It needs two things that live outside this repository:

| | |
|---|---|
| Keystore | `~\.irs-certs\external-widget.p12` |
| Password | environment variable `WIDGET_KEYSTORE_PASSWORD` |

First time on a machine, from an **elevated** PowerShell (hosts entry, trusted
root, firewall rule - idempotent):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-https-host.ps1
```

Then, from this directory:

```powershell
$env:WIDGET_KEYSTORE_PASSWORD = [Environment]::GetEnvironmentVariable('WIDGET_KEYSTORE_PASSWORD','User')
mvn spring-boot:run
```

Verify the application and the widget:

```powershell
Invoke-RestMethod https://external.solize.com/api/status
# -> {"status":"UP","application":"irclass-external-widget"}

Start-Process https://external.solize.com/WidgetPacket/IRSProjects/IRSProjects.html
```

If the keystore is missing, or you need to recreate it, see worklog entry
`2026-09-24-01` for the exact OpenSSL commands.

## HTTPS

[docs/3dexperience-tls.md](docs/3dexperience-tls.md) covers both directions:
the platform's certificate and Java trust baseline for our **outbound** calls,
and the widget's own **inbound** HTTPS endpoint - including why the platform's
Apache certificates cannot be reused for it.
