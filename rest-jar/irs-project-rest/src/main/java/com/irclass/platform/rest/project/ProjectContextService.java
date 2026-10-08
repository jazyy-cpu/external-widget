package com.irclass.platform.rest.project;

import java.util.Map;

import com.dassault_systemes.platform.restServices.RestService;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Transport for {@link ProjectContextReader} - and nothing else.
 *
 * <pre>
 * GET /3dspace/resources/v1/irsproject/projects/{projectId}/context
 * </pre>
 *
 * Returns one project's risks, opportunities and key learnings in a single
 * response, because the widget's panel needs all three at once and three
 * endpoints would mean three authentications and three sets of round trips for
 * one screen.
 *
 * <h2>What this class is allowed to do</h2>
 *
 * Read the path parameter, authenticate, call the reader, serialise, map a
 * failure to a status code. No selects, no relationship names, no business
 * rules - those live in the reader, which is proven in a JPO first (see its
 * javadoc). Keeping the split strict is what lets the expensive half be
 * debugged without a 216-second redeploy.
 *
 * <h2>The resource is a SINGLETON</h2>
 *
 * One instance serves every concurrent call, so there are no fields here and
 * there must never be any. Request and user data stay in local variables.
 * This is the one fault the JPO self-test cannot catch: a field that behaves
 * perfectly in a single-threaded test is a cross-request data leak in this
 * host.
 *
 * <h2>Authorization</h2>
 *
 * {@code getAuthenticatedContext(request, false)} proves a platform session,
 * no more. That is sufficient <i>for this endpoint</i> and only because every
 * read below is evaluated by the kernel as the calling user, so policy access
 * already decides which rows come back. A write endpoint added to this modeler
 * later must make its own authorization decision explicitly - the open J6 of
 * the build guide.
 */
@Path("/projects")
public final class ProjectContextService extends RestService {

    /** Signatures of a bad id, as the kernel words them. */
    private static final String[] NOT_FOUND = {
        "does not exist", "not a valid", "invalid object", "no such object"
    };

    /**
     * @param include optional {@code $include} - a comma-separated list of
     *        sections. Omitted means all of them, so a caller written before
     *        this parameter existed is unaffected.
     *
     *        <pre>
     *        ?$include=risks
     *        ?$include=risks,opportunities
     *        ?$include=learnings.reused
     *        </pre>
     *
     *        A section that is not asked for is <b>absent</b> from the
     *        response rather than present and empty, so the caller can tell
     *        "I did not ask" from "there are none". The response's own
     *        {@code included} array says which it carries.
     */
    @GET
    @Path("/{projectId}/context")
    @Produces(MediaType.APPLICATION_JSON)
    public Response context(@Context HttpServletRequest request,
                            @PathParam("projectId") String projectId,
                            @QueryParam("$include") String include) {
        if (projectId == null || projectId.trim().isEmpty()) {
            return error(Response.Status.BAD_REQUEST, "MISSING_PROJECT_ID",
                    "A project id is required.");
        }

        java.util.Set<String> sections;
        try {
            sections = ProjectContextReader.parseInclude(include);
        } catch (IllegalArgumentException e) {
            // a typo is rejected rather than ignored: silently dropping an
            // unknown section would look exactly like a project with no risks
            return error(Response.Status.BAD_REQUEST, "BAD_INCLUDE", e.getMessage());
        }

        matrix.db.Context platform;
        try {
            platform = getAuthenticatedContext(request, false);
        } catch (Exception e) {
            return error(Response.Status.UNAUTHORIZED, "NOT_AUTHENTICATED",
                    "No valid platform session.");
        }
        if (platform == null) {
            return error(Response.Status.UNAUTHORIZED, "NOT_AUTHENTICATED",
                    "No valid platform session.");
        }

        try {
            Map<String, Object> payload =
                    ProjectContextReader.readProjectContext(platform, projectId, sections);
            // no-store: risks, opportunities and learnings change while a
            // project runs, and a cached panel showing a closed risk as open is
            // worse than a second call
            return Response.ok(JsonValues.of(payload).toString(),
                            MediaType.APPLICATION_JSON_TYPE)
                    .header("Cache-Control", "private, no-store")
                    .header("X-Content-Type-Options", "nosniff")
                    .build();
        } catch (IllegalArgumentException e) {
            return error(Response.Status.BAD_REQUEST, "BAD_PROJECT_ID", e.getMessage());
        } catch (Exception e) {
            if (looksMissing(e)) {
                return error(Response.Status.NOT_FOUND, "PROJECT_NOT_FOUND",
                        "No project could be read for that id.");
            }
            // the kernel's own wording is kept: it names the select or the
            // relationship that failed, which is what makes a 500 actionable.
            // No stack trace goes to the client.
            return error(Response.Status.INTERNAL_SERVER_ERROR, "READ_FAILED", text(e));
        }
    }

    /**
     * Whether a failure means "that id is not an object" rather than "the read
     * broke".
     *
     * String matching on a kernel message is admittedly brittle - it is how the
     * kernel reports it, and the alternative is an extra existence round trip on
     * every call. The consequence of getting it wrong is a 500 where a 404 was
     * due, never wrong data. Listed as an open item.
     */
    private static boolean looksMissing(Exception e) {
        String message = text(e).toLowerCase();
        for (String probe : NOT_FOUND) {
            if (message.contains(probe)) {
                return true;
            }
        }
        return false;
    }

    private static String text(Exception e) {
        String message = e.getMessage();
        return (message == null || message.trim().isEmpty())
                ? e.getClass().getName() : message.trim();
    }

    /** One error shape for every failure, so the widget needs one branch. */
    private static Response error(Response.Status status, String code, String message) {
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
}
