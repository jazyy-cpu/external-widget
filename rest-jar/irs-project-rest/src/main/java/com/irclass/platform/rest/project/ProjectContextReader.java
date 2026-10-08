package com.irclass.platform.rest.project;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import matrix.db.Context;
import matrix.util.StringList;

import com.matrixone.apps.domain.DomainConstants;
import com.matrixone.apps.domain.DomainObject;
import com.matrixone.apps.domain.util.MapList;
import com.matrixone.apps.domain.util.PropertyUtil;

/**
 * One project's risks, opportunities and key learnings, as plain Maps and Lists.
 *
 * <h2>Business and data access only</h2>
 *
 * Nothing in this class knows about HTTP. It takes a {@code matrix.db.Context}
 * and returns data - no {@code Response}, no JSON, no servlet types. That keeps
 * the four layers the build guide asks for separate (transport, validation,
 * business rules, data access) and it is what makes the class testable at all:
 *
 * <p><b>This file is the twin of the JPO</b>
 * {@code mxupdate/custom/program/jpo/IRSProjectContext_mxJPO.java}, whose body
 * is identical. That is the project's working practice, not an accident: a JPO
 * recompiles in seconds, while a JAR redeploy costs a ~216-second TomEE
 * restart, and both hosts hand the method the very same
 * {@code matrix.db.Context} - the kernel in a JPO,
 * {@code getAuthenticatedContext(request, false)} here. So the logic is proven
 * there and moved here unchanged.
 *
 * <p><b>If this reader changes, change both.</b> The JPO carries the self-test
 * ({@code exec program IRSProjectContext <projectId>}) that prints the exact
 * payload, and it is worth nothing if it has drifted from this file.
 *
 * <h2>Why a custom service at all</h2>
 *
 * Checked against what DS ships before being written (CLAUDE.md):
 * <ul>
 *   <li><b>risks</b> - {@code GET /resources/v1/modeler/projects/{id}/risks}
 *       exists and answers 200, but returned an <i>empty</i> list for TEST
 *       PROJECT while the {@code Risk} relationship holds four objects
 *       (worklog 2026-10-07-03 and -04);</li>
 *   <li><b>opportunities</b> - no REST route exists at all; an Opportunity id
 *       on {@code /risks/{id}} returns {@code data: []};</li>
 *   <li><b>key learnings</b> - {@code IRSLearning} is ours, so no OOTB service
 *       can know it.</li>
 * </ul>
 *
 * <h2>Round trips</h2>
 *
 * Four, whatever the row count: the project header, everything on the
 * {@code Risk} relationship (risks and opportunities arrive together, because
 * OOTB carries both over that one relationship), the learnings this project
 * produced, and the learnings it reuses - the last with their origin project
 * and project number fetched through a <i>nested</i> select, so there is no
 * second call per row.
 *
 * <h2>Access control</h2>
 *
 * None of its own, deliberately. {@code getRelatedObjects} and {@code getInfo}
 * are evaluated by the kernel as the authenticated user, so a caller sees
 * exactly the rows their policies allow. This class must therefore never be
 * handed a context obtained any other way than from the live request.
 */
public final class ProjectContextReader {

    /** OOTB. Project Management -&gt; Risk Management, carries BOTH kinds. */
    private static final String REL_RISK = "Risk";

    /** Ours - symbolic, with the real name as the fallback (rule W4). */
    private static final String SYM_REL_ORIGIN = "relationship_IRSProjectLearning";
    private static final String SYM_REL_REUSED = "relationship_IRSProjectReusedLearning";
    private static final String SYM_TYPE_LEARNING = "type_IRSLearning";
    private static final String SYM_ATTR_LEARNING_TEXT = "attribute_IRSLearningText";
    private static final String SYM_ATTR_TITLE = "attribute_Title";

    /** DMC-created, no symbolic name - the literal is the name. */
    private static final String ATTR_PROJECT_NO = "EPMProjectNo";

    private static final String SEL_PHYSICAL_ID = "physicalid";
    private static final String SEL_TYPE = "type";
    private static final String SEL_CURRENT = "current";
    private static final String SEL_REVISION = "revision";

    /** TRUE on an Opportunity and on any future subtype of one. */
    private static final String SEL_IS_OPPORTUNITY = "type.kindof[Opportunity]";

    private ProjectContextReader() {
    }

    // ------------------------------------------------------------ helpers

    /**
     * A symbolic name resolved to the real one, falling back to the literal.
     *
     * The fallback is not laziness: {@code getSchemaProperty} returns empty on
     * an environment where the symbolic name was never registered, and a list
     * silently missing because of that is worse than one read through the real
     * name. Our CIs do register them, so this should never fire - and if it
     * does, the data is still right.
     */
    private static String nameOf(Context context, String symbolic, String fallback) {
        try {
            String real = PropertyUtil.getSchemaProperty(context, symbolic);
            if (real != null && !real.trim().isEmpty()) {
                return real.trim();
            }
        } catch (Exception ignored) {
            // fall through to the literal
        }
        return fallback;
    }

