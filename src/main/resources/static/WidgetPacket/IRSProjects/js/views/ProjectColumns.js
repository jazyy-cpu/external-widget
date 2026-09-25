/**
 * Tabulator column definitions for the project list (WGT-01 section 2).
 *
 * No header filter on any column: the grid has one search control in the
 * toolbar instead (user, 2026-09-24). A filter box under every heading cost a
 * whole row of height and duplicated what the search box does.
 *
 * The headings and the two rendered columns follow the OOTB project grids
 * (user, 2026-09-24 - "try to match with ootb screen, specially status and
 * project type"): **Type** is plain text carrying the platform's own label
 * ("Analysis Project"), and **Maturity State** is a solid badge showing the
 * platform's display name ("Draft", not the MQL `Create`) in the platform's
 * maturity palette. The date headings are the platform's too - Estimated Start
 * / Estimated Finish.
 *
 * The cell value stays the MQL name throughout, so sorting and the state query
 * parameter are unaffected; only the drawn text is translated.
 *
 * Minimum columns to recognise a project - no task data. Everything else is on
 * the detail page, opened by clicking the title.
 *
 * Widths: every column has a minWidth and none is allowed to shrink, so with
 * layout "fitDataFill" a narrow widget gets a horizontal scroll bar instead of
 * squeezed or hidden columns (user, 2026-09-23). Project No. and Title are
 * frozen so they stay readable while scrolling sideways.
 */
define('IRSProjects/views/ProjectColumns', [
    'IRSProjects/config/ProjectFields',
    'IRSProjects/utils/Format'
], function (Fields, Format) {
    'use strict';

    function badgeFormatter(suffixOf, labelOf) {
        return function (cell) {
            var value = cell.getValue();
            if (!value) { return ''; }
            // the cell keeps the platform's MQL name so sorting and the state
            // filter still work; only what is drawn is the display name
            return Format.badge(labelOf ? labelOf(value) : value, suffixOf(value));
        };
    }

    function dateFormatter(cell) {
        return Format.date(cell.getValue());
    }

    /**
     * @param {Function} onOpen  called with the row data when the title is clicked
     */
    return function columns(onOpen) {
        return [
            {
                title: 'Project No.', field: 'projectNo', frozen: true,
                width: 120, minWidth: 100,
                // empty until the numbering rule exists (R20)
                formatter: function (cell) { return cell.getValue() || '—'; }
            },
            {
                title: 'Title', field: 'title', frozen: true,
                width: 240, minWidth: 160,
                cssClass: 'link-primary irs-link',
                cellClick: function (e, cell) { onOpen(cell.getRow().getData()); }
            },
            // plain text, and the platform's own label - exactly as the OOTB
            // project grids print their Type column
            { title: 'Type', field: 'category', width: 150, minWidth: 120 },
            { title: 'Department', field: 'department', width: 140, minWidth: 110 },
            { title: 'Customer', field: 'customer', width: 140, minWidth: 110 },
            {
                title: 'Maturity State', field: 'state', width: 140, minWidth: 120,
                formatter: badgeFormatter(Fields.stateBadge, Fields.stateLabel)
            },
            {
                title: 'Estimated Start', field: 'start', width: 140, minWidth: 120,
                formatter: dateFormatter, sorter: 'string'
            },
            {
                title: 'Estimated Finish', field: 'finish', width: 150, minWidth: 130,
                formatter: dateFormatter, sorter: 'string'
            }
        ];
    };
});
