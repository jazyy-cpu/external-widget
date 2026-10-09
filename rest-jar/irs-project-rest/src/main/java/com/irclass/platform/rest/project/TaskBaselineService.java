package com.irclass.platform.rest.project;

import java.util.Map;

import com.dassault_systemes.platform.restServices.RestService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Transport for the task's Project Baseline - and nothing else.
 *
 * <pre>
 * GET /3dspace/resources/v1/irsproject/tasks/{taskId}/baseline
 * </pre>
 *
 * <h2>Why this is task-scoped and not another {@code $include} section</h2>
 *
 * Every other section of this modeler hangs off a PROJECT, and
 * {@code /projects/{id}/context} serves them together because one screen needs
 * them at once. The baseline does not hang off the project: the
 * {@code IRSTaskBaseline} link starts at the <b>task</b>, and a project with
 * four personnel/cost tasks has four different baselines. Folding it into the
 * project endpoint would have meant smuggling a task id in beside a project
 * id, and an endpoint whose answer depends on a parameter its path does not
 * name is the kind that gets called wrongly later.
 *
 * So it is a sibling path. It costs the widget one extra call on this one form,
 * which is the honest price of the data living somewhere else.
 *
 * <h2>No baseline is a 200, not a 404</h2>
 *
 * Most personnel/cost tasks have no baseline captured yet (6 of them did on
 * 2026-10-09, the rest did not). That is a normal state of a live task, not a
 * missing resource, so it answers {@code 200} with
 * {@code baseline.linked: "false"}. A 404 is reserved for "that id is not a
 * task at all", which is a different thing the caller must be able to tell
 * apart - one is "nothing captured yet", the other is a broken link.
 *
 * <h2>The resource is a SINGLETON</h2>
 *
 * One instance serves every concurrent call, so there are no fields here and
 * there must never be any. Request and user data stay in local variables.
 *
 * <h2>Authorization</h2>
 *
 * {@code getAuthenticatedContext(request, false)} proves a platform session and
 * no more, which is sufficient here only because the read is evaluated by the
 * kernel as the calling user - policy access already decides whether that task
 * and that baseline are visible. This endpoint performs no write.
 */
@Path("/tasks")
public final class TaskBaselineService extends RestService {

    /**
     * @param taskId physical id ({@code 299036CE...}) or legacy id
     *        ({@code 39261.35329...}); both resolve
     * @return {@code {taskId, baseline:{linked, id, physicalId, name, type,
     *         state, actualStartDate, actualFinishDate, estimatedStartDate,
     *         estimatedFinishDate}}}. A task with no baseline captured answers
     *         200 with {@code linked: "false"} and empty fields; only an id
     *         that is not a task at all gives a 404.
     */
    @GET
    @Path("/{taskId}/baseline")
    @Produces(MediaType.APPLICATION_JSON)
    public Response baseline(@Context HttpServletRequest request,
                             @PathParam("taskId") String taskId) {
        if (taskId == null || taskId.trim().isEmpty()) {
            return Responses.error(Response.Status.BAD_REQUEST, "MISSING_TASK_ID",
                    "A task id is required.");
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
                    ProjectContextReader.readTaskBaselineContext(platform, taskId);
            return Responses.ok(JsonValues.of(payload).toString());
        } catch (IllegalArgumentException e) {
            return Responses.error(Response.Status.BAD_REQUEST, "BAD_TASK_ID", e.getMessage());
        } catch (Exception e) {
            if (Responses.looksMissing(e)) {
                return Responses.error(Response.Status.NOT_FOUND, "TASK_NOT_FOUND",
                        "No task could be read for that id.");
            }
            return Responses.error(Response.Status.INTERNAL_SERVER_ERROR, "READ_FAILED",
                    Responses.text(e));
        }
    }
}