    @SuppressWarnings("rawtypes")
    private static String str(Map row, String select) {
        Object value = row == null ? null : row.get(select);
        if (value == null) {
            return "";
        }
        if (value instanceof List) {
            List list = (List) value;
            value = list.isEmpty() ? "" : list.get(0);
        }
        return value == null ? "" : value.toString().trim();
    }

    @SuppressWarnings("rawtypes")
    private static boolean isTrue(Map row, String select) {
        return "TRUE".equalsIgnoreCase(str(row, select));
    }

    private static StringList selects(String... names) {
        StringList list = new StringList();
        for (String name : names) {
            list.add(name);
        }
        return list;
    }

    /** The {@code from} side of a relationship on the project - one round trip. */
    private static MapList fromProject(Context context, String projectId, String relName,
                                       String typePattern, StringList busSelects)
            throws Exception {
        MapList rows = new DomainObject(projectId).getRelatedObjects(context,
                relName,            // relationship
                typePattern,        // object type pattern on the far end
                busSelects,
                null,               // no relationship selects needed
                false,              // getTo   - do not walk towards the project
                true,               // getFrom - the project is the FROM end
                (short) 1,          // one level
                null, null, 0);
        if (rows == null) {
            return new MapList();
        }
        rows.sort(DomainConstants.SELECT_NAME, "ascending", "string");
        return rows;
    }

    // ------------------------------------------------------- the reader

    /**
     * Everything the widget's Risks / Opportunities / Key Learnings panels need.
     *
     * @param context   the authenticated platform context
     * @param projectId physical id ({@code 299036CE...}) or legacy id
     *                  ({@code 39261.35329...}); both resolve, verified
     *                  2026-10-07
     * @return a Map of plain Strings, Lists and Maps. Never null, and never
     *         partial without saying so: a section that could not be read
     *         reports its own error rather than looking empty, because an empty
     *         list and a failed read mean entirely different things to whoever
     *         reads the screen.
     * @throws IllegalArgumentException when no project id was given
     */
    @SuppressWarnings("rawtypes")
    public static Map<String, Object> readProjectContext(Context context, String projectId)
            throws Exception {
        if (projectId == null || projectId.trim().isEmpty()) {
            throw new IllegalArgumentException("A project id is required.");
        }
        String id = projectId.trim();

        Map<String, Object> out = new LinkedHashMap<String, Object>();
        out.put("project", readProject(context, id));

        // --- risks and opportunities: ONE call, split by type ---------------
        List<Map<String, Object>> risks = new ArrayList<Map<String, Object>>();
        List<Map<String, Object>> opportunities = new ArrayList<Map<String, Object>>();
        String riskError = "";
        try {
            String titleSelect = "attribute[" + nameOf(context, SYM_ATTR_TITLE, "Title") + "]";
            MapList rows = fromProject(context, id, REL_RISK, DomainConstants.QUERY_WILDCARD,
                    selects(DomainConstants.SELECT_ID, SEL_PHYSICAL_ID,
                            DomainConstants.SELECT_NAME, SEL_REVISION, SEL_TYPE,
                            SEL_CURRENT, SEL_IS_OPPORTUNITY, titleSelect));
            for (int i = 0; i < rows.size(); i++) {
                Map row = (Map) rows.get(i);
                Map<String, Object> item = new LinkedHashMap<String, Object>();
                item.put("id", str(row, DomainConstants.SELECT_ID));
                item.put("physicalId", str(row, SEL_PHYSICAL_ID));
                item.put("no", str(row, DomainConstants.SELECT_NAME));   // R-0000006 / OPP-0000007
                item.put("revision", str(row, SEL_REVISION));
                item.put("title", str(row, titleSelect));
                item.put("state", str(row, SEL_CURRENT));
                item.put("type", str(row, SEL_TYPE));
                // classified by kindof, not by == on the type name, so an IRS
                // subtype of Opportunity still lands in the right list
                if (isTrue(row, SEL_IS_OPPORTUNITY)) {
                    opportunities.add(item);
                } else {
                    risks.add(item);
                }
            }
        } catch (Exception e) {
            riskError = message(e);
        }
        out.put("risks", risks);
        out.put("opportunities", opportunities);

        // --- key learnings: produced here, and reused from elsewhere --------
        Map<String, Object> learnings = new LinkedHashMap<String, Object>();
        String learningError = "";
        List<Map<String, Object>> produced = new ArrayList<Map<String, Object>>();
        List<Map<String, Object>> reused = new ArrayList<Map<String, Object>>();
        try {
            String typeLearning = nameOf(context, SYM_TYPE_LEARNING, "IRSLearning");
            produced = readLearnings(context, id,
                    nameOf(context, SYM_REL_ORIGIN, "IRSProjectLearning"), typeLearning, false);
            reused = readLearnings(context, id,
                    nameOf(context, SYM_REL_REUSED, "IRSProjectReusedLearning"), typeLearning, true);
        } catch (Exception e) {
            learningError = message(e);
        }
        learnings.put("createdInThisProject", produced);
        learnings.put("fromOtherSources", reused);
        learnings.put("error", learningError);
        out.put("learnings", learnings);

        Map<String, Object> counts = new LinkedHashMap<String, Object>();
        counts.put("risks", String.valueOf(risks.size()));
        counts.put("opportunities", String.valueOf(opportunities.size()));
        counts.put("learningsCreatedInThisProject", String.valueOf(produced.size()));
        counts.put("learningsFromOtherSources", String.valueOf(reused.size()));
        out.put("counts", counts);
        out.put("riskError", riskError);

        return out;
    }

