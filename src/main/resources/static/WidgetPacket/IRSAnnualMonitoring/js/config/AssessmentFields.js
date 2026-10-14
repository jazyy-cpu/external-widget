/**
 * The one file to edit when the Annual Monitoring data model changes.
 *
 * Everything here is a decision recorded in WP01 doc 10, not a preference:
 * the point formula, the grade thresholds, the man-day ceiling and the Note
 * text are all from the customer's forms. If one of them changes, it changes
 * here and nowhere else.
 */
define('IRSAnnualMonitoring/config/AssessmentFields', [], function () {
    'use strict';

    /** Our three types, as the platform names them. */
    var TYPES = {
        assessment: 'IRSSkillAssessment',
        report: 'IRSAnnualMonitoring',
        rating: 'IRSDomainRating'
    };

    /** Policy states, in order. One policy governs all three types. */
    var STATES = ['Draft', 'In Assessment', 'Completed'];

    /** Bootstrap badge class per state. */
    var STATE_BADGE = {
        'Draft': 'bg-secondary',
        'In Assessment': 'bg-primary',
        'Completed': 'bg-success'
    };

    /**
     * The points rule.
     *
     * !! NOT UNIVERSAL ANY MORE (2026-10-14). This formula is the **AR /
     * RDAREA** rule only. R&D departments (Hydrodynamics and Multiphysics,
     * Marine and Offshore Structures, Risk and System Reliability Assessment,
     * Long Term Strength Assessment) do not use it at all: their points are
     * TYPED by the HOD from the nature of the work, and their form has no
     * man-days column. Calling points() for an R&D rating would invent a
     * number the rule has no use for.
     *
     * The grid columns differ with it - see doc 10 section 4. This file still
     * carries only the AR rule because the division branch is built with the
     * rating grid, which does not exist yet; it is noted here so the next
     * person does not assume one rule from one function.
     *
     *   Points = min(10, 0.044 x man-days)      per domain, per year
     *
     * 0.044 x 228 = 10.032, so a full year in one domain lands just over the
     * cap - which is why the forms say a MAXIMUM of ten. The min() is not
     * optional.
     *
     * THIS IS FOR FEEDBACK ONLY. The server computes and stores the value from
     * the stored man-days; the browser recomputes it so the HOD sees the effect
     * while typing. If the two ever disagree, the server is right.
     */
    var POINTS_FACTOR = 0.044;
    var POINTS_CAP = 10;

    /** Working man-days available in a full year, from the RDAREA form note. */
    var MANDAYS_PER_YEAR = 228;

    function points(mandays) {
        var m = Number(mandays);
        if (!isFinite(m) || m <= 0) { return 0; }
        return Math.min(POINTS_CAP, POINTS_FACTOR * m);
    }

    /**
     * Grade from accumulated + current. The A and B thresholds are printed on
     * every AM form. The C threshold and "Not Assessed" are OUR inference and
     * are not on any form - doc 10 open question Q1, still unconfirmed.
     */
    function grade(total) {
        var t = Number(total);
        if (!isFinite(t) || t <= 0) { return 'Not Assessed'; }
        if (t >= 20) { return 'A'; }
        if (t >= 10) { return 'B'; }
        return 'C';
    }

    var GRADE_MEANING = {
        'A': 'Reviewer',
        'B': 'Independent',
        'C': 'Under Supervision',
        'Not Assessed': 'Not assessed'
    };

    function gradeClass(g) {
        if (g === 'A' || g === 'B' || g === 'C') { return 'irs-grade-' + g; }
        return 'irs-grade-none';
    }

    /**
     * The Note block, rendered UNDER the rating table.
     *
     * Not decoration: the customer annotated the form with "Grade Calculation
     * Rules (Show This table in this form)", so the rule text is part of the
     * report. Wording follows the RDAREA note, which is the one the system now
     * implements - the R&D forms still print the older allocation rule and no
     * longer match (doc 10 section 1).
     */
    var NOTE = {
        heading: 'Grade calculation rules',
        lines: [
            'Points allocation scheme: in a year, a maximum of 10 points, for a domain, ' +
                'can be given on a pro rata basis using the equation: ' +
                'Points = 0.044 x (man-days spent), considering average 228 working ' +
                'man-days are available annually.',
            'Achieving 10 points will become Grade B and 20 points will become Grade A in a domain.'
        ],
        grades: 'Grade A: Reviewer.   Grade B: Independent.   Grade C: Under Supervision.'
    };



    /**
     * The financial year runs April to March (doc 10 section 10.3). Returns the
     * default range for "today", which the HOD may then change - a department
     * is allowed two rounds in one year.
     */
    function defaultRange(today) {
        var now = today || new Date();
        var year = now.getFullYear();
        // Before April, the current financial year started last April.
        if (now.getMonth() < 3) { year = year - 1; }
        return {
            year: year,
            start: year + '-04-01',
            end: (year + 1) + '-03-31'
        };
    }

    /**
     * Does an item overlap the assessment range?
     *
     * The rule is an OVERLAP test, deliberately NOT "start or end inside the
     * range" - that wording drops an item that spans the whole range, which is
     * exactly the long project a monitoring report should include. An empty end
     * date means still running, and still counts. Doc 10 section 10.3.
     */
    function overlaps(itemStart, itemEnd, rangeStart, rangeEnd) {
        if (!itemStart) { return false; }
        if (itemStart > rangeEnd) { return false; }
        if (!itemEnd) { return true; }
        return itemEnd >= rangeStart;
    }

    return {
        TYPES: TYPES,
        STATES: STATES,
        STATE_BADGE: STATE_BADGE,
        POINTS_FACTOR: POINTS_FACTOR,
        POINTS_CAP: POINTS_CAP,
        MANDAYS_PER_YEAR: MANDAYS_PER_YEAR,
        NOTE: NOTE,
        GRADE_MEANING: GRADE_MEANING,
        points: points,
        grade: grade,
        gradeClass: gradeClass,
        defaultRange: defaultRange,
        overlaps: overlaps
    };
});
