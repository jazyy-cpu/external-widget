package com.irs.irclass.widget;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Temporary endpoint confirming that the widget host is running.
 */
@RestController
@RequestMapping("/api")
public class WidgetStatusController {

    @GetMapping("/status")
    public Map<String, String> status() {
        return Map.of("status", "UP", "application", "irclass-external-widget");
    }
}
