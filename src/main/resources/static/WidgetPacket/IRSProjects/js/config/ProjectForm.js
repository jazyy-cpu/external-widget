/**
 * What we capture on a project - the R&D-PRJ-01 catalogue (WGT-04).
 *
 * One ordered list, in the order the printed form asks for it
 * (`R&D-PRJ-01-Rev.06`, sections I to XVI plus header and signature block).
 * The detail page renders straight from this list, so adding a field to the
 * form is a row here and nothing else.
 *
 * Source of truth: WP02 doc 05 "Project subtypes on the VM and the gate-wise
 * attribute matrix", section 12 - every field, created vs not, verified in MQL
 * on 2026-09-23. Keep the two in step: if doc 05 changes, this changes.
 *
 * `kind` says where a field lives, and it is what the UI uses to decide how to
 * draw it. It is not decoration - four of these do not exist on the VM yet and
 * the page must say so rather than show an innocent empty box:
 *
 *   attribute  a real EPM attribute, created: read it from `dataelements`
 *   basic      an OOTB field of the project object (name, state, dates)
 *   subtype    carried by the type itself, not by any field
 *   todo       agreed but NOT created on the VM yet - the page says so
 *   rel        a relationship, and the relationship does not exist yet either
 *   object     modelled as its own OOTB objects - lives on its own tab
 *   wbs        the OOTB work breakdown, not a field
 *   route      an approval step in a Route, not a field
 */
