package com.irclass.platform.rest.project;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * The one error shape every endpoint of this modeler returns, and the two
 * helpers that decide it.
 *
 * Extracted from {@link ProjectContextService} when a second endpoint was
 * added (2026-10-09). The reason is in that class's own comment - <i>"one
 * error shape for every failure, so the widget needs one branch"</i> - which
 * stops being true the moment a second copy of it exists and drifts. A widget
 * branching on `error.code` must be able to rely on every endpoint here
 * wording a failure the same way.
 *
 * Package-private on purpose: this is internal plumbing of the modeler, not
 * part of any contract.
 */
final class Responses {

    /** Signatures of a bad id, as the kernel words them. */
    private static final String[] NOT_FOUND = {
        "does not exist", "not a valid", "invalid object", "no such object"
    };

    private Responses() {
    }

    /**
     * Whether a failure means "that id is not an object" rather than "the read
     * broke".
     *
     * String matching on a kernel message is admittedly brittle - it is how the
     * kernel reports it, and the alternative is an extra existence round trip
     * on every call. The consequence of getting it wrong is a 500 where a 404
     * was due, never wrong data. Listed as open item P2 of the build guide.
     */
    static boolean looksMissing(Exception e) {
        String message = text(e).toLowerCase();
        for (String probe : NOT_FOUND) {
            if (message.contains(probe)) {
                return true;
            }
        }
        return false;
    }

    /** The kernel's own wording, which is what makes a 500 actionable. */
    static String text(Exception e) {
        String message = e.getMessage();
        return (message == null || message.trim().isEmpty())
                ? e.getClass().getName() : message.trim();
    }

    /** One error shape for every failure, so the widget needs one branch. */
    static Response error(Response.Status status, String code, String message) {
        JsonObject body = Json.createObjectBuilder()
                .add("error", Json.createObjectBuilder()
                        .add("status", status.getStatusCode())
                        .add("code", code)
                        .add("message", message == null ? "" : message))
                .build();
        return Response.status(status)
                .entity(body.toString())
                .type(MediaType.APPLICATION_JSON_TYPE)
                .header("Cache-Control", "private, no-store")
                .build();
    }

    /** The success shape: no-store, because this data changes while work runs. */
    static Response ok(String json) {
        return Response.ok(json, MediaType.APPLICATION_JSON_TYPE)
                .header("Cache-Control", "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .build();
    }
}
