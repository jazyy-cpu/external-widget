# 2026-11-22-01 - WAR packaging: `3dexternal.war` for the TomEE `3dexternal` instance

Requirement: - (hosting, WP12 `documents/work-packages/12-external-app-server-3dexternal/`). Worklog `2026-11-20-10` (update 2026-11-22 (2)).

## What changed

| File | Change |
|---|---|
| `pom.xml` | `<packaging>war</packaging>`; `spring-boot-starter-tomcat` with scope `provided`; `<finalName>3dexternal</finalName>` |
| `src/main/java/com/irs/irclass/widget/ExternalWidgetApplication.java` | extends `SpringBootServletInitializer` (`org.springframework.boot.web.servlet.support`, in `spring-boot-4.1.1.jar`) and overrides `configure` - the entry point when an external server deploys the WAR; `main` unchanged |

`application.properties` is unchanged. Inside TomEE the `server.port` / `server.ssl.*` settings are not used (the port comes from TomEE's `server.xml`, 8980), and an unresolved `${WIDGET_KEYSTORE_PASSWORD}` is left as text by the binder rather than failing. Moving them into a `dev` profile is a later tidy-up.

## Why `provided`

`spring-boot-starter-webmvc` 4.1.1 depends on `spring-boot-starter-tomcat` at compile scope. As `provided`, the embedded Tomcat goes to `WEB-INF/lib-provided` (used only by `java -jar`) and not to `WEB-INF/lib`, so it cannot clash with TomEE's own Tomcat 11. `mvn spring-boot:run` still includes it, so the local development loop is unchanged.

## Build and result

```bat
set "JAVA_HOME=D:\SOFTWARES\openjdk-21.0.2_windows-x64_bin\jdk-21.0.2"
"D:\SOFTWARES\apache-maven-3.9.9-bin\apache-maven-3.9.9\bin\mvn.cmd" package
```

- `BUILD SUCCESS`, 1 test run, 0 failures; `target\3dexternal.war`, 23,192,269 bytes, SHA-256 `b42cd5eb...672dee2`.
- `WEB-INF/lib`: 29 jars (Spring 7.0.9, Boot 4.1.1, Jackson 3.1.5, Logback 1.5.38, ...), **no Tomcat**; `WEB-INF/lib-provided`: Tomcat (3 jars).
- `WEB-INF/classes` holds `application.properties`, the classes and `static/WidgetPacket/...`.
- Class file major version **61** (Java 17), so it runs on the platform's Semeru 17 although it was built with JDK 21.

## Deployed

Copied to VM `C:\DassaultSystemes\TomEE\3dexternal\webapps\3dexternal.war` (hash matches). The stock webapps stay (user decision). TomEE not started yet: the user starts it and checks `http://127.0.0.1:8980/3dexternal/api/status` on the VM, then restarts Apache for `https://3dexperience2024x.solize.com/3dexternal/...`.

## Watch on first start

`WEB-INF/lib` carries `jakarta.annotation-api-3.0.0.jar`, Logback and SLF4J. TomEE may log that it skips a Jakarta API jar (harmless), and TomEE's own CDI / JAX-RS scanning sees the WAR. Any `SEVERE` at deploy goes into an update of this entry.

## Update 2026-11-22 - first start: two TomEE issues fixed, WAR running

1. **404 on `/3dexternal/api/status`, Spring never started.** TomEE's scan exclusion list (`default.exclusions` in `openejb-core-11.0.0-M2.jar`) has the entry `spring-`, so the `ServletContainerInitializer` in `spring-web` was skipped and the context stayed empty. Fixed on the **server**: `conf\system.properties` `openejb.additional.include = spring-` (read from the bytecode: `NewLoaderLogic.getExclusions` removes every exclusion that `startsWith` the value - `spring-web` would not match). Delivered in `PLM_PRD_CUSTOMIZATION/tomee/`.
2. **Spring then failed** with `loading constraint violation ... com/fasterxml/jackson/annotation/ObjectIdGenerator`: TomEE Plus ships Jackson 2 in its `lib` (`jackson-annotations-2.21`, core/databind 2.22.4) and its `ContainerClassesFilter` serves `com.fasterxml.jackson.annotation` from there. Fixed in **`pom.xml`**: `com.fasterxml.jackson.core:jackson-annotations` scope `provided` (same 2.21 version as TomEE's; moves to `WEB-INF/lib-provided`, so `spring-boot:run` and `java -jar` keep it). Jackson 3 (`tools.jackson`, core/databind 3.1.5) stays in `WEB-INF/lib`.
3. A replaced WAR was **not** re-expanded - TomEE kept the 19:04 `webapps\3dexternal\` with the old jar. Stop, delete the expanded folder and `work\Catalina\localhost\3dexternal`, start.

Result 19:12: `Started ExternalWidgetApplication in 2.327 seconds`, deployment 6.4 s, 0 SEVERE (only BatchEE JMX notices); `GET http://127.0.0.1:8980/3dexternal/api/status` -> 200 `{"status":"UP","application":"irclass-external-widget"}`; `IRSProjects.html` -> 200; 8980 not reachable from the host. WAR SHA-256 `1E43DE87...7FCE1FC`.
