package com.irclass.platform.rest.project;

import java.util.List;
import java.util.Map;

import jakarta.json.Json;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.JsonValue;

/**
 * Plain Maps, Lists and Strings turned into JSON-P values.
 *
 * One generic converter rather than a hand-written builder per endpoint: the
 * reader decides the shape, and this class only transliterates it. Adding a
 * field to the payload is then a change in one place, not two.
 *
 * jakarta.json ships with the TomEE host (the hello service already uses it),
 * so nothing is bundled in our JAR - the build guide's rule that platform JARs
 * are compile-only inputs still holds.
 *
 * Everything the reader produces is a String, a Map or a List, so those are the
 * only cases. Anything else is written as its {@code toString()} rather than
 * throwing: a diagnostic payload that renders is worth more than a 500.
 */
final class JsonValues {

    private JsonValues() {
    }

    @SuppressWarnings("rawtypes")
    static JsonValue of(Object value) {
        if (value == null) {
            return JsonValue.NULL;
        }
        if (value instanceof Map) {
            JsonObjectBuilder object = Json.createObjectBuilder();
            Map map = (Map) value;
            for (Object key : map.keySet()) {
                object.add(String.valueOf(key), of(map.get(key)));
            }
            return object.build();
        }
        if (value instanceof List) {
            JsonArrayBuilder array = Json.createArrayBuilder();
            for (Object item : (List) value) {
                array.add(of(item));
            }
            return array.build();
        }
        if (value instanceof Boolean) {
            return ((Boolean) value) ? JsonValue.TRUE : JsonValue.FALSE;
        }
        return Json.createValue(value.toString());
    }
}