    /** The project header: one round trip, every select named at once. */
    @SuppressWarnings("rawtypes")
    private static Map<String, Object> readProject(Context context, String id) throws Exception {
        String title = nameOf(context, SYM_ATTR_TITLE, "Title");
        StringList wanted = selects(DomainConstants.SELECT_ID, SEL_PHYSICAL_ID,
                DomainConstants.SELECT_NAME, SEL_TYPE, SEL_CURRENT,
                "attribute[" + title + "]", "attribute[" + ATTR_PROJECT_NO + "]");

        Map info = new DomainObject(id).getInfo(context, wanted);

        Map<String, Object> project = new LinkedHashMap<String, Object>();
        project.put("id", str(info, DomainConstants.SELECT_ID));
        project.put("physicalId", str(info, SEL_PHYSICAL_ID));
        project.put("name", str(info, DomainConstants.SELECT_NAME));
        project.put("title", str(info, "attribute[" + title + "]"));
        project.put("projectNo", str(info, "attribute[" + ATTR_PROJECT_NO + "]"));
        project.put("type", str(info, SEL_TYPE));
        project.put("state", str(info, SEL_CURRENT));
        return project;
    }

    /**
     * The learnings on one relationship.
     *
     * {@code withOrigin} adds the origin project to each row through a NESTED
     * select - {@code to[IRSProjectLearning].from.*} on the learning - so the
     * whole "a learning from another source, with its project number" answer
     * arrives in the same round trip. Proven on this VM: LRN-0000008, reused by
     * TEST PROJECT, reports origin {@code Solize XYZ} / {@code R&D-26010-HY}.
     *
     * A learning with no origin at all is LEGITIMATE, not an error (WP02 doc
     * 08): R&amp;D-PRJ-01 XII may cite work that predates the system. Such a row
     * comes back with an empty {@code originProject}, and the page must read
     * that as "unknown source", not as a fault.
     */
    @SuppressWarnings("rawtypes")
    private static List<Map<String, Object>> readLearnings(Context context, String projectId,
            String relName, String typeLearning, boolean withOrigin) throws Exception {
        String title = nameOf(context, SYM_ATTR_TITLE, "Title");
        String text = nameOf(context, SYM_ATTR_LEARNING_TEXT, "IRSLearningText");
        String relOrigin = nameOf(context, SYM_REL_ORIGIN, "IRSProjectLearning");

        String originName = "to[" + relOrigin + "].from.name";
        String originTitle = "to[" + relOrigin + "].from.attribute[" + title + "]";
        String originNo = "to[" + relOrigin + "].from.attribute[" + ATTR_PROJECT_NO + "]";
        String originId = "to[" + relOrigin + "].from.physicalid";

        StringList wanted = selects(DomainConstants.SELECT_ID, SEL_PHYSICAL_ID,
                DomainConstants.SELECT_NAME, SEL_CURRENT,
                "attribute[" + title + "]", "attribute[" + text + "]");
        if (withOrigin) {
            wanted.add(originName);
            wanted.add(originTitle);
            wanted.add(originNo);
            wanted.add(originId);
        }

        MapList rows = fromProject(context, projectId, relName, typeLearning, wanted);

        List<Map<String, Object>> out = new ArrayList<Map<String, Object>>(rows.size());
        for (int i = 0; i < rows.size(); i++) {
            Map row = (Map) rows.get(i);
            Map<String, Object> item = new LinkedHashMap<String, Object>();
            item.put("id", str(row, DomainConstants.SELECT_ID));
            item.put("physicalId", str(row, SEL_PHYSICAL_ID));
            item.put("no", str(row, DomainConstants.SELECT_NAME));       // LRN-0000008
            item.put("title", str(row, "attribute[" + title + "]"));
            item.put("text", str(row, "attribute[" + text + "]"));
            item.put("state", str(row, SEL_CURRENT));
            if (withOrigin) {
                Map<String, Object> origin = new LinkedHashMap<String, Object>();
                origin.put("physicalId", str(row, originId));
                origin.put("name", str(row, originName));
                origin.put("title", str(row, originTitle));
                origin.put("projectNo", str(row, originNo));
                item.put("originProject", origin);
            }
            out.add(item);
        }
        return out;
    }

    private static String message(Exception e) {
        String text = e.getMessage();
        return (text == null || text.trim().isEmpty()) ? e.getClass().getName() : text.trim();
    }
}
