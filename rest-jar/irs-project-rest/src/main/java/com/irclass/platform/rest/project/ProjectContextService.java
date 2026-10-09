package com.irclass.platform.rest.project;

import java.util.Map;

import com.dassault_systemes.platform.restServices.RestService;

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

    /**
     * @param include optional {@code $include} - a comma-separated list of
     *        sections. Omitted means all of them, so a caller written before
     *        this parameter existed is unaffected.
     *
     *        <pre>
     *        ?$include=risks
     *        ?$include=risks,opportunities
     *        ?$include=learnings.reused
     *        ?$include=members
     *        </pre>
     *
     *        {@code members} (added 2026-10-09) answers the R&amp;D-PRJ-02
     *        member block in one round trip: each person's designation and
     *        skills, which live on the Person, together with the responsibility
     *        and drive-access values, which live on the {@code Member}
     *        connection. The OOTB task resource's own {@code $include=members}
     *        returns names only, so without this section the caller would have
     *        to read every member separately.
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
            return Responses.error(Response.Status.BAD_REQUEST, "MISSING_PROJECT_ID",
                    "A project id is required.");
        }

        java.util.Set<String> sections;
        try {
            sections = ProjectContextReader.parseInclude(include);
        } catch (IllegalArgumentException e) {
            // a typo is rejected rather than ignored: silently dropping an
            // unknown section would look exactly like a project with no risks
            return Responses.error(Response.Status.BAD_REQUEST, "BAD_INCLUDE", e.getMessage());
        }

        matrix.db.Context platform;
        try {
            platform = getAuthenticatedContext(request, false);
        } catch (Exception e) {
            return Responses.error(Response.Status.UNAUTHORIZED, "NOT_AUTHENTICATED",
                    "No valid platform session.");
        }
        if (platform == null) {
            return Responses.error(Response.Status.UNAUTHORIZED, "NOT_AUTHENTICATED",
                    "No valid platform session.");
        }

        try {
            Map<String, Object> payload =
                    ProjectContextReader.readProjectContext(platform, projectId, sections);
            // Responses.ok sends no-store: risks, opportunities and
            // learnings change while a project runs, and a cached panel
            // showing a closed risk as open is worse than a second call
            return Responses.ok(JsonValues.of(payload).toString());
        } catch (IllegalArgumentException e) {
            return Responses.error(Response.Status.BAD_REQUEST, "BAD_PROJECT_ID", e.getMessage());
        } catch (Exception e) {
            if (Responses.looksMissing(e)) {
                return Responses.error(Response.Status.NOT_FOUND, "PROJECT_NOT_FOUND",
                        "No project could be read for that id.");
            }
            // the kernel's own wording is kept: it names the select or the
            // relationship that failed, which is what makes a 500 actionable.
            // No stack trace goes to the client.
            return Responses.error(Response.Status.INTERNAL_SERVER_ERROR, "READ_FAILED", Responses.text(e));
        }
    }

}
