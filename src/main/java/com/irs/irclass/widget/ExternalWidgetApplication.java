package com.irs.irclass.widget;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

/**
 * Entry point for the IRCLASS external widget application.
 * <p>
 * {@code main} starts it standalone with the embedded Tomcat (development).
 * {@link #configure} is the entry point when {@code 3dexternal.war} is deployed
 * into an external server - the TomEE {@code 3dexternal} instance (WP12).
 */
@SpringBootApplication
public class ExternalWidgetApplication extends SpringBootServletInitializer {

    public static void main(String[] args) {
        SpringApplication.run(ExternalWidgetApplication.class, args);
    }

    @Override
    protected SpringApplicationBuilder configure(SpringApplicationBuilder builder) {
        return builder.sources(ExternalWidgetApplication.class);
    }
}
