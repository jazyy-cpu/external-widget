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

From this directory, run:

```powershell
mvn spring-boot:run
```

Then verify the application:

```powershell
Invoke-RestMethod http://localhost:8080/api/status
```

Expected response:

```json
{"status":"UP","application":"irclass-external-widget"}
```
