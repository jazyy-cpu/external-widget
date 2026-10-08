package com.irclass.platform.rest.project;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

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

    /** Ours. The CUSTOMER is the `from` end and the project the `to` end -
     *  the opposite of the learning relationships, verified 2026-10-08. */
    private static final String SYM_REL_CUSTOMER = "relationship_IRSProjectCustomer";

    /** Ours. The DEPARTMENT is the `from` end, the project the `to` end. */
    private static final String SYM_REL_DEPARTMENT = "relationship_IRSDepartmentProject";

    /** OOTB, and it carries the Business Unit that owns a Department. */
    private static final String REL_COMPANY_DEPARTMENT = "Company Department";

    /** DMC. Stored range values carry underscores; the drop-down text is only
     *  a label, so never compare against the pretty version. */
    private static final String ATTR_PROJECT_TYPE = "EPMProjectType";
    private static final String PROJECT_TYPE_EXTERNAL = "External_Projects";
    private static final String PROJECT_TYPE_INTERNAL = "Internal_Projects";

    /** TRUE on a Company, FALSE on a Business Unit or a Department. */
    private static final String SEL_IS_COMPANY = "type.kindof[Company]";

    /**
     * Customer attributes that live on type **Organization**, so Company,
     * Business Unit and Department all carry them - an internal customer
     * answers every one of these.
     */
    private static final String[] ORGANIZATION_ATTRIBUTES = {
        "Organization Name", "Title", "City", "Country", "State/Region",
        "Address", "Postal Code", "Organization Phone Number",
        "Organization Fax Number", "Web Site", "Organization ID"
    };

    /**
     * Customer attributes that exist on type **Company only**. Asking a
     * Business Unit for one is not merely empty - the attribute is not on the
     * type - so these are read in a second call, made only for an external
     * customer.
     */
    private static final String[] COMPANY_ONLY_ATTRIBUTES = { "Email Address" };

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
        return readProjectContext(context, projectId, null);
    }

    /**
     * @param include the sections to read, from {@link #knownSections()}, or
     *        null for every one of them
     */
    @SuppressWarnings("rawtypes")
    public static Map<String, Object> readProjectContext(Context context, String projectId,
            Set<String> include) throws Exception {
        if (projectId == null || projectId.trim().isEmpty()) {
            throw new IllegalArgumentException("A project id is required.");
        }
        String id = projectId.trim();

        Map<String, Object> out = new LinkedHashMap<String, Object>();

        // the header is always read: it costs one round trip and it is what
        // makes a response identifiable as belonging to this project
        out.put("project", readProject(context, id));
        out.put("included", includedNames(include));

        boolean wantRisks = wants(include, S_RISKS);
        boolean wantOpportunities = wants(include, S_OPPORTUNITIES);
        boolean wantCreated = wants(include, S_LEARNINGS_CREATED) || wants(include, S_LEARNINGS);
        boolean wantReused = wants(include, S_LEARNINGS_REUSED) || wants(include, S_LEARNINGS);

        // --- risks and opportunities: ONE call, split by type ---------------
        List<Map<String, Object>> risks = new ArrayList<Map<String, Object>>();
        List<Map<String, Object>> opportunities = new ArrayList<Map<String, Object>>();
        String riskError = "";
        // one relationship carries both kinds, so the call is made when EITHER
        // is asked for and skipped only when neither is
        if (wantRisks || wantOpportunities) {
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
                    item.put("no", str(row, DomainConstants.SELECT_NAME));
                    item.put("revision", str(row, SEL_REVISION));
                    item.put("title", str(row, titleSelect));
                    item.put("state", str(row, SEL_CURRENT));
                    item.put("type", str(row, SEL_TYPE));
                    // classified by kindof, not by == on the type name, so an
                    // IRS subtype of Opportunity still lands in the right list
                    if (isTrue(row, SEL_IS_OPPORTUNITY)) { opportunities.add(item); }
                    else { risks.add(item); }
                }
            } catch (Exception e) {
                riskError = message(e);
            }
        }

        Map<String, Object> counts = new LinkedHashMap<String, Object>();
        // a section that was NOT asked for is absent from the response, rather
        // than present and empty. The caller can then tell "I did not ask" from
        // "there are none", which is the same distinction the error fields keep
        if (wantRisks) {
            out.put("risks", risks);
            counts.put("risks", String.valueOf(risks.size()));
        }
        if (wantOpportunities) {
            out.put("opportunities", opportunities);
            counts.put("opportunities", String.valueOf(opportunities.size()));
        }
        if (wantRisks || wantOpportunities) {
            out.put("riskError", riskError);
        }

        // --- key learnings: produced here, and reused from elsewhere --------
        //
        // The two groups answer two different forms. R&D-PRJ-01 XII asks a
        // PROPOSAL to cite lessons from earlier projects - the reused group -
        // while R&D-COM captures what THIS project produced. So they are
        // separately requestable, and each is its own round trip: asking for
        // one does not pay for the other.
        if (wantCreated || wantReused) {
            Map<String, Object> learnings = new LinkedHashMap<String, Object>();
            String learningError = "";
            List<Map<String, Object>> produced = new ArrayList<Map<String, Object>>();
            List<Map<String, Object>> reused = new ArrayList<Map<String, Object>>();
            try {
                String typeLearning = nameOf(context, SYM_TYPE_LEARNING, "IRSLearning");
                if (wantCreated) {
                    produced = readLearnings(context, id,
                            nameOf(context, SYM_REL_ORIGIN, "IRSProjectLearning"),
                            typeLearning, false);
                }
                if (wantReused) {
                    reused = readLearnings(context, id,
                            nameOf(context, SYM_REL_REUSED, "IRSProjectReusedLearning"),
                            typeLearning, true);
                }
            } catch (Exception e) {
                learningError = message(e);
            }
            if (wantCreated) {
                learnings.put("createdInThisProject", produced);
                counts.put("learningsCreatedInThisProject", String.valueOf(produced.size()));
            }
            if (wantReused) {
                learnings.put("fromOtherSources", reused);
                counts.put("learningsFromOtherSources", String.valueOf(reused.size()));
            }
            learnings.put("error", learningError);
            out.put("learnings", learnings);
        }

        // --- the customer, with the detail its KIND has --------------------
        if (wants(include, S_CUSTOMER)) {
            Map<String, Object> customer;
            try {
                customer = readCustomer(context, id);
            } catch (Exception e) {
                customer = new LinkedHashMap<String, Object>();
                customer.put("error", message(e));
            }
            if (!customer.containsKey("error")) { customer.put("error", ""); }
            out.put("customer", customer);
        }

        // --- the department, and the Business Unit that owns it -----------
        if (wants(include, S_DEPARTMENT)) {
            Map<String, Object> department;
            try {
                department = readDepartment(context, id);
            } catch (Exception e) {
                department = new LinkedHashMap<String, Object>();
                department.put("error", message(e));
            }
            if (!department.containsKey("error")) { department.put("error", ""); }
            out.put("department", department);
        }

        out.put("counts", counts);
        return out;
    }

    // ------------------------------------------------- section selection

    /**
     * The sections a caller may name in {@code $include}.
     *
     * {@code learnings} is the pair; {@code learnings.created} and
     * {@code learnings.reused} are the halves, because the two answer different
     * forms and each costs its own round trip.
     */
    public static final String S_RISKS = "risks";
    public static final String S_OPPORTUNITIES = "opportunities";
    public static final String S_LEARNINGS = "learnings";
    public static final String S_LEARNINGS_CREATED = "learnings.created";
    public static final String S_LEARNINGS_REUSED = "learnings.reused";
    public static final String S_CUSTOMER = "customer";
    public static final String S_DEPARTMENT = "department";

    private static final String[] KNOWN = {
        S_RISKS, S_OPPORTUNITIES, S_LEARNINGS, S_LEARNINGS_CREATED,
        S_LEARNINGS_REUSED, S_CUSTOMER, S_DEPARTMENT
    };

    /** Every section name, for an error message that tells the caller what IS valid. */
    public static List<String> knownSections() {
        return new ArrayList<String>(Arrays.asList(KNOWN));
    }

    public static boolean isKnownSection(String name) {
        for (int i = 0; i < KNOWN.length; i++) {
            if (KNOWN[i].equals(name)) { return true; }
        }
        return false;
    }

    /**
     * Parse an {@code $include} value. Null, empty or absent means EVERYTHING -
     * the pre-existing behaviour, so a caller written before this parameter
     * existed keeps working.
     *
     * @throws IllegalArgumentException naming the offender, because a silently
     *         ignored typo would look exactly like a project with no risks
     */
    public static Set<String> parseInclude(String raw) {
        if (raw == null || raw.trim().isEmpty()) { return null; }
        Set<String> out = new LinkedHashSet<String>();
        String[] parts = raw.split(",");
        for (int i = 0; i < parts.length; i++) {
            String name = parts[i].trim().toLowerCase();
            if (name.isEmpty()) { continue; }
            if (!isKnownSection(name)) {
                throw new IllegalArgumentException("Unknown $include section '" + name
                        + "'. Valid sections: " + join(knownSections()));
            }
            out.add(name);
        }
        // "$include=," and nothing else: treat as not given rather than as
        // "nothing at all", which no caller can have meant
        return out.isEmpty() ? null : out;
    }

    private static boolean wants(Set<String> include, String section) {
        return include == null || include.contains(section);
    }

    /** What the response actually carries, so it is self-describing. */
    private static List<String> includedNames(Set<String> include) {
        List<String> out = new ArrayList<String>();
        if (wants(include, S_RISKS)) { out.add(S_RISKS); }
        if (wants(include, S_OPPORTUNITIES)) { out.add(S_OPPORTUNITIES); }
        if (wants(include, S_LEARNINGS_CREATED) || wants(include, S_LEARNINGS)) {
            out.add(S_LEARNINGS_CREATED);
        }
        if (wants(include, S_LEARNINGS_REUSED) || wants(include, S_LEARNINGS)) {
            out.add(S_LEARNINGS_REUSED);
        }
        if (wants(include, S_CUSTOMER)) { out.add(S_CUSTOMER); }
        if (wants(include, S_DEPARTMENT)) { out.add(S_DEPARTMENT); }
        return out;
    }

    private static String join(List<String> values) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) { out.append(", "); }
            out.append(values.get(i));
        }
        return out.toString();
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

    /**
     * The project's customer, with the detail that its KIND actually has.
     *
     * The rule is the one `IRSProjectUI_mxJPO` already enforces on the AEF
     * form, not a new one:
     *
     * <pre>
     *   External project -&gt; the customer is a Company
     *   Internal project -&gt; the customer is a Business Unit or a Department
     * </pre>
     *
     * so "give me the customer's details" means different fields in the two
     * cases, and the section says which case it is rather than leaving the
     * caller to infer it from blanks.
     *
     * <b>Round trips: one, or two for an external customer.</b> Everything on
     * type {@code Organization} comes back in the first call, because Company,
     * Business Unit and Department all inherit those. {@code Email Address} is
     * on {@code Company} only, so it is fetched in a second call made solely
     * when the customer really is a Company - asking a Business Unit for an
     * attribute its type does not define is not an empty value, it is a bad
     * select.
     *
     * {@code kind} is taken from the customer's own type, not from
     * {@code EPMProjectType}. The two should agree, and when they do not the
     * object wins: the attribute records what was intended, the link records
     * what is there. {@code projectType} is reported alongside so a
     * disagreement is visible rather than silently resolved.
     */
    @SuppressWarnings("rawtypes")
    private static Map<String, Object> readCustomer(Context context, String projectId)
            throws Exception {
        String rel = nameOf(context, SYM_REL_CUSTOMER, "IRSProjectCustomer");
        String from = "to[" + rel + "].from.";

        StringList wanted = selects(from + DomainConstants.SELECT_ID,
                from + SEL_PHYSICAL_ID, from + DomainConstants.SELECT_NAME,
                from + SEL_TYPE, from + SEL_CURRENT, from + SEL_IS_COMPANY,
                "attribute[" + ATTR_PROJECT_TYPE + "]");
        for (int i = 0; i < ORGANIZATION_ATTRIBUTES.length; i++) {
            wanted.add(from + "attribute[" + ORGANIZATION_ATTRIBUTES[i] + "]");
        }

        Map info = new DomainObject(projectId).getInfo(context, wanted);

        Map<String, Object> out = new LinkedHashMap<String, Object>();
        String projectType = str(info, "attribute[" + ATTR_PROJECT_TYPE + "]");
        out.put("projectType", projectType);
        out.put("projectTypeLabel", projectTypeLabel(projectType));

        String customerId = str(info, from + DomainConstants.SELECT_ID);
        if (customerId.isEmpty()) {
            // no customer linked at all. Said explicitly, because an absent
            // link and an unnamed customer are different facts
            out.put("linked", "false");
            out.put("kind", "");
            return out;
        }

        boolean isCompany = isTrue(info, from + SEL_IS_COMPANY);
        out.put("linked", "true");
        out.put("kind", isCompany ? "external" : "internal");
        out.put("id", customerId);
        out.put("physicalId", str(info, from + SEL_PHYSICAL_ID));
        out.put("name", str(info, from + DomainConstants.SELECT_NAME));
        out.put("type", str(info, from + SEL_TYPE));
        out.put("state", str(info, from + SEL_CURRENT));

        Map<String, Object> attributes = new LinkedHashMap<String, Object>();
        for (int i = 0; i < ORGANIZATION_ATTRIBUTES.length; i++) {
            attributes.put(ORGANIZATION_ATTRIBUTES[i],
                    str(info, from + "attribute[" + ORGANIZATION_ATTRIBUTES[i] + "]"));
        }

        // the Company-only half, for an external customer and nobody else
        if (isCompany) {
            StringList extra = new StringList();
            for (int i = 0; i < COMPANY_ONLY_ATTRIBUTES.length; i++) {
                extra.add("attribute[" + COMPANY_ONLY_ATTRIBUTES[i] + "]");
            }
            Map companyInfo = new DomainObject(customerId).getInfo(context, extra);
            for (int i = 0; i < COMPANY_ONLY_ATTRIBUTES.length; i++) {
                attributes.put(COMPANY_ONLY_ATTRIBUTES[i],
                        str(companyInfo, "attribute[" + COMPANY_ONLY_ATTRIBUTES[i] + "]"));
            }
        }

        // The name a screen should print: the organisation's own name, then
        // its title, then the autonamed id - which is `Comp-0000001` and means
        // nothing to a reader, so it is the last resort rather than the first.
        //
        // Placeholders are skipped, and that is not a nicety: BU-0000002 has
        // `Organization Name` = "Unknown" and `Title` = "RDAREA", so a plain
        // first-non-empty choice prints the word **Unknown** as the customer's
        // name. The platform writes these words into unset Organization fields.
        String display = meaningful(attributes.get("Organization Name"));
        if (display.isEmpty()) { display = meaningful(attributes.get("Title")); }
        if (display.isEmpty()) { display = str(info, from + DomainConstants.SELECT_NAME); }
        out.put("displayName", display);

        out.put("attributes", attributes);
        return out;
    }

    /**
     * ENOVIA's own placeholders for an unset Organization field, which are
     * real strings in the database rather than empty values.
     *
     * They are filtered out of the DISPLAY NAME only. The attribute map keeps
     * what the platform stores, because hiding it there would be deciding on
     * the caller's behalf that "Unassigned" carries no information - and a
     * screen that wants to say "country not set" needs to know the difference
     * between that and never having asked.
     */
    private static final String[] PLACEHOLDERS = { "unknown", "unassigned" };

    private static String meaningful(Object value) {
        String text = toText(value);
        for (int i = 0; i < PLACEHOLDERS.length; i++) {
            if (PLACEHOLDERS[i].equalsIgnoreCase(text)) { return ""; }
        }
        return text;
    }

    private static String toText(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    /** The stored range value turned into the words the form uses. */
    private static String projectTypeLabel(String stored) {
        if (PROJECT_TYPE_EXTERNAL.equals(stored)) { return "External Project"; }
        if (PROJECT_TYPE_INTERNAL.equals(stored)) { return "Internal Project"; }
        return stored;
    }

    /**
     * The project's department, and the Business Unit that owns it.
     *
     * <pre>
     *   project  &lt;-IRSDepartmentProject-  Department  &lt;-Company Department-  Business Unit
     * </pre>
     *
     * Both are read in <b>one round trip</b>, the Business Unit through a
     * doubly nested select
     * ({@code to[IRSDepartmentProject].from.to[Company Department].from.*}).
     * That traversal was tested in MQL before being written here rather than
     * assumed: single nesting was already proven by the learning section, two
     * levels was not.
     *
     * Both are returned because the form header shows both, and because the
     * Business Unit is what `IRSProjectUI` calls the stream - a Department
     * name alone does not say which part of the organisation it belongs to.
     *
     * Only identity is returned, no attribute map: the form wants the names.
     * Risks and opportunities were deliberately kept thin for the same reason,
     * and widening is cheaper later than narrowing.
     */
    @SuppressWarnings("rawtypes")
    private static Map<String, Object> readDepartment(Context context, String projectId)
            throws Exception {
        String rel = nameOf(context, SYM_REL_DEPARTMENT, "IRSDepartmentProject");
        String from = "to[" + rel + "].from.";
        String unit = from + "to[" + REL_COMPANY_DEPARTMENT + "].from.";

        StringList wanted = selects(
                from + DomainConstants.SELECT_ID, from + SEL_PHYSICAL_ID,
                from + DomainConstants.SELECT_NAME, from + SEL_TYPE, from + SEL_CURRENT,
                from + "attribute[Organization Name]", from + "attribute[Title]",
                unit + DomainConstants.SELECT_ID, unit + SEL_PHYSICAL_ID,
                unit + DomainConstants.SELECT_NAME, unit + SEL_TYPE,
                unit + "attribute[Organization Name]", unit + "attribute[Title]");

        Map info = new DomainObject(projectId).getInfo(context, wanted);

        Map<String, Object> out = new LinkedHashMap<String, Object>();
        String departmentId = str(info, from + DomainConstants.SELECT_ID);
        if (departmentId.isEmpty()) {
            out.put("linked", "false");
            return out;
        }

        out.put("linked", "true");
        out.put("id", departmentId);
        out.put("physicalId", str(info, from + SEL_PHYSICAL_ID));
        out.put("name", str(info, from + DomainConstants.SELECT_NAME));
        out.put("type", str(info, from + SEL_TYPE));
        out.put("state", str(info, from + SEL_CURRENT));
        out.put("displayName", organizationName(
                str(info, from + "attribute[Organization Name]"),
                str(info, from + "attribute[Title]"),
                str(info, from + DomainConstants.SELECT_NAME)));

        // the owning Business Unit. A Department without one is possible, so
        // it reports its own absence rather than arriving as empty strings
        Map<String, Object> businessUnit = new LinkedHashMap<String, Object>();
        String unitId = str(info, unit + DomainConstants.SELECT_ID);
        if (unitId.isEmpty()) {
            businessUnit.put("linked", "false");
        } else {
            businessUnit.put("linked", "true");
            businessUnit.put("id", unitId);
            businessUnit.put("physicalId", str(info, unit + SEL_PHYSICAL_ID));
            businessUnit.put("name", str(info, unit + DomainConstants.SELECT_NAME));
            businessUnit.put("type", str(info, unit + SEL_TYPE));
            businessUnit.put("displayName", organizationName(
                    str(info, unit + "attribute[Organization Name]"),
                    str(info, unit + "attribute[Title]"),
                    str(info, unit + DomainConstants.SELECT_NAME)));
        }
        out.put("businessUnit", businessUnit);
        return out;
    }

    /**
     * The name to print for an organisation: its own name, then its title,
     * then the autonamed id.
     *
     * The id is last because it is `0000000001` or `BU-0000002` and means
     * nothing to a reader, and the placeholders are skipped because the
     * platform stores the literal word "Unknown" in an unset Organization
     * Name - BU-0000002 has exactly that, with its real name in Title.
     */
    private static String organizationName(String organizationName, String title,
                                           String fallbackName) {
        String display = meaningful(organizationName);
        if (display.isEmpty()) { display = meaningful(title); }
        if (display.isEmpty()) { display = fallbackName; }
        return display;
    }

    private static String message(Exception e) {
        String text = e.getMessage();
        return (text == null || text.trim().isEmpty()) ? e.getClass().getName() : text.trim();
    }
}
