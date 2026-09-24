/**
 * Tabulator column definitions for the project list (WGT-01 section 2).
 *
 * No header filter on any column: the grid has one search control in the
 * toolbar instead (user, 2026-09-24). A filter box under every heading cost a
 * whole row of height and duplicated what the search box does.
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

    function badgeFormatter(suffixOf) {
        return function (cell) {
            var text = cell.getValue();
            if (!text) { return ''; }
            return Format.badge(text, suffixOf(text));
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
            {
                title: 'Category', field: 'category', width: 110, minWidth: 90,
                formatter: badgeFormatter(function () { return 'secondary'; })
            },
            { title: 'Department', field: 'department', width: 140, minWidth: 110 },
            { title: 'Customer', field: 'customer', width: 140, minWidth: 110 },
            {
                title: 'Status', field: 'state', width: 110, minWidth: 90,
                formatter: badgeFormatter(Fields.stateBadge)
            },
            {
                title: 'Start', field: 'start', width: 110, minWidth: 100,
                formatter: dateFormatter, sorter: 'string'
            },
            {
                title: 'Planned end', field: 'finish', width: 120, minWidth: 110,
                formatter: dateFormatter, sorter: 'string'
            }
        ];
    };
});
