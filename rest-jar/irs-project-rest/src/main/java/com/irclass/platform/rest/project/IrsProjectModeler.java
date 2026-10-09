package com.irclass.platform.rest.project;

import com.dassault_systemes.platform.restServices.ModelerBase;

import jakarta.ws.rs.ApplicationPath;

/**
 * The JAX-RS application of the IRCLASS project services.
 *
 * <pre>
 * /3dspace/resources/v1/irsproject/...
 * </pre>
 *
 * <h2>Why a separate application path from the hello JAR</h2>
 *
 * {@code irs-hello-rest} already owns {@code /resources/v1/irs}. Nesting a
 * second application beneath another's path makes which one serves a URL
 * container-dependent, so this one takes a sibling path of its own. The two
 * JARs are then independent: redeploying this one cannot break the smoke-test
 * endpoint that tells us the mechanism still works at all.
 *
 * <h2>R2024x, not R2022x</h2>
 *
 * {@code ModelerBase} extends {@code jakarta.ws.rs.core.Application} on this
 * release. The white paper's {@code javax.ws.rs} samples are <b>not</b>
 * binary-compatible, and {@code RestService.authenticate} is deprecated in
 * favour of {@code getAuthenticatedContext}. Compile with
 * {@code --release 17}.
 *
 * Further services for the project widget are registered here, one line each.
 */
@ApplicationPath("/resources/v1/irsproject")
public final class IrsProjectModeler extends ModelerBase {

    @Override
    public Class<?>[] getServices() {
        return new Class<?>[] {
            ProjectContextService.class,
            // the task's Project Baseline - a sibling path because the
            // IRSTaskBaseline link starts at the TASK, not the project
            TaskBaselineService.class
        };
    }
}