define('IRSProjects/config/ProjectForm', [], function () {
    'use strict';

    var FORM = 'R&D-PRJ-01-Rev.06';

    /**
     * @typedef {Object} FormField
     * @property {string}  ref    the numeral on the printed form ("III"), or "Header" / "Footer"
     * @property {string}  label  what the form calls it
     * @property {string}  kind   see the header comment
     * @property {string} [field] the attribute or basic field name, when kind is attribute/basic
     * @property {string} [tab]   the tab that owns it, when it is not Overview
     * @property {string} [note]  shown as muted help text under the label
     * @property {boolean}[dd]    applicable only to design and development of a new product/service
     */

    /** The body of the form, in printed order. */
    var SECTIONS = [
        { ref: 'I',    label: 'Project Category', kind: 'subtype',
          note: 'Research or Analysis - carried by the project type itself, not by a field' },

        { ref: 'II',   label: 'Customer Name and Contact', kind: 'rel', tab: 'organisation',
          note: 'A Company object linked by IRSProjectCustomer; name, city, country, phone and e-mail all live on it' },

        { ref: 'III',  label: 'Need of the Project', kind: 'attribute', field: 'EPMNeedOfTheProject' },
        { ref: 'IV',   label: 'Project Overview', kind: 'attribute', field: 'EPMProjectOverview' },
        { ref: 'V',    label: 'Scope of Work', kind: 'attribute', field: 'EPMScopeofWork' },
        { ref: 'VI',   label: 'Input - Technical Data, Information and References',
          kind: 'attribute', field: 'EPMInput' },
        { ref: 'VII',  label: 'Methodology', kind: 'attribute', field: 'EPMMethodology' },

        { ref: 'VIII', label: 'Complexity of the design and development activity',
          kind: 'attribute', field: 'EPMComplexity', dd: true },
        { ref: 'IX',   label: 'Identified Standards, Codes, Acts, Rules, Regulations, Statutory and legal requirements',
          kind: 'attribute', field: 'EPMIdentifiedStandards',
          note: 'with version or year, as applicable' },
        { ref: 'X',    label: 'Feedback from previous similar design',
          kind: 'attribute', field: 'EPMFeedback', dd: true },
        { ref: 'XI',   label: 'Potential consequences of failure',
          kind: 'attribute', field: 'EPMPotentialConsequencesOfFailure', dd: true },

        { ref: 'XII',  label: 'Lessons learnt from failures', kind: 'todo', field: 'EPMLessonsLearnt',
          tab: 'lessons', dd: true,
          note: 'The attribute is agreed but not created on the VM yet (doc 05 section 12)' },

        { ref: 'XIII', label: 'Risks and opportunities', kind: 'object', tab: 'risks',
          note: 'Not a text field: OOTB Risk and Opportunity objects linked by the Risk relationship, each with its own RPN scoring (doc 05 section 13.2)' },

        { ref: 'XIV',  label: 'Details of stage-validation, verification and validation',
          kind: 'attribute', field: 'EPMStageValidation' },
        { ref: 'XV',   label: 'Deliverables / Handing Over', kind: 'attribute', field: 'EPMDeliverables' },

        { ref: 'XVI',  label: 'Project Planning: task break-up, sequencing, review stages',
          kind: 'wbs', tab: 'planning',
          note: 'The OOTB work breakdown - Subtask, Task, Phase, Gate, Milestone' }
    ];

    /** The identity block at the top of the form - rendered in the page header. */
    var HEADER = [
        { ref: 'Header', label: 'Project Name', kind: 'basic', field: 'title' },
        { ref: 'Header', label: 'Project No.', kind: 'attribute', field: 'EPMProjectNo',
          note: 'System generated from a numbering scheme (R20) - the scheme is not defined yet' },
        { ref: 'Header', label: 'Department', kind: 'rel', tab: 'organisation',
          note: 'Department object linked by IRSDepartmentProject; the parent Business Unit gives the stream' }
    ];

    /** The signature block - approvals are Route steps, not fields. */
    var FOOTER = [
        { ref: 'Footer', label: 'Approval from Screening Committee obtained',
          kind: 'todo', field: 'EPMScreeningApprovalObtained',
          note: 'YES / NO / Not Applicable - a range attribute, not yet created' },
        { ref: 'Footer', label: 'Project Manager', kind: 'route', tab: 'approvals' },
        { ref: 'Footer', label: 'In-Charge / HOD', kind: 'route', tab: 'approvals' },
        { ref: 'Footer', label: 'Divisional Head', kind: 'route', tab: 'approvals' }
    ];

    /**
     * Agreed in the to-be field table (RSD Figure-16) but not on the printed
     * as-is form, and not created on the VM. Kept separate so the Overview tab
     * can stay faithful to the form while still showing what is coming.
     */
    var PLANNED = [
        { ref: 'Fig-16 r14', label: 'Resources (hardware, software, other technology)',
          kind: 'todo', field: 'EPMResources' },
        { ref: 'Fig-16 r14', label: 'Software used', kind: 'todo', field: 'EPMSoftwareUsed',
          note: 'A drop-down from a software master that does not exist yet' },
        { ref: 'Fig-16 r15', label: 'Required competence / skill',
          kind: 'todo', field: 'EPMRequiredCompetenceSkill',
          note: 'From the WP01 skill master - may become a relationship instead' },
        { ref: 'Fig-16 r20', label: 'Submission of Project', kind: 'todo', field: 'EPMSubmissionOfProject' },
        { ref: 'Fig-16 r22', label: 'DH comment', kind: 'todo', field: 'EPMDHComment' }
    ];

    return {
        FORM: FORM,
        HEADER: HEADER,
        SECTIONS: SECTIONS,
        FOOTER: FOOTER,
        PLANNED: PLANNED,

        /** Everything the form asks for, in printed order. */
        all: function () {
            return HEADER.concat(SECTIONS, FOOTER);
        },

        /** The sections the Overview tab draws itself (the rest belong to other tabs). */
        overview: function () {
            return SECTIONS.filter(function (s) { return !s.tab; });
        },

        /** The sections that point somewhere else, so Overview can link to them. */
        elsewhere: function () {
            return SECTIONS.filter(function (s) { return !!s.tab; });
        },

        /** One field by attribute name, or undefined. */
        byField: function (name) {
            return HEADER.concat(SECTIONS, FOOTER, PLANNED).filter(function (f) {
                return f.field === name;
            })[0];
        },

        /** The attribute names the detail page reads - the created ones only. */
        attributeFields: function () {
            return HEADER.concat(SECTIONS, FOOTER).filter(function (f) {
                return f.kind === 'attribute' && f.field;
            }).map(function (f) { return f.field; });
        }
    };
});
