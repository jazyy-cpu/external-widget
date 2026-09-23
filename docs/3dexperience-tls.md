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

## Sources

- [Spring Boot SSL bundles](https://docs.spring.io/spring-boot/reference/features/ssl.html)
- [Spring Boot `RestClientSsl`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/restclient/autoconfigure/RestClientSsl.html)
- [Java JSSE truststore behavior](https://docs.oracle.com/en/java/javase/12/security/java-secure-socket-extension-jsse-reference-guide.html)
- [RFC 9525 service identity](https://www.rfc-editor.org/rfc/rfc9525.html)
- [Chrome common-name deprecation](https://developer.chrome.com/blog/chrome-58-deprecations)
