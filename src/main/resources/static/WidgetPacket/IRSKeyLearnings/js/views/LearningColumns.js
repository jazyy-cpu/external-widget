/**
 * Tabulator columns of the register - the user's list of 2026-10-25, in that
 * order, plus State (WP11 O1: every state is shown until IRS decides).
 *
 * Kept apart from the view, as IRSProjects does, so changing what the grid
 * shows never means touching how it loads.
 *
 * EXPORT READS THE FIELD, NOT THE FORMATTER. Tabulator's download writes each
 * row's raw value, so every column's field already holds the text a CSV
 * should carry (members joined, the date as yyyy-mm-dd). The formatters only
 * decorate the screen: a badge, kept line breaks.
 */
define('IRSKeyLearnings/views/LearningColumns', [
    'JazzySole/Format',
    'IRSKeyLearnings/config/LearningFields'
], function (Format, Fields) {
    'use strict';

    function stateBadge(cell) {
        var value = cell.getValue();
        return value ? Format.badge(value, Fields.STATE_BADGE[value] || 'secondary') : '';
    }

    /** Keeps the author's line breaks - "1. ... 2. ..." is how learnings are typed. */
    function lines(cell) {
        var div = document.createElement('div');
        div.className = 'irs-lines';
        div.textContent = cell.getValue() || '';
        return div;
    }

    /** Muted when the user cannot read the project, so it is not read as data. */
    function projectCell(cell) {
        var row = cell.getRow().getData();
        var div = document.createElement('div');
        div.className = 'irs-lines';
        div.textContent = cell.getValue() || '';
        if (row.hasProject && !row.projectAccess) { div.className += ' text-body-secondary fst-italic'; }
        return div;
    }

    function day(cell) {
        var v = cell.getValue();
        return v ? Format.date(v + 'T00:00:00') : '';
    }

    return {
        build: function () {
            return [
                { title: 'Learning No.', field: 'no', width: 120, frozen: true },
                { title: 'Learning', field: 'title', minWidth: 160, widthGrow: 2, formatter: lines },
                { title: 'Key Learning Features', field: 'text', minWidth: 260, widthGrow: 4,
                  formatter: lines, variableHeight: true },
                { title: 'Origin Project', field: 'projectName', minWidth: 160, widthGrow: 2 },
                { title: 'Origin Project No.', field: 'projectNo', width: 140 },
                { title: 'Project Manager', field: 'managerName', minWidth: 150, formatter: projectCell },
                { title: 'Project Members', field: 'membersText', minWidth: 200, widthGrow: 3,
                  formatter: projectCell, variableHeight: true },
                { title: 'Date Originated', field: 'originatedDate', width: 125, formatter: day },
                { title: 'State', field: 'state', width: 95, formatter: stateBadge }
            ];
        }
    };
});
