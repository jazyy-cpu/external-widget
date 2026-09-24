# 3DEXPERIENCE HTTPS trust for the external widget

Checked on 2026-09-23 against the local R2024x VM. The application does not yet make 3DEXPERIENCE API calls.

## Verified setup

- `https://3dexperience2024x.solize.com` resolves on this host to `192.168.125.10`. Apache httpd terminates TLS on port 443.
- The server presents `CN=3dexperience2024x.solize.com`, valid 2024-01-02 through 2033-12-30, issued by the private SOLIZE root CA. The leaf is X.509 v1 and has no Subject Alternative Name (SAN).
- The presented root has SHA-256 fingerprint `12:19:F6:A7:84:AE:57:C2:01:C5:4B:B6:46:EF:72:1E:DE:9B:DE:A4:05:DD:CA:F1:EB:96:BA:C4:52:9F:D2:23`. A public copy is at `AGENTS/3dexperience_windows_vm/config/certs/solize-ServerRootCA.crt`.
- This host's OpenJDK 21.0.2 default trust manager contains that exact root. Java HTTPS GET to the platform hostname returned HTTP 200 with default TLS checks. No client certificate was required for that TLS connection.
- The JDK `HttpClient` also completed a verified TLS connection to the hostname and received HTTP 302 (an application redirect).
- Java HTTPS GET to `https://192.168.125.10/3dspace/` failed with `SSLHandshakeException: No subject alternative names present`. Configure the Spring client with the DNS hostname.

## Decision for the Spring client

For this host and JDK, no new certificate or `.p12` file is needed for an outbound connection to the current platform hostname. A different JDK, container, or server may have a different truststore; test from the actual runtime before integrating the widget.

If that runtime does not trust the private CA, configure the Spring HTTP client to trust the public root CA certificate. Spring Boot supports a PEM truststore bundle directly, so PKCS#12 conversion is optional. A `.p12` truststore containing the public CA also works. Neither needs the Apache server private key. Do not copy the server `.key` or export it into this project.

The platform leaf has no SAN. Current TLS identity standards and Chromium browsers require SAN for hostname validation. A future browser-facing platform certificate should be reissued with DNS SANs for each hostname users visit. The existing CA may sign it if that CA remains appropriate. The widget's own HTTPS endpoint will also need a browser-trusted certificate when embedded from the HTTPS platform.

Keep certificate and hostname verification enabled. TLS trust, HTTP authentication, browser CORS, and iframe/CSP policy are separate integration checks.

## The widget's own HTTPS endpoint (inbound)

Everything above is the **outbound** direction: our Spring client calling the
platform. This section is the **inbound** direction: 3DDashboard and the
browser fetching our widget. Set up 2026-09-24, worklog `2026-09-24-01`.

### The existing Apache certificates cannot be reused

All three leaf certificates in `C:\DassaultSystemes\Apache24\conf\ssl\` on the
VM - `3dexperience.crt`, `untrusted3dexperience.crt`, `3dswym3dexperience.crt` -
are **X.509 v1 with no extensions at all**, so none of them has a SAN and no
browser will accept any of them, whatever hostname they are served under. Their
CNs are also the VM's own hostnames, which both hosts files resolve to the VM,
so they cannot name a widget host on the developer machine. `ServerRootCA.crt`
could sign a correct SAN leaf, but `ServerRootCA.key` is
`-----BEGIN ENCRYPTED PRIVATE KEY-----` and the passphrase is not ours.

The considered alternative was to keep the existing certificate where it is and
add a `ProxyPass /WidgetPacket` to the platform's own `:443` vhost
(`mod_proxy_http` is already loaded). That needs no certificate at all and
makes the widget same-origin with 3DSpace. It was not taken, because it edits
platform Apache configuration; it stays on the table if the certificate route
becomes a maintenance burden.

### What is in place

| Piece | Value |
|---|---|
| URL | `https://external.solize.com/WidgetPacket/IRSProjects/IRSProjects.html` |
| Certificate | our own, self-signed (its own trust anchor), RSA 2048, SHA-256, v3, 10 years, `CN=external.solize.com` |
| SANs | `DNS:external.solize.com`, `DNS:localhost`, `IP:127.0.0.1`, `IP:192.168.125.1`, `IP:192.168.1.6` |
| Keystore | `~\.irs-certs\external-widget.p12`, alias `external-widget` - **outside the repository** |
| Password | user environment variable `WIDGET_KEYSTORE_PASSWORD`, never in a file |
| Spring | `server.port=443`, `server.ssl.*` in `application.properties`, keystore path via `${user.home}` |
| Host setup | `scripts/setup-https-host.ps1` - hosts entry, trusted root, firewall rule (needs elevation, idempotent) |

### Who actually needs to trust this certificate (corrected 2026-09-24)

Only the **platform VM's JVM**. 3DDashboard does not let the browser talk to our
server: it fetches our files server-side and re-serves them from its own origin
under `/3ddashboard/api/widget/proxy/external/...`, so the browser only ever
sees the platform's own certificate.

That means the hosts entry and the trusted-root import in
`scripts/setup-https-host.ps1` are **not required** for the widget to load in
the dashboard - they only let a developer open
`https://external.solize.com/...` directly in a browser. The firewall rule is
still worth having, to move off the Wi-Fi address (below). Confirmed from the
browser console log in devlog `2026-09-24-02`.

### The trust step that is easy to miss

The dashboard fetches the widget HTML **server-side**, from the VM's TomEE JVM
(Eclipse OpenJ9 17, `C:\Program Files\Semeru\jdk-17.0.8.7-openj9`). No TomEE
instance sets `-Djavax.net.ssl.trustStore`, so the JDK default `cacerts`
decides. Before importing, that JVM failed with
`SSLHandshakeException: PKIX path building failed`; after importing the
certificate as alias `irs-external-widget` it returned HTTP 200. A **running**
JVM caches the default SSLContext, so the `3DDashboard_R2024x` service has to
be restarted for the import to take effect.

Worth probing this directly with a throwaway single-file Java program run by
that exact JVM before changing anything - it turns a guess into a fact and
costs no downtime.

### Reachability, and the address that keeps breaking

The VM reaches the host over VMware NAT. The host's **VMnet8** address
`192.168.125.1` is stable; its Wi-Fi address changes with the network. The VM
hosts file pointing `external.solize.com` at the Wi-Fi address is what produced
the original `HttpHostConnectException ... Connection refused`. Use
`192.168.125.1`, which needs the inbound firewall rule from
`setup-https-host.ps1` because VMnet8 is not on the Private profile that the
existing `java.exe` rules cover.

### Rules for this endpoint

- The keystore and its password never enter the repository, and neither does
  any platform private key.
- Verify with `curl --cacert <our crt>`, never `curl -k` - `-k` would hide
  exactly the SAN and chain problems this setup exists to avoid.

## Sources

- [Spring Boot SSL bundles](https://docs.spring.io/spring-boot/reference/features/ssl.html)
- [Spring Boot `RestClientSsl`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/restclient/autoconfigure/RestClientSsl.html)
- [Java JSSE truststore behavior](https://docs.oracle.com/en/java/javase/12/security/java-secure-socket-extension-jsse-reference-guide.html)
- [RFC 9525 service identity](https://www.rfc-editor.org/rfc/rfc9525.html)
- [Chrome common-name deprecation](https://developer.chrome.com/blog/chrome-58-deprecations)
