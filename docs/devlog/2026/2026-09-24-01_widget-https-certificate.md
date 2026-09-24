# 2026-09-24-01 - Widget served over HTTPS with our own SAN certificate

| | |
|---|---|
| Requirement | infrastructure for WGT-01 / WGT-02 / WGT-03 (WP03 open item O1) |
| Status | done - dashboard render still to be confirmed |
| Worklog | `worklog/entries/2026/2026-09-24-01_widget-https-san-cert-p12.md` |

## Why

3DDashboard refused the widget with
`HttpHostConnectException: Connect to external.solize.com:443 ... Connection refused`.
Nothing listened on 443 - the app was plain HTTP on 8080 - and the dashboard is
HTTPS, so an HTTP widget would be blocked as mixed content anyway.

## What was asked, and what was actually possible

The ask was to reuse the platform's Apache certificate, convert it to PKCS#12
and point Spring at it. That turned out to be impossible, for a reason worth
remembering: **all three Apache leaf certificates are X.509 v1 with no
extensions**, so none has a Subject Alternative Name, and browsers have
required a SAN since Chrome 58. Their CNs are the VM's own hostnames as well.
The one certificate that could have signed a correct leaf,
`ServerRootCA.crt`, has an encrypted private key.

So a certificate was generated instead. The platform's PKI was not touched.

## What was built

| Piece | Detail |
|---|---|
| Certificate | self-signed (its own trust anchor), RSA 2048 / SHA-256, v3, 10 years, `CN=external.solize.com` |
| SANs | `DNS:external.solize.com`, `DNS:localhost`, `IP:127.0.0.1`, `IP:192.168.125.1`, `IP:192.168.1.6` |
| Keystore | `~\.irs-certs\external-widget.p12`, alias `external-widget`, **outside the repository**; the standalone `.key` was deleted so the key exists only inside the `.p12` |
| Password | 40 random characters generated straight into the user environment variable `WIDGET_KEYSTORE_PASSWORD` - never printed, never written to a file |
| Spring | `server.port=443` (free on the host, so the URL needs no port), `server.ssl.*`, keystore path via `${user.home}` so it is not machine-specific |
| Host setup script | `scripts/setup-https-host.ps1` - hosts entry, trusted root, firewall rule; needs elevation, idempotent |

## The part that would have cost a confusing second debugging round

The dashboard fetches the widget HTML **server-side**, from the VM's TomEE JVM,
so that JVM has to trust the certificate too. Rather than assume it, a
throwaway single-file Java program was run by that exact JVM
(Eclipse OpenJ9 17, `C:\Program Files\Semeru\jdk-17.0.8.7-openj9`):

```
before: SSLHandshakeException: PKIX path building failed ...
        unable to find valid certification path to requested target
after : HTTP 200  + the widget XHTML
```

No TomEE instance sets `-Djavax.net.ssl.trustStore`, so the JDK default
`cacerts` is what matters. The certificate went in as alias
`irs-external-widget`, and `3DDashboard_R2024x` was restarted because a running
JVM caches the default SSLContext.

## Verified

Validation was done with `curl --cacert <our crt>` - deliberately **not**
`curl -k`, which would have hidden the SAN and chain problems this whole
exercise is about.

| Check | Result |
|---|---|
| Spring connector | `Tomcat started on port 443 (https) ... alias [external-widget]` |
| TLS via `localhost` | `http=200`, `ssl_verify_result=0` |
| TLS as `external.solize.com` (SAN match) | `http=200`, `ssl_verify_result=0` |
| `IRSProjects.html`, `js/App.js`, `js/components/CredentialBar.js`, `js/views/HelloView.js` | 200 |
| `JazzySole/PlatformService/Credentials.js`, `JazzySole/Router/Router.js` | 200 |
| `JazzySole/bootstrap/css/bootstrap.min.css` | 200, 232,111 bytes, `text/css` |
| VM's TomEE JVM fetching the widget | 200 |

## Also learned

The VM reaches the host over VMware NAT. `192.168.125.1` (host VMnet8) is
stable; the Wi-Fi address changes with the network, and the VM hosts file
pointing at the Wi-Fi address is what produced the original connection refusal.
Switching to `192.168.125.1` needs the inbound firewall rule from the setup
script, because VMnet8 is not on the Private profile the existing `java.exe`
rules cover.

## Next

- Run `scripts/setup-https-host.ps1` elevated, then load the widget in
  3DDashboard and run the WGT-03 checks T1-T5. T1 - whether "Credential source"
  reads OOTB or Fallback - finally answers whether a widget on an external
  server can reach `DS/ENOXWidgetPreferences`.
- Then WGT-02 wiring and the WGT-01 landing grid.
